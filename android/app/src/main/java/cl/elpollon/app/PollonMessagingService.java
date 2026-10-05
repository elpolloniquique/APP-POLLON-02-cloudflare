package cl.elpollon.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Bandeja tipo WhatsApp: FCM notification+data pinta el aviso con la app
 * cerrada / otra app / pantalla apagada. Un tag por pedido (reemplaza, no duplica).
 * En primer plano no se pinta bandeja: el pedido ya se ve en la app, sin alarma.
 */
public class PollonMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "pollon_driver_offer_v4";
    public static final int NOTIF_ID = 72001;
    public static final int NOTIF_ID_SPAN = 8000;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        showOfferNotification(remoteMessage);
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Exception ignored) {
            /* plugin aún no listo */
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Exception ignored) {}
    }

    private void showOfferNotification(RemoteMessage msg) {
        Map<String, String> data = msg.getData();
        RemoteMessage.Notification n = msg.getNotification();

        // Con payload notification, Android ya muestra la bandeja (app cerrada / otra app).
        // En primer plano el pedido se ve en la lista: no alarma ni aviso extra.
        if (n != null) return;

        String title = str(data, "title", "El Pollón · Pedido nuevo");
        String body = str(data, "body", "Tienes un pedido nuevo. Ábrelo para aceptar.");
        String offerId = str(data, "offerId", "offer");
        String jobId = str(data, "jobId", offerId);
        String tag = str(data, "tag", "");
        if (tag.isEmpty()) tag = "pollon-job-" + jobId;
        String deepLink = str(data, "deepLink", "");
        if (deepLink.isEmpty() || !deepLink.startsWith("/")) {
            deepLink = "/repartidor/oferta/" + offerId;
        }

        ensureChannel(this);

        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) launch = new Intent(this, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("deepLink", deepLink);
        launch.putExtra("offerId", offerId);
        launch.setData(Uri.parse("elpollon://repartidor/oferta/" + Uri.encode(offerId)));

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        int req = Math.abs(offerId.hashCode());
        PendingIntent content = PendingIntent.getActivity(this, req, launch, flags);

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
            builder.setPriority(Notification.PRIORITY_MAX);
        }

        builder
            .setSmallIcon(R.drawable.ic_stat_pollon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setContentIntent(content)
            .setAutoCancel(true)
            .setOngoing(false)
            .setOnlyAlertOnce(false)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setDefaults(Notification.DEFAULT_LIGHTS | Notification.DEFAULT_VIBRATE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setColor(0xFFE11D48);
        }

        Notification notif = builder.build();

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        int notifId = stableNotifId(jobId, offerId);
        if (nm != null) {
            nm.notify(tag, notifId, notif);
        }

        try {
            BadgeHelper.apply(this, 1);
        } catch (Exception ignored) {}
    }

    static void cancelOfferByJob(Context context, String jobId, String offerId) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        String tag = (jobId != null && !jobId.isEmpty()) ? ("pollon-job-" + jobId) : "";
        int id = stableNotifId(jobId, offerId);
        try {
            if (!tag.isEmpty()) {
                nm.cancel(tag, 0);
                nm.cancel(tag, id);
            }
            nm.cancel(id);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.service.notification.StatusBarNotification[] notes = nm.getActiveNotifications();
                if (notes != null) {
                    for (android.service.notification.StatusBarNotification note : notes) {
                        String noteTag = note.getTag();
                        if (tag.isEmpty()) continue;
                        if (tag.equals(noteTag)) {
                            nm.cancel(noteTag, note.getId());
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    static void cancelOfferNotifications(Context context) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.cancel(NOTIF_ID);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.service.notification.StatusBarNotification[] notes = nm.getActiveNotifications();
                if (notes != null) {
                    for (android.service.notification.StatusBarNotification note : notes) {
                        int id = note.getId();
                        String tag = note.getTag();
                        if ((id >= NOTIF_ID && id < NOTIF_ID + NOTIF_ID_SPAN)
                            || (tag != null && tag.startsWith("pollon-job-"))) {
                            if (tag != null) nm.cancel(tag, id);
                            else nm.cancel(id);
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "Pedidos nuevos",
            NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription("Aviso de pedido nuevo, igual que WhatsApp, con pantalla apagada o app cerrada");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] { 0, 400, 200, 400 });
        ch.enableLights(true);
        ch.setLightColor(0xFFE11D48);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setBypassDnd(true);
        ch.setShowBadge(true);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        ch.setSound(sound, attrs);
        nm.createNotificationChannel(ch);
    }

    static int stableNotifId(String jobId, String offerId) {
        String key = (jobId != null && !jobId.isEmpty()) ? jobId : String.valueOf(offerId);
        return NOTIF_ID + (Math.abs(key.hashCode()) % NOTIF_ID_SPAN);
    }

    private static String str(Map<String, String> data, String key, String fallback) {
        if (data == null) return fallback;
        String v = data.get(key);
        return (v == null || v.isEmpty()) ? fallback : v;
    }
}
