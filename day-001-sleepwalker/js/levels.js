/*
 * 夢遊先生 Mr. Sleepwalker — 關卡資料
 *
 * 向 1999 年 Sarbakan《Good Night Mr. Snoozleberg》致敬的重新設計關卡。
 * 每關附 solution（一組擺放座標），供自動化可解性測試與「示範」功能使用。
 *
 * 座標：左上為原點，y 向下。所有關卡共用 960x620 世界。
 * 物件 type：plank(木板) / box(箱子) / spring(彈簧床) / mattress(床墊，軟著陸)
 * 危險 kind：water(水) / spike(尖刺) / fire(火)
 * portals：成對的傳送門，走進去從 link 指向的另一個門冒出來（exitFacing 設定冒出後面向）
 */
(function (root) {
  'use strict';

  var W = 960, H = 620;
  var LW = { x: 0, y: 0, w: 32, h: H, kind: 'wall' };
  var RW = { x: 928, y: 0, w: 32, h: H, kind: 'wall' };
  var PC = '#9b8cff';   // 傳送門色
  var PC2 = '#7fd6c0';
  function world() { return { w: W, h: H }; }

  var LEVELS = [
    // 1 —— 鋪木板過洞
    {
      id: 1, name: '半夜・起床', chapter: '第一章 · 臥室', theme: 'room',
      story: '夜深了，夢遊先生從床上爬起來，慢慢往窗邊走。地板上有個洞——幫他鋪條路。',
      hint: '把木板拖到地板的缺口上，先生才能走過去。',
      world: world(), startFacing: 1, bed: { x: 110, y: 470 },
      solids: [LW, RW, { x: 32, y: 470, w: 330, h: 18 }, { x: 520, y: 470, w: 408, h: 18 }],
      hazards: [{ x: 362, y: 540, w: 158, h: 80, kind: 'water' }],
      movables: [{ id: 'plank', type: 'plank', x: 600, y: 454, w: 180, h: 16 }],
      exit: { x: 826, y: 392, w: 54, h: 78 },
      solution: [{ id: 'plank', x: 350, y: 466 }]
    },

    // 2 —— 墊箱子化解落差
    {
      id: 2, name: '走下床台', chapter: '第一章 · 臥室', theme: 'room',
      story: '前方是一階高高的落差，直接跳下去會摔醒。墊個東西在中間吧。',
      hint: '把箱子墊在落差中間當踏腳石，先生才不會摔太重。',
      world: world(), startFacing: 1, bed: { x: 110, y: 320 },
      solids: [LW, RW, { x: 32, y: 320, w: 520, h: 18 }, { x: 32, y: 470, w: 896, h: 18 }],
      hazards: [],
      movables: [{ id: 'box', type: 'box', x: 740, y: 386, w: 84, h: 84 }],
      exit: { x: 826, y: 392, w: 54, h: 78 },
      solution: [{ id: 'box', x: 540, y: 386 }]
    },

    // 3 —— 用箱子當牆讓他轉身
    {
      id: 3, name: '轉個彎', chapter: '第一章 · 臥室', theme: 'room',
      story: '出口在他背後的左邊，可他偏偏往右走、右邊是深谷。想辦法讓他回頭。',
      hint: '先生撞到比他高的東西就會轉身。把箱子擋在右邊。',
      world: world(), startFacing: 1, bed: { x: 380, y: 470 },
      solids: [LW, RW, { x: 32, y: 470, w: 520, h: 18 }],
      hazards: [{ x: 552, y: 540, w: 376, h: 80, kind: 'water' }],
      movables: [{ id: 'box', type: 'box', x: 160, y: 378, w: 56, h: 92 }],
      exit: { x: 46, y: 392, w: 54, h: 78 },
      solution: [{ id: 'box', x: 470, y: 378 }]
    },

    // 4 —— 彈簧床當跳板飛越尖刺
    {
      id: 4, name: '彈跳板', chapter: '第二章 · 屋頂', theme: 'roof',
      story: '前方一整排尖刺，跨不過去。放張彈簧床當跳板，把他往前彈過去。',
      hint: '把彈簧床放在尖刺前面的地板上，他踩上去會往前飛，跳過尖刺。',
      world: world(), startFacing: 1, bed: { x: 90, y: 500 },
      solids: [LW, RW, { x: 32, y: 500, w: 420, h: 18 }, { x: 540, y: 500, w: 388, h: 18 }],
      hazards: [{ x: 452, y: 484, w: 88, h: 16, kind: 'spike' }],
      movables: [{ id: 'spring', type: 'spring', x: 680, y: 486, w: 64, h: 14 }],
      exit: { x: 826, y: 422, w: 54, h: 78 },
      solution: [{ id: 'spring', x: 360, y: 486 }]
    },

    // 5 —— 床墊軟著陸
    {
      id: 5, name: '跳下雨棚', chapter: '第二章 · 屋頂', theme: 'roof',
      story: '從屋頂到下面好高，直接落地一定摔醒。鋪個軟的接住他。',
      hint: '床墊能接住任何高度的墜落而不受傷。鋪在他會落下的位置。',
      world: world(), startFacing: 1, bed: { x: 90, y: 250 },
      solids: [LW, RW, { x: 32, y: 250, w: 300, h: 18 }, { x: 32, y: 520, w: 896, h: 18 }],
      hazards: [],
      movables: [{ id: 'mat', type: 'mattress', x: 700, y: 494, w: 150, h: 26 }],
      exit: { x: 826, y: 442, w: 54, h: 78 },
      solution: [{ id: 'mat', x: 286, y: 494 }]
    },

    // 6 —— 傳送門教學：穿牆而過
    {
      id: 6, name: '穿牆而過', chapter: '第二章 · 屋頂', theme: 'roof',
      story: '一道高牆擋住去路，繞不過去。牆上有扇會發光的窗——走進去，會從另一扇窗冒出來。',
      hint: '先生走進發光的門會從連結的另一扇門出來。對面還有道縫要用木板補。',
      world: world(), startFacing: 1, bed: { x: 90, y: 470 },
      solids: [LW, RW,
        { x: 32, y: 470, w: 360, h: 18 },
        { x: 400, y: 250, w: 28, h: 220, kind: 'wall' },
        { x: 460, y: 470, w: 200, h: 18 },
        { x: 740, y: 470, w: 188, h: 18 }],
      hazards: [{ x: 660, y: 540, w: 80, h: 80, kind: 'water' }],
      portals: [
        { id: 'a', x: 354, y: 392, w: 42, h: 78, link: 'b', color: PC },
        { id: 'b', x: 466, y: 392, w: 42, h: 78, link: 'a', exitFacing: 1, color: PC }],
      movables: [{ id: 'plank', type: 'plank', x: 80, y: 454, w: 150, h: 16 }],
      exit: { x: 826, y: 392, w: 54, h: 78 },
      solution: [{ id: 'plank', x: 600, y: 466 }]
    },

    // 7 —— 傳送門下樓 + 跨尖刺
    {
      id: 7, name: '煙囪滑梯', chapter: '第二章 · 屋頂', theme: 'roof',
      story: '高處的煙囪是條捷徑，可以直接通到樓下；但落地後還有尖刺擋路。',
      hint: '走進高處的門會掉到樓下另一扇門。落地後用木板跨過尖刺。',
      world: world(), startFacing: 1, bed: { x: 90, y: 260 },
      solids: [LW, RW,
        { x: 32, y: 260, w: 320, h: 18 },
        { x: 440, y: 500, w: 240, h: 18 },
        { x: 760, y: 500, w: 168, h: 18 }],
      hazards: [
        { x: 680, y: 540, w: 80, h: 40, kind: 'spike' },
        { x: 352, y: 560, w: 88, h: 60, kind: 'water' }],
      portals: [
        { id: 'a', x: 316, y: 182, w: 44, h: 78, link: 'b', color: PC },
        { id: 'b', x: 452, y: 422, w: 44, h: 78, link: 'a', exitFacing: 1, color: PC }],
      movables: [{ id: 'plank', type: 'plank', x: 80, y: 484, w: 160, h: 16 }],
      exit: { x: 866, y: 422, w: 54, h: 78 },
      solution: [{ id: 'plank', x: 640, y: 496 }]
    },

    // 8 —— 一波三折：兩塊木板 + 一個箱子
    {
      id: 8, name: '一波三折', chapter: '第三章 · 後巷', theme: 'sky',
      story: '一路下坡，先補缺口、再墊落差、再跨水溝，三樣道具缺一不可。',
      hint: '上層的縫用木板，落差墊箱子，最後的水溝再用一塊木板。',
      world: world(), startFacing: 1, bed: { x: 80, y: 240 },
      solids: [LW, RW,
        { x: 32, y: 240, w: 260, h: 18 },
        { x: 360, y: 240, w: 112, h: 18 },
        { x: 32, y: 440, w: 500, h: 18 },
        { x: 660, y: 440, w: 268, h: 18 }],
      hazards: [
        { x: 292, y: 300, w: 68, h: 18, kind: 'spike' },
        { x: 532, y: 510, w: 128, h: 80, kind: 'water' }],
      movables: [
        { id: 'p0', type: 'plank', x: 700, y: 424, w: 140, h: 16 },
        { id: 'box', type: 'box', x: 740, y: 356, w: 84, h: 84 },
        { id: 'p1', type: 'plank', x: 800, y: 400, w: 160, h: 16 }],
      exit: { x: 826, y: 362, w: 54, h: 78 },
      solution: [
        { id: 'p0', x: 278, y: 236 },
        { id: 'box', x: 472, y: 356 },
        { id: 'p1', x: 530, y: 436 }]
    },

    // 9 —— 繞道而行：先轉身、搭橋、再鑽下水道
    {
      id: 9, name: '繞道而行', chapter: '第三章 · 後巷', theme: 'sky',
      story: '他往右走會掉下斷崖，下水道口卻在左邊；過去前還有一道斷橋。',
      hint: '用箱子把他從斷崖那邊擋回來，木板補左邊斷橋，他才能走到下水道口。',
      world: world(), startFacing: 1, bed: { x: 400, y: 300 },
      solids: [LW, RW,
        { x: 260, y: 300, w: 300, h: 18 },
        { x: 32, y: 300, w: 168, h: 18 },
        { x: 600, y: 520, w: 328, h: 18 }],
      hazards: [{ x: 560, y: 360, w: 40, h: 260, kind: 'water' }],
      portals: [
        { id: 'a', x: 44, y: 222, w: 44, h: 78, link: 'b', color: PC2 },
        { id: 'b', x: 640, y: 442, w: 44, h: 78, link: 'a', exitFacing: 1, color: PC2 }],
      movables: [
        { id: 'box', type: 'box', x: 320, y: 208, w: 56, h: 92 },
        { id: 'plank', type: 'plank', x: 700, y: 504, w: 150, h: 16 }],
      exit: { x: 866, y: 442, w: 54, h: 78 },
      solution: [{ id: 'box', x: 520, y: 208 }, { id: 'plank', x: 190, y: 296 }]
    },

    // 10 —— 雙重門：傳送上樓 + 兩塊木板
    {
      id: 10, name: '雙重門', chapter: '第三章 · 後巷', theme: 'sky',
      story: '出口在上面那層，地面這層的門能把他送上去；上下兩層各有一道缺口。',
      hint: '先補地面的縫走到門口，傳送到上層後，再補上層的缺口到出口。',
      world: world(), startFacing: 1, bed: { x: 80, y: 520 },
      solids: [LW, RW,
        { x: 32, y: 520, w: 260, h: 18 },
        { x: 400, y: 520, w: 132, h: 18 },
        { x: 560, y: 300, w: 140, h: 18 },
        { x: 800, y: 300, w: 128, h: 18 }],
      hazards: [
        { x: 292, y: 580, w: 108, h: 40, kind: 'water' },
        { x: 700, y: 360, w: 100, h: 18, kind: 'spike' }],
      portals: [
        { id: 'a', x: 488, y: 442, w: 44, h: 78, link: 'b', color: PC },
        { id: 'b', x: 600, y: 222, w: 44, h: 78, link: 'a', exitFacing: 1, color: PC }],
      movables: [
        { id: 'p1', type: 'plank', x: 60, y: 504, w: 150, h: 16 },
        { id: 'p2', type: 'plank', x: 120, y: 480, w: 150, h: 16 }],
      exit: { x: 866, y: 222, w: 54, h: 78 },
      solution: [{ id: 'p1', x: 278, y: 516 }, { id: 'p2', x: 688, y: 296 }]
    },

    // 11 —— 跳過水溝：彈簧 + 木板
    {
      id: 11, name: '跳過水溝', chapter: '第四章 · 回家的路', theme: 'dawn',
      story: '快到家了。先用彈簧跳過一排尖刺，再鋪木板跨過最後的水溝。',
      hint: '彈簧床跳過尖刺，落地後木板補上水溝。',
      world: world(), startFacing: 1, bed: { x: 90, y: 500 },
      solids: [LW, RW,
        { x: 32, y: 500, w: 340, h: 18 },
        { x: 468, y: 500, w: 200, h: 18 },
        { x: 760, y: 500, w: 168, h: 18 }],
      hazards: [
        { x: 372, y: 484, w: 96, h: 16, kind: 'spike' },
        { x: 668, y: 540, w: 92, h: 80, kind: 'water' }],
      movables: [
        { id: 'spring', type: 'spring', x: 700, y: 486, w: 64, h: 14 },
        { id: 'plank', type: 'plank', x: 800, y: 470, w: 160, h: 16 }],
      exit: { x: 866, y: 422, w: 54, h: 78 },
      solution: [{ id: 'spring', x: 300, y: 486 }, { id: 'plank', x: 640, y: 496 }]
    },

    // 12 —— 終章：回到床上（木板 + 床墊 + 木板 + 傳送門）
    {
      id: 12, name: '回到床上', chapter: '第四章 · 回家的路', theme: 'dawn',
      story: '天快亮了，最後一段最長的路：跨縫、鑽過捷徑、軟著陸、躲尖刺，把先生平安送回床。',
      hint: '頂樓的縫用木板、鑽門下樓、用床墊接住墜落、再用木板跨過尖刺到床邊。',
      world: world(), startFacing: 1, bed: { x: 80, y: 180 },
      solids: [LW, RW,
        { x: 32, y: 180, w: 220, h: 18 },
        { x: 360, y: 180, w: 180, h: 18 },
        { x: 32, y: 420, w: 360, h: 18 },
        { x: 32, y: 580, w: 500, h: 18 },
        { x: 660, y: 580, w: 268, h: 18 }],
      hazards: [
        { x: 532, y: 600, w: 128, h: 20, kind: 'spike' }],
      portals: [
        { id: 'a', x: 496, y: 102, w: 44, h: 78, link: 'b', color: PC },
        { id: 'b', x: 60, y: 342, w: 44, h: 78, link: 'a', exitFacing: 1, color: PC }],
      movables: [
        { id: 'p0', type: 'plank', x: 700, y: 564, w: 160, h: 16 },
        { id: 'mat', type: 'mattress', x: 740, y: 554, w: 160, h: 26 },
        { id: 'p1', type: 'plank', x: 800, y: 540, w: 170, h: 16 }],
      exit: { x: 866, y: 502, w: 54, h: 78 },
      solution: [
        { id: 'p0', x: 240, y: 176 },
        { id: 'mat', x: 360, y: 554 },
        { id: 'p1', x: 506, y: 576 }]
    }
  ];

  var api = { LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SleepwalkerLevels = api;
})(typeof window !== 'undefined' ? window : this);
