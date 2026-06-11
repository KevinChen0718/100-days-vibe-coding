'use strict';
// 角色資料 — 原創致敬角色,不使用原作任何素材
// 每隻角色:基本能力值 + 外觀配色 + 兩招必殺(防→前→攻 / 防→上→攻)

const CHARS = {
  dan: {
    name: '阿丹', en: 'Dan', title: '氣功少年',
    skin: '#f2c9a0', hair: '#4a2f17', hairKind: 'spiky',
    shirt: '#3a6ea5', pants: '#2c3e50', shoes: '#7a4a21', band: '#d23c3c',
    speed: 2.7, run: 4.8, jumpV: 10.5,
    proj: { kind: 'blast', speed: 7.5, dmg: 42, mp: 100, name: '氣功波' },
    spec2: { kind: 'uppercut', dmg: 55, mp: 150, name: '升龍拳' },
    desc: '攻守均衡的王道主角',
  },
  blaze: {
    name: '火焰', en: 'Blaze', title: '烈火行者',
    skin: '#eebd92', hair: '#d8401f', hairKind: 'flame',
    shirt: '#c8581e', pants: '#5a2a16', shoes: '#332012', band: null,
    speed: 2.8, run: 4.9, jumpV: 10.2,
    proj: { kind: 'fire', speed: 5.5, dmg: 50, mp: 100, effect: 'burn', name: '火球' },
    spec2: { kind: 'firejet', dmg: 26, mp: 200, name: '烈焰噴射' },
    desc: '火球威力大,中招必倒地',
  },
  frost: {
    name: '阿霜', en: 'Frost', title: '冰封術士',
    skin: '#f4ddc8', hair: '#dfeef5', hairKind: 'side',
    shirt: '#5aa7c7', pants: '#33566b', shoes: '#22394a', band: null,
    speed: 2.6, run: 4.5, jumpV: 10.5,
    proj: { kind: 'ice', speed: 5.2, dmg: 34, mp: 100, effect: 'freeze', name: '冰凍球' },
    spec2: { kind: 'storm', dmg: 30, mp: 250, effect: 'freeze', name: '暴風雪' },
    desc: '把對手凍住再慢慢修理',
  },
  bolt: {
    name: '雷弟', en: 'Bolt', title: '旋風快腿',
    skin: '#e8b888', hair: '#222426', hairKind: 'buzz',
    shirt: '#3f9e58', pants: '#2a2f33', shoes: '#dddddd', band: '#3f9e58',
    speed: 3.0, run: 5.3, jumpV: 11.0,
    proj: { kind: 'homing', speed: 4.4, dmg: 38, mp: 100, name: '追蹤氣彈' },
    spec2: { kind: 'spinkick', dmg: 16, mp: 150, name: '旋風連踢' },
    desc: '全場最快,氣彈會轉彎',
  },
};

const CHAR_KEYS = ['dan', 'blaze', 'frost', 'bolt'];

// 武器 — 會從天上掉下來,站在上面按攻擊撿起
// heavy=true 拿著揮(有耐久),heavy=false 按攻擊丟出去;drink=true 是喝的
const WEAPONS = {
  bat:   { name: '球棒', heavy: true,  dmg: 40, reach: 80, kb: 5.5, down: true,  dur: 8,
           swing: { dur: 26, a0: 7, a1: 14 } },
  knife: { name: '小刀', heavy: true,  dmg: 34, reach: 64, kb: 2.5, down: false, dur: 10,
           swing: { dur: 16, a0: 4, a1: 9 } },
  stone: { name: '石頭', heavy: false, dmg: 55, dur: 2 },
  soda:  { name: '汽水', heavy: false, drink: true, dmg: 25, dur: 1 },
};
const WEAPON_KEYS = ['bat', 'knife', 'stone', 'soda'];

if (typeof module !== 'undefined') module.exports = { CHARS, CHAR_KEYS, WEAPONS, WEAPON_KEYS };
