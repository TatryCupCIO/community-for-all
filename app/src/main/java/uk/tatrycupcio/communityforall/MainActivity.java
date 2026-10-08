package uk.tatrycupcio.communityforall;

import android.app.Activity;
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

import androidx.annotation.NonNull;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.JavaScriptReplyProxy;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.util.Collections;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

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

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

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

        webView.loadUrl(APP_URL);
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
