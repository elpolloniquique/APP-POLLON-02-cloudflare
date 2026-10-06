package cl.elpollon.app;

import android.content.Context;
import android.content.SharedPreferences;

/** Sesión “en línea” para restaurar GPS tras reinicio o muerte del proceso. */
final class PollonPrefs {
    private static final String NAME = "pollon_driver";
    static final String WANT_ONLINE = "want_online";
    static final String PING_URL = "ping_url";
    static final String LAST_JS_GPS_AT = "last_js_gps_at";
    static final String ASKED_BATTERY = "asked_battery";
    static final String ACTIVE_TRACKING = "active_tracking";

    private PollonPrefs() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static boolean wantOnline(Context context) {
        return prefs(context).getBoolean(WANT_ONLINE, false);
    }

    static String pingUrl(Context context) {
        return prefs(context).getString(PING_URL, "");
    }

    static long lastJsGpsAt(Context context) {
        return prefs(context).getLong(LAST_JS_GPS_AT, 0L);
    }

    static boolean jsGpsFresh(Context context, long maxAgeMs) {
        long at = lastJsGpsAt(context);
        return at > 0 && (System.currentTimeMillis() - at) < maxAgeMs;
    }

    static void setOnlineSession(Context context, String pingUrl, boolean active) {
        prefs(context).edit()
            .putBoolean(WANT_ONLINE, true)
            .putBoolean(ACTIVE_TRACKING, active)
            .putString(PING_URL, pingUrl == null ? "" : pingUrl)
            .putLong(LAST_JS_GPS_AT, System.currentTimeMillis())
            .apply();
    }

    static boolean activeTracking(Context context) {
        return prefs(context).getBoolean(ACTIVE_TRACKING, false);
    }

    static void touchJsGps(Context context) {
        prefs(context).edit().putLong(LAST_JS_GPS_AT, System.currentTimeMillis()).apply();
    }

    static boolean askedBattery(Context context) {
        return prefs(context).getBoolean(ASKED_BATTERY, false);
    }

    static void markAskedBattery(Context context) {
        prefs(context).edit().putBoolean(ASKED_BATTERY, true).apply();
    }

    static void clearOnlineSession(Context context) {
        prefs(context).edit()
            .putBoolean(WANT_ONLINE, false)
            .putBoolean(ACTIVE_TRACKING, false)
            .remove(PING_URL)
            .remove(LAST_JS_GPS_AT)
            .apply();
    }
}
