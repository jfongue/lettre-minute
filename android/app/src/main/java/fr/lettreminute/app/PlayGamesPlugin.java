package fr.lettreminute.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;

/**
 * Google Play Games: the achievements and the end-of-run events. Sign-in is
 * the SDK's own, silent at launch (MainActivity): a player who has no Play
 * Games profile, or declined it, is simply not authenticated, and every call
 * here then does nothing rather than ask.
 */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {

    /** Runs `action` only for an authenticated player; the call always resolves. */
    private void whenSignedIn(PluginCall call, Runnable action) {
        PlayGames.getGamesSignInClient(getActivity())
            .isAuthenticated()
            .addOnCompleteListener(task -> {
                boolean signedIn = task.isSuccessful() && task.getResult().isAuthenticated();
                if (signedIn) action.run();
                JSObject result = new JSObject();
                result.put("signedIn", signedIn);
                call.resolve(result);
            });
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        whenSignedIn(call, () -> {
            for (int i = 0; i < ids.length(); i++) {
                String id = ids.optString(i, "");
                if (!id.isEmpty()) PlayGames.getAchievementsClient(getActivity()).unlock(id);
            }
        });
    }

    @PluginMethod
    public void increment(PluginCall call) {
        String id = call.getString("id", "");
        int steps = call.getInt("steps", 0);
        whenSignedIn(call, () -> {
            if (!id.isEmpty() && steps > 0) PlayGames.getEventsClient(getActivity()).increment(id, steps);
        });
    }

    /** The signed-in player's gamer name: the game names a new account after it. */
    @PluginMethod
    public void player(PluginCall call) {
        PlayGames.getGamesSignInClient(getActivity())
            .isAuthenticated()
            .addOnCompleteListener(signIn -> {
                JSObject result = new JSObject();
                boolean signedIn = signIn.isSuccessful() && signIn.getResult().isAuthenticated();
                result.put("signedIn", signedIn);
                if (!signedIn) {
                    call.resolve(result);
                    return;
                }
                PlayGames.getPlayersClient(getActivity())
                    .getCurrentPlayer()
                    .addOnCompleteListener(player -> {
                        if (player.isSuccessful() && player.getResult() != null) {
                            result.put("name", player.getResult().getDisplayName());
                        }
                        call.resolve(result);
                    });
            });
    }

    @PluginMethod
    public void showAchievements(PluginCall call) {
        whenSignedIn(call, () ->
            PlayGames.getAchievementsClient(getActivity())
                .getAchievementsIntent()
                .addOnSuccessListener(intent -> getActivity().startActivityForResult(intent, 9003))
        );
    }
}
