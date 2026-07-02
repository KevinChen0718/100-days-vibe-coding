#!/bin/zsh
# 移除 install-schedule.sh 裝的 launchd 排程（label 依專案路徑 hash 計算，
# 所以要在「當初安裝的那份專案」裡執行才對得上）。

set -eu

if [ "$(uname)" != "Darwin" ]; then
  echo "這支腳本只支援 macOS。Linux 請用 crontab -e 手動移除那行排程。"
  exit 1
fi

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
HASH="$(/sbin/md5 -q -s "${PROJ}" | cut -c1-8)"
LABEL="com.fare-tracker.${HASH}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [ ! -f "${PLIST}" ]; then
  echo "找不到 ${PLIST}——這份專案沒裝過排程，或當初是從別的路徑裝的。"
  echo "手動查：ls ~/Library/LaunchAgents | grep fare-tracker"
  exit 1
fi

launchctl unload "${PLIST}" 2>/dev/null || true
rm "${PLIST}"
echo "已移除排程 ${LABEL}（log 檔保留在 ~/Library/Logs/fare-tracker.log，不動）。"
