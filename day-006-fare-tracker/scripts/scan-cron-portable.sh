#!/bin/zsh
# =====================================================================
# scan-cron-portable.sh — 通用版排程包裝腳本（任何人的機器都能跑）
# ---------------------------------------------------------------------
# 與 scan-cron.sh / scan-cron-v2.sh 的差別：不寫死任何機器路徑。
#   - 專案路徑：從腳本自身位置反推（放哪都行）
#   - node 路徑：自動偵測（PATH → nvm → Homebrew → /usr/local）
# 既有的 scan-cron*.sh 一字未動；這支是給新使用者的版本，
# 由 install-schedule.sh 產生的 launchd 排程呼叫。
# =====================================================================

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${FARE_TRACKER_LOG:-$HOME/Library/Logs/fare-tracker.log}"

# 找 node：launchd 的環境很乾淨（PATH 常常沒有 node），按常見安裝位置逐一找
NODE=""
if command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
else
  for cand in "$HOME"/.nvm/versions/node/*/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
    [ -x "$cand" ] && NODE="$cand"
  done
fi
if [ -z "$NODE" ]; then
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') 找不到 node，掃描跳過 =====" >> "$LOG"
  echo "PATH、~/.nvm、/opt/homebrew/bin、/usr/local/bin 都沒有 node。裝好 Node.js 後重跑。" >> "$LOG"
  exit 1
fi

# log 超過 10000 行就修剪成最近 5000 行（每 3 小時跑一次、一年會長到 4 萬行）
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 10000 ]; then
  tail -n 5000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

cd "$PROJ" || exit 1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') scan 開始（portable / v2 掃描器）=====" >> "$LOG"
"$NODE" "$PROJ/scan-v2.js" >> "$LOG" 2>&1
echo "" >> "$LOG"
