package fr.lettreminute.app;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The `referrer` the invitation page put on its Play link: the only trace an
 * install keeps of the page it came from. Play answers it for ninety days
 * after the install; any failure answers an empty string.
 */
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    @PluginMethod
    public void read(PluginCall call) {
        InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        client.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int code) {
                JSObject result = new JSObject();
                result.put("referrer", "");
                if (code == InstallReferrerClient.InstallReferrerResponse.OK) {
                    try {
                        result.put("referrer", client.getInstallReferrer().getInstallReferrer());
                    } catch (Exception ignored) {
                        // An empty referrer, as if the install came from nowhere.
                    }
                }
                client.endConnection();
                call.resolve(result);
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                // Resolved already, or never connected: nothing waits on it.
            }
        });
    }
}
