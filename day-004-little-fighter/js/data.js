'use strict';
// 原創角色資料 — 保留既有招式機制與數值,人物名稱、設定與 Sprite 全部自創
// 指令鍵:'>' 前(依面向)、'^' 上、'v' 下;結尾 A=攻擊鍵、J=跳躍鍵

const CHARS = {
  rook: {
    name: 'ROOK', zh: '脈衝拳手',
    skin: '#f2c9a0', hair: '#26201a', hairKind: 'spiky',
    shirt: '#f2eee4', pants: '#1d355e', shoes: '#e8edf3', band: null,
    speed: 3.0, run: 5.2, jumpV: 10.8,
    moves: {
      '>A': { kind: 'proj', proj: 'blast', speed: 7.5, dmg: 40, mp: 40, chain: true, name: '氣功波' },
      'vA': { kind: 'shrafe', dmg: 42, mp: 75, hits: 1, name: '迴身擊' },
      '^A': { kind: 'uppercut', dmg: 70, mp: 225, name: '升龍拳' },
      '^J': { kind: 'leapatk', dmg: 45, mp: 25, name: '躍擊' },
    },
    desc: '重拳與脈衝氣勁兼備的近戰核心',
  },
  vex: {
    name: 'VEX', zh: '疾風腿師',
    skin: '#eec49a', hair: '#6a4a26', hairKind: 'buzz',
    shirt: '#1c67c8', pants: '#252933', shoes: '#edf0ed', band: '#e87922',
    speed: 3.1, run: 5.4, jumpV: 10.6,
    moves: {
      '>A': { kind: 'proj', proj: 'blast', speed: 7.0, dmg: 40, mp: 40, chain: true, name: '氣彈' },
      'vA': { kind: 'shrafe', dmg: 18, mp: 75, hits: 4, name: '連環踢' },
      '>J': { kind: 'dashspin', dmg: 16, mp: 75, name: '追風連環踢' },
      '^A': { kind: 'proj', proj: 'homing', speed: 4.4, dmg: 50, mp: 100, name: '追蹤氣彈' },
    },
    desc: '高速腿技與追蹤氣彈牽制全場',
  },
  shade: {
    name: 'SHADE', zh: '瞬步斥候',
    skin: '#e8b888', hair: '#2a2420', hairKind: 'side',
    shirt: '#68252d', pants: '#202025', shoes: '#17171c', band: '#c8942d',
    speed: 2.9, run: 5.1, jumpV: 11.2,
    moves: {
      '^A': { kind: 'flipkick', dmg: 40, mp: 0, name: '後空翻踢' },
      'vA': { kind: 'turnkick', dmg: 45, mp: 50, name: '迴旋掃腿' },
      '>A': { kind: 'proj', proj: 'blast', speed: 6.5, dmg: 55, mp: 125, big: true, name: '氣勁波' },
      '^J': { kind: 'teleport', mp: 50, name: '瞬身(敵)' },
      'vJ': { kind: 'teleportFriend', mp: 50, name: '瞬身(友)' },
      '>J': { kind: 'tigerdash', dmg: 60, mp: 200, name: '猛虎突擊' },
    },
    desc: '用瞬步切換位置的敏捷斥候',
  },
  ember: {
    name: 'EMBER', zh: '爆炎鬥士',
    skin: '#eebd92', hair: '#d8401f', hairKind: 'flame',
    shirt: '#d94a18', pants: '#262429', shoes: '#211b19', band: null,
    speed: 2.7, run: 4.7, jumpV: 10.2,
    moves: {
      '>A': { kind: 'proj', proj: 'fire', speed: 5.5, dmg: 45, mp: 75, effect: 'burn', chain: true, name: '火球' },
      '>J': { kind: 'blazedash', dmg: 20, mp: 75, name: '火焰衝刺' },
      'vJ': { kind: 'inferno', dmg: 28, mp: 150, name: '地獄火' },
      '^J': { kind: 'explosion', dmg: 75, mp: 300, hpCost: 40, name: '自爆' },
    },
    desc: '以爆炎壓迫近身空間的重裝鬥士',
  },
  rime: {
    name: 'RIME', zh: '冰刃術士',
    skin: '#f4ddc8', hair: '#dfeef5', hairKind: 'side',
    shirt: '#d9f1fa', pants: '#183456', shoes: '#e8f5fb', band: null,
    speed: 2.6, run: 4.5, jumpV: 10.5,
    moves: {
      '>A': { kind: 'proj', proj: 'ice', speed: 5.2, dmg: 40, mp: 100, effect: 'freeze', name: '冰凍波' },
      '>J': { kind: 'icicle', dmg: 50, mp: 150, name: '冰柱' },
      'vJ': { kind: 'icesword', mp: 150, name: '召喚冰劍' },
      '^J': { kind: 'storm', dmg: 30, mp: 300, effect: 'freeze', name: '冰風暴' },
    },
    desc: '用寒氣控場並召喚冰刃的術士',
  },
};

const CHAR_KEYS = ['rook', 'vex', 'shade', 'ember', 'rime'];
const LEGACY_CHAR_IDS = {
  davis: 'rook', dennis: 'vex', woody: 'shade', firen: 'ember', freeze: 'rime',
};
function resolveCharKey(key) { return LEGACY_CHAR_IDS[key] || key; }

const SPRITE_POSES = {
  IDLE_A: 0, IDLE_B: 1, WALK_A: 2, WALK_B: 3,
  RUN: 4, JUMP: 5, PUNCH: 6, KICK: 7,
  DEFEND: 8, SPECIAL: 9, HURT: 10, WIN: 11,
};

function fighterSpriteIndex(f, frame = 0) {
  const timer = Number.isFinite(f.stateTimer) ? f.stateTimer : frame;
  switch (f.state) {
    case 'idle': return Math.floor(timer / 18) % 2 ? SPRITE_POSES.IDLE_B : SPRITE_POSES.IDLE_A;
    case 'walk': return Math.floor(timer / 8) % 2 ? SPRITE_POSES.WALK_B : SPRITE_POSES.WALK_A;
    case 'run': return SPRITE_POSES.RUN;
    case 'jump': case 'flip': return SPRITE_POSES.JUMP;
    case 'attack1': case 'attack2': case 'runattack': case 'weaponatk':
    case 'throwitem': case 'drink': case 'catching':
      return SPRITE_POSES.PUNCH;
    case 'attack3': case 'jumpattack': case 'leapatk': case 'risekick':
    case 'dashatk': case 'turnkick':
      return SPRITE_POSES.KICK;
    case 'defend': return SPRITE_POSES.DEFEND;
    case 'teleport': case 'explode': case 'cast': return SPRITE_POSES.SPECIAL;
    case 'hurt': case 'fall': case 'lying': case 'stunned': case 'caught': case 'frozen':
      return SPRITE_POSES.HURT;
    case 'win': return SPRITE_POSES.WIN;
    default: return SPRITE_POSES.IDLE_A;
  }
}

// 武器 — 會從天上掉下來,站在上面按攻擊撿起;拿著時 防→前→攻 = 用力丟出去
const WEAPONS = {
  bat:      { name: '球棒', heavy: true,  dmg: 40, reach: 80, kb: 5.5, down: true,  dur: 8,
              swing: { dur: 26, a0: 7, a1: 14 } },
  knife:    { name: '小刀', heavy: true,  dmg: 34, reach: 64, kb: 2.5, down: false, dur: 10,
              swing: { dur: 16, a0: 4, a1: 9 } },
  icesword: { name: '冰劍', heavy: true,  dmg: 45, reach: 72, kb: 3.5, down: false, dur: 6, effect: 'freeze',
              swing: { dur: 20, a0: 5, a1: 11 } },
  stone:    { name: '石頭', heavy: false, dmg: 55, dur: 2 },
  soda:     { name: '汽水', heavy: false, drink: true, dmg: 25, dur: 1 },
};
const WEAPON_KEYS = ['bat', 'knife', 'stone', 'soda']; // 冰劍只能召喚,不會從天上掉

if (typeof module !== 'undefined') {
  module.exports = {
    CHARS, CHAR_KEYS, LEGACY_CHAR_IDS, resolveCharKey,
    SPRITE_POSES, fighterSpriteIndex, WEAPONS, WEAPON_KEYS,
  };
}
