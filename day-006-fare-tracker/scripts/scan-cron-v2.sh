#!/bin/zsh
# launchd 排程跑 scan-v2.js 的包裝腳本（2026-07-02 進版）。
# 原 scan-cron.sh 不動；回退＝把 plist 指回 scan-cron.sh。
# v2 差異：跑 scan-v2.js（過期跳過／查無退避／逾時重試）+ log 超長自動修剪。
# launchd 的環境很乾淨（PATH 沒有 node），所以這裡直接指定 nvm 的 node 路徑。

NODE_BIN="/Users/kevinchen/.nvm/versions/node/v22.14.0/bin"
export PATH="$NODE_BIN:$PATH"

PROJ="/Users/kevinchen/projects/100-days-vibe-coding/day-006-fare-tracker"
LOG="$HOME/Library/Logs/fare-tracker.log"

# log 超過 10000 行就修剪成最近 5000 行（每 3 小時跑一次、一年會長到 4 萬行）
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 10000 ]; then
  tail -n 5000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

cd "$PROJ" || exit 1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') scan 開始（v2）=====" >> "$LOG"
node "$PROJ/scan-v2.js" >> "$LOG" 2>&1
echo "" >> "$LOG"
