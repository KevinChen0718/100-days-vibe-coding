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

## 自動定時跑（本機 launchd，每 3 小時）

> **為什麼不是 GitHub Actions？** 試過了，行不通：Alaska 的 Akamai 對 GitHub 機房 IP
> 第一個請求就 `406` 擋掉（只認住宅 IP）。雲端免費排程跟「只認住宅 IP」本質衝突，
> 所以排程改跑在自己 Mac 上（住宅 IP）。`.github/workflows/award-radar-scan.yml` 保留
> 但排程已停用（留手動觸發），等之後若有住宅 IP 的 self-hosted runner 再啟用。

排程用 macOS 原生 `launchd`，檔案在 `scripts/`：
- `scripts/scan-cron.sh`：runner（source nvm 取 node → `node radar.js`）。通知讀專案的 `.env`。
- `scripts/com.kevin.award-radar.plist`：每 3 小時（台北 0/3/6/9/12/15/18/21）；log 在 `~/Library/Logs/award-radar.log`。

安裝 / 管理：
```bash
cp scripts/com.kevin.award-radar.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kevin.award-radar.plist  # 啟用
launchctl kickstart -k gui/$(id -u)/com.kevin.award-radar                            # 立刻跑一次（測試）
launchctl list | grep award-radar                                                    # 看狀態
tail -f ~/Library/Logs/award-radar.log                                               # 看掃描紀錄
launchctl bootout gui/$(id -u)/com.kevin.award-radar                                 # 停用
```
> Mac 睡著時錯過的排程，會在喚醒後補跑一次；要完全不漏就讓 Mac 保持開機。

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

---

## 開發復盤（Day 3）

> 日期：2026-06-08～09　·　線上 demo：本機 `npm run serve`

### 這天做了什麼
把 Day 2 那個「會跑但餵半自動資料」的骨架，接上**真正的 Alaska 即時資料**、加上**每 3 小時自動跑的排程**、再補上**通知去重**。Day 2 把最脆的部分隔離成 `sources/alaska.js` 一個模組，這天的活幾乎全在這個模組裡完成，其他程式沒怎麼動——分天攻的設計這天領到了紅利。

### 為什麼做這個
Day 2 結尾老實標了「自動抓取還沒做」。那其實是整個工具「有沒有用」的命門：抓不到真資料，再漂亮的儀表板都是模型屋。所以 Day 3 就一個目標——把手動望遠鏡換成自動天線。

### 怎麼想的（思考過程 & 技術選擇）
- **不埋頭寫，先偵察可行性**：Day 2 卡在查詢表單是 Auro web component + shadow DOM、字都打不進去。這天第一件事是用瀏覽器探，發現可以**用網址帶參數直接跳結果頁**，整個表單繞過。
- **找資料藏在哪**：頁面是 SvelteKit，結果直接 server-render 在 HTML 的 `__data.json` 裡（devalue 壓縮格式），不用登入、純 fetch 也拿得到。寫了個 unflatten 還原它。
- **中途大轉向**：逐日端點有 token-bucket 限速（連發約 7~10 次就鎖、冷卻數分鐘），一次掃 29 天會中途撞牆。後來挖到**月曆端點 `shoulderDates`**——一個 POST 一次回 ±15 天、純 JSON，把 29 個請求壓成 3 個。這是這天最關鍵的一手。
- **排程選錯又改對**：原本接 GitHub Actions（免費、雲端、不用開機），結果機房 IP 被 Akamai 第一個請求就 406。最後認清「免費雲端排程」和「只認住宅 IP」本質衝突，改用本機 macOS `launchd`，跑在自己住宅 IP 上。

### 踩了哪些坑、怎麼解的（本日精華）

| 遇到的問題 | 卡在哪 | 怎麼解決 | 學到什麼 |
|---|---|---|---|
| 查詢表單打不進字（Day 2 的牆） | Auro web component + shadow DOM | 網址帶參數 deep-link 直接跳結果頁 | 自動化前先找「能不能繞過 UI」，常常有後門 |
| 資料看不懂 | SvelteKit devalue 把物件攤平成索引陣列 | 寫 unflatten 還原；後改用更乾淨的月曆 JSON | server-render 的站，資料常已在 HTML 裡 |
| 一次掃 29 天掃到一半就死 | 逐日端點 token-bucket 限速 | 改用月曆端點，一次回 31 天 | **想抓多筆，先找有沒有「一次回多筆」的端點** |
| 我宣稱「月曆完全不受限速」 | 只跑一次乾淨的就下結論 | 連跑 3 次就露餡——月曆也會被擋（回 HTML 擋頁），只是門檻高 | **下結論前多驗幾次；樂觀的單次結果會騙人** |
| GitHub Actions 排程拿不到真資料 | 機房 IP 被 Akamai 直接 406 | 改本機 launchd，跑住宅 IP | **datacenter IP 會被當機器人；要住宅 IP 就別繞雲端** |
| launchd 跑不起來 | 它的 PATH 很乾淨，找不到 nvm 的 node | runner 裡 `source ~/.nvm/nvm.sh` 再跑 | cron/launchd 環境跟你的 shell 不一樣，別假設 PATH |
| 排程會每 3 小時重複 ping 同一張票 | 沒有去重 | 記「上次通知過什麼」，只在第一次/變便宜/多新日期才發 | 監控的價值在「變化」，不是「現況」 |
| 抓不到時誤判「票沒了」 | 去重狀態若連 mock 也管，會把暫時抓不到當沒票 | 去重只對「真資料」管理狀態 | 區分「真的沒了」與「這次沒拿到」 |

### 成果怎麼看
```bash
npm run scan     # 手動掃一次（住宅 IP 下拿真資料）
npm run serve    # http://localhost:4173 看儀表板
# 排程（每 3 小時自動跑）安裝與查 log 見上面「自動定時跑」段
tail -f ~/Library/Logs/award-radar.log
```

### 下次會怎麼做（給未來的自己）
- 偵察資料源時，**別跑一次成功就宣布勝利**——多跑幾次看會不會被限速/封鎖（這天在「月曆免疫」上栽了一跤）。
- 資料源若是大站（有 Akamai/Cloudflare 這類 bot 防護），**排程一開始就假設要住宅 IP**，別先繞一圈 GitHub Actions 才發現機房 IP 被擋。
- 抓批量資料前，先花十分鐘找「月曆/批次端點」，往往一個請求頂十幾個。

### 一句話總結
這天真正的對手不是「怎麼寫抓取」，是**資料源會反擊**——限速、IP 封鎖、HTML 擋頁。學到的是：誠實面對「拿不到就退 mock、別假裝」，以及**樂觀的單次結果會騙人，下結論前多驗一次**。
