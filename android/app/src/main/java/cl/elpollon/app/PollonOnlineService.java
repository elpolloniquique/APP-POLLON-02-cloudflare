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
import android.os.PowerManager;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * FGS nativo: GPS → Cloudflare (el-pollon.cl) con pantalla apagada u otra app.
 * Se mantiene desde que acepta un pedido hasta Pedido entregado.
 */
public class PollonOnlineService extends Service implements LocationListener {
    public static final String CHANNEL_ID = "pollon_online_v1";
    public static final int NOTIF_ID = 73001;
    private static final long ACTIVE_INTERVAL_MS = 8_000L;
    private static final float ACTIVE_DISTANCE_M = 8f;
    private static final long IDLE_INTERVAL_MS = 45_000L;
    private static final float IDLE_DISTANCE_M = 40f;

    private LocationManager locationManager;
    private HandlerThread ioThread;
    private Handler ioHandler;
    private PowerManager.WakeLock wakeLock;
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
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pollon:gps");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(12L * 60L * 60L * 1000L);
            }
        } catch (Exception ignored) {}
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
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
            wakeLock = null;
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
        boolean active = PollonPrefs.activeTracking(this);
        builder
            .setSmallIcon(R.drawable.ic_stat_pollon)
            .setContentTitle(active ? "El Pollón · En ruta" : "El Pollón · En línea")
            .setContentText(active
                ? "Entrega en curso. Admin y caja te ven aunque apagues la pantalla."
                : "Disponible para pedidos. No detengas esta notificación.")
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
        long interval = PollonPrefs.activeTracking(this) ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
        float distance = PollonPrefs.activeTracking(this) ? ACTIVE_DISTANCE_M : IDLE_DISTANCE_M;
        try {
            locationManager.removeUpdates(this);
        } catch (Exception ignored) {}
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, interval, distance, this
            );
        } catch (Exception ignored) {}
        try {
            locationManager.requestLocationUpdates(
                LocationManager.NETWORK_PROVIDER, interval, distance, this
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
        if (Math.abs(location.getLatitude()) < 0.001 && Math.abs(location.getLongitude()) < 0.001) return;
        long now = System.currentTimeMillis();
        long minInterval = PollonPrefs.activeTracking(this) ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
        if (lastPingAt > 0 && now - lastPingAt < minInterval) return;
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
