/*
 * 夢遊先生 Mr. Sleepwalker — 關卡資料
 *
 * 向 1999 年 Sarbakan《Good Night Mr. Snoozleberg》致敬的重新設計關卡。
 * 每關附 solution（一組擺放座標），供自動化可解性測試與「示範」功能使用。
 *
 * 座標：左上為原點，y 向下。所有關卡共用 960x620 世界。
 * 物件 type：plank(木板) / box(箱子) / spring(彈簧床) / mattress(床墊，軟著陸)
 * 危險 kind：water(水) / spike(尖刺) / fire(火)
 */
(function (root) {
  'use strict';

  var W = 960, H = 620;
  var LW = { x: 0, y: 0, w: 32, h: H, kind: 'wall' };
  var RW = { x: 928, y: 0, w: 32, h: H, kind: 'wall' };
  function world() { return { w: W, h: H }; }

  var LEVELS = [
    // 1 —— 教學：補一塊木板過洞
    {
      id: 1, name: '半夜・起床', chapter: '第一章 · 臥室', theme: 'room',
      story: '夜深了，夢遊先生從床上爬起來，閉著眼睛往窗邊走。地板上有個洞——幫他鋪條路。',
      hint: '把木板拖到地板的缺口上，先生才能走過去。',
      world: world(), startFacing: 1, bed: { x: 110, y: 470 },
      solids: [LW, RW,
        { x: 32, y: 470, w: 330, h: 18 },
        { x: 520, y: 470, w: 408, h: 18 }],
      hazards: [{ x: 362, y: 540, w: 158, h: 80, kind: 'water' }],
      movables: [{ id: 'plank', type: 'plank', x: 600, y: 454, w: 180, h: 16 }],
      exit: { x: 826, y: 392, w: 54, h: 78 },
      solution: [{ id: 'plank', x: 350, y: 466 }]
    },

    // 2 —— 教學：墊箱子化解致命落差
    {
      id: 2, name: '走下床台', chapter: '第一章 · 臥室', theme: 'room',
      story: '前方是一階高高的落差，直接跳下去會摔醒。墊個東西在中間吧。',
      hint: '把箱子墊在落差中間當踏腳石，先生才不會摔太重。',
      world: world(), startFacing: 1, bed: { x: 110, y: 320 },
      solids: [LW, RW,
        { x: 32, y: 320, w: 520, h: 18 },
        { x: 32, y: 470, w: 896, h: 18 }],
      hazards: [],
      movables: [{ id: 'box', type: 'box', x: 740, y: 386, w: 84, h: 84 }],
      exit: { x: 826, y: 392, w: 54, h: 78 },
      solution: [{ id: 'box', x: 548, y: 386 }]
    },

    // 3 —— 教學：用箱子當牆讓他轉身
    {
      id: 3, name: '轉個彎', chapter: '第一章 · 臥室', theme: 'room',
      story: '出口在他背後的左邊，可是他偏偏往右走、右邊是深谷。想辦法讓他回頭。',
      hint: '先生撞到比他高的東西就會轉身。把箱子擋在右邊。',
      world: world(), startFacing: 1, bed: { x: 380, y: 470 },
      solids: [LW, RW,
        { x: 32, y: 470, w: 520, h: 18 }],
      hazards: [{ x: 552, y: 540, w: 376, h: 80, kind: 'water' }],
      movables: [{ id: 'box', type: 'box', x: 160, y: 378, w: 56, h: 92 }],
      exit: { x: 46, y: 392, w: 54, h: 78 },
      solution: [{ id: 'box', x: 470, y: 378 }]
    },

    // 4 —— 教學：彈簧床當跳板，飛越尖刺坑
    {
      id: 4, name: '彈跳板', chapter: '第二章 · 屋頂', theme: 'roof',
      story: '前方一整排尖刺，跨不過去。放張彈簧床當跳板，把他往前彈過去。',
      hint: '把彈簧床放在尖刺前面的地板上，他踩上去會往前飛，跳過尖刺落到對面。',
      world: world(), startFacing: 1, bed: { x: 90, y: 500 },
      solids: [LW, RW,
        { x: 32, y: 500, w: 420, h: 18 },
        { x: 540, y: 500, w: 388, h: 18 }],
      hazards: [{ x: 452, y: 484, w: 88, h: 16, kind: 'spike' }],
      movables: [{ id: 'spring', type: 'spring', x: 680, y: 486, w: 64, h: 14 }],
      exit: { x: 826, y: 422, w: 54, h: 78 },
      solution: [{ id: 'spring', x: 360, y: 486 }]
    },

    // 5 —— 教學：床墊軟著陸，接住長墜
    {
      id: 5, name: '跳下雨棚', chapter: '第二章 · 屋頂', theme: 'roof',
      story: '從屋頂到下面好高，直接落地一定摔醒。鋪個軟的接住他。',
      hint: '床墊（雨棚）能接住任何高度的墜落而不受傷。鋪在他會落下的位置。',
      world: world(), startFacing: 1, bed: { x: 90, y: 250 },
      solids: [LW, RW,
        { x: 32, y: 250, w: 300, h: 18 },
        { x: 32, y: 520, w: 896, h: 18 }],
      hazards: [],
      movables: [{ id: 'mat', type: 'mattress', x: 700, y: 494, w: 150, h: 26 }],
      exit: { x: 826, y: 442, w: 54, h: 78 },
      solution: [{ id: 'mat', x: 300, y: 494 }]
    },

    // 6 —— 兩道裂縫，兩塊板
    {
      id: 6, name: '兩道裂縫', chapter: '第二章 · 屋頂', theme: 'roof',
      story: '屋簷上裂了兩道縫，下面就是雨水槽。兩塊板都要鋪好。',
      hint: '兩道縫各鋪一塊木板。先生掉進水裡就會醒。',
      world: world(), startFacing: 1, bed: { x: 90, y: 470 },
      solids: [LW, RW,
        { x: 32, y: 470, w: 260, h: 18 },
        { x: 400, y: 470, w: 170, h: 18 },
        { x: 690, y: 470, w: 238, h: 18 }],
      hazards: [
        { x: 292, y: 540, w: 108, h: 80, kind: 'water' },
        { x: 570, y: 540, w: 120, h: 80, kind: 'water' }],
      movables: [
        { id: 'p1', type: 'plank', x: 720, y: 454, w: 140, h: 16 },
        { id: 'p2', type: 'plank', x: 760, y: 430, w: 140, h: 16 }],
      exit: { x: 826, y: 392, w: 54, h: 78 },
      solution: [{ id: 'p1', x: 278, y: 466 }, { id: 'p2', x: 558, y: 466 }]
    },

    // 7 —— 箱子 + 木板 組合
    {
      id: 7, name: '下到中庭', chapter: '第二章 · 屋頂', theme: 'roof',
      story: '先下一個落差，再跨過一道水溝，才能到中庭出口。',
      hint: '箱子化解落差、木板跨過水溝，兩個都要用上。',
      world: world(), startFacing: 1, bed: { x: 90, y: 300 },
      solids: [LW, RW,
        { x: 32, y: 300, w: 400, h: 18 },
        { x: 32, y: 470, w: 500, h: 18 },
        { x: 650, y: 470, w: 278, h: 18 }],
      hazards: [{ x: 532, y: 540, w: 118, h: 80, kind: 'water' }],
      movables: [
        { id: 'box', type: 'box', x: 700, y: 386, w: 84, h: 84 },
        { id: 'plank', type: 'plank', x: 740, y: 430, w: 160, h: 16 }],
      exit: { x: 826, y: 392, w: 54, h: 78 },
      solution: [{ id: 'box', x: 436, y: 386 }, { id: 'plank', x: 512, y: 466 }]
    },

    // 8 —— 先轉向再搭橋
    {
      id: 8, name: '屋頂回頭', chapter: '第三章 · 後院', theme: 'sky',
      story: '右邊是一排尖刺，出口卻在左邊的斷橋對面。先讓他回頭，再幫他過橋。',
      hint: '用箱子把他從尖刺那邊擋回來，再用木板接通左邊的斷橋。',
      world: world(), startFacing: 1, bed: { x: 500, y: 470 },
      solids: [LW, RW,
        { x: 320, y: 470, w: 300, h: 18 },
        { x: 32, y: 470, w: 168, h: 18 }],
      hazards: [
        { x: 620, y: 454, w: 308, h: 34, kind: 'spike' },
        { x: 200, y: 540, w: 120, h: 80, kind: 'water' }],
      movables: [
        { id: 'box', type: 'box', x: 380, y: 378, w: 56, h: 92 },
        { id: 'plank', type: 'plank', x: 420, y: 430, w: 160, h: 16 }],
      exit: { x: 46, y: 392, w: 54, h: 78 },
      solution: [{ id: 'box', x: 560, y: 378 }, { id: 'plank', x: 190, y: 466 }]
    },

    // 9 —— 招牌：層層下樓（房子剖面）
    {
      id: 9, name: '層層下樓', chapter: '第三章 · 後院', theme: 'sky',
      story: '三層樓的房子剖面，先生要從最上層一路安全降到地面大門。',
      hint: '箱子接第一層落差、床墊接第二層落差，引他一路往下。',
      world: world(), startFacing: 1, bed: { x: 90, y: 180 },
      solids: [LW, RW,
        { x: 32, y: 180, w: 360, h: 18 },
        { x: 380, y: 360, w: 300, h: 18 },
        { x: 32, y: 540, w: 896, h: 18 }],
      hazards: [],
      movables: [
        { id: 'box', type: 'box', x: 720, y: 456, w: 84, h: 84 },
        { id: 'mat', type: 'mattress', x: 760, y: 514, w: 150, h: 26 }],
      exit: { x: 826, y: 462, w: 54, h: 78 },
      solution: [{ id: 'box', x: 392, y: 276 }, { id: 'mat', x: 640, y: 514 }]
    },

    // 10 —— 終章：木板 + 箱子 + 床墊 + 危險全用上
    {
      id: 10, name: '平安落地', chapter: '第四章 · 大門', theme: 'dawn',
      story: '天快亮了，最後一段最長的路：跨缝、下樓、躲開尖刺，把先生平安送到大門。',
      hint: '木板補頂樓的縫、箱子接落差、床墊鋪在尖刺上方接住他。',
      world: world(), startFacing: 1, bed: { x: 90, y: 170 },
      solids: [LW, RW,
        { x: 32, y: 170, w: 240, h: 18 },
        { x: 380, y: 170, w: 172, h: 18 },
        { x: 380, y: 360, w: 300, h: 18 },
        { x: 32, y: 540, w: 896, h: 18 }],
      hazards: [
        { x: 272, y: 560, w: 108, h: 60, kind: 'water' },
        { x: 600, y: 522, w: 180, h: 18, kind: 'spike' }],
      movables: [
        { id: 'plank', type: 'plank', x: 80, y: 510, w: 160, h: 16 },
        { id: 'box', type: 'box', x: 120, y: 456, w: 84, h: 84 },
        { id: 'mat', type: 'mattress', x: 220, y: 514, w: 160, h: 26 }],
      exit: { x: 826, y: 462, w: 54, h: 78 },
      solution: [
        { id: 'plank', x: 260, y: 166 },
        { id: 'box', x: 552, y: 276 },
        { id: 'mat', x: 632, y: 514 }]
    }
  ];

  var api = { LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SleepwalkerLevels = api;
})(typeof window !== 'undefined' ? window : this);
