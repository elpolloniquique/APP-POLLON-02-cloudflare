package cl.elpollon.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * FGS de respaldo: GPS → Cloudflare KV mientras el conductor está Disponible.
 * Lo usa boot / watchdog. Con la app abierta Capgo toma el relevo.
 */
public class PollonOnlineService extends Service implements LocationListener {
    public static final String CHANNEL_ID = "pollon_online_v1";
    public static final int NOTIF_ID = 73001;
    private static final long MIN_INTERVAL_MS = 75_000L;
    private static final float MIN_DISTANCE_M = 80f;

    private LocationManager locationManager;
    private HandlerThread ioThread;
    private Handler ioHandler;
    private long lastPingAt;

    public static void start(Context context) {
        if (!PollonPrefs.wantOnline(context)) return;
        if (PollonPrefs.pingUrl(context).isEmpty()) return;
        Intent i = new Intent(context, PollonOnlineService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(i);
            } else {
                context.startService(i);
            }
        } catch (Exception ignored) {
            /* OEM / permiso */
        }
    }

    public static void stop(Context context) {
        try {
            context.stopService(new Intent(context, PollonOnlineService.class));
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel(this);
        ioThread = new HandlerThread("pollon-online-io");
        ioThread.start();
        ioHandler = new Handler(ioThread.getLooper());
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!PollonPrefs.wantOnline(this) || PollonPrefs.pingUrl(this).isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startAsForeground();
        requestUpdates();
        pingLastKnown();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (Exception ignored) {}
        }
        if (ioThread != null) {
            ioThread.quitSafely();
            ioThread = null;
            ioHandler = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onLocationChanged(@NonNull Location location) {
        enqueuePing(location);
    }

    @Override
    public void onProviderEnabled(@NonNull String provider) {}

    @Override
    public void onProviderDisabled(@NonNull String provider) {}

    @Override
    @Deprecated
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    private void startAsForeground() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) launch = new Intent(this, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("deepLink", "/repartidor");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent content = PendingIntent.getActivity(this, 73001, launch, flags);

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
            builder.setPriority(Notification.PRIORITY_LOW);
        }
        builder
            .setSmallIcon(R.drawable.ic_stat_pollon)
            .setContentTitle("El Pollón · En línea")
            .setContentText("Disponible para pedidos. No detengas esta notificación.")
            .setContentIntent(content)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE);

        Notification notif = builder.build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, notif);
        }
    }

    private void requestUpdates() {
        if (locationManager == null) return;
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        try {
            locationManager.removeUpdates(this);
        } catch (Exception ignored) {}
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, MIN_INTERVAL_MS, MIN_DISTANCE_M, this
            );
        } catch (Exception ignored) {}
        try {
            locationManager.requestLocationUpdates(
                LocationManager.NETWORK_PROVIDER, MIN_INTERVAL_MS, MIN_DISTANCE_M, this
            );
        } catch (Exception ignored) {}
    }

    private void pingLastKnown() {
        if (locationManager == null) return;
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        Location best = null;
        try {
            best = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        } catch (Exception ignored) {}
        if (best == null) {
            try {
                best = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            } catch (Exception ignored) {}
        }
        if (best != null) enqueuePing(best);
    }

    private void enqueuePing(Location location) {
        if (location == null || ioHandler == null) return;
        long now = System.currentTimeMillis();
        if (lastPingAt > 0 && now - lastPingAt < MIN_INTERVAL_MS) return;
        lastPingAt = now;
        final double lat = location.getLatitude();
        final double lng = location.getLongitude();
        final Float acc = location.hasAccuracy() ? location.getAccuracy() : null;
        final String url = PollonPrefs.pingUrl(this);
        ioHandler.post(() -> postPing(url, lat, lng, acc));
    }

    static void postPing(String pingUrl, double lat, double lng, Float accuracy) {
        if (pingUrl == null || pingUrl.isEmpty()) return;
        HttpURLConnection conn = null;
        try {
            URL url = new URL(pingUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Content-Type", "application/json");
            String json = "{\"latitude\":" + lat + ",\"longitude\":" + lng
                + (accuracy != null ? ",\"accuracy\":" + accuracy : "") + "}";
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            OutputStream os = conn.getOutputStream();
            os.write(bytes);
            os.flush();
            conn.getInputStream().close();
        } catch (Exception ignored) {
            /* siguiente tick */
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "El Pollón · En línea",
            NotificationManager.IMPORTANCE_LOW
        );
        ch.setDescription("Ubicación en vivo mientras estás Disponible");
        ch.setShowBadge(false);
        ch.enableVibration(false);
        ch.setSound(null, null);
        nm.createNotificationChannel(ch);
    }
}
