# Day 8 — Inbox Distiller

把 Obsidian Web Clipper、臨時摘錄、文章片段先丟進 `inbox`，再讓你指定的 agent 一檔一檔蒸餾成 LLM Wiki 筆記。

這支工具自己不寫知識筆記，也不刪 inbox 原檔。它只負責挑出還沒成功處理過的檔案、把工作手冊交給 agent、記 ledger，讓 agent 在 vault 裡完成整理。

## Quick Start

```bash
cd day-008-inbox-distiller
node distill.js --vault ~/vault --init
node distill.js --vault ~/vault
```

初始化會在 vault 內建立：

```text
wiki.config.json
inbox/
knowledge/
```

`目錄.md` 與 `日誌.md` 預設放在 vault 根目錄，首次成功蒸餾時由 agent 建立或更新。`wiki.config.json` 是標準 JSON，不能放 `//` 註解。欄位說明看下方 config 表。

常用指令：

```bash
node distill.js --vault ~/vault --dry-run
node distill.js --vault ~/vault --timeout 180
node distill.js --help
```

## Obsidian Web Clipper 設定

1. 在 Obsidian 開啟你的 vault，例如 `~/vault`。
2. 執行 `node distill.js --vault ~/vault --init`。
3. 到 Obsidian Web Clipper 的模板或儲存位置設定。
4. 把剪藏輸出資料夾指到 vault 內的 `inbox`。
5. 剪藏文章後，先確認檔案出現在 `~/vault/inbox`。
6. 回到終端機執行 `node distill.js --vault ~/vault`。

建議把 Web Clipper 的輸出維持成 Markdown。原始剪藏檔會保留在 inbox，方便你回頭查原文。

## Config 欄位

`~/vault/wiki.config.json` 範例：

```json
{
  "inbox": "inbox",
  "knowledge": "knowledge",
  "index": "目錄.md",
  "journal": "日誌.md",
  "agent": "claude",
  "maxPerRun": 5
}
```

| 欄位 | 預設 | 說明 |
|---|---:|---|
| `inbox` | `inbox` | 收件匣資料夾名，相對於 vault 根目錄 |
| `knowledge` | `knowledge` | agent 要寫入筆記的知識庫資料夾名，相對於 vault 根目錄 |
| `index` | `目錄.md` | 知識庫目錄檔路徑，相對於 vault 根目錄 |
| `journal` | `日誌.md` | 匯入日誌檔路徑，相對於 vault 根目錄 |
| `agent` | `claude` | `claude` 代表 `claude -p`，`codex` 代表 `codex exec`，也可填自訂指令字串 |
| `maxPerRun` | `5` | 每次最多處理幾個新檔 |

自訂 agent 例子：

```json
{
  "agent": "node scripts/my-agent.js"
}
```

預設會把蒸餾提示詞從 stdin 送給 agent。若你的指令必須把 prompt 放在參數位置，可以用 `{input}`：

```json
{
  "agent": "my-agent --prompt {input}"
}
```

## LLM Wiki 文字版流程

每次執行時，Inbox Distiller 會做這幾件事：

1. 掃描 `inbox` 裡的檔案。
2. 計算每個檔案的 `sha256`。
3. 查 `~/vault/.inbox-distiller/ledger.json`。
4. 已經 `success` 且 hash 相同的檔案會跳過。
5. 二進位檔會記成 `skipped_binary` 並跳過，不會呼叫 agent。
6. `failed` 的檔案下次會重試。
7. 同一路徑但內容改過，hash 變了，就當成新項目再處理。
8. 對每個待處理檔案，把內嵌工作手冊送給 agent。

agent 收到的手冊會要求它：

- 原始 inbox 檔唯讀。
- 筆記寫進知識庫資料夾。
- 至少加入一個 `[[雙向連結]]`。
- 若知識庫已有同名但主題不同的筆記，換一個不衝突頁名，不覆蓋無關筆記。
- 在 config 指定的目錄檔加上 `[[頁名]] — 一句話`。
- 在 config 指定的日誌檔追加 `## [日期] 匯入 | 檔名`。
- 使用繁體中文白話整理。

若同一輪處理清單出現相同 basename，例如 `inbox/dup.md` 與 `inbox/sub/dup.md`，終端機會印出警告但不會中斷。自訂 agent 如果直接用檔名當筆記檔名，這類來源會互相覆蓋；建議依內容主題命名筆記。

## 支援的檔案類型

這支工具適合處理 Markdown、純文字與其他可由 agent 安全讀取的文字檔。常見圖片、音訊、影片、壓縮檔、Office 檔與 PDF，或檔案前 8KB 含 NUL byte，預設會被判定為二進位檔。

二進位檔會顯示為 `跳過（二進位）`，並在 ledger 記成 `skipped_binary`；同路徑同 hash 下次不會再重列，也不會呼叫 agent。

## Dry Run

```bash
node distill.js --vault ~/vault --dry-run
```

dry-run 只會列出：

- 這次會處理哪些 inbox 檔案
- 會呼叫哪個 agent 指令

它不會寫 ledger，也不會呼叫 agent。

## Ledger

帳本放在：

```text
~/vault/.inbox-distiller/ledger.json
```

每筆會記：

- `relativePath`
- `sha256`
- `status`
- `note`
- `error`
- `updatedAt`

去重會看 `status: "success"` 與 `status: "skipped_binary"` 的同路徑同 hash。失敗紀錄不會阻止下次重試。

## 限制與安全原則

- 零 npm 依賴，只用 Node 18+ 內建模組。
- 不連網；是否連網取決於你設定的 agent 本身。
- 工具本體不寫知識筆記，不修改 inbox 原檔，不刪檔。
- 工具本體只寫 `.inbox-distiller/ledger.json`，以及 `--init` 時的設定檔與資料夾。
- agent 的工作目錄會鎖在 vault 根目錄。
- config 內的 `inbox`、`knowledge`、`index`、`journal` 都必須是 vault 內的相對路徑。
- 若 agent 指令不存在、exit 非 0、或逾時，該檔會記成 `failed`，整體 exit code 會是非 0。
- 自訂 agent 指令不透過 shell 執行，避免 shell 展開造成不可預期的副作用。

## 測試

```bash
node test/run.js
```

測試會建立暫存 vault，用假 agent 驗證：

- 首跑 2 檔會產出筆記、更新目錄與日誌。
- inbox 原檔 bit 不變。
- 二跑 0 檔。
- 內容變更會重新處理。
- dry-run 不落檔。
- agent 失敗會標 `failed`，下次同 hash 會重試。
- 缺 command 會輸出人話錯誤，exit 非 0，沒有 stack trace。
- `index` / `journal` 從 vault 根目錄 resolve，不被強制放進 `knowledge`。
- 同一輪重複 basename 會印出警告。
- 二進位檔會跳過、記 `skipped_binary`，且不呼叫 agent。

---

# 開發復盤（Day 8）

> 日期：2026-07-12　·　花費時間：約 2.5 小時（含派工空轉的學費）　·　純本機 CLI，`node distill.js --help`

## 為什麼做這個

看了一支教「LLM Wiki」的影片（Obsidian ＋ AI 自主維護知識庫），對照自己已有的記憶系統後發現：架構九成早就有了，唯一缺的是「低摩擦餵料管線」——把網頁剪藏、隨手丟的檔案自動蒸餾進知識庫，不用每次手動開對話。與其只補自己的洞，不如做成通用工具當 Day 8。

## 怎麼想的（思考過程 & 技術選擇）

- 分工設計刻意極簡：工具只管「掃描、去重、叫 agent、記帳」，筆記內容 100% 交給下游 AI CLI——工具永不寫筆記、永不動原始檔，責任邊界一刀切。
- 帳本去重用「路徑＋內容 hash」而不是檔名或 mtime：內容變了就重新蒸餾、搬位置不重複處理，語意最接近「這份材料消化過沒」。
- 這是第一個全程用「跨模型互審流水線」做的 Day 專案：Claude 出腦（規格、裁定、驗收交辦）、Codex 出手（寫程式）、Claude 側 fresh-context 驗收官抓漏，修驗兩輪收斂。

## 踩了哪些坑、怎麼解的（本日精華）

| 遇到的問題 | 卡在哪 | 怎麼解決 | 學到什麼 |
|---|---|---|---|
| Codex CLI 丟背景跑永遠不動 | 背景模式 stdin 不是 tty，codex 卡在「Reading additional input from stdin...」 | 指令尾端加 `< /dev/null` | 背景派 CLI 工具，stdin 要顯式關掉 |
| 中斷後想用 `codex exec resume` 接續 | resume 會把可寫目錄掉回預設路徑，連點名正確 session id 也一樣，交辦內容還沒跟過來 | 放棄 resume，中斷一律重開新 session、交辦自包含 | 續派靠「完整交辦」不靠「會話記憶」；而且這兩個坑其實筆記裡早有記載——**派工前重讀最新版手冊**，比事後除錯便宜十倍 |
| Codex 停下來等「同意」不動工 | 它自己的 brainstorming 規則要求先提設計、獲同意才實作 | 把「已核准的設計＋裁定」直接寫進交辦，明說無需再徵求同意 | 派工給有自己規則的 agent，要在交辦裡預先滿足它的關卡 |
| 產出者自測全綠，仍有三個洞 | 路徑語意打架（`../` 可逃出設計假設）、同名筆記靜默覆蓋、二進位檔沒防呆 | fresh-context 驗收官獨立實測抓出，一輪修完、二輪複驗通過 | 寫的人測不出自己的假設——驗收一定換一雙眼睛，且驗收官要自己動手跑，不能只讀回報 |

## 下次會怎麼做

先花三分鐘重讀工具手冊的踩坑區再派工——今天兩輪空轉都是別的 session 已經記錄過的坑。制度寫了沒讀，等於沒寫。

## 一句話總結

用「兩個 AI 互相把關」的流水線，做出一個「讓 AI 幫你消化收件匣」的工具——過程本身就是產品理念的最好證明。
