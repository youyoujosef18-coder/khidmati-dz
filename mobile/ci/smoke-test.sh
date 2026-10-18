#!/usr/bin/env bash
# Emulator smoke test for the Khidmati Android app (run by .github/workflows/android.yml).
# Checks: install, cold start without crash, app in the foreground showing the real Khidmati page
# (read through WebView debugging, debug builds only), offline screen when the network is off,
# back button. Diagnostics + screenshots + logcat go to $OUT.
set -uo pipefail

APK="$1"
OUT="${2:-smoke}"
PKG="dz.khidmati.app"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP_URL="${KHIDMATI_APP_URL:-}"
APP_HOST=$(echo "$APP_URL" | sed -E 's#^https?://([^/]+).*#\1#')
mkdir -p "$OUT"
FAIL=0
pass() { echo "PASS  $1" | tee -a "$OUT/report.txt"; }
fail() { echo "FAIL  $1" | tee -a "$OUT/report.txt"; FAIL=1; }
skip() { echo "SKIP  $1" | tee -a "$OUT/report.txt"; }
diag() { echo "$1" >> "$OUT/diagnostics.txt"; }

crashed() { adb logcat -d | grep -E "FATAL EXCEPTION|AndroidRuntime: Process: $PKG" >/dev/null; }
foreground() { adb shell dumpsys activity activities 2>/dev/null | grep -m1 -E "topResumedActivity|mResumedActivity" | tr -d '\r' | sed 's/^ *//'; }
# What the WebView shows: {"href","title","text"} (or {"error"}).
page_info() {
  local pid
  pid=$(adb shell pidof "$PKG" | tr -d '\r')
  if [ -z "$pid" ]; then echo '{"error":"app not running"}'; return; fi
  adb forward --remove-all >/dev/null 2>&1
  adb forward tcp:9222 "localabstract:webview_devtools_remote_${pid}" >/dev/null 2>&1
  node "$HERE/webview-inspect.mjs" 9222
}

adb wait-for-device
adb install -r "$APK" && pass "APK installs" || fail "APK installs"

# 1. Cold start with network
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/start.txt"
sleep 25
adb exec-out screencap -p > "$OUT/1-launch.png"
if adb shell pidof "$PKG" >/dev/null; then pass "app process running after launch"; else fail "app process running after launch"; fi
if crashed; then fail "no crash on launch"; else pass "no crash on launch"; fi
FG=$(foreground); diag "[launch] foreground: $FG"
if echo "$FG" | grep -q "$PKG"; then pass "app in the foreground after launch"; else fail "app in the foreground after launch"; fi
PAGE=$(page_info); diag "[launch] page: $PAGE"
HEALTH=$(curl -s -m 15 "${APP_URL%/}/api/health" || true)
if echo "$HEALTH" | grep -q '"database":"ok"'; then
  if echo "$PAGE" | grep -q "\"href\":\"https://${APP_HOST}" && echo "$PAGE" | grep -qE "Demander un service|Trouver un technicien|اطلب خدمة"; then
    pass "Khidmati home page shown in the app ($APP_HOST)"
  else
    fail "Khidmati home page shown in the app ($APP_HOST)"
  fi
else
  skip "Khidmati page check: server ${APP_URL:-?} is not deployed/healthy yet"
fi

# 2. Offline: network off -> local offline page (first launch) or the site's cached offline page
adb shell svc wifi disable; adb shell svc data disable
sleep 3
adb shell am force-stop "$PKG"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" >/dev/null
sleep 15
adb exec-out screencap -p > "$OUT/2-offline.png"
FG=$(foreground); diag "[offline] foreground: $FG"
PAGE=$(page_info); diag "[offline] page: $PAGE"
if echo "$PAGE" | grep -qE "Connexion impossible|Vous êtes hors ligne|غير متصل"; then
  pass "offline screen shown without network"
else
  fail "offline screen shown without network"
fi
if crashed; then fail "no crash offline"; else pass "no crash offline"; fi

# 3. Back button on the first page leaves the app (no crash)
adb shell input keyevent KEYCODE_BACK
sleep 3
if crashed; then fail "no crash on back"; else pass "no crash on back"; fi

adb shell svc wifi enable; adb shell svc data enable
adb logcat -d > "$OUT/logcat.txt"
grep -E "Capacitor|chromium|AndroidRuntime|ActivityTaskManager.*$PKG" "$OUT/logcat.txt" | tail -25 >> "$OUT/diagnostics.txt" || true
echo "---"; cat "$OUT/report.txt"; echo "---"; cat "$OUT/diagnostics.txt"
exit $FAIL
