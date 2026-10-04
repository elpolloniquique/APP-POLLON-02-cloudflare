package cl.elpollon.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restaura GPS “En línea” tras reinicio o actualización de la APK. */
public class PollonBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;
        boolean boot = Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            || "android.intent.action.QUICKBOOT_POWERON".equals(action);
        if (!boot) return;
        if (!PollonPrefs.wantOnline(context)) return;
        PollonOnlineWorker.schedule(context);
        PollonOnlineService.start(context);
    }
}
