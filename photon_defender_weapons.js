/*
 * Weapons, bullet patterns and difficulty settings for PSO Photon Defender –
 * Vampire Survivors flavour.
 *
 * This module defines particle effects (FX), weapon families and their
 * evolutionary tiers, a bullet factory for constructing projectiles with
 * varied behaviours, and an optional Difficulty object to scale enemy
 * encounters. It also overrides certain methods on the Game prototype to
 * implement complex firing patterns, bullet motion, rendering and damage
 * handling. The spawn logic for enemies is provided separately in
 * photon_defender_enemies.js; this file focuses solely on the player’s
 * arsenal and on-screen effects.
 */

/* ---------- 1) FX + Bullet “animations” (trails, spin, pulses, particles) ---------- */
// Basic random range helper used throughout the weapons module. Defined
// here in case the enemies module hasn’t already provided it.
function randRange(a, b) {
  return a + Math.random() * (b - a);
}

// Clamp a value between two bounds. Used for homing adjustments.
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// Particle effect manager. Handles sparks, trails and rings. Each effect
// manages its own lifetime and draws itself relative to the game’s
// canvas context.
class FX {
  constructor(game) {
    this.g = game;
    this.ctx = game.ctx;
    this.particles = [];
  }
  spark(x, y, color, n = 10, sp = 3, life = 25) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y,
        vx: randRange(-sp, sp),
        vy: randRange(-sp, sp),
        r: randRange(1, 3),
        life: randRange(life * 0.6, life),
        max: life,
        color
      });
    }
  }
  trail(x, y, color, w = 6, h = 2, life = 16, rot = 0) {
    this.particles.push({
      x, y,
      vx: 0,
      vy: 0,
      r: 0,
      life,
      max: life,
      color,
      w,
      h,
      rot,
      kind: 'trail'
    });
  }
  ring(x, y, color, life = 18, r0 = 4, r1 = 30) {
    this.particles.push({
      x, y,
      vx: 0,
      vy: 0,
      life,
      max: life,
      color,
      r0,
      r1,
      kind: 'ring'
    });
  }
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life--;
      p.x += p.vx || 0;
      p.y += p.vy || 0;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
  render() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const t = 1 - (p.life / p.max);
      if (p.kind === 'trail') {
        ctx.save();
        ctx.globalAlpha = 0.35 * (1 - t);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }
      if (p.kind === 'ring') {
        const r = p.r0 + (p.r1 - p.r0) * t;
        ctx.save();
        ctx.globalAlpha = 0.35 * (1 - t);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.save();
      ctx.globalAlpha = 0.65 * (1 - t);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}

/* ---------- 2) Weapon families and evolutions ---------- */
// The weapon definition tree. Each class has families (saber, handgun, etc.)
// and each family has tiers. Tiers specify damage, cooldown and pattern,
// plus a display colour. Evolved tiers unlock more complex patterns.
const WeaponDefs = {
  hunter: {
    saber: {
      name: 'SABER',
      tiers: [
        { label: 'SABER I',    dmg: 0.85, cd: 12, pattern: 'slash',        color: '#f97316' },
        { label: 'SABER II',   dmg: 0.95, cd: 12, pattern: 'doubleSlash',  color: '#fb923c' },
        { label: 'SABER III',  dmg: 1.05, cd: 11, pattern: 'tripleSlash',  color: '#fdba74' },
        { label: 'GIGA EDGE',  dmg: 1.20, cd: 11, pattern: 'wideWave',      color: '#ff7b72', evolve: true },
        { label: 'GIGA EDGE+', dmg: 1.30, cd: 10, pattern: 'wideWavePlus', color: '#ef4444' }
      ]
    }
  },
  ranger: {
    handgun: {
      name: 'HANDGUN',
      tiers: [
        { label: 'HG I',  dmg: 0.55, cd: 10, pattern: 'single',         color: '#34d399' },
        { label: 'HG II', dmg: 0.60, cd:  9, pattern: 'double',         color: '#22c55e' },
        { label: 'HG III',dmg: 0.70, cd:  8, pattern: 'fan',            color: '#86efac' },
        { label: 'HEAVEN STRIKER',  dmg: 0.85, cd: 8, pattern: 'pierceLine',    color: '#facc15', evolve: true },
        { label: 'HEAVEN STRIKER+', dmg: 0.95, cd: 7, pattern: 'pierceLinePlus', color: '#fde047' }
      ]
    },
    shotgun: {
      name: 'SHOTGUN',
      tiers: [
        { label: 'SG I',  dmg: 0.42, cd: 13, pattern: 'cone3',        color: '#f87171' },
        { label: 'SG II', dmg: 0.45, cd: 12, pattern: 'cone5',        color: '#fb7185' },
        { label: 'SG III',dmg: 0.48, cd: 11, pattern: 'cone7',        color: '#fecdd3' },
        { label: 'SPREAD NEEDLE', dmg: 0.55, cd: 10, pattern: 'needleBurst',     color: '#e2e8f0', evolve: true },
        { label: 'SPREAD NEEDLE+',dmg: 0.60, cd:  9, pattern: 'needleBurstPlus', color: '#ffffff' }
      ]
    },
    rifle: {
      name: 'RIFLE',
      tiers: [
        { label: 'RF I',  dmg: 0.75, cd: 16, pattern: 'sniper',        color: '#facc15' },
        { label: 'RF II', dmg: 0.85, cd: 15, pattern: 'sniperPierce',  color: '#fde047' },
        { label: 'RF III',dmg: 0.95, cd: 14, pattern: 'sniperPierce',  color: '#fff7aa' },
        { label: 'FROZEN SHOOTER',  dmg: 1.00, cd: 14, pattern: 'freezeLance',   color: '#38bdf8', evolve: true },
        { label: 'FROZEN SHOOTER+', dmg: 1.10, cd: 13, pattern: 'freezeLancePlus', color: '#7dd3fc' }
      ]
    },
    bazooka: {
      name: 'BAZOOKA',
      tiers: [
        { label: 'BZ I',  dmg: 0.95, cd: 20, pattern: 'rocket',         color: '#c084fc' },
        { label: 'BZ II', dmg: 1.05, cd: 19, pattern: 'rocketSplash',   color: '#a855f7' },
        { label: 'BZ III',dmg: 1.15, cd: 18, pattern: 'rocketSplash',   color: '#e9d5ff' },
        { label: 'DARK METEOR',  dmg: 1.25, cd: 18, pattern: 'meteor',        color: '#ef4444', evolve: true },
        { label: 'DARK METEOR+', dmg: 1.35, cd: 17, pattern: 'meteorPlus',    color: '#ff7b72' }
      ]
    }
  },
  force: {
    fire: {
      name: 'FIRE',
      tiers: [
        { label: 'FOIE I',   dmg: 0.45, cd: 25, pattern: 'fireOrb',       color: '#f97316' },
        { label: 'FOIE II',  dmg: 0.55, cd: 23, pattern: 'fireOrb2',      color: '#fb923c' },
        { label: 'FOIE III', dmg: 0.65, cd: 22, pattern: 'fireOrbSpread', color: '#fdba74' },
        { label: 'GIFOIE',   dmg: 0.70, cd: 21, pattern: 'fireRing',      color: '#ef4444', evolve: true },
        { label: 'GIFOIE+',  dmg: 0.80, cd: 20, pattern: 'fireRingPlus',  color: '#ff7b72' }
      ]
    },
    lightning: {
      name: 'LIGHTNING',
      tiers: [
        { label: 'ZONDE I',   dmg: 0.40, cd: 24, pattern: 'zap',         color: '#facc15' },
        { label: 'ZONDE II',  dmg: 0.48, cd: 22, pattern: 'zapChain',    color: '#fde047' },
        { label: 'ZONDE III', dmg: 0.55, cd: 21, pattern: 'zapChain',    color: '#fff7aa' },
        { label: 'GIZONDE',   dmg: 0.60, cd: 20, pattern: 'zapNova',      color: '#eab308', evolve: true },
        { label: 'GIZONDE+',  dmg: 0.70, cd: 19, pattern: 'zapNovaPlus', color: '#fef08a' }
      ]
    },
    ice: {
      name: 'ICE',
      tiers: [
        { label: 'BARTA I',   dmg: 0.50, cd: 26, pattern: 'iceShard',      color: '#38bdf8' },
        { label: 'BARTA II',  dmg: 0.60, cd: 24, pattern: 'iceShard2',     color: '#7dd3fc' },
        { label: 'BARTA III', dmg: 0.68, cd: 23, pattern: 'iceShardSpread',color: '#bae6fd' },
        { label: 'GIBARTA',   dmg: 0.75, cd: 22, pattern: 'iceWall',       color: '#0ea5e9', evolve: true },
        { label: 'GIBARTA+',  dmg: 0.85, cd: 21, pattern: 'iceWallPlus',   color: '#38bdf8' }
      ]
    }
  }
};

/* ---------- 3) Bullet factory ---------- */
// Create a bullet with default properties, merging in overrides. This
// ensures every bullet has consistent fields (x, y, velocity, size,
// lifetime, type, etc.). Additional flags like piercing, homing,
// splash damage and slow effects are supported.
function makeBullet(x, y, base) {
  return Object.assign({
    x, y,
    vx: base.vx ?? base.s ?? 8,
    vy: base.vy ?? 0,
    w: base.w ?? 10,
    h: base.h ?? 4,
    life: base.life ?? 120,
    pierce: !!base.piercing,
    homing: !!base.homing,
    color: base.color ?? '#58a6ff',
    spin: base.spin ?? 0,
    rot: base.rot ?? 0,
    kind: base.kind ?? 'rect',
    glow: base.glow ?? 0,
    splash: base.splash ?? 0,
    slow: base.slow ?? 0,
    ricochet: base.ricochet ?? 0,
    owner: 'player'
  }, base);
}

/* ---------- 4) Difficulty knobs ---------- */
// Difficulty settings control scaling of enemy attributes, spawn rates
// and bullet sizes/speeds. These values are read by the core and
// enemies modules.
const Difficulty = {
  spawnRateStart: 48,
  spawnRateMin: 10,
  spawnRateDropPerLevel: 3,
  enemyHpScalePerLevel: 0.08,
  enemySpeedScalePerLevel: 0.03,
  enemyBulletSpeedMult: 1.25,
  enemyBulletSizeMult: 1.10,
  eliteBaseChance: 0.18,
  eliteBonusPerLevel: 0.006,
  eliteHpMult: 1.6,
  eliteSpeedMult: 1.15,
  eliteDropBonus: 0.20
};

/* ---------- 5) Overwrite Game.prototype.shoot ---------- */
// This replacement shoot method uses the weapon definition tree to
// determine firing patterns. It selects the current weapon family for
// the class, manages tiers and fervor stacks, calculates damage and
// pushes the appropriate bullets with particle effects.
Game.prototype.shoot = function () {
  this.sounds.shoot();
  const lvl = clamp(this.player.weaponLevel, 1, 10);
  const baseX = this.player.x + this.player.w;
  const baseY = this.player.y + this.player.h / 2;
  // Determine current weapon family based on class and equipped type
  let familyKey = 'saber';
  if (this.playerClass === 'hunter') familyKey = 'saber';
  if (this.playerClass === 'ranger') familyKey = (this.player.weaponType || 'handgun');
  if (this.playerClass === 'force') familyKey = (this.player.element || 'fire');
  // Initialize or reset family state
  if (!this.player.weaponFamily) this.player.weaponFamily = familyKey;
  if (this.player.weaponFamily !== familyKey) {
    this.player.weaponFamily = familyKey;
    this.player.weaponTier = 0;
    this.player.fervor = 1.0;
    this.player.fervorStacks = 0;
  }
  const defTree = WeaponDefs[this.playerClass]?.[familyKey] || WeaponDefs.hunter.saber;
  const tierIdx = clamp(this.player.weaponTier, 0, defTree.tiers.length - 1);
  const tier = defTree.tiers[tierIdx];
  // Use tier cooldown as shoot interval
  const cd = Math.max(2, tier.cd - Math.floor((lvl - 1) / 3));
  if (this.frame % cd !== 0) return;
  // Compute damage multiplier
  const dmg = (this.player.damage || 0.5) * tier.dmg * this.player.damageMultiplier * (this.player.fervor || 1);
  const color = tier.color;
  const push = (b) => {
    b.damage = dmg;
    this.bullets.push(b);
  };
  // Helper for spread angles
  const spread = (count, angStep) => {
    const mid = (count - 1) / 2;
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push((i - mid) * angStep);
    }
    return arr;
  };
  // Determine pattern and spawn bullets
  const p = tier.pattern;
  if (this.playerClass === 'hunter') {
    if (p === 'slash') {
      push(makeBullet(baseX, baseY - 16, { kind: 'slash', w: 14, h: 60, vx: 7, color, spin: 0.15, life: 50, piercing: false }));
      this.fx.trail(baseX + 20, baseY, color, 18, 6, 14, 0.2);
    }
    if (p === 'doubleSlash') {
      [-18, 18].forEach(off => {
        push(makeBullet(baseX, baseY - 16 + off, { kind: 'slash', w: 14, h: 70, vx: 7, color, spin: 0.18, life: 50 }));
        this.fx.trail(baseX + 20, baseY + off, color, 22, 6, 14, 0.25);
      });
    }
    if (p === 'tripleSlash') {
      [-24, 0, 24].forEach(off => {
        push(makeBullet(baseX, baseY - 18 + off, { kind: 'slash', w: 16, h: 80, vx: 7.5, color, spin: 0.22, life: 55, piercing: false }));
        this.fx.trail(baseX + 20, baseY + off, color, 24, 7, 16, 0.3);
      });
    }
    if (p === 'wideWave') {
      // vamp style wave: thick, slow, piercing
      push(makeBullet(baseX, baseY - 80, { kind: 'wave', w: 26, h: 160, vx: 6.5, color, glow: 1, life: 70, piercing: true }));
      this.fx.ring(this.player.x + this.player.w, baseY, color, 16, 6, 28);
    }
    if (p === 'wideWavePlus') {
      [-40, 0, 40].forEach(off => {
        push(makeBullet(baseX, baseY - 90 + off, { kind: 'wave', w: 26, h: 180, vx: 6.8, color, glow: 1, life: 75, piercing: true }));
      });
      this.fx.ring(this.player.x + this.player.w, baseY, color, 18, 8, 34);
    }
  }
  if (this.playerClass === 'ranger') {
    const gun = familyKey;
    if (p === 'single') {
      push(makeBullet(baseX, baseY - 2, { kind: 'rect', w: 18, h: 4, vx: 18, color, life: 90 }));
      this.fx.trail(baseX + 10, baseY, color, 18, 4, 12, 0);
    }
    if (p === 'double') {
      [-8, 8].forEach(off => {
        push(makeBullet(baseX, baseY - 2 + off, { kind: 'rect', w: 18, h: 4, vx: 18, color, life: 90 }));
        this.fx.trail(baseX + 10, baseY + off, color, 18, 4, 12, 0);
      });
    }
    if (p === 'fan') {
      spread(5, 0.06).forEach(a => {
        push(makeBullet(baseX, baseY - 2, { kind: 'rect', w: 16, h: 4, vx: 18, vy: Math.sin(a) * 6, color, life: 95, rot: a }));
      });
      this.fx.trail(baseX + 10, baseY, color, 28, 6, 14, 0);
    }
    if (p === 'cone3') {
      spread(3, 0.08).forEach(a => {
        push(makeBullet(baseX, baseY, { kind: 'pellet', w: 10, h: 6, vx: 12, vy: Math.sin(a) * 7, color, life: 70, rot: a }));
      });
      this.fx.spark(baseX, baseY, color, 6, 2.2, 18);
    }
    if (p === 'cone5') {
      spread(5, 0.08).forEach(a => {
        push(makeBullet(baseX, baseY, { kind: 'pellet', w: 10, h: 6, vx: 12, vy: Math.sin(a) * 7, color, life: 70, rot: a }));
      });
      this.fx.spark(baseX, baseY, color, 8, 2.4, 18);
    }
    if (p === 'cone7') {
      spread(7, 0.08).forEach(a => {
        push(makeBullet(baseX, baseY, { kind: 'pellet', w: 10, h: 6, vx: 12, vy: Math.sin(a) * 7, color, life: 70, rot: a }));
      });
      this.fx.spark(baseX, baseY, color, 10, 2.6, 18);
    }
    if (p === 'sniper') {
      push(makeBullet(baseX, baseY - 2, { kind: 'lance', w: 36, h: 3, vx: 22, color, life: 120, piercing: false, glow: 1 }));
      this.fx.trail(baseX + 14, baseY, color, 40, 5, 16, 0);
    }
    if (p === 'sniperPierce') {
      push(makeBullet(baseX, baseY - 2, { kind: 'lance', w: 40, h: 3, vx: 23, color, life: 130, piercing: true, glow: 1 }));
      this.fx.trail(baseX + 14, baseY, color, 44, 6, 16, 0);
    }
    if (p === 'rocket') {
      push(makeBullet(baseX, baseY - 10, { kind: 'rocket', w: 18, h: 12, vx: 8, color, life: 120, splash: 40, rot: 0.1, spin: 0.05 }));
      this.fx.spark(baseX, baseY, color, 6, 1.5, 22);
    }
    if (p === 'rocketSplash') {
      push(makeBullet(baseX, baseY - 10, { kind: 'rocket', w: 20, h: 14, vx: 8, color, life: 120, splash: 55, rot: 0.1, spin: 0.06 }));
      this.fx.spark(baseX, baseY, color, 8, 1.6, 22);
    }
    if (p === 'needleBurst') {
      spread(9, 0.06).forEach(a => {
        push(makeBullet(baseX, baseY, { kind: 'needle', w: 22, h: 2, vx: 16, vy: Math.sin(a) * 7, color, life: 90, piercing: true, glow: 1, rot: a }));
      });
      this.fx.ring(baseX, baseY, color, 14, 4, 22);
    }
    if (p === 'needleBurstPlus') {
      spread(13, 0.055).forEach(a => {
        push(makeBullet(baseX, baseY, { kind: 'needle', w: 22, h: 2, vx: 17, vy: Math.sin(a) * 8, color, life: 95, piercing: true, glow: 1, rot: a }));
      });
      this.fx.ring(baseX, baseY, color, 16, 6, 28);
    }
    if (p === 'pierceLine') {
      push(makeBullet(baseX, baseY - 2, { kind: 'beam', w: 70, h: 4, vx: 24, color, life: 120, piercing: true, glow: 1 }));
      this.fx.trail(baseX + 18, baseY, color, 60, 8, 18, 0);
    }
    if (p === 'pierceLinePlus') {
      [-10, 10].forEach(off => {
        push(makeBullet(baseX, baseY - 2 + off, { kind: 'beam', w: 70, h: 4, vx: 24, color, life: 120, piercing: true, glow: 1 }));
      });
      this.fx.trail(baseX + 18, baseY, color, 70, 10, 20, 0);
    }
    if (p === 'freezeLance' || p === 'freezeLancePlus') {
      const slow = (p === 'freezeLancePlus') ? 0.45 : 0.35;
      push(makeBullet(baseX, baseY - 2, { kind: 'iceLance', w: 46, h: 4, vx: 22, color, life: 125, piercing: true, slow, glow: 1 }));
      this.fx.trail(baseX + 16, baseY, color, 46, 8, 16, 0);
    }
    if (p === 'meteor' || p === 'meteorPlus') {
      const splash = (p === 'meteorPlus') ? 75 : 65;
      push(makeBullet(baseX, baseY - 12, { kind: 'meteor', w: 22, h: 22, vx: 7.5, color, life: 130, splash, piercing: true, rot: 0.2, spin: 0.10, glow: 1 }));
      this.fx.ring(baseX, baseY, color, 16, 6, 26);
    }
  }
  if (this.playerClass === 'force') {
    if (p === 'fireOrb') {
      push(makeBullet(baseX, baseY - 10, { kind: 'orb', w: 18, h: 18, vx: 7, color, life: 110, glow: 1, spin: 0.08 }));
      this.fx.spark(baseX, baseY, color, 6, 1.5, 18);
    }
    if (p === 'fireOrb2') {
      [-14, 14].forEach(off => {
        push(makeBullet(baseX, baseY - 10 + off, { kind: 'orb', w: 18, h: 18, vx: 7.2, color, life: 110, glow: 1, spin: 0.10 }));
      });
      this.fx.spark(baseX, baseY, color, 8, 1.6, 18);
    }
    if (p === 'fireOrbSpread') {
      spread(3, 0.08).forEach(a => {
        push(makeBullet(baseX, baseY - 10, { kind: 'orb', w: 18, h: 18, vx: 7.2, vy: Math.sin(a) * 5, color, life: 110, glow: 1, spin: 0.10, rot: a }));
      });
      this.fx.ring(baseX, baseY, color, 14, 4, 20);
    }
    if (p === 'fireRing' || p === 'fireRingPlus') {
      // orbiting ring projectiles
      const count = (p === 'fireRingPlus') ? 10 : 8;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        push(makeBullet(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, {
          kind: 'orbit',
          w: 10, h: 10,
          vx: 0, vy: 0,
          color,
          life: 80,
          orbit: true,
          orbitA: ang,
          orbitR: (p === 'fireRingPlus') ? 78 : 64,
          glow: 1
        }));
      }
      this.fx.ring(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, color, 18, 10, 44);
    }
    if (p === 'zap') {
      push(makeBullet(baseX, baseY - 6, { kind: 'zap', w: 12, h: 12, vx: 14, color, life: 100, homing: true, glow: 1 }));
      this.fx.trail(baseX + 10, baseY, color, 24, 6, 14, 0);
    }
    if (p === 'zapChain') {
      [-10, 10].forEach(off => {
        push(makeBullet(baseX, baseY - 6 + off, { kind: 'zap', w: 10, h: 10, vx: 14, color, life: 100, homing: true, glow: 1 }));
      });
      this.fx.spark(baseX, baseY, color, 10, 2.2, 18);
    }
    if (p === 'zapNova' || p === 'zapNovaPlus') {
      const count = (p === 'zapNovaPlus') ? 12 : 10;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        push(makeBullet(baseX, baseY, { kind: 'spark', w: 10, h: 10, vx: 10 + Math.cos(ang) * 6, vy: Math.sin(ang) * 6, color, life: 70, homing: false, glow: 1, rot: ang }));
      }
      this.fx.ring(baseX, baseY, color, 16, 6, 34);
    }
    if (p === 'iceShard') {
      push(makeBullet(baseX, baseY - 10, { kind: 'crystal', w: 16, h: 16, vx: 6, color, life: 120, piercing: true, glow: 1, spin: 0.08 }));
      this.fx.trail(baseX + 10, baseY, color, 30, 10, 16, 0);
    }
    if (p === 'iceShard2') {
      [-12, 12].forEach(off => {
        push(makeBullet(baseX, baseY - 10 + off, { kind: 'crystal', w: 16, h: 16, vx: 6.2, color, life: 120, piercing: true, glow: 1, spin: 0.10 }));
      });
      this.fx.trail(baseX + 10, baseY, color, 34, 12, 16, 0);
    }
    if (p === 'iceShardSpread') {
      spread(5, 0.07).forEach(a => {
        push(makeBullet(baseX, baseY - 10, { kind: 'crystal', w: 16, h: 16, vx: 6.2, vy: Math.sin(a) * 4, color, life: 120, piercing: true, glow: 1, spin: 0.10, rot: a }));
      });
      this.fx.ring(baseX, baseY, color, 14, 4, 26);
    }
    if (p === 'iceWall' || p === 'iceWallPlus') {
      const cols = (p === 'iceWallPlus') ? 5 : 4;
      for (let i = 0; i < cols; i++) {
        push(makeBullet(baseX, baseY - 80 + i * 40, { kind: 'wall', w: 18, h: 26, vx: 4.2, color, life: 100, piercing: true, glow: 1 }));
      }
      this.fx.ring(baseX, baseY, color, 16, 8, 40);
    }
  }
};

/* ---------- 6) Override bullet updates ---------- */
// Update bullet positions, handle orbiting and homing logic, and remove
// bullets when their lifetime expires or they leave the screen. This
// replaces the default bullet loop in the core update().
Game.prototype._updateBullets = function () {
  for (let i = this.bullets.length - 1; i >= 0; i--) {
    const b = this.bullets[i];
    // Orbiting projectiles follow a circular path around the player
    if (b.orbit) {
      b.orbitA += 0.12;
      const cx = this.player.x + this.player.w / 2;
      const cy = this.player.y + this.player.h / 2;
      b.x = cx + Math.cos(b.orbitA) * b.orbitR;
      b.y = cy + Math.sin(b.orbitA) * b.orbitR;
      b.life--;
      this.fx.trail(b.x, b.y, b.color, 10, 6, 10, b.orbitA);
      if (b.life <= 0) this.bullets.splice(i, 1);
      continue;
    }
    // Homing bullets adjust their vertical velocity towards the nearest
    // enemy ahead of them
    if (b.homing) {
      let nearest = null;
      let md = 1e9;
      for (const e of this.enemies) {
        const d = Math.hypot((e.x + e.w / 2) - b.x, (e.y + e.h / 2) - b.y);
        if (d < md && e.x > b.x) {
          md = d;
          nearest = e;
        }
      }
      if (nearest) {
        const ty = (nearest.y + nearest.h / 2) - b.y;
        b.vy += clamp(ty * 0.002, -0.35, 0.35);
        b.vy = clamp(b.vy, -6, 6);
      }
    }
    b.x += (b.vx ?? 0);
    b.y += (b.vy ?? 0);
    b.rot += (b.spin ?? 0);
    // Add trails for certain projectile types
    if (b.kind === 'beam' || b.kind === 'lance' || b.kind === 'needle') {
      this.fx.trail(b.x, b.y, b.color, 18, 6, 10, b.rot);
    } else if (b.kind === 'meteor' || b.kind === 'rocket' || b.kind === 'orb' || b.kind === 'crystal') {
      this.fx.trail(b.x, b.y, b.color, 12, 10, 10, b.rot);
    }
    b.life--;
    if (b.life <= 0 || b.x > this.width + 80 || b.y < -80 || b.y > this.height + 80) {
      this.bullets.splice(i, 1);
    }
  }
};

/* ---------- 7) Override bullet rendering ---------- */
// Draw bullets with unique shapes and glow effects. This method
// replaces the default bullet drawing loop in the core render().
Game.prototype._renderBullets = function (ctx) {
  for (const b of this.bullets) {
    ctx.save();
    if (b.glow) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = b.color;
    }
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot || 0);
    ctx.fillStyle = b.color;
    if (b.kind === 'pellet') {
      ctx.beginPath();
      ctx.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'slash' || b.kind === 'wave') {
      ctx.globalAlpha = 0.9;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.globalAlpha = 1;
    } else if (b.kind === 'needle' || b.kind === 'beam' || b.kind === 'lance' || b.kind === 'iceLance') {
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.beginPath();
      ctx.moveTo(b.w / 2, 0);
      ctx.lineTo(b.w / 2 - 8, -6);
      ctx.lineTo(b.w / 2 - 8, 6);
      ctx.closePath();
      ctx.fill();
    } else if (b.kind === 'rocket') {
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-b.w / 2, -2, 6, 4);
    } else if (b.kind === 'meteor' || b.kind === 'orb' || b.kind === 'spark' || b.kind === 'zap') {
      ctx.beginPath();
      ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'crystal') {
      ctx.beginPath();
      ctx.moveTo(0, -b.h / 2);
      ctx.lineTo(b.w / 2, 0);
      ctx.lineTo(0, b.h / 2);
      ctx.lineTo(-b.w / 2, 0);
      ctx.closePath();
      ctx.fill();
    } else if (b.kind === 'wall') {
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    } else if (b.kind === 'orbit') {
      ctx.beginPath();
      ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }
};

/* ---------- 8) Override bullet collision handling ---------- */
// Apply damage and effects when bullets hit enemies. Support splash
// damage, slow effects and per-bullet damage values. This method
// replaces the default bullet collision loop in the core update().
Game.prototype._handleBulletHits = function () {
  for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
    const b = this.bullets[bi];
    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const e = this.enemies[ei];
      // approximate bullet bounding box for collision
      const bb = { x: b.x - (b.w / 2), y: b.y - (b.h / 2), w: b.w, h: b.h };
      if (this.checkCollision(bb, e)) {
        const dmg = b.damage ?? (this.player.damage * this.player.damageMultiplier * (this.player.fervor || 1));
        e.hp -= dmg;
        this.sounds.hit();
        // Apply slow effect if applicable
        if (b.slow) {
          e.slowed = Math.max(e.slowed || 0, Math.floor(60 * b.slow));
        }
        // Apply splash damage
        if (b.splash) {
          this.fx.ring(e.x + e.w / 2, e.y + e.h / 2, b.color, 14, 6, b.splash);
          for (const other of this.enemies) {
            const cx = other.x + other.w / 2;
            const cy = other.y + other.h / 2;
            const d = Math.hypot(cx - (e.x + e.w / 2), cy - (e.y + e.h / 2));
            if (d < b.splash) {
              other.hp -= dmg * 0.45;
            }
          }
        } else {
          this.fx.spark(e.x + e.w / 2, e.y + e.h / 2, b.color, 6, 2.2, 18);
        }
        if (!b.pierce && !b.orbit) {
          this.bullets.splice(bi, 1);
        }
        if (e.hp <= 0) {
          this.killEnemy(e);
          this.enemies.splice(ei, 1);
        }
        break;
      }
    }
  }
};

/* ---------- 9) Weapon feed helper ---------- */
// Upgrade or evolve the current weapon family when collecting weapon
// drops. If the tier cap is reached, add fervor stacks instead.
Game.prototype._applyWeaponFeed = function () {
  let familyKey = 'saber';
  if (this.playerClass === 'hunter') familyKey = 'saber';
  if (this.playerClass === 'ranger') familyKey = (this.player.weaponType || 'handgun');
  if (this.playerClass === 'force') familyKey = (this.player.element || 'fire');
  if (!this.player.weaponFamily) this.player.weaponFamily = familyKey;
  if (this.player.weaponFamily !== familyKey) {
    this.player.weaponFamily = familyKey;
    this.player.weaponTier = 0;
    this.player.fervor = 1.0;
    this.player.fervorStacks = 0;
  }
  const defTree = WeaponDefs[this.playerClass]?.[familyKey] || WeaponDefs.hunter.saber;
  if (this.player.weaponTier < defTree.tiers.length - 1) {
    this.player.weaponTier++;
    const t = defTree.tiers[this.player.weaponTier];
    this.showFloatText(t.evolve ? 'EVOLVE!' : 'UPGRADE!', this.player.x, this.player.y);
    this.sounds.levelup();
    this.fx.ring(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, t.color, 18, 8, 44);
  } else {
    // Add fervor stacks for extra power once max tier is reached
    this.player.fervorStacks++;
    this.player.fervor = 1.0 + this.player.fervorStacks * 0.06;
    this.showFloatText('FERVOR +' + this.player.fervorStacks, this.player.x, this.player.y);
    this.sounds.power();
    this.fx.spark(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#facc15', 12, 2.8, 20);
  }
};
