package cl.elpollon.app;

import android.content.Context;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;

/**
 * Alarma nativa de pedido nuevo: 3 tonos fuertes.
 * La notificación sticky permanece en bandeja hasta aceptar/rechazar.
 */
final class OfferAlarmPlayer {
    private static final int BEATS = 3;
    private static final int BEAT_MS = 1400;
    private static final int TONE_MS = 900;

    private static ToneGenerator tone;
    private static Handler handler;
    private static PowerManager.WakeLock wakeLock;
    private static int remaining;
    private static final Runnable beat = OfferAlarmPlayer::playBeat;

    private OfferAlarmPlayer() {}

    static synchronized void start(Context context) {
        stopInternal(false);
        Context app = context.getApplicationContext();
        remaining = BEATS;

        try {
            PowerManager pm = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ElPollon::OfferAlarm");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(BEATS * BEAT_MS + 3000L);
            }
        } catch (Exception ignored) {}

        ensureTone();
        if (tone == null) return;
        handler = new Handler(Looper.getMainLooper());
        playBeat();
    }

    static synchronized void stop() {
        stopInternal(true);
    }

    private static void stopInternal(boolean releaseAll) {
        remaining = 0;
        if (handler != null) {
            handler.removeCallbacks(beat);
            handler = null;
        }
        if (tone != null) {
            try {
                tone.stopTone();
                tone.release();
            } catch (Exception ignored) {}
            tone = null;
        }
        if (wakeLock != null) {
            try {
                if (wakeLock.isHeld()) wakeLock.release();
            } catch (Exception ignored) {}
            wakeLock = null;
        }
    }

    private static void ensureTone() {
        if (tone != null) return;
        try {
            tone = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
        } catch (Exception e) {
            try {
                tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100);
            } catch (Exception ignored) {}
        }
    }

    private static synchronized void playBeat() {
        if (remaining <= 0) {
            stop();
            return;
        }
        ensureTone();
        if (tone == null) {
            stop();
            return;
        }
        remaining -= 1;
        try {
            tone.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, TONE_MS);
        } catch (Exception e) {
            try {
                if (tone != null) tone.release();
            } catch (Exception ignored) {}
            tone = null;
            ensureTone();
        }
        if (remaining > 0 && handler != null) {
            handler.postDelayed(beat, BEAT_MS);
        } else if (handler != null) {
            handler.postDelayed(OfferAlarmPlayer::stop, 1000);
        }
    }
}
