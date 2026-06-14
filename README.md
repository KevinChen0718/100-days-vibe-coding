# 100 天 Vibe Coding 馬拉松

連續 100 天，每天做一個有趣、可以對外公開的網頁小專案，累積自己的 Vibe Coding 作品集。

每個專案都是一個獨立資料夾，盡量做到**打開瀏覽器就能玩／用**，零安裝、零依賴。

## 進度

| Day | 專案 | 說明 | 連結 |
|:--:|:--|:--|:--|
| 001 | 夢遊先生 Mr. Sleepwalker | 致敬 1999 年 Sarbakan《Good Night Mr. Snoozleberg》的物理解謎遊戲：手繪卡通夜色屋頂，從右上角窗戶出發，移動屋頂上隨處可見的東西（木板/天線/遮陽棚/木箱/水管，碰到就固定）幫夢遊的睡衣先生繞出之字安全路線回家。10 關、煙囪轉身/陷阱道具、純 Canvas、lounge jazz、零依賴。 | [day-001-sleepwalker](day-001-sleepwalker/) |
| 002 | 里程票雷達 Award Radar | 用 Alaska 里程盯星宇（STARLUX）優惠票、跌破門檻推 Discord/Telegram 的監控雷達骨架：追蹤清單→掃描→比對門檻→達標通知→儀表板。可替換資料源 adapter + 可插拔通知 + 零依賴。 | [day-002-award-radar](day-002-award-radar/) |
| 003 | 里程票雷達（接續 Day 2） | 接上真正的 Alaska 即時資料（月曆端點一次回整段、免登入/不開瀏覽器）、本機 launchd 每 3 小時自動排程、通知去重。踩穿限速 / datacenter IP 封鎖 / SvelteKit 資料解析等坑。 | [day-002-award-radar](day-002-award-radar/) |
| 004 | 小朋友齊打交・致敬復刻版 | 復刻 LF2 的 2.5D 格鬥遊戲：原作五人眾 Davis/Dennis/Woody/Firen/Freeze，招式指令與 MP 消耗照官方 control guide 對齊；縱深命中、搓招連發、抓投（打暈→抓住→毆打/過肩摔）、倒地受身、撿武器（含召喚冰劍）、2v2 群架（4 種模式）、競技場捲軸（三層視差）。機制照抄、美術音效全原創，零依賴。 | [day-004-little-fighter](day-004-little-fighter/) |
| 005 | 霜峽行動 Operation Frostfjord | 致敬《Commandos: Behind Enemy Lines》第一關的即時戰術潛行：三人小隊（刀殺/手槍/開船）分散登陸挪威雪岸，奪艇渡海用油桶炸掉無線電中繼站。視野錐雙區（近區蹲了也沒用、遠區蹲低隱形）、敵兵三態 FSM、背後刀殺、搬屍體藏灌木、誘餌、快速存讀檔；A* 尋路、ASCII 地圖資料驅動、85 條 Node 回歸測試含腳本化通關驗證。機制重寫、素材全原創，零依賴。 | [day-005-frostfjord](day-005-frostfjord/) |
| 006 | 票價軌跡 Fare Tracker | 國外機票價格追蹤看板：盯國際線票價、看價格軌跡、判斷「現在該買還是該等」。買點訊號＝現價百分位＋距出發天數；區域→國家→城市三層篩選、航空公司與來回/單程、目標價達標亮燈、手刻 SVG 圖表（含懸停十字線）、localStorage 持久化。資料層可替換且誠實標示——先做可重現模擬（標「模擬」），再接 **Travelpayouts 真實票價**（Node `scan.js` 抓最低價寫 `data.json`＋launchd 每 3 小時排程，抓到標「真實」、抓不到退「模擬」；真實價為該出發月最低）。 | [day-006-fare-tracker](day-006-fare-tracker/) |

## 玩法慣例

- 每個 `day-XXX-*/` 資料夾都是一個獨立、可直接打開 `index.html` 的作品。
- 偏好純前端、零建置、零外部依賴，方便任何人 clone 下來立刻跑。

---

由 Kevin 與 AI 協作完成。
