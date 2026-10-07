package fr.lettreminute.app;

import android.app.NotificationManager;
import android.service.notification.StatusBarNotification;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
* Ce que FCM ne sait pas faire : reprendre une notification déjà affichée. Quand
* une table de duel n'attend plus personne, le serveur envoie donc un message
* muet (`duel_cancel`) portant l'étiquette de l'invitation, et ce service le
* traduit en annulation.
*
* Déclaré avec une priorité plus haute que les deux autres services qui
* écoutent `MESSAGING_EVENT` — celui du plugin Capacitor et celui de Firebase,
* à -500 —, c'est lui que FCM réveille ; il repasse ensuite au plugin, qui
* affiche ce qu'il y a à afficher.
*/
public class DuelMessagingService extends MessagingService {
@Override
public void onMessageReceived(RemoteMessage message) {
String tag = message.getData().get("tag");
if ("duel_cancel".equals(message.getData().get("kind")) && tag != null && !tag.isEmpty()) {
NotificationManager manager = getSystemService(NotificationManager.class);
for (StatusBarNotification shown : manager.getActiveNotifications()) {
if (tag.equals(shown.getTag())) manager.cancel(shown.getTag(), shown.getId());
}
}
super.onMessageReceived(message);
}
}
