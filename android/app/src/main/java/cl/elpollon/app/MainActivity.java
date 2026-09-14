package cl.elpollon.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DriverBadgePlugin.class);
        super.onCreate(savedInstanceState);
        PollonMessagingService.ensureChannel(this);
        requestIgnoreBatteryOptimizations();
    }

    /**
     * Sin esto Xiaomi/Huawei/Samsung matan el GPS a los pocos minutos
     * con pantalla apagada u otra app en primer plano.
     */
    private void requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            if (pm.isIgnoringBatteryOptimizations(getPackageName())) return;
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception ignored) {
            /* algunos OEM no exponen este intent */
        }
    }
}
