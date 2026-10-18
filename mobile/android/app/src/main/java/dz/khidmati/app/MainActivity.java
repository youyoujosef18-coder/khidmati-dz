package dz.khidmati.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Khidmati Android shell.
 *
 * The app displays the Khidmati platform (server URL from capacitor.config) and adds the
 * native behaviour a plain WebView lacks:
 *  - Android back button navigates the in-app history before leaving the app;
 *  - file downloads (CSV / JSON exports) go through DownloadManager with the user's session;
 *  - "khidmati://print" prints the current page (receipts) with the Android print service;
 *  - https App Links to the Khidmati domain open inside the app;
 *  - server error pages (404, 403…) are shown as-is; only real connection failures show the
 *    local offline page (Capacitor's default would replace every HTTP error with it).
 */
public class MainActivity extends BridgeActivity {

    private static final String NATIVE_SCHEME = "khidmati";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge == null) {
            // No WebView available on this device (Capacitor showed its "no_webview" layout).
            return;
        }

        WebView webView = bridge.getWebView();
        bridge.setWebViewClient(new KhidmatiWebViewClient(bridge));
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            startDownload(url, userAgent, contentDisposition, mimeType)
        );

        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        WebView wv = bridge != null ? bridge.getWebView() : null;
                        if (wv != null && wv.canGoBack()) {
                            wv.goBack();
                            return;
                        }
                        // Nothing left in the in-app history: let Android leave the app.
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                }
            );
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openAppLink(intent);
    }

    @Override
    public void onPause() {
        super.onPause();
        // Persist the session cookie promptly so the user stays signed in after the app is killed.
        CookieManager.getInstance().flush();
    }

    /** Opens https://<khidmati host>/… links (App Links, shared links) inside the app. */
    private void openAppLink(Intent intent) {
        if (intent == null || bridge == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }
        Uri data = intent.getData();
        if (data != null && "https".equals(data.getScheme()) && isKhidmatiHost(data.getHost())) {
            bridge.getWebView().loadUrl(data.toString());
        }
    }

    private boolean isKhidmatiHost(String host) {
        if (host == null || bridge == null || bridge.getServerUrl() == null) {
            return false;
        }
        String serverHost = Uri.parse(bridge.getServerUrl()).getHost();
        return serverHost != null && serverHost.equalsIgnoreCase(host);
    }

    private boolean isKhidmatiPage(String url) {
        return url != null && isKhidmatiHost(Uri.parse(url).getHost());
    }

    private void startDownload(String url, String userAgent, String contentDisposition, String mimeType) {
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equals("https") || scheme.equals("http"))) {
            Toast.makeText(this, R.string.download_unsupported, Toast.LENGTH_LONG).show();
            return;
        }
        String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
        try {
            DownloadManager.Request request = new DownloadManager.Request(uri);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) {
                // The export endpoints are authenticated by the session cookie.
                request.addRequestHeader("Cookie", cookies);
            }
            if (userAgent != null) {
                request.addRequestHeader("User-Agent", userAgent);
            }
            if (mimeType != null) {
                request.setMimeType(mimeType);
            }
            request.setTitle(fileName);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            } else {
                // Android 9 and older: app-specific folder, no storage permission required.
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, fileName);
            }
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                throw new IllegalStateException("DownloadManager unavailable");
            }
            manager.enqueue(request);
            Toast.makeText(this, getString(R.string.download_started, fileName), Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, R.string.download_failed, Toast.LENGTH_LONG).show();
        }
    }

    private void printCurrentPage(WebView webView) {
        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
        if (printManager == null) {
            Toast.makeText(this, R.string.print_unavailable, Toast.LENGTH_LONG).show();
            return;
        }
        String title = webView.getTitle();
        String jobName = (title == null || title.trim().isEmpty()) ? "Khidmati" : title;
        PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
        printManager.print(jobName, adapter, new PrintAttributes.Builder().build());
    }

    private class KhidmatiWebViewClient extends BridgeWebViewClient {

        KhidmatiWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (NATIVE_SCHEME.equals(url.getScheme())) {
                if ("print".equals(url.getHost()) && isKhidmatiPage(view.getUrl())) {
                    printCurrentPage(view);
                }
                return true;
            }
            return super.shouldOverrideUrlLoading(view, request);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            // Intentionally not calling super: the server renders its own localized error pages
            // (e.g. "Page introuvable"). Network failures still reach onReceivedError, which
            // shows the local offline page.
        }
    }
}
