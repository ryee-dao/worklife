#!/usr/bin/env bash
# Checks the installers in dist/ the way a user meets them: the signature state matches what we expect,
# so a surprise warning (or a missing one) fails the build, and the installed app starts and logs APP_STARTED.
# Runs on the GitHub runner of each OS; bash is on all three.
set -euo pipefail

# Flip these when the certificates arrive
EXPECT_MAC_SIGNATURE=adhoc     # adhoc: "Apple could not verify" dialog. developer-id: notarized, no dialog
EXPECT_WIN_SIGNATURE=NotSigned # NotSigned: SmartScreen "unrecognized app". Valid: signed with a certificate

os="${RUNNER_OS:-$(uname -s)}"
user_data="$PWD/verify-user-data" # Scratch folder so the check never touches a real profile
rm -rf "$user_data"
user_data_for_app="$user_data"
[[ "$os" == Windows ]] && user_data_for_app=$(cygpath -w "$user_data")

stop_app() {
  if [[ "$os" == Windows ]]; then
    powershell -NoProfile -Command "Stop-Process -Name WorkLife -Force -ErrorAction SilentlyContinue"
  else
    # Every process of this launch carries the scratch folder in its command line. SIGKILL, since the app sometimes hangs on a polite quit
    pkill -9 -f "$user_data" || true
  fi
}

# Starts the app pointed at the scratch folder, waits for its first event, then stops it
launch_check() {
  "$@" --user-data-dir="$user_data_for_app" >verify-app.log 2>&1 & # The AppImage lists every extracted file, so the output only shows on failure
  disown # Otherwise bash reports the kill below as if something went wrong
  for _ in $(seq 30); do
    grep -q '"APP_STARTED"' "$user_data/events.jsonl" 2>/dev/null && break
    sleep 1
  done
  stop_app
  grep -q '"APP_STARTED"' "$user_data/events.jsonl" 2>/dev/null || { echo "App did not log APP_STARTED within 30s"; tail -50 verify-app.log; exit 1; }
  echo "App started and logged APP_STARTED"
}

check_mac_signature() {
  codesign --verify --deep --strict --verbose=2 "$1" # Unsigned, or a seal that no longer matches the files, is what macOS calls "damaged"
  local info
  info=$(codesign -dv --verbose=2 "$1" 2>&1)
  echo "$info" | grep -E '^(Signature|Authority|TeamIdentifier)=' || true
  case "$EXPECT_MAC_SIGNATURE" in
    adhoc) echo "$info" | grep -q '^Signature=adhoc' ;;
    developer-id) echo "$info" | grep -q '^Authority=Developer ID Application' && spctl --assess --type execute "$1" ;;
  esac || { echo "Mac signature of $1 is not $EXPECT_MAC_SIGNATURE"; exit 1; }
  echo "Mac signature is $EXPECT_MAC_SIGNATURE as expected"
}

case "$os" in
  macOS|Darwin)
    for dmg in dist/*.dmg; do
      mount=$(mktemp -d)
      hdiutil attach -nobrowse -quiet -mountpoint "$mount" "$dmg"
      app="${dmg%.dmg}.app"
      rm -rf "$app" && cp -R "$mount/WorkLife.app" "$app"
      hdiutil detach -quiet "$mount"
      check_mac_signature "$app"
    done
    launch_check dist/*-arm64.app/Contents/MacOS/WorkLife # The runner is Apple Silicon, so only that build can run here
    ;;
  Windows|MINGW*|MSYS*)
    exe=$(ls dist/*.exe)
    status=$(powershell -NoProfile -Command "(Get-AuthenticodeSignature '$exe').Status" | tr -d '\r')
    echo "Windows installer signature: $status"
    [[ "$status" == "$EXPECT_WIN_SIGNATURE" ]] || { echo "Expected $EXPECT_WIN_SIGNATURE"; exit 1; }
    powershell -NoProfile -Command "Start-Process -Wait -FilePath (Resolve-Path '$exe') -ArgumentList '/S'"
    stop_app # The installer starts the app when it finishes; it's started again below with the scratch folder
    launch_check "$(cygpath "$LOCALAPPDATA")/Programs/WorkLife/WorkLife.exe"
    ;;
  Linux)
    # Nothing signs or warns on Linux, so only the launch is checked
    # shortcut: the runner has no desktop, so the tray and window on a real Linux desktop aren't covered, test on a real machine before relying on this
    launch_check dist/*.AppImage --appimage-extract-and-run
    ;;
  *) echo "Unknown OS $os"; exit 1 ;;
esac
