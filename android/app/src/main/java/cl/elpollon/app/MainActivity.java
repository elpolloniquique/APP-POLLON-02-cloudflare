package cl.elpollon.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private int safeTopPx;
    private int safeBottomPx;
    private int safeLeftPx;
    private int safeRightPx;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DriverBadgePlugin.class);
        super.onCreate(savedInstanceState);
        PollonMessagingService.ensureChannel(this);
        PollonOnlineService.ensureChannel(this);
        requestIgnoreBatteryOptimizations();
        listenSystemInsets();
        scheduleSafeAreaInjects();
        if (PollonPrefs.wantOnline(this)) {
            PollonOnlineWorker.schedule(this);
        }
        applyDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyDeepLink(intent);
    }

    @Override
    public void onStart() {
        super.onStart();
        scheduleSafeAreaInjects();
    }

    @Override
    public void onResume() {
        super.onResume();
        resumeWebView();
        scheduleSafeAreaInjects();
    }

    /**
     * Android 15/16 pinta la app debajo de hora, batería y botones.
     * No se recorta la WebView: se pasan los márgenes al CSS para
     * bajar logo/Salir y subir la barra de pestañas.
     */
    private void listenSystemInsets() {
        try {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(0x00000000);
            getWindow().setNavigationBarColor(0x00000000);
            View decor = getWindow().getDecorView();
            ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
                Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                safeTopPx = Math.max(bars.top, statusBarFallbackPx());
                safeBottomPx = Math.max(bars.bottom, 0);
                safeLeftPx = Math.max(bars.left, 0);
                safeRightPx = Math.max(bars.right, 0);
                injectSafeAreaCss();
                return insets;
            });
            ViewCompat.requestApplyInsets(decor);
        } catch (Exception ignored) {
            safeTopPx = statusBarFallbackPx();
            injectSafeAreaCss();
        }
    }

    private int statusBarFallbackPx() {
        try {
            int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (id > 0) return getResources().getDimensionPixelSize(id);
        } catch (Exception ignored) {
            /* ignore */
        }
        return Math.round(24f * getResources().getDisplayMetrics().density);
    }

    private void scheduleSafeAreaInjects() {
        injectSafeAreaCss();
        mainHandler.postDelayed(this::injectSafeAreaCss, 250);
        mainHandler.postDelayed(this::injectSafeAreaCss, 800);
        mainHandler.postDelayed(this::injectSafeAreaCss, 1800);
    }

    private void injectSafeAreaCss() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        float density = getResources().getDisplayMetrics().density;
        if (density <= 0f) density = 1f;
        int top = Math.max(Math.round(safeTopPx / density), 24);
        int bottom = Math.max(Math.round(safeBottomPx / density), 0);
        int left = Math.max(Math.round(safeLeftPx / density), 0);
        int right = Math.round(safeRightPx / density);
        String js = "(function(){var r=document.documentElement;"
            + "r.classList.add('is-native-app');"
            + "r.style.setProperty('--sat','" + top + "px');"
            + "r.style.setProperty('--sab','" + bottom + "px');"
            + "r.style.setProperty('--sal','" + left + "px');"
            + "r.style.setProperty('--sar','" + right + "px');"
            + "})();";
        try {
            getBridge().getWebView().evaluateJavascript(js, null);
        } catch (Exception ignored) {
            /* WebView aún no lista */
        }
    }

    /**
     * Sin esto Xiaomi/Huawei/Samsung matan el GPS a los pocos minutos
     * con pantalla apagada u otra app en primer plano.
     */
    private void resumeWebView() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            getBridge().getWebView().onResume();
            getBridge().getWebView().resumeTimers();
        } catch (Exception ignored) {}
    }

    private void requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            if (pm.isIgnoringBatteryOptimizations(getPackageName())) return;
            if (PollonPrefs.askedBattery(this)) return;
            PollonPrefs.markAskedBattery(this);
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception ignored) {
            /* algunos OEM no exponen este intent */
        }
    }

    private void applyDeepLink(Intent intent) {
        if (intent == null) return;
        String path = intent.getStringExtra("deepLink");
        Uri data = intent.getData();
        if (data != null && "elpollon".equalsIgnoreCase(data.getScheme())) {
            String host = data.getHost();
            String p = data.getPath();
            if (host != null && !host.isEmpty()) {
                path = "/" + host + (p != null ? p : "");
            }
        }
        if (path == null || !path.startsWith("/")) return;
        final String resolved = path;
        mainHandler.postDelayed(() -> injectDeepLink(resolved), 400);
        mainHandler.postDelayed(() -> injectDeepLink(resolved), 1600);
    }

    private void injectDeepLink(String path) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String escaped = path.replace("\\", "\\\\").replace("'", "\\'");
        String js = "(function(){try{var p='" + escaped + "';"
            + "if((location.pathname+location.search)!==p){"
            + "history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'));"
            + "}}catch(e){}})();";
        try {
            getBridge().getWebView().evaluateJavascript(js, null);
        } catch (Exception ignored) {}
    }
}
