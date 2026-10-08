
package uk.tatrycupcio.communityforall;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService
        extends FirebaseMessagingService {

    private static final String CHANNEL_ID =
            "community_for_all_notifications";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d("CFA_FCM", "Firebase token updated");
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);

        String title = "Community For All";
        String body = "Máte nové upozornenie.";

        if (message.getNotification() != null) {
            if (message.getNotification().getTitle() != null) {
                title = message.getNotification().getTitle();
            }

            if (message.getNotification().getBody() != null) {
                body = message.getNotification().getBody();
            }
        }

        if (message.getData().containsKey("title")) {
            title = message.getData().get("title");
        }

        if (message.getData().containsKey("body")) {
            body = message.getData().get("body");
        }

        NotificationManager manager =
                (NotificationManager) getSystemService(
                        NOTIFICATION_SERVICE
                );

        if (manager == null) {
            return;
        }

        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel =
                    new NotificationChannel(
                            CHANNEL_ID,
                            "Community For All",
                            NotificationManager.IMPORTANCE_DEFAULT
                    );

            manager.createNotificationChannel(channel);
        }

        Intent intent =
                new Intent(this, MainActivity.class);

        intent.setFlags(
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        PendingIntent pendingIntent =
                PendingIntent.getActivity(
                        this,
                        0,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT |
                        PendingIntent.FLAG_IMMUTABLE
                );

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(
                        this,
                        CHANNEL_ID
                )
                .setSmallIcon(
                        R.drawable.tatry_cup_cio_512x512
                )
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(
                        NotificationCompat.PRIORITY_DEFAULT
                );

        manager.notify(
                (int) System.currentTimeMillis(),
                builder.build()
        );
    }
}

