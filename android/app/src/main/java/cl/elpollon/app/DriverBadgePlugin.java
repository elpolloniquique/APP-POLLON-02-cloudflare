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
        call.resolve();
    }

    @PluginMethod
    public void cancelOffer(PluginCall call) {
        String jobId = call.getString("jobId", "");
        String offerId = call.getString("offerId", "");
        try {
            PollonMessagingService.cancelOfferByJob(getContext(), jobId, offerId);
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void setOnlineSession(PluginCall call) {
        String pingUrl = call.getString("pingUrl", "");
        boolean want = call.getBoolean("wantOnline", true);
        if (want && pingUrl != null && !pingUrl.isEmpty()) {
            PollonPrefs.setOnlineSession(getContext(), pingUrl);
            PollonOnlineWorker.schedule(getContext());
            PollonOnlineService.stop(getContext());
        } else {
            PollonPrefs.clearOnlineSession(getContext());
            PollonOnlineWorker.cancel(getContext());
            PollonOnlineService.stop(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void clearOnlineSession(PluginCall call) {
        PollonPrefs.clearOnlineSession(getContext());
        PollonOnlineWorker.cancel(getContext());
        PollonOnlineService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void touchOnlineHeartbeat(PluginCall call) {
        PollonPrefs.touchJsGps(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stopOnlineService(PluginCall call) {
        PollonOnlineService.stop(getContext());
        call.resolve();
    }
}
