#!/usr/bin/env bash
# 도식 HTML 을 1920×1080 PNG 로 찍는다. 맥 · 윈도우 · 리눅스 공용.
#
#   ./diagrams/shot.sh diagrams/01_이름.html            → /tmp/diagram.png
#   ./diagrams/shot.sh diagrams/01_이름.html out.png
#   CHROME=/경로/chrome ./diagrams/shot.sh ...          → 브라우저 직접 지정
set -euo pipefail

html=${1:-}
if [ -z "$html" ]; then
  echo "사용: shot.sh <html> [out.png] [width] [height]" >&2
  exit 2
fi
out=${2:-/tmp/diagram.png}
width=${3:-1920}
height=${4:-1080}

find_browser() {
  if [ -n "${CHROME:-}" ]; then
    if [ -x "$CHROME" ] || command -v "$CHROME" >/dev/null 2>&1; then
      printf '%s' "$CHROME"; return 0
    fi
    echo "CHROME 값을 실행할 수 없습니다: $CHROME" >&2
    return 1
  fi

  local candidate
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
    "/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
    "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
    "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  do
    [ -x "$candidate" ] && { printf '%s' "$candidate"; return 0; }
  done

  for candidate in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge chrome; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"; return 0
    fi
  done
  return 1
}

if ! browser=$(find_browser); then
  cat >&2 <<'MSG'
크롬 계열 브라우저를 찾지 못했습니다.
실행 파일 경로를 직접 지정하세요.

  CHROME="/경로/chrome" ./diagrams/shot.sh diagrams/01_이름.html

맥      /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
윈도우  C:\Program Files\Google\Chrome\Application\chrome.exe
리눅스  google-chrome · chromium
MSG
  exit 1
fi

case "$html" in
  /*) abs="$html" ;;
  *)  abs="$PWD/$html" ;;
esac
[ -f "$abs" ] || { echo "파일 없음: $abs" >&2; exit 1; }

rm -f "$out"
"$browser" --headless=new --disable-gpu --hide-scrollbars \
  --window-size="${width},${height}" --virtual-time-budget=6000 \
  --screenshot="$out" "file://$abs" >/dev/null 2>&1 || true

if [ ! -f "$out" ]; then
  echo "스크린샷 실패: $out (브라우저: $browser)" >&2
  exit 1
fi
echo "$out"
