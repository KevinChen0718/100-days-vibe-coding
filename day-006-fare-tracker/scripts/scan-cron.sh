#!/bin/zsh
# launchd 排程跑 scan.js 的包裝腳本。
# launchd 的環境很乾淨（PATH 沒有 node），所以這裡直接指定 nvm 的 node 路徑。

NODE_BIN="/Users/kevinchen/.nvm/versions/node/v22.14.0/bin"
export PATH="$NODE_BIN:$PATH"

PROJ="/Users/kevinchen/projects/100-days-vibe-coding/day-006-fare-tracker"
LOG="$HOME/Library/Logs/fare-tracker.log"

cd "$PROJ" || exit 1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') scan 開始 =====" >> "$LOG"
node "$PROJ/scan.js" >> "$LOG" 2>&1
echo "" >> "$LOG"
