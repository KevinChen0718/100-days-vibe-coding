/*
 * 夢遊先生 Mr. Sleepwalker — 關卡資料（曲折屋頂版）
 *
 * 設計原則：
 *  - 即時可動，但道具被先生碰到就固定 → 不能拖一塊板子推到底。
 *  - 用煙囪/箱子讓他轉彎、用落下方向做之字路線 → 路徑要研究、不好預測。
 *  - 道具配額剛好、每個都必要（test/solve.js 驗「可解+沒擺不能過+每個道具必要」）。
 *  - 後段加「陷阱道具」decoy（看似有用、其實不需要），逼玩家判斷該動哪個。
 *  - 主角不能往上爬高過 16px；要上樓只能彈簧。箱子用於墊落差(往下)或當牆讓他轉身。
 *
 * type：plank/box/spring/mattress（decoy:true = 陷阱道具，不列入 solution）
 * kind：water/spike（spike 一律沉在缺口底，木板鋪在上方安全）
 * portals：成對管道；exitFacing 設定冒出後面向。
 */
(function (root) {
  'use strict';

  var W = 960, H = 620;
  var LW = { x: 0, y: 0, w: 32, h: H, kind: 'wall' };
  var RW = { x: 928, y: 0, w: 32, h: H, kind: 'wall' };
  var PC = '#9b8cff', PC2 = '#7fd6c0';
  function world() { return { w: W, h: H }; }

  var LEVELS = [
    // 1 —— 教學：鋪木板過巷
    {
      id: 1, name: '半夜・起床', chapter: '第一章 · 出門', theme: 'room',
      story: '夢遊先生爬起來走向屋頂。兩棟樓之間有道巷子——鋪塊板讓他走過去。',
      hint: '把木板拖到缺口上鋪平。可以邊走邊擺，但被他碰到就固定了。',
      world: world(), startFacing: 1, bed: { x: 110, y: 470 },
      solids: [LW, RW, { x: 32, y: 470, w: 360, h: 20 }, { x: 520, y: 470, w: 408, h: 20 }],
      hazards: [{ x: 392, y: 540, w: 128, h: 80, kind: 'water' }],
      movables: [{ id: 'plank', type: 'plank', x: 700, y: 454, w: 150, h: 16 }],
      exit: { x: 840, y: 392, w: 54, h: 78 },
      solution: [{ id: 'plank', x: 376, y: 462 }]
    },

    // 2 —— 教學：雨棚軟著陸
    {
      id: 2, name: '跳下雨棚', chapter: '第一章 · 出門', theme: 'roof',
      story: '下一棟樓矮一截，直接跳下去會摔醒。鋪個軟的接住他。',
      hint: '床墊（條紋雨棚）能接住任何高度的墜落。鋪在他落下的位置（會稍微往前飄）。',
      world: world(), startFacing: 1, bed: { x: 110, y: 300 },
      solids: [LW, RW, { x: 32, y: 300, w: 520, h: 20 }, { x: 32, y: 480, w: 896, h: 20 }],
      hazards: [],
      movables: [{ id: 'mat', type: 'mattress', x: 760, y: 454, w: 150, h: 26 }],
      exit: { x: 840, y: 402, w: 54, h: 78 },
      solution: [{ id: 'mat', x: 500, y: 454 }]
    },

    // 3 —— 教學：箱子當牆讓他轉身
    {
      id: 3, name: '轉個彎', chapter: '第一章 · 出門', theme: 'room',
      story: '家在他背後的左邊，他卻往右走、右邊是深巷。讓他回頭。',
      hint: '主角撞到比他高的東西會轉身。把箱子擋在他右邊。',
      world: world(), startFacing: 1, bed: { x: 380, y: 470 },
      solids: [LW, RW, { x: 32, y: 470, w: 520, h: 20 }],
      hazards: [{ x: 552, y: 540, w: 376, h: 80, kind: 'water' }],
      movables: [{ id: 'box', type: 'box', x: 150, y: 378, w: 56, h: 92 }],
      exit: { x: 46, y: 392, w: 54, h: 78 },
      solution: [{ id: 'box', x: 470, y: 378 }]
    },

    // 4 —— 教學：彈簧床往上彈
    {
      id: 4, name: '彈上高樓', chapter: '第一章 · 出門', theme: 'roof',
      story: '家在更高的那棟樓，他跳不上去。用彈簧床把他往上彈。',
      hint: '把彈簧床放在高樓缺口的正下方，他踩到會往上前方彈、落到高樓。',
      world: world(), startFacing: 1, bed: { x: 90, y: 480 },
      solids: [LW, RW, { x: 32, y: 480, w: 896, h: 20 }, { x: 32, y: 300, w: 360, h: 20 }, { x: 520, y: 300, w: 408, h: 20 }],
      hazards: [],
      movables: [{ id: 'spring', type: 'spring', x: 760, y: 466, w: 64, h: 14 }],
      exit: { x: 840, y: 222, w: 54, h: 78 },
      solution: [{ id: 'spring', x: 426, y: 466 }]
    },

    // 5 —— 之字下樓：兩張雨棚接兩次墜落
    {
      id: 5, name: '之字下樓', chapter: '第二章 · 屋頂', theme: 'sky',
      story: '他會一路往左、一層層往下掉。算準兩次墜落，各鋪一張雨棚接住。',
      hint: '他往左走、掉下去再往左。兩道落差各放一張床墊（會往落下方向飄一點）。',
      world: world(), startFacing: -1, bed: { x: 840, y: 200 },
      solids: [LW, RW,
        { x: 520, y: 200, w: 360, h: 20 },
        { x: 300, y: 360, w: 360, h: 20 },
        { x: 32, y: 520, w: 500, h: 20 }],
      hazards: [],
      movables: [
        { id: 'm1', type: 'mattress', x: 700, y: 334, w: 150, h: 26 },
        { id: 'm2', type: 'mattress', x: 750, y: 494, w: 150, h: 26 }],
      exit: { x: 60, y: 442, w: 54, h: 78 },
      solution: [{ id: 'm1', x: 420, y: 334 }, { id: 'm2', x: 180, y: 494 }]
    },

    // 6 —— 通風管道：木板過巷 → 鑽管 → 雨棚接墜落
    {
      id: 6, name: '通風管道', chapter: '第二章 · 屋頂', theme: 'sky',
      story: '這頭是死路，牆上的通風管通到另一棟封死的樓；進管前有巷、出管後會墜落。',
      hint: '先用木板過巷走進管道；管道另一頭很高，用床墊接住掉下來的他。',
      world: world(), startFacing: 1, bed: { x: 90, y: 480 },
      solids: [LW, RW,
        { x: 32, y: 480, w: 300, h: 20 },
        { x: 420, y: 480, w: 132, h: 20 },
        { x: 600, y: 300, w: 18, h: 240, kind: 'wall' },
        { x: 600, y: 540, w: 328, h: 20 }],
      hazards: [{ x: 332, y: 560, w: 88, h: 60, kind: 'water' }],
      portals: [
        { id: 'a', x: 500, y: 402, w: 44, h: 78, link: 'b', color: PC },
        { id: 'b', x: 720, y: 222, w: 44, h: 78, link: 'a', exitFacing: 1, color: PC }],
      movables: [
        { id: 'plank', type: 'plank', x: 80, y: 464, w: 130, h: 16 },
        { id: 'mat', type: 'mattress', x: 760, y: 514, w: 150, h: 26 }],
      exit: { x: 860, y: 462, w: 54, h: 78 },
      solution: [{ id: 'plank', x: 312, y: 476 }, { id: 'mat', x: 700, y: 514 }]
    },

    // 7 —— 撞煙囪回頭 + 接墜落 + 過巷
    {
      id: 7, name: '繞過煙囪', chapter: '第三章 · 後巷', theme: 'roof',
      story: '右邊的煙囪會把他擋回來。看清楚他被擋回後往哪走、會從哪掉下去。',
      hint: '他撞煙囪會轉頭往左、從左緣掉下去：先用床墊接住，再用木板補後面的水溝。',
      world: world(), startFacing: 1, bed: { x: 560, y: 240 },
      solids: [LW, RW,
        { x: 200, y: 240, w: 500, h: 20 },
        { x: 660, y: 170, w: 26, h: 70, kind: 'wall' },
        { x: 32, y: 420, w: 360, h: 20 },
        { x: 540, y: 420, w: 388, h: 20 }],
      hazards: [{ x: 392, y: 500, w: 148, h: 100, kind: 'water' }],
      movables: [
        { id: 'mat', type: 'mattress', x: 720, y: 394, w: 150, h: 26 },
        { id: 'plank', type: 'plank', x: 760, y: 404, w: 160, h: 16 }],
      exit: { x: 840, y: 342, w: 54, h: 78 },
      solution: [{ id: 'mat', x: 60, y: 394 }, { id: 'plank', x: 380, y: 416 }]
    },

    // 8 —— 彈簧飛越尖刺 + 過水溝
    {
      id: 8, name: '飛越尖刺', chapter: '第三章 · 後巷', theme: 'sky',
      story: '一道尖刺、一道水溝。彈簧把他往前彈過尖刺，落地後再補水溝。',
      hint: '彈簧床放在尖刺前讓他飛過去；落到對面後用木板補水溝。',
      world: world(), startFacing: 1, bed: { x: 90, y: 460 },
      solids: [LW, RW,
        { x: 32, y: 460, w: 340, h: 20 },
        { x: 500, y: 460, w: 220, h: 20 },
        { x: 820, y: 460, w: 108, h: 20 }],
      hazards: [
        { x: 372, y: 520, w: 128, h: 40, kind: 'spike' },
        { x: 720, y: 540, w: 100, h: 60, kind: 'water' }],
      movables: [
        { id: 'spring', type: 'spring', x: 600, y: 446, w: 64, h: 14 },
        { id: 'plank', type: 'plank', x: 40, y: 444, w: 120, h: 16 }],
      exit: { x: 846, y: 382, w: 54, h: 78 },
      solution: [{ id: 'spring', x: 300, y: 446 }, { id: 'plank', x: 700, y: 456 }]
    },

    // 9 —— 鑽管道到封死的家（含陷阱道具）
    {
      id: 9, name: '繞道回家', chapter: '第三章 · 後巷', theme: 'dawn',
      story: '他往左掉下去，下水道口能繞到封死的家。但別被沒用的道具騙了。',
      hint: '只需要用床墊接住那一次墜落，再走進管道就到家了——有個道具是多餘的。',
      world: world(), startFacing: -1, bed: { x: 820, y: 240 },
      solids: [LW, RW,
        { x: 500, y: 240, w: 360, h: 20 },
        { x: 300, y: 420, w: 400, h: 20 },
        { x: 32, y: 520, w: 260, h: 20 }],
      hazards: [],
      portals: [
        { id: 'a', x: 320, y: 342, w: 44, h: 78, link: 'b', color: PC2 },
        { id: 'b', x: 60, y: 442, w: 44, h: 78, link: 'a', exitFacing: 1, color: PC2 }],
      movables: [
        { id: 'mat', type: 'mattress', x: 700, y: 394, w: 150, h: 26 },
        { id: 'decoyBox', type: 'box', x: 612, y: 336, w: 84, h: 84, decoy: true }],
      exit: { x: 220, y: 442, w: 54, h: 78 },
      solution: [{ id: 'mat', x: 400, y: 394 }]
    },

    // 10 —— 終章：之字長路 + 過巷 + 鑽管 + 高處落下（含陷阱道具）
    {
      id: 10, name: '回到床上', chapter: '第四章 · 天亮前', theme: 'dawn',
      story: '天快亮了，最長的一段：往左掉、過巷、鑽管、再從高處落下回到床。看清楚路再動手。',
      hint: '雨棚接第一次墜落、木板補巷、走進管道；管道另一頭很高，再用第二張雨棚接住。',
      world: world(), startFacing: -1, bed: { x: 820, y: 160 },
      solids: [LW, RW,
        { x: 540, y: 160, w: 320, h: 20 },
        { x: 320, y: 320, w: 340, h: 20 },
        { x: 32, y: 320, w: 200, h: 20 },
        { x: 560, y: 480, w: 368, h: 20 }],
      hazards: [],
      portals: [
        { id: 'a', x: 44, y: 242, w: 44, h: 78, link: 'b', color: PC },
        { id: 'b', x: 600, y: 242, w: 44, h: 78, link: 'a', exitFacing: 1, color: PC }],
      movables: [
        { id: 'm1', type: 'mattress', x: 700, y: 294, w: 150, h: 26 },
        { id: 'plank', type: 'plank', x: 740, y: 304, w: 160, h: 16 },
        { id: 'm2', type: 'mattress', x: 760, y: 454, w: 150, h: 26 }],
      exit: { x: 866, y: 402, w: 54, h: 78 },
      solution: [
        { id: 'm1', x: 420, y: 294 },
        { id: 'plank', x: 222, y: 316 },
        { id: 'm2', x: 560, y: 454 }]
    }
  ];

  var api = { LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SleepwalkerLevels = api;
})(typeof window !== 'undefined' ? window : this);
