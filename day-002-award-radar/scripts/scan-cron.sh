#!/bin/bash
# 里程票雷達 — launchd 排程 runner。每 3 小時被叫一次。
#
# 為什麼是本機跑：Alaska 只認住宅 IP，GitHub 機房 IP 會被 Akamai 立刻 406。
# 所以排程放在你 Mac（住宅 IP）上跑，不走雲端。
#
# 為什麼專案在 ~/projects 而非 ~/Documents：macOS 隱私保護（TCC）會擋背景排程（launchd）
# 存取 ~/Documents，所以這個會被自動排程跑的 repo 放在 ~/projects（非保護區）。
#
# 通知：scan 會自動讀專案目錄下的 .env（DISCORD_WEBHOOK_URL / TELEGRAM_*），
#       有設就推、沒設只更新 data.json。不必把密鑰寫進這支腳本或 plist。
set -u

# launchd 的 PATH 很乾淨，且 node 走 nvm 的版本路徑（會隨版本變）。
# 這裡 source nvm 取得 node，升級 node 版本也不會壞。
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" >/dev/null 2>&1

PROJECT_DIR="$HOME/projects/100-days-vibe-coding/day-002-award-radar"
cd "$PROJECT_DIR" || { echo "找不到專案目錄：$PROJECT_DIR"; exit 1; }

echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') 排程掃描開始 ====="
node radar.js
status=$?
echo "----- 結束（exit=$status）-----"
echo ""
exit $status
