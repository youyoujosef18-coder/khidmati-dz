#!/usr/bin/env bash
# Emulator smoke test for the Khidmati Android app (run by .github/workflows/android.yml).
# Checks: install, cold start without crash, page rendered, offline page when the network is off,
# back button leaves the app from the start page. Screenshots + logcat go to $OUT.
set -uo pipefail

APK="$1"
OUT="${2:-smoke}"
PKG="dz.khidmati.app"
mkdir -p "$OUT"
FAIL=0
pass() { echo "PASS  $1" | tee -a "$OUT/report.txt"; }
fail() { echo "FAIL  $1" | tee -a "$OUT/report.txt"; FAIL=1; }

crashed() { adb logcat -d | grep -E "FATAL EXCEPTION|AndroidRuntime: Process: $PKG" >/dev/null; }
ui_text() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml "$OUT/$1.xml" >/dev/null 2>&1; cat "$OUT/$1.xml" 2>/dev/null; }

adb wait-for-device
adb install -r "$APK" && pass "APK installs" || fail "APK installs"
adb shell pm grant "$PKG" android.permission.CAMERA 2>/dev/null || true

# 1. Cold start with network
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/start.txt"
sleep 25
adb exec-out screencap -p > "$OUT/1-launch.png"
if adb shell pidof "$PKG" >/dev/null; then pass "app process running after launch"; else fail "app process running after launch"; fi
if crashed; then fail "no crash on launch"; else pass "no crash on launch"; fi
# Only assert real Khidmati content when the server is actually reachable and healthy.
APP_URL="${KHIDMATI_APP_URL:-}"
HEALTH=$(curl -s -m 15 "${APP_URL%/}/api/health" || true)
if echo "$HEALTH" | grep -q '"database":"ok"'; then
  if ui_text launch | grep -q "Demander un service\|Trouver un technicien\|اطلب خدمة"; then pass "Khidmati home page rendered in the app"; else fail "Khidmati home page rendered in the app"; fi
else
  echo "SKIP  Khidmati page check: server ${APP_URL:-?} is not deployed/healthy yet" | tee -a "$OUT/report.txt"
fi

# 2. Offline: network off -> local offline page
adb shell svc wifi disable; adb shell svc data disable
sleep 3
adb shell am force-stop "$PKG"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" >/dev/null
sleep 12
adb exec-out screencap -p > "$OUT/2-offline.png"
if ui_text offline | grep -q "Connexion impossible"; then pass "offline page shown without network"; else fail "offline page shown without network"; fi
if crashed; then fail "no crash offline"; else pass "no crash offline"; fi

# 3. Back button on the first page leaves the app (no crash)
adb shell input keyevent KEYCODE_BACK
sleep 3
if crashed; then fail "no crash on back"; else pass "no crash on back"; fi

adb shell svc wifi enable; adb shell svc data enable
adb logcat -d > "$OUT/logcat.txt"
echo "---"; cat "$OUT/report.txt"
exit $FAIL
