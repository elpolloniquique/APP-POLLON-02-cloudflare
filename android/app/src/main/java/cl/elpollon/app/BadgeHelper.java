package cl.elpollon.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;

/** Badge del ícono tipo WhatsApp (Samsung / Xiaomi / Huawei / OPPO / Vivo / Sony). */
final class BadgeHelper {
    private BadgeHelper() {}

    static void apply(Context context, int count) {
        int n = Math.max(0, count);
        String pkg = context.getPackageName();
        String cls = MainActivity.class.getName();
        trySamsung(context, pkg, cls, n);
        tryXiaomi(context, pkg, cls, n);
        tryHuawei(context, pkg, cls, n);
        trySony(context, pkg, cls, n);
        tryOppo(context, pkg, n);
        tryVivo(context, pkg, cls, n);
        tryApex(context, pkg, cls, n);
    }

    private static void trySamsung(Context ctx, String pkg, String cls, int n) {
        try {
            Intent i = new Intent("android.intent.action.BADGE_COUNT_UPDATE");
            i.putExtra("badge_count", n);
            i.putExtra("badge_count_package_name", pkg);
            i.putExtra("badge_count_class_name", cls);
            ctx.sendBroadcast(i);
        } catch (Exception ignored) {}
    }

    private static void tryXiaomi(Context ctx, String pkg, String cls, int n) {
        try {
            Intent i = new Intent("android.intent.action.APPLICATION_MESSAGE_UPDATE");
            i.putExtra("android.intent.extra.update_application_component_name", pkg + "/" + cls);
            i.putExtra("android.intent.extra.update_application_message_text", n <= 0 ? "" : String.valueOf(n));
            ctx.sendBroadcast(i);
        } catch (Exception ignored) {}
        try {
            Object miui = Class.forName("android.app.MiuiNotification").getConstructor().newInstance();
            miui.getClass().getDeclaredField("messageCount").setAccessible(true);
            miui.getClass().getDeclaredField("messageCount").set(miui, n);
        } catch (Exception ignored) {}
    }

    private static void tryHuawei(Context ctx, String pkg, String cls, int n) {
        try {
            Bundle extra = new Bundle();
            extra.putString("package", pkg);
            extra.putString("class", cls);
            extra.putInt("badgenumber", n);
            ctx.getContentResolver().call(
                Uri.parse("content://com.huawei.android.launcher.settings/badge/"),
                "change_badge",
                null,
                extra
            );
        } catch (Exception ignored) {}
    }

    private static void trySony(Context ctx, String pkg, String cls, int n) {
        try {
            Intent i = new Intent("com.sonyericsson.home.action.UPDATE_BADGE");
            i.putExtra("com.sonyericsson.home.intent.extra.badge.ACTIVITY_NAME", cls);
            i.putExtra("com.sonyericsson.home.intent.extra.badge.SHOW_MESSAGE", n > 0);
            i.putExtra("com.sonyericsson.home.intent.extra.badge.MESSAGE", String.valueOf(n));
            i.putExtra("com.sonyericsson.home.intent.extra.badge.PACKAGE_NAME", pkg);
            ctx.sendBroadcast(i);
        } catch (Exception ignored) {}
    }

    private static void tryOppo(Context ctx, String pkg, int n) {
        try {
            Bundle extra = new Bundle();
            extra.putInt("app_badge_count", n);
            extra.putString("app_badge_packageName", pkg);
            ctx.getContentResolver().call(
                Uri.parse("content://com.android.badge/badge"),
                "setAppBadgeCount",
                null,
                extra
            );
        } catch (Exception ignored) {}
    }

    private static void tryVivo(Context ctx, String pkg, String cls, int n) {
        try {
            Intent i = new Intent("launcher.action.CHANGE_APPLICATION_NOTIFICATION_NUM");
            i.putExtra("packageName", pkg);
            i.putExtra("className", cls);
            i.putExtra("notificationNum", n);
            ctx.sendBroadcast(i);
        } catch (Exception ignored) {}
    }

    private static void tryApex(Context ctx, String pkg, String cls, int n) {
        try {
            Intent i = new Intent("com.anddoes.launcher.COUNTER_CHANGED");
            i.putExtra("package", pkg);
            i.putExtra("count", n);
            i.putExtra("class", cls);
            ctx.sendBroadcast(i);
        } catch (Exception ignored) {}
    }

    @SuppressWarnings("unused")
    static boolean hasLauncher(Context ctx, String packageName) {
        try {
            ctx.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
