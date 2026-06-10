'use strict';
// 遊戲引擎 — 純邏輯零 DOM,瀏覽器與 Node 都能跑
// 座標系:x 水平、z 縱深(畫面 y 位置)、y 離地高度(跳起為正);畫面位置 = (x, z - y)

const W = 960, H = 540;
const ZMIN = 315, ZMAX = 515, XMIN = 42, XMAX = 918;
const GRAV = 0.55;
const HP_MAX = 500, MP_MAX = 500;
const Z_HIT = 22;          // 攻擊允許的縱深誤差(LF2 精髓:沒對齊就打不到)
const RUN_TAP_WINDOW = 14; // 雙擊跑步的判定幀數

// 普通攻擊參數表:dur 總幀數 / a0~a1 有效命中幀 / reach 距離 / down 是否擊倒
const ATK = {
  attack1:   { dur: 20, a0: 5, a1: 10, reach: 54, dmg: 20, kb: 1.6 },
  attack2:   { dur: 20, a0: 5, a1: 10, reach: 56, dmg: 22, kb: 2.2 },
  attack3:   { dur: 26, a0: 8, a1: 14, reach: 62, dmg: 30, kb: 4.5, down: true },
  runattack: { dur: 24, a0: 5, a1: 14, reach: 64, dmg: 40, kb: 5.0, down: true, lunge: 4.2 },
  jumpattack:{ dur: 999, a0: 0, a1: 999, reach: 60, dmg: 38, kb: 4.5, down: true },
  uppercut:  { dur: 999, a0: 3, a1: 22, reach: 58, dmg: 55, kb: 3.0, down: true },
  spinkick:  { dur: 30, a0: 2, a1: 26, reach: 56, dmg: 16, kb: 2.0, multi: true, dash: 6.2 },
};

function makeInput() {
  return { left: 0, right: 0, up: 0, down: 0, def: 0,
           atkE: 0, jumpE: 0, leftE: 0, rightE: 0, runWish: 0, seq: [] };
}

class Fighter {
  constructor(key, x, facing, pid, isAI) {
    this.key = key; this.c = CHARS[key]; this.pid = pid; this.isAI = !!isAI;
    this.x = x; this.z = (ZMIN + ZMAX) / 2; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.state = 'idle'; this.stateTimer = 0;
    this.hp = HP_MAX; this.hpRec = HP_MAX; this.mp = MP_MAX;
    this.input = makeInput();
    this.hitstop = 0; this.invuln = 0; this.frozenT = 0; this.hitFlash = 0;
    this.combo = 0; this.comboBuf = false;
    this.hitMap = {};        // 這一招已打中誰(pid → 命中幀)
    this.tapDir = 0; this.tapTimer = 99;
    this.castPlan = null;    // 施法中要生成的彈幕排程
    this.aiCool = 0; this.aiDefT = 0; this.aiZoff = 0; this.aiZoffT = 0;
  }
  get grounded() { return this.y <= 0 && this.vy <= 0; }
  get busy() { // 不能接受新指令的狀態
    return !['idle', 'walk', 'run', 'defend'].includes(this.state);
  }
}

class Engine {
  constructor(p1Key, p2Key, opts = {}) {
    this.frame = 0;
    this.fighters = [
      new Fighter(p1Key, 300, 1, 0, opts.p1AI),
      new Fighter(p2Key, 660, -1, 1, opts.p2AI),
    ];
    this.projs = [];
    this.parts = [];          // 粒子(純資料,render 負責畫)
    this.banner = { text: 'FIGHT!', t: 70 };
    this.intro = 50;          // 開場凍結幀
    this.over = false; this.winner = null;
    this.sfx = () => {};      // 由 main 注入音效 callback
    this.shake = 0;
  }
  enemyOf(f) { return this.fighters[1 - f.pid]; }

  step() {
    this.frame++;
    if (this.intro > 0) this.intro--;
    if (this.banner.t > 0) this.banner.t--;
    if (this.shake > 0) this.shake--;
    for (const f of this.fighters) {
      if (f.isAI && !this.over && this.intro <= 0) aiAct(this, f);
    }
    for (const f of this.fighters) this.updateFighter(f);
    this.updateProjs();
    this.updateParts();
    this.checkEnd();
    for (const f of this.fighters) {
      const i = f.input;
      i.atkE = 0; i.jumpE = 0; i.leftE = 0; i.rightE = 0; i.runWish = 0;
      if (i.seq.length > 8) i.seq.splice(0, i.seq.length - 8);
    }
  }

  // ---- 角色更新 ----
  updateFighter(f) {
    if (f.hitstop > 0) { f.hitstop--; return; }
    f.stateTimer++;
    f.tapTimer++;
    if (f.invuln > 0) f.invuln--;
    if (f.hitFlash > 0) f.hitFlash--;
    // MP 回氣 + HP 慢慢回到暗紅可回復線
    if (f.hp > 0) {
      f.mp = Math.min(MP_MAX, f.mp + 0.7);
      if (f.hp < f.hpRec) f.hp = Math.min(f.hpRec, f.hp + 0.05);
    }
    const inp = this.intro > 0 || this.over ? makeInput() : f.input;

    switch (f.state) {
      case 'idle': case 'walk': case 'run': case 'defend':
        this.groundControl(f, inp); break;
      case 'jump': this.airControl(f, inp); break;
      case 'attack1': case 'attack2': case 'attack3': case 'runattack':
        this.doAttack(f, inp); break;
      case 'jumpattack': this.doJumpAttack(f); break;
      case 'uppercut': this.doUppercut(f); break;
      case 'spinkick': this.doSpinkick(f); break;
      case 'cast': this.doCast(f); break;
      case 'hurt':
        f.x += f.vx; f.vx *= 0.86;
        if (f.stateTimer > 16) this.setState(f, 'idle');
        break;
      case 'fall': this.doFall(f); break;
      case 'lying':
        if (f.hp > 0 && f.stateTimer > 46) { this.setState(f, 'idle'); f.invuln = 45; }
        break;
      case 'frozen':
        f.frozenT--;
        if (f.frozenT <= 0) {
          this.setState(f, 'idle');
          this.burstParts(f.x, f.z - 40, '#bfe8ff', 10, 'ice');
          this.sfx('shatter');
        }
        break;
      case 'win':
        break;
    }
    this.clampPos(f);
  }

  setState(f, s) { f.state = s; f.stateTimer = 0; f.hitMap = {}; f.comboBuf = false; }

  groundControl(f, inp) {
    // 防禦
    if (inp.def && f.state !== 'defend') { this.setState(f, 'defend'); return; }
    if (f.state === 'defend') {
      // 攻擊優先處理:不然「放開防禦+按攻擊」同一幀時,攻擊會被吃掉
      if (inp.atkE) { this.tryAttackFromGround(f, inp); return; }
      if (!inp.def) this.setState(f, 'idle');
      return;
    }
    // 雙擊偵測 → 跑步
    if (inp.leftE) {
      if (f.tapDir === -1 && f.tapTimer < RUN_TAP_WINDOW) this.startRun(f, -1);
      f.tapDir = -1; f.tapTimer = 0;
    }
    if (inp.rightE) {
      if (f.tapDir === 1 && f.tapTimer < RUN_TAP_WINDOW) this.startRun(f, 1);
      f.tapDir = 1; f.tapTimer = 0;
    }
    if (inp.runWish && (inp.left || inp.right) && f.state !== 'run') {
      this.startRun(f, inp.right ? 1 : -1); // AI 專用的跑步捷徑
    }
    if (inp.jumpE) {
      f.vy = f.c.jumpV * (f.state === 'run' ? 1.05 : 1);
      f.runJump = f.state === 'run';
      this.setState(f, 'jump'); this.sfx('jump'); return;
    }
    if (inp.atkE) { this.tryAttackFromGround(f, inp); return; }

    if (f.state === 'run') {
      const dirHeld = f.facing === 1 ? inp.right : inp.left;
      const oppHeld = f.facing === 1 ? inp.left : inp.right;
      if (!dirHeld || oppHeld) { this.setState(f, 'idle'); return; }
      f.x += f.facing * f.c.run;
      f.z += (inp.down - inp.up) * 1.3;
      if (this.frame % 5 === 0) this.dust(f.x - f.facing * 14, f.z);
      return;
    }
    // 走路
    let mx = (inp.right - inp.left), mz = (inp.down - inp.up);
    if (mx !== 0) f.facing = mx;
    f.x += mx * f.c.speed;
    f.z += mz * 1.85;
    this.setStateKeep(f, (mx || mz) ? 'walk' : 'idle');
  }
  setStateKeep(f, s) { if (f.state !== s) this.setState(f, s); }

  startRun(f, dir) { f.facing = dir; this.setState(f, 'run'); }

  tryAttackFromGround(f, inp) {
    if (this.trySpecial(f)) return;
    if (f.state === 'run') { this.setState(f, 'runattack'); f.combo = 0; this.sfx('whoosh'); return; }
    this.setState(f, 'attack1'); f.combo = 1; this.sfx('whoosh');
  }

  airControl(f, inp) {
    f.x += (inp.right - inp.left) * f.c.speed * (f.runJump ? 1.5 : 0.85);
    f.z += (inp.down - inp.up) * 1.2;
    if (inp.atkE) { this.setState(f, 'jumpattack'); this.sfx('whoosh'); return; }
    this.applyGravity(f, 'idle');
  }

  applyGravity(f, landState) {
    f.y += f.vy; f.vy -= GRAV;
    if (f.y <= 0 && f.vy < 0) {
      f.y = 0; f.vy = 0; f.runJump = false;
      this.dust(f.x - 8, f.z); this.dust(f.x + 8, f.z);
      this.setState(f, landState);
      return true;
    }
    return false;
  }

  doAttack(f, inp) {
    const a = ATK[f.state];
    if (a.lunge && f.stateTimer < a.a1) f.x += f.facing * a.lunge;
    if (f.stateTimer >= a.a0 && f.stateTimer <= a.a1) this.meleeHit(f, a);
    // 連段預輸入:第一、二拳的後搖按攻擊 → 接下一拳
    if (inp.atkE && f.stateTimer > a.a0) f.comboBuf = true;
    if (f.stateTimer >= a.dur) {
      if (f.comboBuf && f.combo >= 1 && f.combo < 3) {
        f.combo++;
        this.setState(f, 'attack' + f.combo); this.sfx('whoosh');
      } else { f.combo = 0; this.setState(f, 'idle'); }
    }
  }

  doJumpAttack(f) {
    const a = ATK.jumpattack;
    f.x += f.facing * 1.2;
    this.meleeHit(f, a);
    this.applyGravity(f, 'idle');
  }

  doUppercut(f) {
    const a = ATK.uppercut;
    if (f.stateTimer === 1) { f.vy = 9.5; this.sfx('cast'); }
    f.x += f.facing * 2.2;
    if (f.stateTimer >= a.a0 && f.stateTimer <= a.a1) this.meleeHit(f, a, { upKb: 9 });
    if (this.frame % 2 === 0) this.addP(f.x, f.z - f.y - 50, 0, -1, '#ffe28a', 14, 'spark');
    this.applyGravity(f, 'idle');
  }

  doSpinkick(f) {
    const a = ATK.spinkick;
    if (f.stateTimer >= a.a0 && f.stateTimer <= a.a1) {
      f.x += f.facing * a.dash;
      this.meleeHit(f, a, { rehit: 8, lastDown: f.stateTimer > a.a1 - 8 });
      if (this.frame % 3 === 0) this.dust(f.x - f.facing * 16, f.z);
    }
    if (f.stateTimer >= a.dur) this.setState(f, 'idle');
  }

  doCast(f) {
    if (f.castPlan) {
      for (const c of f.castPlan) {
        if (f.stateTimer === c.at) this.spawnProj(f, c);
      }
    }
    if (f.stateTimer >= 26) { f.castPlan = null; this.setState(f, 'idle'); }
  }

  doFall(f) {
    f.x += f.vx; f.vx *= 0.97;
    if (this.applyGravity(f, 'lying')) {
      f.vx = 0; this.sfx('thud'); this.shake = Math.max(this.shake, 6);
    }
  }

  // ---- 近戰命中 ----
  meleeHit(f, a, opt = {}) {
    const e = this.enemyOf(f);
    const dx = (e.x - f.x) * f.facing;
    if (dx < 4 || dx > a.reach) return;
    if (Math.abs(e.z - f.z) > Z_HIT) return;
    if (Math.abs(e.y - f.y) > 52) return;
    const last = f.hitMap[e.pid];
    if (a.multi) {
      if (last !== undefined && f.stateTimer - last < (opt.rehit || 8)) return;
    } else if (last !== undefined) return;
    f.hitMap[e.pid] = f.stateTimer;
    const down = a.down || opt.lastDown;
    this.applyHit(e, f, { dmg: a.dmg, kb: a.kb, down, upKb: opt.upKb });
  }

  // ---- 傷害結算(近戰與彈幕共用)----
  applyHit(t, atkr, { dmg, kb = 2, down = false, effect = null, upKb = 0 }) {
    if (t.state === 'lying' || t.invuln > 0 || t.state === 'win' || this.over) return false;
    const dir = Math.sign(t.x - atkr.x) || -t.facing || 1;
    const facingAttacker = t.facing === Math.sign(atkr.x - t.x);
    // 防禦成功:傷害大減、不被擊倒
    if (t.state === 'defend' && facingAttacker && t.frozenT <= 0) {
      dmg *= 0.12; down = false; effect = null;
      t.vx = 0; t.x += dir * kb * 2;
      this.burstParts((t.x + atkr.x) / 2, t.z - 45, '#9fb7d4', 5, 'spark');
      this.sfx('block');
    } else {
      this.burstParts((t.x + atkr.x) / 2, t.z - t.y - 45, '#ffd75e', 8, 'spark');
      this.sfx(effect === 'freeze' ? 'freezeHit' : 'hit');
    }
    if (t.state === 'frozen') { t.frozenT = 0; down = true; effect = null;
      this.burstParts(t.x, t.z - 40, '#bfe8ff', 12, 'ice'); this.sfx('shatter'); }
    if (t.y > 2) down = true; // 空中吃招一律擊落,避免掛在半空

    t.hpRec = Math.max(0, t.hpRec - dmg * 0.7);
    t.hp = Math.max(0, t.hp - dmg);
    t.hpRec = Math.max(t.hpRec, t.hp);
    t.hitFlash = 5;
    if (t.hp <= 0) down = true;

    if (effect === 'freeze' && !down) {
      t.frozenT = 110; t.vx = 0; this.setState(t, 'frozen');
    } else if (down) {
      t.vx = dir * Math.max(2.5, kb); t.vy = upKb || 6.5;
      t.y = Math.max(t.y, 0.1);
      this.setState(t, 'fall');
      if (effect === 'burn') this.burstParts(t.x, t.z - 50, '#ff8c3a', 14, 'flame');
    } else if (t.state !== 'defend') {
      t.vx = dir * kb * 0.8;
      this.setState(t, 'hurt');
    }
    t.hitstop = 5; atkr.hitstop = 5;
    return true;
  }

  // ---- 必殺技輸入判定:防 → 方向 → 攻 ----
  trySpecial(f) {
    const s = f.input.seq, now = this.frame;
    let dirEv = null, defOK = !!f.input.def;
    for (let i = s.length - 1; i >= 0; i--) {
      const e = s[i];
      if (now - e.f > 48) break;
      if (!dirEv && (e.k === 'left' || e.k === 'right' || e.k === 'up')) { dirEv = e; continue; }
      if (dirEv && e.k === 'def') { defOK = true; break; }
    }
    if (!dirEv || !defOK) return false;
    if (dirEv.k === 'up') return this.castSpec2(f);
    return this.castProj(f, dirEv.k === 'right' ? 1 : -1);
  }

  castProj(f, dir) {
    const p = f.c.proj;
    if (f.mp < p.mp) return false;
    f.mp -= p.mp; f.facing = dir;
    f.castPlan = [{ at: 10, ...p }];
    this.setState(f, 'cast'); f.input.seq = [];
    this.sfx('cast');
    return true;
  }

  castSpec2(f) {
    const sp = f.c.spec2;
    if (f.mp < sp.mp) return false;
    f.mp -= sp.mp; f.input.seq = [];
    if (sp.kind === 'uppercut') { this.setState(f, 'uppercut'); return true; }
    if (sp.kind === 'spinkick') { this.setState(f, 'spinkick'); this.sfx('cast'); return true; }
    if (sp.kind === 'firejet') {
      f.castPlan = [8, 14, 20].map(at => ({ at, kind: 'fire', speed: 5, dmg: sp.dmg, mp: 0, effect: 'burn', life: 30, small: true }));
      this.setState(f, 'cast'); this.sfx('fire');
      return true;
    }
    if (sp.kind === 'storm') {
      f.castPlan = [{ at: 12, kind: 'storm', speed: 1.6, dmg: sp.dmg, mp: 0, effect: 'freeze', life: 130, wide: true }];
      this.setState(f, 'cast'); this.sfx('ice');
      return true;
    }
    return false;
  }

  spawnProj(f, spec) {
    this.projs.push({
      kind: spec.kind, owner: f.pid,
      x: f.x + f.facing * 30, z: f.z, y: 38,
      vx: f.facing * spec.speed,
      dmg: spec.dmg, effect: spec.effect || null,
      life: spec.life || 200, wide: !!spec.wide, small: !!spec.small,
      seed: (this.frame * 7 + f.pid * 13) % 100,
    });
    this.sfx(spec.kind === 'fire' ? 'fire' : spec.kind === 'ice' || spec.kind === 'storm' ? 'ice' : 'shoot');
  }

  updateProjs() {
    for (const p of this.projs) {
      p.x += p.vx; p.life--;
      if (p.kind === 'homing') {
        const t = this.fighters[1 - p.owner];
        const dz = t.z - p.z;
        p.z += Math.max(-1.8, Math.min(1.8, dz * 0.09));
      }
      // 尾跡粒子
      if (this.frame % 2 === 0) {
        const col = { blast: '#8df0ff', fire: '#ff9a3a', ice: '#cfeaff', homing: '#9af09a', storm: '#dff2ff' }[p.kind];
        this.addP(p.x - p.vx * 2, p.z - p.y + (Math.random() - 0.5) * 8, -p.vx * 0.2, -0.3, col, 8, p.kind === 'fire' ? 'flame' : 'spark');
      }
      if (p.x < -40 || p.x > W + 40 || p.life <= 0) { p.dead = true; continue; }
      // 打中角色
      const zw = p.wide ? 42 : Z_HIT, xw = p.wide ? 46 : 28;
      for (const f of this.fighters) {
        if (f.pid === p.owner || p.dead) continue;
        if (f.state === 'lying' || f.invuln > 0) continue;
        if (Math.abs(p.z - f.z) > zw || Math.abs(p.x - f.x) > xw) continue;
        if (f.y > 46) continue; // 跳起來可以躲彈
        const hit = this.applyHit(f, this.fighters[p.owner],
          { dmg: p.dmg, kb: 3.5, down: !p.effect || p.effect === 'burn', effect: p.effect });
        if (hit) {
          p.dead = true;
          const col = p.kind === 'fire' ? '#ff8c3a' : p.kind === 'ice' || p.kind === 'storm' ? '#bfe8ff' : '#aef3ff';
          this.burstParts(p.x, p.z - p.y, col, 12, p.kind === 'fire' ? 'flame' : 'spark');
        }
      }
    }
    // 彈互撞 → 同歸於盡
    for (let i = 0; i < this.projs.length; i++) {
      for (let j = i + 1; j < this.projs.length; j++) {
        const a = this.projs[i], b = this.projs[j];
        if (a.dead || b.dead || a.owner === b.owner) continue;
        if (Math.abs(a.z - b.z) < 26 && Math.abs(a.x - b.x) < 32) {
          a.dead = b.dead = true;
          this.burstParts((a.x + b.x) / 2, a.z - a.y, '#ffffff', 14, 'spark');
          this.sfx('hit');
        }
      }
    }
    this.projs = this.projs.filter(p => !p.dead);
  }

  // ---- 粒子 ----
  addP(x, y, vx, vy, color, life, kind) {
    if (this.parts.length > 220) return;
    this.parts.push({ x, y, vx, vy, color, life, max: life, kind, size: 2 + Math.random() * 3 });
  }
  burstParts(x, y, color, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.2;
      this.addP(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 1, color, 16 + Math.random() * 12, kind);
    }
  }
  dust(x, z) { this.addP(x, z, (Math.random() - 0.5) * 1.2, -0.6 - Math.random(), '#c9b89a', 14, 'dust'); }
  updateParts() {
    for (const p of this.parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.kind === 'spark' || p.kind === 'ice') p.vy += 0.12;
      if (p.kind === 'flame') p.vy -= 0.08;
      p.life--;
    }
    this.parts = this.parts.filter(p => p.life > 0);
  }

  clampPos(f) {
    f.x = Math.max(XMIN, Math.min(XMAX, f.x));
    f.z = Math.max(ZMIN, Math.min(ZMAX, f.z));
  }

  checkEnd() {
    if (this.over) return;
    for (const f of this.fighters) {
      if (f.hp <= 0 && f.state === 'lying' && f.stateTimer > 40) {
        this.over = true;
        this.winner = this.enemyOf(f);
        if (this.winner.grounded && this.winner.hp > 0) this.setState(this.winner, 'win');
        this.banner = { text: 'K.O.!', t: 9999 };
        this.sfx('ko');
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = { Engine, Fighter, W, H, ZMIN, ZMAX, HP_MAX, MP_MAX };
