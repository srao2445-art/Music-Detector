const state = {
  files: [],
  originalZipName: 'website.zip',
  iconDataUrl: '',
  splashDataUrl: '',
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const sanitizePackage = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '') || 'com.webviewforge.app';

const javaPackagePath = (packageName) => sanitizePackage(packageName).replaceAll('.', '/');

const escapeXml = (value) =>
  String(value).replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]));

const toast = (message) => {
  const element = $('#toast');
  element.textContent = message;
  element.classList.remove('translate-y-6', 'opacity-0');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => element.classList.add('translate-y-6', 'opacity-0'), 3200);
};

const createParticles = () => {
  const container = $('#particles');
  for (let index = 0; index < 58; index += 1) {
    const particle = document.createElement('span');
    particle.className = 'particle';
    particle.style.setProperty('--x', `${Math.random() * 100}vw`);
    particle.style.setProperty('--drift', `${(Math.random() - 0.5) * 22}vw`);
    particle.style.setProperty('--duration', `${12 + Math.random() * 18}s`);
    particle.style.setProperty('--opacity', `${0.25 + Math.random() * 0.55}`);
    particle.style.animationDelay = `-${Math.random() * 24}s`;
    container.appendChild(particle);
  }
};

const bindMouseLight = () => {
  const cursorGlow = $('#cursorGlow');
  window.addEventListener('pointermove', (event) => {
    cursorGlow.style.left = `${event.clientX}px`;
    cursorGlow.style.top = `${event.clientY}px`;
  });

  $$('.glass-panel, .feature-card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    });
  });
};

const updatePreview = () => {
  const appName = $('#appName').value || 'Forge App';
  const themeColor = $('#themeColor').value;
  const splashColor = $('#splashColor').value;
  $('#previewTitle').textContent = appName;
  $('#previewTop').textContent = appName;
  $('#previewTop').style.background = `linear-gradient(90deg, ${themeColor}55, transparent)`;
  $('#previewBody').style.background = `radial-gradient(circle at 50% 30%, ${themeColor}2e, transparent 38%), ${splashColor}`;
  $('#previewLogo').style.background = `${themeColor}28`;
  $('#previewLogo').style.color = themeColor;
};

const readImage = (input, nameElement, target) => {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state[target] = reader.result;
    nameElement.textContent = file.name;
    const logo = $('#previewLogo');
    logo.innerHTML = `<img src="${reader.result}" alt="Uploaded branding" class="h-full w-full rounded-[1.7rem] object-cover" />`;
    toast(`${target === 'iconDataUrl' ? 'App icon' : 'Splash logo'} updated`);
  };
  reader.readAsDataURL(file);
};

const normalizeZipPath = (path) => {
  const clean = path.replace(/^\/+/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length > 1) {
    const first = parts[0];
    const allShareRoot = state.files.length === 0 || state.files.every((file) => file.path.startsWith(`${first}/`) || file.path === clean);
    if (allShareRoot && !first.includes('.')) return parts.slice(1).join('/');
  }
  return clean;
};

const inspectZip = async (file) => {
  state.originalZipName = file.name;
  $('#uploadProgress').style.width = '18%';
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.includes('__MACOSX'));
  $('#uploadProgress').style.width = '46%';

  state.files = [];
  for (const entry of entries) {
    const content = await entry.async('uint8array');
    state.files.push({ path: entry.name.replace(/^\/+/, ''), normalizedPath: entry.name.replace(/^\/+/, ''), size: content.byteLength, content });
  }

  const roots = state.files.map((entry) => entry.path.split('/')[0]);
  const commonRoot = roots.length && roots.every((root) => root === roots[0]) && !roots[0].includes('.') ? roots[0] : '';
  if (commonRoot) {
    state.files = state.files.map((entry) => ({ ...entry, normalizedPath: entry.path.slice(commonRoot.length + 1) }));
  }

  const totalSize = state.files.reduce((sum, entry) => sum + entry.size, 0);
  const entryFile = state.files.find((entry) => /(^|\/)index\.html?$/i.test(entry.normalizedPath));
  $('#uploadProgress').style.width = '100%';
  $('#fileCount').textContent = String(state.files.length);
  $('#totalSize').textContent = formatBytes(totalSize);
  $('#entryFile').textContent = entryFile?.normalizedPath || 'index.html not found';
  $('#entryFile').classList.toggle('text-amber-200', !entryFile);
  $('#fileList').innerHTML = state.files
    .slice(0, 12)
    .map((entry) => `<div class="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2"><span class="truncate">${entry.normalizedPath}</span><span class="ml-3 shrink-0 text-slate-500">${formatBytes(entry.size)}</span></div>`)
    .join('');

  if (state.files.length > 12) {
    $('#fileList').insertAdjacentHTML('beforeend', `<div class="empty-state">+${state.files.length - 12} more files will be bundled.</div>`);
  }

  toast(entryFile ? 'Website analyzed successfully' : 'ZIP uploaded, but index.html was not detected');
};

const bindUploads = () => {
  const dropZone = $('#dropZone');
  const input = $('#zipInput');
  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast('Please upload a ZIP file.');
      return;
    }
    inspectZip(file).catch((error) => {
      console.error(error);
      toast('Unable to read ZIP file.');
      $('#uploadProgress').style.width = '0%';
    });
  };

  input.addEventListener('change', () => handleFile(input.files?.[0]));
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('border-cyan-300/70', 'bg-cyan-300/10');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('border-cyan-300/70', 'bg-cyan-300/10');
    });
  });
  dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files?.[0]));

  $('#iconInput').addEventListener('change', (event) => readImage(event.target, $('#iconName'), 'iconDataUrl'));
  $('#splashInput').addEventListener('change', (event) => readImage(event.target, $('#splashName'), 'splashDataUrl'));
};

const currentSettings = () => ({
  appName: $('#appName').value.trim() || 'Forge App',
  packageName: sanitizePackage($('#packageName').value),
  versionName: $('#versionName').value.trim() || '1.0.0',
  versionCode: Number($('#versionCode').value) || 1,
  themeColor: $('#themeColor').value,
  splashColor: $('#splashColor').value,
  toggles: Object.fromEntries($$('[data-setting]').map((input) => [input.dataset.setting, input.checked])),
});

const javaBoolean = (value) => (value ? 'true' : 'false');

const createMainActivity = (settings) => `package ${settings.packageName};

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ValueCallback<Uri[]> fileUploadCallback;

    private final ActivityResultLauncher<Intent> filePicker = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(),
        result -> {
            if (fileUploadCallback == null) return;
            Uri[] results = null;
            if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                Uri dataUri = result.getData().getData();
                if (dataUri != null) results = new Uri[] { dataUri };
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        }
    );

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ${settings.toggles.fullscreen ? 'getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN);' : ''}
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        swipeRefreshLayout.setEnabled(${javaBoolean(settings.toggles.pullRefresh)});
        swipeRefreshLayout.setOnRefreshListener(() -> webView.reload());

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(${javaBoolean(settings.toggles.enableJs)});
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setBuiltInZoomControls(${javaBoolean(settings.toggles.zoom)});
        webSettings.setDisplayZoomControls(false);
        webSettings.setCacheMode(${settings.toggles.offline ? 'WebSettings.LOAD_CACHE_ELSE_NETWORK' : 'WebSettings.LOAD_DEFAULT'});

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                swipeRefreshLayout.setRefreshing(false);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (!${javaBoolean(settings.toggles.fileUpload)}) return false;
                fileUploadCallback = filePathCallback;
                filePicker.launch(fileChooserParams.createIntent());
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`;

const createManifest = (settings) => {
  const iconRef = state.iconDataUrl ? '@drawable/app_icon' : '@drawable/ic_launcher';
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <application
        android:allowBackup="true"
        android:hardwareAccelerated="true"
        android:icon="${iconRef}"
        android:label="${escapeXml(settings.appName)}"
        android:roundIcon="${iconRef}"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
};

const createLayout = () => `<?xml version="1.0" encoding="utf-8"?>
<androidx.swiperefreshlayout.widget.SwipeRefreshLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/swipeRefreshLayout"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    <WebView
        android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</androidx.swiperefreshlayout.widget.SwipeRefreshLayout>`;

const createAppGradle = (settings) => `plugins {
    id 'com.android.application'
}

android {
    namespace '${settings.packageName}'
    compileSdk 35

    defaultConfig {
        applicationId '${settings.packageName}'
        minSdk 23
        targetSdk 35
        versionCode ${settings.versionCode}
        versionName '${settings.versionName}'
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
}`;

const createRootGradle = () => `plugins {
    id 'com.android.application' version '8.7.3' apply false
}`;

const createReadme = (settings) => `# ${settings.appName}

Generated by WebViewForge.

## Open in Android Studio

1. Open this folder in Android Studio.
2. Let Gradle sync dependencies.
3. Build or run the app on a device/emulator.

## WebView entry point

The app loads the bundled website from:

\`\`\`
file:///android_asset/index.html
\`\`\`

## Package

- Application ID: \`${settings.packageName}\`
- Version: \`${settings.versionName}\` (${settings.versionCode})
`;

const dataUrlToBase64 = (dataUrl) => dataUrl.split(',')[1] || '';

const addGeneratedProject = async (zip, settings) => {
  zip.file('settings.gradle', "pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name = 'WebViewForgeProject'\ninclude ':app'\n");
  zip.file('build.gradle', createRootGradle());
  zip.file('gradle.properties', 'android.useAndroidX=true\nandroid.nonTransitiveRClass=true\norg.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\n');
  zip.file('README.md', createReadme(settings));
  zip.file('app/build.gradle', createAppGradle(settings));
  zip.file('app/src/main/AndroidManifest.xml', createManifest(settings));
  zip.file('app/src/main/res/layout/activity_main.xml', createLayout());
  zip.file('app/src/main/res/values/styles.xml', `<resources>\n    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:navigationBarColor">${settings.splashColor}</item>\n        <item name="colorAccent">${settings.themeColor}</item>\n    </style>\n</resources>`);
  zip.file(`app/src/main/java/${javaPackagePath(settings.packageName)}/MainActivity.java`, createMainActivity(settings));

  zip.file('app/src/main/res/drawable/ic_launcher.xml', `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n    <path android:fillColor="${settings.themeColor}" android:pathData="M18,18h72v72h-72z"/>\n    <path android:fillColor="#FFFFFF" android:pathData="M29,31h10l8,31 9,-31h8l9,31 8,-31h10l-13,46h-10l-8,-28 -8,28h-10z"/>\n</vector>`);

  if (state.iconDataUrl) {
    zip.file('app/src/main/res/drawable/app_icon.png', dataUrlToBase64(state.iconDataUrl), { base64: true });
  }

  if (state.splashDataUrl) {
    zip.file('app/src/main/res/drawable/splash_logo.png', dataUrlToBase64(state.splashDataUrl), { base64: true });
  }

  if (state.files.length) {
    state.files.forEach((entry) => zip.file(`app/src/main/assets/${entry.normalizedPath}`, entry.content));
  } else {
    zip.file('app/src/main/assets/index.html', `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(settings.appName)}</title></head><body style="font-family:sans-serif;background:#030712;color:white;display:grid;place-items:center;min-height:100vh"><main><h1>${escapeXml(settings.appName)}</h1><p>Replace this starter page with your uploaded static website.</p></main></body></html>`);
  }
};

const runBuildAnimation = async () => {
  const steps = $$('#buildSteps li');
  for (let index = 0; index < steps.length; index += 1) {
    steps.forEach((step, stepIndex) => {
      step.classList.toggle('active', stepIndex === index);
      step.classList.toggle('done', stepIndex < index);
    });
    const percent = Math.round(((index + 1) / steps.length) * 100);
    $('#buildBar').style.width = `${percent}%`;
    $('#buildPercent').textContent = `${percent}%`;
    await new Promise((resolve) => setTimeout(resolve, 420));
  }
  steps.forEach((step) => step.classList.add('done'));
  steps.forEach((step) => step.classList.remove('active'));
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const generateProject = async () => {
  if (!window.JSZip) {
    toast('JSZip is still loading. Try again in a moment.');
    return;
  }

  const button = $('#generateBtn');
  const settings = currentSettings();
  $('#packageName').value = settings.packageName;
  button.disabled = true;
  button.textContent = 'Forging Project...';

  try {
    await runBuildAnimation();
    const zip = new JSZip();
    await addGeneratedProject(zip, settings);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    downloadBlob(blob, `${settings.appName.replace(/[^a-z0-9]+/gi, '-') || 'WebViewForge'}-Android.zip`);
    toast('Android Studio project generated successfully.');
  } catch (error) {
    console.error(error);
    toast('Project generation failed. Check the console for details.');
  } finally {
    button.disabled = false;
    button.textContent = 'Generate Android Project';
  }
};

const bindSettings = () => {
  ['appName', 'themeColor', 'splashColor'].forEach((id) => $(`#${id}`).addEventListener('input', updatePreview));
  $('#packageName').addEventListener('blur', (event) => {
    event.target.value = sanitizePackage(event.target.value);
  });
  $('#generateBtn').addEventListener('click', generateProject);
};

createParticles();
bindMouseLight();
bindUploads();
bindSettings();
updatePreview();
