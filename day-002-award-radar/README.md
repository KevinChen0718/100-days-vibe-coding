# 🛰️ 里程票雷達 Award Radar — Alaska × STARLUX

> 用阿拉斯加航空（Alaska Mileage Plan / Atmos Rewards）的里程，自動盯星宇航空（STARLUX）的限時優惠票。**跌破你設的點數門檻，就推 Discord / Telegram 通知你去搶。**

Day 2 of 100 · Vibe Coding Marathon

## 為什麼是 Alaska × 星宇
星宇沒加入任何航空聯盟，**全世界唯一**能用里程換星宇的就是 Alaska。亞洲區域內短程（例如桃園→東京）的甜蜜價：經濟艙 **7,500 點**、商務艙 **15,000 點**，而且區域線幾乎每班都有位子。問題是優惠哪天放出來看運氣，不可能每天手動查——所以做這個雷達。

## 怎麼跑（需要 Node.js 18+，零 npm 依賴）
```bash
npm run scan     # 掃描一次，產生 data.json
npm run serve    # 開儀表板 http://localhost:4173
```

## 三種用法（看你要多自動）
| 層級 | 做什麼 | 要設定嗎 |
|---|---|---|
| **L0 只看網頁** | 跑 scan + serve，網頁看這區間哪天便宜 | 不用 |
| **L1 + Telegram** | 達標時手機即時推播 | 拿一次 token |
| **L2 + Discord** | 達標時推進你的頻道 | 拿一次 webhook |

## 設定通知（可插拔：設了哪個就推哪個）
複製 `.env.example` 成 `.env`，填你要的管道：
- **Discord**：頻道 → 編輯頻道 → 整合 → Webhook → 複製網址 → 貼 `DISCORD_WEBHOOK_URL`
- **Telegram**：找 `@BotFather` `/newbot` 拿 token；找 `@userinfobot` 拿你的 chat_id；先對新 bot 傳一句話

## 追蹤清單
編輯 `watchlist.json`，或在網頁點「＋新增追蹤航線」產生設定再貼進去。每條航線可設：起迄機場、日期區間、各艙等的通知門檻。

## 資料來源（這是分天攻的關鍵設計）
- **Day 2**：`sources/alaska.js` 是 **mock 模擬資料**；可放 `overrides/<航線id>.json` 灌入真實點數。
- **Day 3（現在）**：`queryRoute()` 改成**真實抓取**——直接 `fetch` Alaska（不開瀏覽器、不用登入），**其餘程式（掃描／門檻／通知／儀表板）完全沒動**——這就是把最難最脆的部分隔離成一個模組的好處。發現它有兩條資料路，各有取捨：
  - **【主力】月曆端點** `POST /search/api/shoulderDates`（`fareView:"as_awards"`）：一次回錨點 ±15 天（≈31 天）的**每日最低獎勵票里程**，純 JSON、**不受下面那個限速地雷影響**。一條航線打一次就拿整段——這是預設走的路。代價：不分艙等／航空公司，給的是「當天最低獎勵票里程」（星宇獨大的亞洲線上＝星宇經濟，所以對應到 **經濟艙**；**商務艙本版不提供**）。
  - **【次要】逐日端點** `GET /search/results/__data.json`：含航空公司／艙等／剩餘位數等細節，但**有 token-bucket 限速**（短時間連發約 7～10 次就鎖成連續 `406`、冷卻數分鐘），一次只能查一天。留給未來 #2 過濾航司 / #5 剩位提醒按需取用，預設不走。
  - 抓到真票 → 標 `real`、才會推播；抓不到 → 自動退回 mock（標「模擬」、絕不發假通知）。
  - `RADAR_SOURCE=mock npm run scan` 可強制走離線假資料（開發 / demo）。

## 之後：自動定時跑
可掛 **GitHub Actions** 免費定時 `scan`，結果 commit 回 `data.json`，配 GitHub Pages 顯示，全程 serverless 不用自己開機。

## 檔案結構
```
radar.js          大腦：讀清單→查→比對門檻→寫 data.json→達標通知
watchlist.json    你要追的航線
data.json         掃描結果（radar 產生，前端讀）
sources/alaska.js 資料來源 adapter（Day2 mock / Day3 真實）
notify/           可插拔通知（discord.js / telegram.js / index.js）
index.html ...    前端儀表板（讀 data.json 動態渲染）
serve.js          零依賴本地伺服器
```

## 開發復盤（Day 2）

### 這天做了什麼
做出「里程票雷達」的會跑骨架：追蹤清單 → 掃描 → 比對門檻 → 達標推 Discord/Telegram → 儀表板呈現。TPE→NRT 用真資料、其餘為模擬示範。**注意：自動抓取 Alaska 還沒做（Day 3）**，目前真值靠手動查 + 填 `overrides`。

### 為什麼做這個
Alaska 是全世界唯一能用里程換星宇的計劃，亞洲短程甜蜜價，但優惠哪天放出來看運氣、不可能每天手動查。想做一個會自動盯、便宜就提醒的雷達。

### 怎麼想的（關鍵決策）
- **分兩天攻**：偵察發現自爬 Alaska 是 Auro web component + shadow DOM 的硬骨頭，連把機場代碼打進去都很難。與其卡死，不如 Day 2 先把「會跑的身體」做好、用半自動/mock 資料，Day 3 再專攻自動抓取。把最難最脆的部分隔離成可替換模組 `sources/alaska.js`。
- **資料源 adapter**：`overrides/<id>.json` 真值蓋 mock；Day 3 只要換掉 `queryRoute()`，其餘程式不動。
- **通知可插拔**：`.env` 設了哪個管道就推哪個，沒設只看網頁。一份 code 支援三種用法。
- **圖表轉折**：原本放「歷史折線圖」被打槍（沒決策價值、會被動態定價誤導），改成「**區間每日點數長條圖**」——回答「這幾天哪天飛便宜」，有當下決策價值。

### 踩了哪些坑、怎麼解的（本日精華）

| 遇到的問題 | 卡在哪 | 怎麼解決 | 學到什麼 |
|---|---|---|---|
| 殘留 Chrome 鎖住 profile | Playwright 連不上瀏覽器 | kill 殘留進程釋放 profile | 多個 session 會搶同一個瀏覽器 profile |
| Alaska 表單打不進字 | 機場欄位是 Auro web component + shadow DOM | 確認自爬難度高 → 改分天攻 | 第三方網站自動化先偵察可行性，別埋頭寫 |
| 日期整排偏一天，override 對不上 | `dateRange` 用了 `toISOString()`（UTC），台北午夜換 UTC 倒退一天 | 改用本地 `getFullYear/Month/Date` 格式化 | **處理本地日期永遠別走 `toISOString()`** |
| 發出假通知（mock 亂編 7.5k） | 沒真資料卻發看起來像真的警報 | 標記 `source: real/mock`，只有 real 發通知、mock 標「模擬」 | **沒真資料就別發像真的警報，比不發更糟** |

### 成果怎麼看
```bash
npm run scan     # 掃描，產生 data.json
npm run serve    # http://localhost:4173
```

### Day 3 待辦（今天用真實情境學到的）
- 自動抓取 Alaska（把手動望遠鏡換成自動天線）
- 過濾航空公司（只追星宇 JX？還是接受日航 JL 等夥伴）
- 「--」無位（Unavailable）狀態建模
- 來回 / 單程切換（Alaska 預設來回，數字差一倍）
- 剩餘位數提醒（last N seats）、動態定價 / 進場時機

### 一句話總結
最大收穫不是寫了多少功能，是學會兩條原則：**把最難最脆的部分隔離成可替換模組**，以及**沒有真資料就別發假警報**。
