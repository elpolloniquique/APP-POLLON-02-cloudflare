package cl.elpollon.app;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.util.concurrent.TimeUnit;

/** Watchdog 15 min: si el conductor sigue Disponible y el JS/Capgo calló, relanza el FGS. */
public class PollonOnlineWorker extends Worker {
    public static final String UNIQUE = "pollon_online_watchdog";
    private static final long JS_FRESH_MS = 3L * 60L * 1000L;

    public PollonOnlineWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    public static void schedule(Context context) {
        try {
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(
                PollonOnlineWorker.class, 15, TimeUnit.MINUTES
            ).build();
            WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(UNIQUE, ExistingPeriodicWorkPolicy.KEEP, req);
        } catch (Exception ignored) {}
    }

    public static void cancel(Context context) {
        try {
            WorkManager.getInstance(context.getApplicationContext()).cancelUniqueWork(UNIQUE);
        } catch (Exception ignored) {}
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        if (!PollonPrefs.wantOnline(ctx)) return Result.success();
        if (PollonPrefs.jsGpsFresh(ctx, JS_FRESH_MS)) return Result.success();
        PollonOnlineService.start(ctx);
        return Result.success();
    }
}
