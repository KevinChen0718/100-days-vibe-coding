# Day 7 — MCP Token Tax

> **這個作品已畢業成獨立 repo → [KevinChen0718/mcp-tax](https://github.com/KevinChen0718/mcp-tax)**（可 `npx mcp-tax` 一行安裝）。後續更新都在那邊，這裡保留 Day 7 當天的原始版本與開發復盤。

**Quick Start (English):** Run `node mcp-tax.js` to scan your local MCP configs, connect to stdio MCP servers, estimate how many context tokens their tool schemas consume, print a terminal tax table, and write `tax-receipt.html`. No npm install, no network calls, Node built-ins only.

把看不見的 MCP tool schema context 成本，做成一張可以截圖分享的「token 稅單」。

## 一、這天做了什麼

做了一支零依賴 Node CLI：

```bash
node mcp-tax.js
```

它會掃描常見 MCP 設定檔，實際啟動每個 `command` 型 stdio MCP server，走 MCP JSON-RPC 初始化流程，呼叫 `tools/list` 拿 tool schema，估算這些 schema 佔掉多少 context token，然後輸出兩種結果：

- 終端機表格：逐台 server 工具數、估算 token、佔 context 百分比、總計、最重 tool 前 3 名。
- `tax-receipt.html`：米白底、陶土橘、深森綠的收據風格 HTML 稅單，可直接用瀏覽器打開截圖。

## 二、為什麼做這個

MCP 裝多之後，每台 server 宣告的 tool schema 都會吃掉 context。這個成本平常藏在背景裡，很容易直到對話變慢、上下文變擠才發現。

這支工具不是要精準算帳，而是把「隱形 context 稅」變成一張看得懂、能分享、能拿來整理 MCP 設定的帳單。估算就是估算，所以所有輸出都明確標示「估算值（約 ±20%）」。

## 三、用法

```bash
node mcp-tax.js [--config <path>] [--context 200000] [--price 3] [--timeout 15] [--out tax-receipt.html]
```

參數：

| 參數 | 預設 | 說明 |
|---|---:|---|
| `--config <path>` | 自動掃描 | 指定 MCP 設定檔 |
| `--context <tokens>` | `200000` | context window 大小 |
| `--price <usd>` | `3` | API input token 假設價格，單位 USD / 百萬 token |
| `--timeout <秒>` | `15` | 單一 stdio server 逾時秒數 |
| `--out <path>` | `tax-receipt.html` | HTML 稅單輸出位置 |

自動掃描順序：

1. `./.mcp.json`
2. `~/.claude.json`
3. `~/Library/Application Support/Claude/claude_desktop_config.json`

掃描會合併設定檔，遇到同名 server 時保留第一個。

## 四、它怎麼算

每個 tool 只取會佔 schema 的核心欄位：

```js
JSON.stringify({ name, description, inputSchema })
```

然後用：

```text
字元數 / 4，無條件進位
```

這是粗估，不是 tokenizer 實作。實際 token 數會依模型、序列化格式、client 注入 prompt 的方式而不同，所以報表會標示「估算值（約 ±20%）」。

金額換算用：

```text
總 token * 100 則訊息 * price / 1,000,000
```

預設 `price = 3`，也就是假設 API input token 每百萬 token 3 USD。稅單上會直接印出這個假設。

## 五、MCP 支援範圍

v1 只支援 stdio MCP server，也就是設定裡有：

```json
{
  "mcpServers": {
    "demo": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

工具會對每台 stdio server 做：

1. spawn 子行程
2. 送 `initialize`，`protocolVersion` 使用 `2025-06-18`
3. 送 `notifications/initialized`
4. 呼叫 `tools/list`
5. 若回應有 `nextCursor`，繼續分頁抓完

單一 server 預設逾時 15 秒，可用 `--timeout <秒>` 調整。連不上、逾時、子行程提前結束，都會列在表格裡，不會靜默跳過。若遇到 `npx` 型 server 首次執行，或對 `registry.npmjs.org` 的網路較慢，可能需要用 `--timeout` 拉長逾時。

HTTP / SSE / URL 型 server 會列出來，但標成：

```text
v1 未計入（僅支援 stdio）
```

## 六、測試

```bash
node test/run.js
```

測試涵蓋：

- mock stdio MCP server 回傳 2 個固定 tool，CLI 算出的工具數與 token 估算要正確。
- 一個不存在的壞 server 會被標成失敗，但整體 CLI 仍正常完成並寫出 HTML。
- 一個會輸出 stderr 但不回應 JSON-RPC 的慢 server，逾時失敗原因要保留 stderr 內容。

## 七、誠實限制

- token 是估算值，不是精準 tokenizer 結果，約 ±20%。
- 只估 tool schema，不估 MCP server 回傳內容、系統 prompt、對話歷史或其他 client 注入內容。
- 訂閱制不直接按 token 計費，金額只是 API 等值換算。
- v1 只支援 stdio；HTTP / SSE / URL 型 MCP server 會列出但不計入。
- 這支工具不做任何對外網路請求，也不安裝 npm 套件。
- 啟動 server 代表會執行你本機 MCP 設定裡的 `command`，請只掃描你信任的設定檔。

## 八、一句話總結

MCP 很好用，但 schema 不是免費的；這張稅單就是把「裝越多工具，context 越擠」這件事用一個誠實又有點嘲諷的方式顯示出來。

---

## 開發復盤（Day 7 · 2026-07-11 · 約 2 小時，含研究與派工等待）

### 這天做了什麼
跳出前六天的遊戲／機票舒適圈，做了第一個純開發者工具：掃描本機 MCP 設定、真實握手拿 tool schema、算出 context 稅。本機實測：playwright + firecrawl 共 50 個工具、估 20,703 tokens、context 稅率 10.35%，單支最肥的 firecrawl_scrape 一個就吃 2,057 tokens。

### 為什麼做這個
開工前先跑了一輪 GitHub 生態研究（多 agent 平行掃趨勢），兩個結論定了方向：一是「給初心者的通用小工具」是紅海，二是 2026 真正的機會在 AI agent 生態的「膠水層」——大家 MCP 裝一堆之後才發現 schema 把 context 吃光了。這支工具的差異化不在演算法，在「翻譯」：把冷數字變成一張可截圖的嘲諷稅單，再加上金錢語言（每 100 則訊息燒多少美元）。

### 怎麼想的
- 零依賴單檔 CLI：受眾是剛入門的人，`node mcp-tax.js` 一行要能跑，不准有 npm install。
- 誠實原則（延續 Day 6）：估算就大字標「估算值 ±20%」、計價假設直接印在稅單上、訂閱制不按 token 計費也照實註記。
- stdio JSON-RPC 握手自己寫（initialize → initialized → tools/list 含分頁），不引 SDK。

### 踩了哪些坑（本日精華：一半是 AI 派工流水線的坑，不是程式的坑）

| 遇到的問題 | 卡在哪 | 怎麼解決 | 學到什麼 |
|---|---|---|---|
| 實作 AI 回報「兩台真實 server 全逾時、稅單 0 token」 | 看起來像握手寫壞了 | 獨立驗收方在正常環境重跑三次全過——是實作 AI 的 sandbox 斷網，npx 打不到 registry 當然逾時 | sandbox 裡的「失敗」先問環境再改程式；產出者與驗收者分開的價值就在這裡 |
| 逾時失敗看不到任何錯誤訊息 | 三條失敗路徑只有「逾時」那條沒附 stderr，偏偏它最需要診斷資訊 | 三條路徑改共用同一個 formatter，逾時也帶 stderr；並加了「會叫但永不回應」的 mock 慢 server 回歸測試 | 失敗訊息要走同一條產生線，散裝遲早漏一條 |
| 續派修復時 patch 全被拒 | `codex exec resume --last` 接錯 session，寫入根目錄跑掉 | 重開新 session、明確帶工作目錄重派 | 跨 AI 派工的 session 狀態不可信，續派寧可自包含重開 |

### 成果怎麼看
```bash
cd day-007-mcp-tax
node mcp-tax.js          # 終端機表格 + 產出 tax-receipt.html
node test/run.js         # 4 條回歸測試
```

### 下次會怎麼做
先確認實作環境有沒有網路再解讀「連線失敗」；HTTP/SSE server 支援與精準 tokenizer 留給 v2；demo 用的乾淨設定檔可以早點準備，截圖不必洩露自己的工具鏈。

### 一句話總結
最有價值的產出是那張稅單截圖——工具解決痛點，視覺負責傳播；還有一課：AI 流水線本身也會製造假 bug，驗收環境跟驗收條件一樣重要。
