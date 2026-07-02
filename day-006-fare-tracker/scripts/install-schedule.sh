#!/bin/zsh
# =====================================================================
# install-schedule.sh — 一鍵安裝「每 3 小時自動掃描」排程（macOS launchd）
# ---------------------------------------------------------------------
# 用法：scripts/install-schedule.sh
# 做什麼：
#   1. 自動偵測專案路徑（不寫死任何人的家目錄）。
#   2. 動態產生 plist 到 ~/Library/LaunchAgents/ 並載入。
#      Label 帶專案路徑 hash，同一台機器放兩份專案也不會撞名。
#   3. 排程呼叫 scan-cron-portable.sh（自動找 node，跑 v2 掃描器：
#      過期跳過／查無退避／逾時重試）。
# 移除：scripts/uninstall-schedule.sh
# Linux 使用者：launchd 是 macOS 專屬，請改用 crontab（README 有一行範例）。
# =====================================================================

set -eu

if [ "$(uname)" != "Darwin" ]; then
  echo "這支腳本只支援 macOS（launchd）。"
  echo "Linux 請改用 crontab -e 加這行（每 3 小時掃一次）："
  echo '  0 */3 * * * cd /你的專案路徑 && node scan-v2.js >> "$HOME/fare-tracker.log" 2>&1'
  exit 1
fi

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
HASH="$(/sbin/md5 -q -s "${PROJ}" | cut -c1-8)"
LABEL="com.fare-tracker.${HASH}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUNNER="${PROJ}/scripts/scan-cron-portable.sh"
LOG="$HOME/Library/Logs/fare-tracker.log"

if [ ! -f "${PROJ}/scan-v2.js" ]; then
  echo "找不到 ${PROJ}/scan-v2.js，請在專案的 scripts/ 目錄下執行這支腳本。"
  exit 1
fi

# 前置檢查：至少要有一個資料來源，否則排程只會每 3 小時失敗一次
if ! command -v node >/dev/null 2>&1; then
  echo "找不到 node，請先安裝 Node.js（v18 以上）再裝排程。"
  exit 1
fi
if ! node -e 'process.exit(require("'"${PROJ}"'/sources/resolve.js").sources().length ? 0 : 1)'; then
  echo "還沒設定任何 API 金鑰（.env）——排程裝了也抓不到真實價。"
  echo "先跑 npm run setup 設定，再回來裝排程。"
  exit 1
fi

# macOS TCC 提醒：launchd 背景程序讀不到 ~/Documents / ~/Desktop / ~/Downloads
case "${PROJ}" in
  "$HOME/Documents/"*|"$HOME/Desktop/"*|"$HOME/Downloads/"*)
    echo "注意：專案放在 ~/Documents、~/Desktop 或 ~/Downloads 底下，"
    echo "macOS 的隱私保護（TCC）常會擋住 launchd 背景讀取這些資料夾，排程可能默默失敗。"
    echo "建議把專案搬到例如 ~/projects/ 再裝；或在系統設定給 node 完整磁碟取用權限。"
    ;;
esac

chmod +x "${RUNNER}"

cat > "${PLIST}" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>${RUNNER}</string>
    </array>

    <!-- 每天 0/3/6/9/12/15/18/21 點各跑一次（每 3 小時） -->
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>15</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>0</integer></dict>
    </array>

    <key>StandardOutPath</key>
    <string>${LOG}</string>
    <key>StandardErrorPath</key>
    <string>${LOG}</string>
</dict>
</plist>
PLIST_EOF

launchctl unload "${PLIST}" 2>/dev/null || true
launchctl load "${PLIST}"

echo "排程已安裝並載入："
echo "  Label：${LABEL}"
echo "  plist：${PLIST}"
echo "  掃描器：scan-v2.js（過期跳過／查無退避／逾時重試）"
echo "  log：${LOG}"
echo ""
echo "確認方式：launchctl list | grep fare-tracker"
echo "立刻手動跑一次：zsh '${RUNNER}' && tail -n 20 '${LOG}'"
echo "移除排程：scripts/uninstall-schedule.sh"
