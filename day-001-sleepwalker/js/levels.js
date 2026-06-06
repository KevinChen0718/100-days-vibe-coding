/*
 * 夢遊先生 Mr. Sleepwalker — 關卡資料（封閉房子剖面版）
 *
 * 設計原則（取自對原作難度來源的研究 + 修正破綻）：
 *  - 玩家放他走之前先擺好道具，放走後鎖定 → 不能「拖一塊板子當移動地板送到底」。
 *  - 封閉幾何：牆 + 天花板 + 樓層，把空間關住，主角只能沿走廊/從特定洞口下樓，不能繞。
 *  - 道具配額剛好夠用，且每個都「不可省」（test/solve.js 會驗證沒擺/缺一個就過不了關）。
 *  - 主角不能往上爬高過 16px 的台階；要上樓只能靠彈簧。箱子用於墊落差(往下)或當牆讓他轉身。
 *
 * 物件 type：plank(木板) / box(箱子) / spring(彈簧床) / mattress(床墊，軟著陸)
 * 危險 kind：water(水) / spike(尖刺)
 * portals：成對傳送門（管道），走進去從 link 的另一個出來；exitFacing 設定冒出後面向。
 */
(function (root) {
  'use strict';

  var W = 960, H = 620;
  var LW = { x: 0, y: 0, w: 32, h: H, kind: 'wall' };
  var RW = { x: 928, y: 0, w: 32, h: H, kind: 'wall' };
  var PC = '#9b8cff', PC2 = '#7fd6c0';
  function world() { return { w: W, h: H }; }

  var LEVELS = [
    // 1 —— 臥室：搭一塊板過洞
    {
      id: 1, name: '半夜・起床', chapter: '第一章 · 臥室樓', theme: 'room',
      story: '夢遊先生從床上爬起，慢慢往房門走。地板上有個洞——先擺好木板再放他走。',
      hint: '把木板拖到地板缺口上鋪平；放他走之後就不能再動道具了。',
      world: world(), startFacing: 1, bed: { x: 110, y: 470 },
      solids: [LW, RW,
        { x: 32, y: 130, w: 896, h: 16, kind: 'wall' },
        { x: 32, y: 470, w: 360, h: 20 },
        { x: 520, y: 470, w: 408, h: 20 }],
      hazards: [{ x: 392, y: 560, w: 128, h: 60, kind: 'water' }],
      movables: [{ id: 'plank', type: 'plank', x: 700, y: 454, w: 150, h: 16 }],
      exit: { x: 840, y: 392, w: 54, h: 78 },
      solution: [{ id: 'plank', x: 376, y: 462 }]
    },

    // 2 —— 床墊：跳下一層樓
    {
      id: 2, name: '下一層樓', chapter: '第一章 · 臥室樓', theme: 'room',
      story: '門外是直接通到樓下的落差，太高了。鋪個軟的接住他。',
      hint: '床墊能接住任何高度的墜落。鋪在他落下的位置（會稍微往前飄）。',
      world: world(), startFacing: 1, bed: { x: 110, y: 300 },
      solids: [LW, RW,
        { x: 32, y: 110, w: 896, h: 16, kind: 'wall' },
        { x: 32, y: 300, w: 520, h: 20 },
        { x: 32, y: 480, w: 896, h: 20 }],
      hazards: [],
      movables: [{ id: 'mat', type: 'mattress', x: 760, y: 460, w: 150, h: 26 }],
      exit: { x: 840, y: 402, w: 54, h: 78 },
      solution: [{ id: 'mat', x: 500, y: 460 }]
    },

    // 3 —— 箱子當牆讓他轉身
    {
      id: 3, name: '轉個彎', chapter: '第一章 · 臥室樓', theme: 'room',
      story: '門在他背後的左邊，他卻往右走、右邊是樓梯井。讓他回頭。',
      hint: '主角撞到比他高的東西會轉身。把箱子擋在他右邊。',
      world: world(), startFacing: 1, bed: { x: 380, y: 470 },
      solids: [LW, RW,
        { x: 32, y: 130, w: 896, h: 16, kind: 'wall' },
        { x: 32, y: 470, w: 520, h: 20 }],
      hazards: [{ x: 552, y: 540, w: 376, h: 80, kind: 'water' }],
      movables: [{ id: 'box', type: 'box', x: 150, y: 378, w: 56, h: 92 }],
      exit: { x: 46, y: 392, w: 54, h: 78 },
      solution: [{ id: 'box', x: 470, y: 378 }]
    },

    // 4 —— 箱子墊落差 + 木板過缺口
    {
      id: 4, name: '樓梯間', chapter: '第二章 · 樓梯間', theme: 'roof',
      story: '先下一層樓的落差，再跨過樓梯間的缺口，兩樣道具都要用上。',
      hint: '箱子墊在落差中間踩著下去，木板補後面的缺口。',
      world: world(), startFacing: 1, bed: { x: 110, y: 300 },
      solids: [LW, RW,
        { x: 32, y: 110, w: 896, h: 16, kind: 'wall' },
        { x: 32, y: 300, w: 400, h: 20 },
        { x: 32, y: 480, w: 500, h: 20 },
        { x: 660, y: 480, w: 268, h: 20 }],
      hazards: [{ x: 532, y: 560, w: 128, h: 60, kind: 'water' }],
      movables: [
        { id: 'box', type: 'box', x: 120, y: 396, w: 84, h: 84 },
        { id: 'plank', type: 'plank', x: 760, y: 464, w: 160, h: 16 }],
      exit: { x: 840, y: 402, w: 54, h: 78 },
      solution: [{ id: 'box', x: 420, y: 396 }, { id: 'plank', x: 520, y: 476 }]
    },

    // 5 —— 彈簧床：往上彈一層
    {
      id: 5, name: '往上一層', chapter: '第二章 · 樓梯間', theme: 'roof',
      story: '出口在樓上，他爬不上去。彈簧床能把他往上彈穿過天花板的洞。',
      hint: '把彈簧床放在天花板洞的正下方，他踩到會往上彈、落到上層。',
      world: world(), startFacing: 1, bed: { x: 90, y: 480 },
      solids: [LW, RW,
        { x: 32, y: 90, w: 896, h: 16, kind: 'wall' },
        { x: 32, y: 480, w: 896, h: 20 },
        { x: 32, y: 300, w: 360, h: 20 },
        { x: 520, y: 300, w: 408, h: 20 }],
      hazards: [],
      movables: [{ id: 'spring', type: 'spring', x: 760, y: 466, w: 64, h: 14 }],
      exit: { x: 840, y: 222, w: 54, h: 78 },
      solution: [{ id: 'spring', x: 426, y: 466 }]
    },

    // 6 —— 管道(傳送門) + 木板 + 床墊
    {
      id: 6, name: '通風管道', chapter: '第二章 · 樓梯間', theme: 'sky',
      story: '這層是死路，牆上的通風管能通到隔壁封死的房間；但進管前有缺口、出管後會墜落。',
      hint: '先用木板過缺口走進管道；管道另一頭很高，用床墊接住掉下來的他。',
      world: world(), startFacing: 1, bed: { x: 90, y: 480 },
      solids: [LW, RW,
        { x: 32, y: 110, w: 896, h: 16, kind: 'wall' },
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
        { id: 'mat', type: 'mattress', x: 760, y: 520, w: 150, h: 26 }],
      exit: { x: 860, y: 462, w: 54, h: 78 },
      solution: [{ id: 'plank', x: 312, y: 476 }, { id: 'mat', x: 700, y: 520 }]
    },

    // 7 —— 兩張床墊：連下兩層
    {
      id: 7, name: '層層下樓', chapter: '第三章 · 地下', theme: 'sky',
      story: '三層樓的剖面，每一層往下都是會摔醒的高度。一層接一張床墊。',
      hint: '兩道落差各鋪一張床墊接住他。',
      world: world(), startFacing: 1, bed: { x: 90, y: 230 },
      solids: [LW, RW,
        { x: 32, y: 90, w: 896, h: 16, kind: 'wall' },
        { x: 32, y: 230, w: 360, h: 20 },
        { x: 32, y: 400, w: 520, h: 20 },
        { x: 32, y: 560, w: 896, h: 20 }],
      hazards: [],
      movables: [
        { id: 'm1', type: 'mattress', x: 700, y: 380, w: 150, h: 26 },
        { id: 'm2', type: 'mattress', x: 760, y: 540, w: 150, h: 26 }],
      exit: { x: 840, y: 482, w: 54, h: 78 },
      solution: [{ id: 'm1', x: 330, y: 380 }, { id: 'm2', x: 520, y: 540 }]
    },

    // 8 —— 床墊 + 木板 + 箱子：三段下樓
    {
      id: 8, name: '三段下樓', chapter: '第三章 · 地下', theme: 'dawn',
      story: '一段比一段刁鑽：先軟著陸、再跨缺口、最後墊著下到地面。三樣道具剛好用完。',
      hint: '床墊接第一段墜落、木板補中間缺口、箱子墊最後一段落差。',
      world: world(), startFacing: 1, bed: { x: 90, y: 200 },
      solids: [LW, RW,
        { x: 32, y: 80, w: 896, h: 16, kind: 'wall' },
        { x: 32, y: 200, w: 300, h: 20 },
        { x: 32, y: 380, w: 420, h: 20 },
        { x: 600, y: 380, w: 120, h: 20 },
        { x: 32, y: 540, w: 896, h: 20 }],
      hazards: [{ x: 452, y: 560, w: 148, h: 60, kind: 'water' }],
      movables: [
        { id: 'mat', type: 'mattress', x: 760, y: 360, w: 150, h: 26 },
        { id: 'plank', type: 'plank', x: 80, y: 524, w: 160, h: 16 },
        { id: 'box', type: 'box', x: 150, y: 456, w: 84, h: 84 }],
      exit: { x: 840, y: 462, w: 54, h: 78 },
      solution: [
        { id: 'mat', x: 300, y: 360 },
        { id: 'plank', x: 440, y: 376 },
        { id: 'box', x: 700, y: 456 }]
    },

    // 9 —— 終章：床墊 + 木板 + 木板 + 管道
    {
      id: 9, name: '回到地面', chapter: '第四章 · 大門', theme: 'dawn',
      story: '天快亮了，最後最長的一段：軟著陸、跨過尖刺、鑽管道到另一邊、再跨過水溝回到大門。',
      hint: '床墊接第一段、木板鋪過尖刺、走進管道、最後一塊木板補水溝。',
      world: world(), startFacing: 1, bed: { x: 90, y: 160 },
      solids: [LW, RW,
        { x: 32, y: 60, w: 896, h: 16, kind: 'wall' },
        { x: 32, y: 160, w: 300, h: 20 },
        { x: 32, y: 340, w: 520, h: 20 },
        { x: 680, y: 340, w: 248, h: 20 },
        { x: 32, y: 540, w: 400, h: 20 },
        { x: 560, y: 540, w: 368, h: 20 }],
      hazards: [
        { x: 552, y: 460, w: 128, h: 30, kind: 'spike' },
        { x: 432, y: 560, w: 128, h: 60, kind: 'water' }],
      portals: [
        { id: 'a', x: 880, y: 262, w: 44, h: 78, link: 'b', color: PC2 },
        { id: 'b', x: 60, y: 462, w: 44, h: 78, link: 'a', exitFacing: 1, color: PC2 }],
      movables: [
        { id: 'mat', type: 'mattress', x: 760, y: 320, w: 150, h: 26 },
        { id: 'p1', type: 'plank', x: 720, y: 324, w: 160, h: 16 },
        { id: 'p2', type: 'plank', x: 80, y: 524, w: 160, h: 16 }],
      exit: { x: 860, y: 462, w: 54, h: 78 },
      solution: [
        { id: 'mat', x: 300, y: 320 },
        { id: 'p1', x: 540, y: 336 },
        { id: 'p2', x: 420, y: 536 }]
    }
  ];

  var api = { LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SleepwalkerLevels = api;
})(typeof window !== 'undefined' ? window : this);
