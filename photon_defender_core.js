/*
 * Core game logic for PSO Photon Defender – Vampire Survivors style
 *
 * This file defines the Game class and supplies the base game loop,
 * player handling, HUD updates, collision checks and simple fallbacks
 * for bullets, enemies and maps. Additional behaviour such as weapon
 * patterns, enemy spawning logic and map backgrounds are supplied via
 * separate files (photon_defender_weapons.js, photon_defender_enemies.js
 * and photon_defender_maps.js). When those files are loaded after this
 * one, they extend or override parts of Game to add richer mechanics.
 */

class Game {
  constructor(canvas, playerClass) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.running = false;
    this.playerClass = playerClass || 'hunter';
    // base player state
    this.player = {
      x: 50,
      y: this.height / 2 - 20,
      w: 40,
      h: 40,
      speed: playerClass === 'ranger' ? 8 : 5,
      lives: playerClass === 'hunter' ? 7 : (playerClass === 'force' ? 2 : 4),
      weaponLevel: 1,
      syncTimer: 1000,
      maxSync: 1000,
      damageMultiplier: 1.0,
      invincible: 0,
      weaponType: playerClass === 'hunter' ? 'saber' : (playerClass === 'force' ? 'tech' : 'handgun'),
      element: 'fire'
    };
    // additional vampire‑style fields; will be overridden by weapons file
    this.player.weaponFamily = null;
    this.player.weaponTier = 0;
    this.player.fervor = 1.0;
    this.player.fervorStacks = 0;
    // scoring and progression
    this.score = 0;
    this.level = 1;
    this.frame = 0;
    this.lastLevel = 1;
    // bullet and enemy containers
    this.bullets = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.area = 'forest';
    this.input = {};
    // spawn rate for enemies (will be overridden if Difficulty is defined)
    this.spawnRate = typeof Difficulty !== 'undefined' ? Difficulty.spawnRateStart : 60;
    // audio: define simple sound helpers so weapons file can call this.sounds.* safely
    this.sounds = {
      shoot: (freq = 880) => this.playSfx(freq, 'square', 0.08),
      hit: () => this.playSfx(440, 'square', 0.1),
      explode: () => this.playSfx(220, 'sawtooth', 0.3),
      power: () => this.playSfx(620, 'triangle', 0.2),
      levelup: () => this.playSfx(880, 'triangle', 0.5),
      warning: () => this.playSfx(150, 'sawtooth', 0.8),
      rare: () => this.playSfx(1200, 'square', 1.0)
    };
    // effects (particles/trails). The FX class is defined in weapons file; check before use
    if (typeof FX !== 'undefined') {
      this.fx = new FX(this);
    } else {
      this.fx = null;
    }
    this.initInputs();
  }

  initInputs() {
    // simple keyboard input handling
    window.onkeydown = (e) => { this.input[e.code] = true; };
    window.onkeyup = (e) => { this.input[e.code] = false; };
  }

  start() {
    this.running = true;
    this.loop();
  }

  loop() {
    if (!this.running) return;
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  update() {
    this.frame++;
    // basic movement controls
    if (this.input['ArrowUp'] || this.input['KeyW']) this.player.y -= this.player.speed;
    if (this.input['ArrowDown'] || this.input['KeyS']) this.player.y += this.player.speed;
    if (this.input['ArrowLeft'] || this.input['KeyA']) this.player.x -= this.player.speed;
    if (this.input['ArrowRight'] || this.input['KeyD']) this.player.x += this.player.speed;
    // keep player on screen
    this.player.y = Math.max(0, Math.min(this.height - this.player.h, this.player.y));
    this.player.x = Math.max(0, Math.min(this.width * 0.4, this.player.x));
    // determine level and area based on score
    this.level = Math.floor(this.score / 2500) + 1;
    this.area = this.level < 5 ? 'forest' : (this.level < 10 ? 'caves' : (this.level < 15 ? 'mines' : 'ruins'));
    // adjust spawn rate on level up if Difficulty exists
    if (typeof Difficulty !== 'undefined' && this.level > this.lastLevel) {
      this.spawnRate = Math.max(Difficulty.spawnRateMin, this.spawnRate - Difficulty.spawnRateDropPerLevel);
      this.lastLevel = this.level;
    }
    // spawn enemies at the configured rate
    if (this.spawnRate && (this.frame % this.spawnRate === 0)) {
      if (typeof this.spawnEnemy === 'function') {
        this.spawnEnemy();
      }
    }
    // handle shooting input (spacebar) with a fixed cadence
    if (this.input['Space'] && (this.frame % 15 === 0)) {
      this.shoot();
    }
    // update bullets – delegate to weapons file if present
    if (typeof this._updateBullets === 'function') {
      this._updateBullets();
    } else {
      // simple bullet motion and homing fallback
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.s || 0;
        b.y += b.vy || 0;
        if (b.homing && this.enemies.length > 0) {
          const target = this.enemies[0];
          b.y += target.y > b.y ? 2 : -2;
        }
        if (b.x > this.width) this.bullets.splice(i, 1);
      }
    }
    // update enemies: movement, telegraph and shooting
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // apply slowing effect if present (set in spawnEnemy or by bullet hits)
      const slowMul = e.slowed ? 0.6 : 1;
      if (e.slowed) e.slowed--;
      // base movement with slight speed increase per level
      e.x -= (e.speed || 0) * slowMul + (this.level * 0.1);
      // enemy shooting telegraph and bullet spawn
      if (e.canShoot) {
        e.shootTimer = (e.shootTimer || 0) + 1;
        if (e.shootFreq && e.shootTimer > e.shootFreq - 30) e.telegraphing = true;
        if (e.shootFreq && e.shootTimer >= e.shootFreq) {
          this.enemyShoot(e);
          e.shootTimer = 0;
          e.telegraphing = false;
        }
      }
      // collision with player
      if (this.checkCollision(this.player, e)) {
        this.takeHit();
      }
      // remove enemies off screen
      if (e.x < -100) this.enemies.splice(i, 1);
    }
    // update enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx || 0;
      eb.y += eb.vy || 0;
      if (this.checkCollision(this.player, eb)) {
        this.takeHit();
        this.enemyBullets.splice(i, 1);
        continue;
      }
      if (eb.x < 0 || eb.x > this.width || eb.y < -50 || eb.y > this.height + 50) {
        this.enemyBullets.splice(i, 1);
      }
    }
    // handle bullet/enemy collisions – delegate if overridden
    if (typeof this._handleBulletHits === 'function') {
      this._handleBulletHits();
    } else {
      // simple bullet collision fallback
      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        const b = this.bullets[bi];
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
          const e = this.enemies[ei];
          if (this.checkCollision(b, e)) {
            e.hp -= this.player.damageMultiplier * (this.playerClass === 'hunter' ? 2 : 1);
            if (!b.piercing) this.bullets.splice(bi, 1);
            if (e.hp <= 0) this.killEnemy(e, ei);
            break;
          }
        }
      }
    }
    // update particles/effects
    if (this.fx) this.fx.update();
    // update HUD display
    this.updateHUD();
  }

  render() {
    const ctx = this.ctx;
    // draw background: if maps file has preloaded images use them
    if (typeof areaBackgroundImg !== 'undefined' && areaBackgroundImg.complete && typeof areaCoords !== 'undefined' && areaCoords[this.area]) {
      const coords = areaCoords[this.area];
      // draw 768x512 tile scaled to canvas size
      ctx.drawImage(areaBackgroundImg, coords.sx, coords.sy, 768, 512, 0, 0, this.width, this.height);
    } else {
      // fallback plain colours
      ctx.fillStyle = this.level < 5 ? '#052e16' : '#0e2433';
      ctx.fillRect(0, 0, this.width, this.height);
    }
    // draw player with flicker when invincible
    ctx.save();
    if (this.player.invincible > 0 && Math.floor(this.frame / 5) % 2 === 0) ctx.globalAlpha = 0.3;
    ctx.fillStyle = this.playerClass === 'hunter' ? '#f97316' : (this.playerClass === 'force' ? '#a855f7' : '#22c55e');
    ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
    ctx.restore();
    // draw bullets: delegate to weapons file if custom renderer is present
    if (typeof this._renderBullets === 'function') {
      this._renderBullets(ctx);
    } else {
      for (const b of this.bullets) {
        ctx.fillStyle = b.color || '#fff';
        ctx.fillRect(b.x, b.y, b.w || 10, b.h || 4);
      }
    }
    // draw enemies and their telegraph rectangles
    for (const e of this.enemies) {
      if (e.telegraphing) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(e.x - 5, e.y - 5, e.w + 10, e.h + 10);
      }
      ctx.fillStyle = e.color || '#fff';
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
    // draw enemy bullets
    for (const eb of this.enemyBullets) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(eb.x, eb.y, eb.w || 8, eb.h || 8);
    }
    // draw particles/effects on top of everything
    if (this.fx) this.fx.render();
  }

  shoot() {
    // basic shoot stub; weapons file replaces this to implement patterns
    const b = { x: this.player.x + this.player.w, y: this.player.y + this.player.h / 2 - 2, w: 10, h: 4, s: 10, piercing: false, color: '#58a6ff' };
    if (this.playerClass === 'hunter') {
      b.w = 20; b.h = 40; b.piercing = true; b.s = 8;
    } else if (this.playerClass === 'force') {
      b.homing = true; b.color = '#a855f7';
    } else if (this.playerClass === 'ranger') {
      b.s = 15; b.color = '#22c55e';
    }
    this.bullets.push(b);
  }

  enemyShoot(e) {
    // basic enemy shooting pattern: elites fire a four‑way cross, others aim at the player
    const speed = 4 + (this.level * 0.2);
    const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    if (e.isElite) {
      for (let i = 0; i < 4; i++) {
        const a = angle + i * Math.PI / 2;
        this.enemyBullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, w: 10, h: 10 });
      }
    } else {
      this.enemyBullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, w: 8, h: 8 });
    }
  }

  spawnEnemy() {
    // fallback enemy spawn: pick random type from enemyData if defined
    if (typeof enemyData === 'undefined') return;
    const keys = Object.keys(enemyData);
    if (keys.length === 0) return;
    const type = keys[Math.floor(Math.random() * keys.length)];
    const def = enemyData[type];
    this.enemies.push({
      type,
      x: this.width,
      y: Math.random() * (this.height - def.h),
      w: def.w,
      h: def.h,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      color: def.color,
      canShoot: def.canShoot,
      isElite: !!def.isElite,
      shootFreq: def.shootFreq,
      shotTimer: 0,
      telegraphing: false,
      slowed: 0
    });
  }

  killEnemy(e, index) {
    // remove enemy and reward points; weapon feed upgrades are handled by weapons file
    this.score += e.isElite ? 500 : 100;
    this.enemies.splice(index, 1);
    // simple weapon level up: replaced by _applyWeaponFeed when available
    if (this.player.weaponLevel < 10 && (e.isElite || Math.random() < 0.2)) {
      this.player.weaponLevel++;
      this.showFloatText('LVL UP!', this.player.x, this.player.y);
    }
  }

  takeHit() {
    if (this.player.invincible > 0) return;
    this.player.lives--;
    this.player.invincible = 90;
    if (this.player.lives <= 0) {
      this.running = false;
      alert('Mission Failed. Score: ' + this.score);
      location.reload();
    }
  }

  checkCollision(a, b) {
    return a.x < b.x + (b.w || 10) && a.x + (a.w || 10) > b.x && a.y < b.y + (b.h || 10) && a.y + (a.h || 10) > b.y;
  }

  updateHUD() {
    const scoreEl = document.getElementById('score');
    const livesEl = document.getElementById('lives');
    const levelEl = document.getElementById('level');
    const weaponEl = document.getElementById('weapon-info');
    if (scoreEl) scoreEl.innerText = this.score;
    if (livesEl) livesEl.innerText = this.player.lives;
    if (levelEl) levelEl.innerText = this.level;
    if (weaponEl) weaponEl.innerText = `${(this.player.weaponType || '').toUpperCase()} L${this.player.weaponLevel}`;
  }

  showFloatText(text, x, y) {
    const el = document.createElement('div');
    el.className = 'dmg-float';
    el.innerText = text;
    el.style.left = (this.canvas.offsetLeft + x) + 'px';
    el.style.top = (this.canvas.offsetTop + y) + 'px';
    const container = document.getElementById('dmg-container');
    if (container) container.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  playSfx(freq, type, dur) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) {
      // ignore audio errors silently
    }
  }
}

// global instance and entry point
let game;
function startGame(pClass) {
  const classSelect = document.getElementById('classSelect');
  if (classSelect) classSelect.style.display = 'none';
  const canvas = document.getElementById('canvas');
  game = new Game(canvas, pClass);
  game.start();
}