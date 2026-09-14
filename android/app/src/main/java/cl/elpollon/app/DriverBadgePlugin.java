package cl.elpollon.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DriverBadge")
public class DriverBadgePlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        int count = 0;
        try {
            Integer v = call.getInt("count");
            if (v != null) count = v;
        } catch (Exception ignored) {}
        BadgeHelper.apply(getContext(), count);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        BadgeHelper.apply(getContext(), 0);
        call.resolve();
    }

    @PluginMethod
    public void stopOfferAlarm(PluginCall call) {
        OfferAlarmPlayer.stop();
        try {
            android.app.NotificationManager nm =
                (android.app.NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(PollonMessagingService.NOTIF_ID);
        } catch (Exception ignored) {}
        call.resolve();
    }
}
