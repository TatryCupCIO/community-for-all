package uk.tatrycupcio.communityforall;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.window.OnBackInvokedDispatcher;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    private static final int FILE_REQUEST = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        webView.setWebViewClient(new WebViewClient());

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
                    Intent intent =
                            params.createIntent();

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

        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher()
                    .registerOnBackInvokedCallback(
                            OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                            () -> handleBack()
                    );
        }

        webView.loadUrl("https://tatrycupcio.uk/");
    }

    private void handleBack() {
        webView.evaluateJavascript(
                "window.history.back();",
                null
        );
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
