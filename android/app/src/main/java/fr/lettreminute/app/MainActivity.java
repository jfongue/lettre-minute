package fr.lettreminute.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.games.PlayGamesSdk;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationSettingsPlugin.class);
        registerPlugin(PlayGamesPlugin.class);
        registerPlugin(InstallReferrerPlugin.class);
        super.onCreate(savedInstanceState);
        // Signs the player in to Play Games silently, as Level Up asks.
        PlayGamesSdk.initialize(this);
    }
}
