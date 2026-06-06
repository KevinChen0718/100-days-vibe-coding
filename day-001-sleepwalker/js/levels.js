/*
 * 夢遊先生 Mr. Sleepwalker — 關卡資料（日常屋頂物件版）
 *
 * 取向（依 Kevin 回饋 + 原作）：
 *  - 起點在右上角，目標在對角（左下/下方），主角夢遊著一路繞下去。
 *  - 只用屋頂上「日常隨處可見」的東西：木板、天線(當橋)、遮陽棚(軟著陸)、木箱(墊高/擋路)、水管(走進去從另一頭出來)。煙囪是固定機關、撞到會轉身。沒有彈簧。
 *  - 即時可動，但道具被先生碰到就固定 → 不能拖一塊板子推到底。
 *  - 用煙囪/木箱讓他轉彎、用落下方向做之字繞路；難度循序漸進、後段多物件 + 陷阱。
 *  - test/solve.js 驗「可解 + 沒擺不能過 + 每個(真)道具必要」。
 *
 * type：board/antenna(剛性橋) · awning(軟著陸) · crate(墊高/擋牆) · (decoy:true = 陷阱)
 * kind：water/spike（spike 沉在缺口底，橋鋪在上方安全）
 * portals(水管)：成對，走進去從 link 的另一個出來；exitFacing 設冒出後面向。
 * props：純裝飾（antenna/dish/flowerpot/cat/clothesline/smokestack）。
 */
(function (root) {
  'use strict';

  var W = 960, H = 620;
  var LW = { x: 0, y: 0, w: 32, h: H, kind: 'wall' };
  var RW = { x: 928, y: 0, w: 32, h: H, kind: 'wall' };
  var PC = '#9b8cff', PC2 = '#7fd6c0';
  function world() { return { w: W, h: H }; }

  var LEVELS = [
    // 1 —— 出窗：搭橋 + 軟著陸
    {
      id: 1, name: '走出窗外', chapter: '第一章 · 屋頂', theme: 'roof',
      story: '夢遊先生從右上角的窗戶爬出來，往左邊的屋頂走。先搭橋過巷，再讓他軟軟地落到下一棟。',
      hint: '木板補中間的巷子；左邊那棟低很多，鋪遮陽棚接住他。可以邊走邊擺，碰到就固定。',
      world: world(), startFacing: -1, bed: { x: 830, y: 180 },
      solids: [LW, RW,
        { x: 560, y: 180, w: 300, h: 20 },
        { x: 260, y: 180, w: 200, h: 20 },
        { x: 32, y: 420, w: 400, h: 20 }],
      hazards: [{ x: 460, y: 540, w: 100, h: 80, kind: 'water' }],
      props: [
        { type: 'smokestack', x: 640, y: 180 },
        { type: 'antenna', x: 360, y: 180 },
        { type: 'flowerpot', x: 180, y: 420 },
        { type: 'cat', x: 300, y: 420, color: '#9a9aa6' }],
      movables: [
        { id: 'board', type: 'board', x: 700, y: 176, w: 120, h: 14 },
        { id: 'awning', type: 'awning', x: 320, y: 396, w: 180, h: 24 }],
      exit: { x: 50, y: 342, w: 50, h: 78 },
      solution: [{ id: 'board', x: 460, y: 172 }, { id: 'awning', x: 110, y: 396 }]
    },

    // 2 —— 撞煙囪：先生會被擋回頭，看清楚他往哪掉
    {
      id: 2, name: '撞煙囪', chapter: '第一章 · 屋頂', theme: 'roof',
      story: '他往左走會撞到煙囪、被擋回來往右；右邊那棟低很多。算準他往哪掉，把遮陽棚鋪好。',
      hint: '煙囪會把他擋回往右走、再從右緣掉下去——遮陽棚要鋪在右邊那棟上。',
      world: world(), startFacing: -1, bed: { x: 720, y: 200 },
      solids: [LW, RW,
        { x: 260, y: 200, w: 500, h: 20 },
        { x: 320, y: 130, w: 26, h: 70, kind: 'wall' },
        { x: 560, y: 430, w: 368, h: 20 }],
      hazards: [{ x: 460, y: 540, w: 100, h: 80, kind: 'water' }],
      props: [
        { type: 'antenna', x: 700, y: 200 },
        { type: 'dish', x: 620, y: 430 },
        { type: 'flowerpot', x: 880, y: 430 },
        { type: 'clothesline', x: 360, y: 150, x2: 540, y2: 150 }],
      movables: [{ id: 'awning', type: 'awning', x: 300, y: 406, w: 180, h: 24 }],
      exit: { x: 866, y: 352, w: 50, h: 78 },
      solution: [{ id: 'awning', x: 700, y: 406 }]
    },

    // 3 —— 推木箱讓他轉身 + 木板過巷
    {
      id: 3, name: '推個木箱', chapter: '第一章 · 屋頂', theme: 'sky',
      story: '他往右走會掉下屋簷，家卻在左邊。用木箱把他擋回來，再用木板補左邊的巷子。',
      hint: '把木箱擋在右邊讓他轉身往左，再用木板補左邊的缺口到家。',
      world: world(), startFacing: 1, bed: { x: 400, y: 260 },
      solids: [LW, RW,
        { x: 200, y: 260, w: 560, h: 20 },
        { x: 32, y: 260, w: 140, h: 20 }],
      hazards: [{ x: 760, y: 360, w: 168, h: 260, kind: 'water' }, { x: 172, y: 360, w: 28, h: 260, kind: 'water' }],
      props: [
        { type: 'smokestack', x: 600, y: 260 },
        { type: 'antenna', x: 300, y: 260 },
        { type: 'cat', x: 90, y: 260, color: '#e0a050' }],
      movables: [
        { id: 'crate', type: 'crate', x: 250, y: 180, w: 48, h: 80 },
        { id: 'board', type: 'board', x: 600, y: 256, w: 80, h: 14 }],
      exit: { x: 50, y: 182, w: 50, h: 78 },
      solution: [{ id: 'crate', x: 690, y: 180 }, { id: 'board', x: 160, y: 254 }]
    },

    // 4 —— 溜煙囪：走到屋頂煙囪溜下去，從下層屋頂的煙囪冒出來，再落到中庭
    {
      id: 4, name: '溜下煙囪', chapter: '第二章 · 後巷', theme: 'sky',
      story: '他走到別人家屋頂的煙囪，會「咻」地溜下去，從下面那棟的煙囪冒出來。冒出來後還有一階落差。',
      hint: '讓他走進高處的煙囪溜下去；他會站到中層屋頂，再往左掉——下面鋪好遮陽棚接住。',
      world: world(), startFacing: -1, bed: { x: 820, y: 200 },
      solids: [LW, RW,
        { x: 560, y: 200, w: 300, h: 20 },
        { x: 300, y: 360, w: 260, h: 20 },
        { x: 32, y: 500, w: 300, h: 20 }],
      hazards: [],
      props: [
        { type: 'antenna', x: 800, y: 200 },
        { type: 'dish', x: 340, y: 360 },
        { type: 'clothesline', x: 60, y: 470, x2: 220, y2: 470 },
        { type: 'cat', x: 120, y: 500, color: '#9a9aa6' }],
      portals: [
        { id: 'a', x: 600, y: 122, w: 40, h: 78, link: 'b', color: PC2 },
        { id: 'b', x: 460, y: 282, w: 40, h: 78, link: 'a', exitFacing: -1, color: PC2 }],
      movables: [{ id: 'awning', type: 'awning', x: 700, y: 476, w: 180, h: 24 }],
      exit: { x: 50, y: 422, w: 50, h: 78 },
      solution: [{ id: 'awning', x: 160, y: 476 }]
    },

    // 5 —— 之字下樓：往左連掉兩層，兩張遮陽棚各接一次
    {
      id: 5, name: '之字下樓', chapter: '第二章 · 後巷', theme: 'sky',
      story: '他會一路往左、一層層往下掉。算準兩次墜落，各鋪一張遮陽棚接住。',
      hint: '他往左走、掉下去再往左。兩道落差各放一張遮陽棚（會往落下方向飄一點）。',
      world: world(), startFacing: -1, bed: { x: 840, y: 180 },
      solids: [LW, RW,
        { x: 520, y: 180, w: 340, h: 20 },
        { x: 300, y: 350, w: 360, h: 20 },
        { x: 32, y: 520, w: 540, h: 20 }],
      hazards: [],
      props: [
        { type: 'smokestack', x: 820, y: 180 },
        { type: 'antenna', x: 560, y: 180 },
        { type: 'flowerpot', x: 620, y: 350 },
        { type: 'dish', x: 340, y: 350 },
        { type: 'cat', x: 200, y: 520, color: '#e0a050' }],
      movables: [
        { id: 'a1', type: 'awning', x: 700, y: 326, w: 180, h: 24 },
        { id: 'a2', type: 'awning', x: 750, y: 496, w: 180, h: 24 }],
      exit: { x: 60, y: 442, w: 50, h: 78 },
      solution: [{ id: 'a1', x: 410, y: 326 }, { id: 'a2', x: 170, y: 496 }]
    },

    // 6 —— 繞煙囪：之字 + 三道處理（兩遮陽棚 + 一木板）
    {
      id: 6, name: '繞煙囪下樓', chapter: '第三章 · 老城', theme: 'roof',
      story: '撞煙囪回頭、連掉兩層、最後過一道巷。看清楚他每次被擋回後往哪走。',
      hint: '煙囪把他擋回往右掉（遮陽棚一）；右牆又把他擋回往左掉（遮陽棚二）；最後木板補巷。',
      world: world(), startFacing: -1, bed: { x: 700, y: 200 },
      solids: [LW, RW,
        { x: 260, y: 200, w: 500, h: 20 },
        { x: 300, y: 130, w: 26, h: 70, kind: 'wall' },
        { x: 560, y: 400, w: 368, h: 20 },
        { x: 360, y: 560, w: 212, h: 20 },
        { x: 32, y: 560, w: 220, h: 20 }],
      hazards: [{ x: 252, y: 590, w: 108, h: 30, kind: 'water' }],
      props: [
        { type: 'smokestack', x: 700, y: 200 },
        { type: 'dish', x: 600, y: 400 },
        { type: 'antenna', x: 480, y: 560 },
        { type: 'cat', x: 120, y: 560, color: '#9a9aa6' }],
      movables: [
        { id: 'a1', type: 'awning', x: 760, y: 376, w: 180, h: 24 },
        { id: 'a2', type: 'awning', x: 760, y: 536, w: 180, h: 24 },
        { id: 'board', type: 'board', x: 80, y: 540, w: 150, h: 14 }],
      exit: { x: 60, y: 482, w: 50, h: 78 },
      solution: [{ id: 'a1', x: 700, y: 376 }, { id: 'a2', x: 400, y: 536 }, { id: 'board', x: 250, y: 556 }]
    },

    // 7 —— 水管 + 軟著陸 + 過巷
    {
      id: 7, name: '溜到對街', chapter: '第三章 · 老城', theme: 'dawn',
      story: '從高處的煙囪溜到對街下層的屋頂，落地後還隔著一道水溝才到家。',
      hint: '走進右邊高處的煙囪溜下去，他會站到左下的屋頂；再用木板補水溝走到家。',
      world: world(), startFacing: -1, bed: { x: 820, y: 220 },
      solids: [LW, RW,
        { x: 460, y: 220, w: 400, h: 20 },
        { x: 32, y: 500, w: 360, h: 20 },
        { x: 560, y: 500, w: 368, h: 20 }],
      hazards: [{ x: 392, y: 560, w: 168, h: 60, kind: 'water' }],
      props: [
        { type: 'antenna', x: 800, y: 220 },
        { type: 'smokestack', x: 560, y: 220 },
        { type: 'flowerpot', x: 600, y: 500 },
        { type: 'clothesline', x: 60, y: 470, x2: 220, y2: 470 }],
      portals: [
        { id: 'a', x: 600, y: 142, w: 40, h: 78, link: 'b', color: PC },
        { id: 'b', x: 120, y: 422, w: 40, h: 78, link: 'a', exitFacing: 1, color: PC }],
      movables: [{ id: 'board', type: 'board', x: 800, y: 484, w: 170, h: 14 }],
      exit: { x: 866, y: 422, w: 50, h: 78 },
      solution: [{ id: 'board', x: 400, y: 496 }]
    },

    // 8 —— 飛簷走壁：天線當橋 + 木板 + 遮陽棚
    {
      id: 8, name: '飛簷走壁', chapter: '第三章 · 老城', theme: 'sky',
      story: '兩道巷、一次墜落。倒下的天線和木板都能當橋，看哪道巷該用哪個。',
      hint: '先用天線（或木板）補第一道巷，遮陽棚接住中間的墜落，再用另一塊補最後的巷。',
      world: world(), startFacing: -1, bed: { x: 840, y: 200 },
      solids: [LW, RW,
        { x: 640, y: 200, w: 220, h: 20 },
        { x: 400, y: 200, w: 160, h: 20 },
        { x: 32, y: 440, w: 300, h: 20 },
        { x: 470, y: 440, w: 458, h: 20 }],
      hazards: [
        { x: 560, y: 300, w: 80, h: 60, kind: 'water' },
        { x: 332, y: 500, w: 138, h: 120, kind: 'water' }],
      props: [
        { type: 'smokestack', x: 820, y: 200 },
        { type: 'antenna', x: 440, y: 200 },
        { type: 'dish', x: 520, y: 440 },
        { type: 'cat', x: 120, y: 440, color: '#e0a050' }],
      movables: [
        { id: 'antenna', type: 'antenna', x: 700, y: 192, w: 150, h: 16 },
        { id: 'awning', type: 'awning', x: 80, y: 416, w: 180, h: 24 },
        { id: 'board', type: 'board', x: 500, y: 424, w: 160, h: 14 }],
      exit: { x: 866, y: 362, w: 50, h: 78 },
      solution: [{ id: 'antenna', x: 552, y: 192 }, { id: 'awning', x: 240, y: 416 }, { id: 'board', x: 350, y: 436 }]
    },

    // 9 —— 紅鯡魚：給你的木箱是多餘的，看清楚別亂放
    {
      id: 9, name: '別被騙了', chapter: '第四章 · 天亮前', theme: 'dawn',
      story: '他往左掉、鑽水管回到封死的家。給你的道具裡有一個是多餘的——別亂放。',
      hint: '只需要遮陽棚接住那次墜落、再走進水管就到家了。那個木箱是陷阱。',
      world: world(), startFacing: -1, bed: { x: 820, y: 240 },
      solids: [LW, RW,
        { x: 500, y: 240, w: 360, h: 20 },
        { x: 300, y: 420, w: 400, h: 20 },
        { x: 32, y: 520, w: 260, h: 20 }],
      hazards: [],
      props: [
        { type: 'antenna', x: 800, y: 240 },
        { type: 'smokestack', x: 560, y: 240 },
        { type: 'cat', x: 120, y: 520, color: '#9a9aa6' },
        { type: 'flowerpot', x: 240, y: 520 }],
      portals: [
        { id: 'a', x: 320, y: 342, w: 40, h: 78, link: 'b', color: PC2 },
        { id: 'b', x: 60, y: 442, w: 40, h: 78, link: 'a', exitFacing: 1, color: PC2 }],
      movables: [
        { id: 'awning', type: 'awning', x: 700, y: 396, w: 180, h: 24 },
        { id: 'decoyCrate', type: 'crate', x: 600, y: 336, w: 48, h: 84, decoy: true }],
      exit: { x: 220, y: 442, w: 50, h: 78 },
      solution: [{ id: 'awning', x: 380, y: 396 }]
    },

    // 10 —— 終章：之字長路 + 過巷 + 鑽水管 + 高處落下
    {
      id: 10, name: '回到床上', chapter: '第四章 · 天亮前', theme: 'dawn',
      story: '天快亮了，最長的一段：往左掉、過巷、鑽水管、再從高處落下回到床。看清楚路再動手。',
      hint: '遮陽棚接第一次墜落、木板補巷、走進水管；水管另一頭很高，再用第二張遮陽棚接住。',
      world: world(), startFacing: -1, bed: { x: 820, y: 160 },
      solids: [LW, RW,
        { x: 540, y: 160, w: 320, h: 20 },
        { x: 320, y: 320, w: 340, h: 20 },
        { x: 32, y: 320, w: 200, h: 20 },
        { x: 560, y: 480, w: 368, h: 20 }],
      hazards: [],
      props: [
        { type: 'smokestack', x: 800, y: 160 },
        { type: 'antenna', x: 560, y: 160 },
        { type: 'dish', x: 360, y: 320 },
        { type: 'clothesline', x: 60, y: 290, x2: 220, y2: 290 },
        { type: 'cat', x: 620, y: 480, color: '#e0a050' }],
      portals: [
        { id: 'a', x: 44, y: 242, w: 40, h: 78, link: 'b', color: PC },
        { id: 'b', x: 600, y: 242, w: 40, h: 78, link: 'a', exitFacing: 1, color: PC }],
      movables: [
        { id: 'a1', type: 'awning', x: 700, y: 296, w: 180, h: 24 },
        { id: 'board', type: 'board', x: 740, y: 304, w: 160, h: 14 },
        { id: 'a2', type: 'awning', x: 760, y: 456, w: 180, h: 24 }],
      exit: { x: 866, y: 402, w: 50, h: 78 },
      solution: [
        { id: 'a1', x: 410, y: 296 },
        { id: 'board', x: 222, y: 316 },
        { id: 'a2', x: 560, y: 456 }]
    }
  ];

  var api = { LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SleepwalkerLevels = api;
})(typeof window !== 'undefined' ? window : this);
