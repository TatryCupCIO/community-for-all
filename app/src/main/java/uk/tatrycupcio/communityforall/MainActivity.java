package uk.tatrycupcio.communityforall;

import android.app.Activity;
import android.widget.FrameLayout;
import android.view.WindowManager;
import android.graphics.Color;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.os.Bundle;
import android.os.Build;
import android.Manifest;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.JavaScriptReplyProxy;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.util.Collections;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingNativeNotification;
    private boolean notificationPageReady = false;

    private static final int FILE_REQUEST = 1001;

    private static final String APP_URL =
            "https://tatrycupcio.uk/";

    private static final String TRUSTED_ORIGIN =
            "https://tatrycupcio.uk";

    private JavaScriptReplyProxy firebaseReplyProxy;

    private boolean isTrustedUrl(Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && "tatrycupcio.uk".equalsIgnoreCase(uri.getHost())
                && uri.getPort() == -1;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(
                        Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED) {

            requestPermissions(
                    new String[]{
                            Manifest.permission.POST_NOTIFICATIONS
                    },
                    1002
            );
        }

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setSoftInputMode(
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        );

        FrameLayout safeArea = new FrameLayout(this);
        safeArea.setBackgroundColor(Color.rgb(245, 249, 251));
        webView = new WebView(this);
        safeArea.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(safeArea);

        WindowInsetsControllerCompat systemBars =
                new WindowInsetsControllerCompat(getWindow(), safeArea);
        systemBars.setAppearanceLightStatusBars(true);
        systemBars.setAppearanceLightNavigationBars(true);

        ViewCompat.setOnApplyWindowInsetsListener(safeArea, (view, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout()
            );
            Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(
                    bars.left,
                    bars.top,
                    bars.right,
                    Math.max(bars.bottom, keyboard.bottom)
            );
            // The wrapper handles these areas, so WebView must not add them twice.
            return WindowInsetsCompat.CONSUMED;
        });
        safeArea.post(() -> ViewCompat.requestApplyInsets(safeArea));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        if (WebViewFeature.isFeatureSupported(
                WebViewFeature.WEB_MESSAGE_LISTENER)) {

            WebViewCompat.addWebMessageListener(
                    webView,
                    "AndroidFirebase",
                    Collections.singleton(TRUSTED_ORIGIN),
                    (view, message, sourceOrigin,
                     isMainFrame, replyProxy) -> {

                        if (!isMainFrame) {
                            return;
                        }

                        if (!TRUSTED_ORIGIN.equals(
                                sourceOrigin.toString())) {
                            return;
                        }

                        if (!"requestToken".equals(
                                message.getData())) {
                            return;
                        }

                        firebaseReplyProxy = replyProxy;
                        sendFirebaseToken(replyProxy);
                    }
            );
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                notificationPageReady = false;
                super.onPageStarted(view, url, icon);
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                notificationPageReady = isTrustedUrl(Uri.parse(url));
                deliverNativeNotification();
            }


            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request) {

                Uri uri = request.getUrl();

                if (isTrustedUrl(uri)) {
                    return false;
                }

                if (request.isForMainFrame()) {
                    openExternalUrl(uri);
                }

                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {

                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }

                fileCallback = callback;

                try {
                    Intent intent = params.createIntent();

                    startActivityForResult(
                            intent,
                            FILE_REQUEST
                    );

                    return true;

                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher()
                    .registerOnBackInvokedCallback(
                            OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                            () -> handleBack()
                    );
        }

        pendingNativeNotification = savedInstanceState == null ? null : savedInstanceState.getString("cfa_pending_notification");
        String initialNotification = savedInstanceState == null ? notificationPayload(getIntent()) : null;
        if (pendingNativeNotification == null) pendingNativeNotification = initialNotification;
        String startUrl = pendingNativeNotification == null ? APP_URL : APP_URL + "#cfa_notice=" + Uri.encode(pendingNativeNotification);
        // The page consumes the cold-start hash after authentication is restored.
        pendingNativeNotification = null;
        webView.loadUrl(startUrl);
    }

    private String notificationPayload(Intent intent) {
        if (intent == null) return null;
        try {
            String raw = intent.getStringExtra("cfa_notification_payload");
            JSONObject source = raw != null && raw.length() <= 8192 ? new JSONObject(raw) : new JSONObject();
            JSONObject safe = new JSONObject();
            String[] fields = {"type", "notification_type", "source_table", "source_id", "message_id", "messageId", "conversation_id", "conversationId", "sender_id", "senderId", "actor_id", "recipient_id", "recipientId", "event_id", "eventId", "booking_id", "url", "link"};
            for (String key : fields) {
                String value = source.has(key) ? source.optString(key, "") : intent.getStringExtra(key);
                if (value != null && !value.isEmpty() && value.length() <= 2048) safe.put(key, value);
            }
            if (safe.length() == 0) {
                if (raw == null && !intent.hasExtra("google.message_id") && !"CFA_OPEN_NOTIFICATION".equals(intent.getAction())) return null;
                safe.put("type", "notifications");
            }
            return safe.toString();
        } catch (Exception ignored) { return null; }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String payload = notificationPayload(intent);
        if (payload != null) {
            pendingNativeNotification = payload;
            deliverNativeNotification();
        }
    }

    private void deliverNativeNotification() {
        if (!notificationPageReady || pendingNativeNotification == null || webView == null) return;
        if (!isTrustedUrl(Uri.parse(webView.getUrl() == null ? "" : webView.getUrl()))) return;
        final String payload = pendingNativeNotification;
        pendingNativeNotification = null;
        String script = "(function(){if(window.CFANotificationRouter){window.CFANotificationRouter.open(JSON.parse("
                + JSONObject.quote(payload) + "));return true;}return false;})()";
        webView.evaluateJavascript(script, result -> {
            if (!"true".equals(result)) {
                notificationPageReady = false;
                webView.loadUrl(APP_URL + "?cfa_notice_reload=" + System.currentTimeMillis()
                        + "#cfa_notice=" + Uri.encode(payload));
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        state.putString("cfa_pending_notification", pendingNativeNotification);
        super.onSaveInstanceState(state);
    }

    private void sendFirebaseToken(
            JavaScriptReplyProxy replyProxy) {

        FirebaseMessaging.getInstance()
                .getToken()
                .addOnCompleteListener(task -> {

                    if (!task.isSuccessful()) {
                        Log.e(
                                "CFA_FCM",
                                "Firebase token request failed",
                                task.getException()
                        );
                        return;
                    }

                    String token = task.getResult();

                    if (token == null || token.isEmpty()) {
                        return;
                    }

                    try {
                        JSONObject response = new JSONObject();
                        response.put("type", "firebaseToken");
                        response.put("token", token);

                        runOnUiThread(() ->
                                replyProxy.postMessage(
                                        response.toString()
                                )
                        );

                    } catch (Exception e) {
                        Log.e(
                                "CFA_FCM",
                                "Cannot prepare Firebase token",
                                e
                        );
                    }
                });
    }

    private void openExternalUrl(Uri uri) {
        try {
            startActivity(
                    new Intent(Intent.ACTION_VIEW, uri)
            );
        } catch (ActivityNotFoundException e) {
            Log.e(
                    "CFA_WEB",
                    "Cannot open external URL",
                    e
            );
        }
    }

    private void handleBack() {
        if (webView != null) {
            webView.evaluateJavascript(
                    "window.history.back();",
                    null
            );
        }
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {

        super.onActivityResult(
                requestCode,
                resultCode,
                data
        );

        if (requestCode == FILE_REQUEST &&
                fileCallback != null) {

            Uri[] results = null;

            if (resultCode == RESULT_OK) {
                results =
                        WebChromeClient.FileChooserParams
                                .parseResult(
                                        resultCode,
                                        data
                                );
            }

            fileCallback.onReceiveValue(results);
            fileCallback = null;
        }
    }
}
