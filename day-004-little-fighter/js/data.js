'use strict';
// 角色資料 — 招式指令表與 MP 消耗依照原作 LF2 官方 control guide(機制數據)
// 美術仍為原創手繪,不使用原作任何素材
// 指令鍵:'>' 前(依面向)、'^' 上、'v' 下;結尾 A=攻擊鍵、J=跳躍鍵

const CHARS = {
  davis: {
    name: 'Davis', zh: '氣功小子',
    skin: '#f2c9a0', hair: '#26201a', hairKind: 'spiky',
    shirt: '#e8e4da', pants: '#3a5f9e', shoes: '#5a4a3a', band: null,
    speed: 3.0, run: 5.2, jumpV: 10.8,
    moves: {
      '>A': { kind: 'proj', proj: 'blast', speed: 7.5, dmg: 40, mp: 40, chain: true, name: '氣功波' },
      'vA': { kind: 'shrafe', dmg: 42, mp: 75, hits: 1, name: '迴身擊' },
      '^A': { kind: 'uppercut', dmg: 70, mp: 225, name: '升龍拳' },
      '^J': { kind: 'leapatk', dmg: 45, mp: 25, name: '躍擊' },
    },
    desc: '拳法主角,升龍拳一擊沖天',
  },
  dennis: {
    name: 'Dennis', zh: '旋風腿王',
    skin: '#eec49a', hair: '#6a4a26', hairKind: 'buzz',
    shirt: '#3f8ee8', pants: '#2a3f5e', shoes: '#e8e4da', band: null,
    speed: 3.1, run: 5.4, jumpV: 10.6,
    moves: {
      '>A': { kind: 'proj', proj: 'blast', speed: 7.0, dmg: 40, mp: 40, chain: true, name: '氣彈' },
      'vA': { kind: 'shrafe', dmg: 18, mp: 75, hits: 4, name: '連環踢' },
      '>J': { kind: 'dashspin', dmg: 16, mp: 75, name: '追風連環踢' },
      '^A': { kind: 'proj', proj: 'homing', speed: 4.4, dmg: 50, mp: 100, name: '追蹤氣彈' },
    },
    desc: '腿功連段,氣彈會轉彎追人',
  },
  woody: {
    name: 'Woody', zh: '忍術小子',
    skin: '#e8b888', hair: '#2a2420', hairKind: 'side',
    shirt: '#8a3a2e', pants: '#3a2e26', shoes: '#26201a', band: '#d8a23c',
    speed: 2.9, run: 5.1, jumpV: 11.2,
    moves: {
      '^A': { kind: 'flipkick', dmg: 40, mp: 0, name: '後空翻踢' },
      'vA': { kind: 'turnkick', dmg: 45, mp: 50, name: '迴旋掃腿' },
      '>A': { kind: 'proj', proj: 'blast', speed: 6.5, dmg: 55, mp: 125, big: true, name: '氣勁波' },
      '^J': { kind: 'teleport', mp: 50, name: '瞬身(敵)' },
      'vJ': { kind: 'teleportFriend', mp: 50, name: '瞬身(友)' },
      '>J': { kind: 'tigerdash', dmg: 60, mp: 200, name: '猛虎突擊' },
    },
    desc: '會瞬間移動的體術忍者',
  },
  firen: {
    name: 'Firen', zh: '火焰人',
    skin: '#eebd92', hair: '#d8401f', hairKind: 'flame',
    shirt: '#c8581e', pants: '#5a2a16', shoes: '#332012', band: null,
    speed: 2.7, run: 4.7, jumpV: 10.2,
    moves: {
      '>A': { kind: 'proj', proj: 'fire', speed: 5.5, dmg: 45, mp: 75, effect: 'burn', chain: true, name: '火球' },
      '>J': { kind: 'blazedash', dmg: 20, mp: 75, name: '火焰衝刺' },
      'vJ': { kind: 'inferno', dmg: 28, mp: 150, name: '地獄火' },
      '^J': { kind: 'explosion', dmg: 75, mp: 300, hpCost: 40, name: '自爆' },
    },
    desc: '玩火的男人,自爆同歸於盡',
  },
  freeze: {
    name: 'Freeze', zh: '冰封者',
    skin: '#f4ddc8', hair: '#dfeef5', hairKind: 'side',
    shirt: '#5aa7c7', pants: '#33566b', shoes: '#22394a', band: null,
    speed: 2.6, run: 4.5, jumpV: 10.5,
    moves: {
      '>A': { kind: 'proj', proj: 'ice', speed: 5.2, dmg: 40, mp: 100, effect: 'freeze', name: '冰凍波' },
      '>J': { kind: 'icicle', dmg: 50, mp: 150, name: '冰柱' },
      'vJ': { kind: 'icesword', mp: 150, name: '召喚冰劍' },
      '^J': { kind: 'storm', dmg: 30, mp: 300, effect: 'freeze', name: '冰風暴' },
    },
    desc: '凍住你,再慢慢修理你',
  },
};

const CHAR_KEYS = ['davis', 'dennis', 'woody', 'firen', 'freeze'];

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

if (typeof module !== 'undefined') module.exports = { CHARS, CHAR_KEYS, WEAPONS, WEAPON_KEYS };
