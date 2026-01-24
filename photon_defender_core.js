/* ===============================
   PSO Photon Defender Core
   Working collisions + HP bars + damage
   =============================== */

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx6T_nPSiK2jQIyWI09Jgcf2g8q9F_6JENVPWoaGbWoft2xIGOCJpnbehX2VJwGXpc/exec";

/* ===============================
   Sprite loading (root directory)
   =============================== */
const CharacterSprites = {
  hunter: new Image(),
  ranger: new Image(),
  force: new Image(),
};
CharacterSprites.hunter.src = "sprite-hunter.png";
CharacterSprites.ranger.src = "sprite-ranger.png";
CharacterSprites.force.src = "sprite-force.png";

/* ===============================
   Background atlas (optional)
   =============================== */
const areaBackgroundImg = new Image();
areaBackgroundImg.src = "areas_background.png";
const areaCoords = {
  forest: { sx: 0, sy: 0 },
  caves: { sx: 768, sy: 0 },
  mines: { sx: 0, sy: 512 },
  ruins: { sx: 768, sy: 512 },
};

/* ===============================
   Collision helpers
   We standardize:
   - Enemies and player: top-left rects (x,y,w,h)
   - Bullets and enemy bullets: center-based (x,y,w,h) meaning x,y is center
   =============================== */
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function rectFromCenter(obj) {
  const w = obj.w || 10;
  const h = obj.h || 10;
  return { x: obj.x - w / 2, y: obj.y - h / 2, w, h };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

class Game {
  constructor(canvas, playerClass) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;

    this.running = false;
    this.playerClass = playerClass || "hunter";

    this.player = {
      x: 50,
      y: this.height / 2 - 20,
      w: 48,
      h: 48,
      speed: this.playerClass === "ranger" ? 7 : 5,

      // Lives per class
      lives: this.playerClass === "hunter" ? 7 : this.playerClass === "force" ? 3 : 5,

      weaponLevel: 1,
      damageMultiplier: 1.0,

      invincible: 0,

      weaponType: this.playerClass === "hunter" ? "saber" : this.playerClass === "force" ? "fire" : "handgun",
      element: this.playerClass === "force" ? "fire" : null,
    };

    this.score = 0;
    this.level = 1;
    this.frame = 0;

    // Core arrays
    this.bullets = [];       // player bullets, center-based
    this.enemies = [];       // enemies, top-left
    this.enemyBullets = [];  // enemy bullets, center-based

    this.area = "forest";

    // Inputs
    this.input = {};
    this._initInputs();

    // Mobile controls
    this._initTouch();

    // Optional FX stub so weapons module won’t explode if it expects it
    if (!this.fx) {
      this.fx = {
        update() {},
        render() {},
        spark() {},
        trail() {},
        ring() {},
      };
    }
  }

  _initInputs() {
    window.addEventListener("keydown", (e) => {
      this.input[e.code] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.input[e.code] = false;
    });
  }

  _initTouch() {
    const canvas = this.canvas;
    const touch = { active: false, sx: 0, sy: 0 };

    canvas.style.touchAction = "none";

    canvas.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        touch.active = true;
        touch.sx = t.clientX;
        touch.sy = t.clientY;
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (!touch.active) return;
        const t = e.touches[0];
        const dx = t.clientX - touch.sx;
        const dy = t.clientY - touch.sy;
        const dz = 10;

        this.input["ArrowLeft"] = dx < -dz;
        this.input["ArrowRight"] = dx > dz;
        this.input["ArrowUp"] = dy < -dz;
        this.input["ArrowDown"] = dy > dz;
      },
      { passive: true }
    );

    canvas.addEventListener("touchend", () => {
      touch.active = false;
      this.input["ArrowLeft"] = false;
      this.input["ArrowRight"] = false;
      this.input["ArrowUp"] = false;
      this.input["ArrowDown"] = false;
    });

    // Tap to shoot
    canvas.addEventListener("click", () => {
      this.shoot();
    });
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

    // Tick invincibility down (this was missing)
    if (this.player.invincible > 0) this.player.invincible--;

    // Movement
    const up = this.input["ArrowUp"] || this.input["KeyW"];
    const down = this.input["ArrowDown"] || this.input["KeyS"];
    const left = this.input["ArrowLeft"] || this.input["KeyA"];
    const right = this.input["ArrowRight"] || this.input["KeyD"];

    if (up) this.player.y -= this.player.speed;
    if (down) this.player.y += this.player.speed;
    if (left) this.player.x -= this.player.speed;
    if (right) this.player.x += this.player.speed;

    this.player.y = clamp(this.player.y, 0, this.height - this.player.h);
    this.player.x = clamp(this.player.x, 0, this.width * 0.45);

    // Level + area
    this.level = Math.floor(this.score / 2500) + 1;
    this.area =
      this.level < 5 ? "forest" : this.level < 10 ? "caves" : this.level < 15 ? "mines" : "ruins";

    // Spawn enemies (enemy module overrides spawnEnemy)
    if (this.frame % Math.max(18, 60 - this.level * 2) === 0) {
      if (typeof this.spawnEnemy === "function") this.spawnEnemy();
    }

    // Shoot (space on desktop)
    if (this.input["Space"] && this.frame % 10 === 0) this.shoot();

    // Update bullets (simple fallback if weapons module didn’t override)
    this._updateBulletsFallback();

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      // Slow support if you use it
      const slowMul = e.slowed ? 0.6 : 1;
      if (e.slowed) e.slowed--;

      e.x -= (e.speed || 2) * slowMul;

      // Enemy shooting (enemy module overrides enemyShoot)
      if (e.canShoot && typeof this.enemyShoot === "function") {
        e.shotTimer = (e.shotTimer || 0) + 1;
        const freq = e.shootFreq || 120;

        if (e.shotTimer > freq - 30) e.telegraphing = true;

        if (e.shotTimer >= freq) {
          this.enemyShoot(e);
          e.shotTimer = 0;
          e.telegraphing = false;
        }
      }

      // Player collision with enemy body
      if (rectsOverlap(this.player, e)) this.takeHit();

      if (e.x < -200) this.enemies.splice(i, 1);
    }

    // Update enemy bullets + collision with player
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx || 0;
      b.y += b.vy || 0;

      if (rectsOverlap(this.player, rectFromCenter(b))) {
        this.takeHit();
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (b.x < -200 || b.x > this.width + 200 || b.y < -200 || b.y > this.height + 200) {
        this.enemyBullets.splice(i, 1);
      }
    }

    // Handle bullet hits on enemies (works even with center bullets)
    this._handleBulletHits();

    this.updateHUD();
  }

  _updateBulletsFallback() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx ?? b.s ?? 10;
      b.y += b.vy ?? 0;
      b.life = (b.life ?? 120) - 1;

      if (b.life <= 0 || b.x > this.width + 200 || b.y < -200 || b.y > this.height + 200) {
        this.bullets.splice(i, 1);
      }
    }
  }

  _handleBulletHits() {
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      const bRect = rectFromCenter(b);

      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];

        if (rectsOverlap(bRect, e)) {
          const dmg = b.damage ?? (1 * this.player.damageMultiplier);
          e.hp -= dmg;

          // remove bullet if not piercing
          if (!b.pierce && !b.piercing) {
            this.bullets.splice(bi, 1);
          }

          if (e.hp <= 0) {
            this.killEnemy(ei);
          }
          break;
        }
      }
    }
  }

  killEnemy(enemyIndex) {
    const e = this.enemies[enemyIndex];
    this.score += e && e.isElite ? 500 : 100;
    this.enemies.splice(enemyIndex, 1);
  }

  takeHit() {
    if (this.player.invincible > 0) return;

    this.player.lives--;
    this.player.invincible = 60;

    if (this.player.lives <= 0) {
      this.running = false;
      alert("Mission Failed. Score: " + this.score);
      location.reload();
    }
  }

  shoot() {
    // Minimal baseline weapon (weapons module can override)
    const cx = this.player.x + this.player.w;
    const cy = this.player.y + this.player.h / 2;

    this.bullets.push({
      x: cx,
      y: cy,
      w: 16,
      h: 6,
      vx: 14,
      vy: 0,
      life: 100,
      damage: 1,
      color: "#58a6ff",
      pierce: false,
    });
  }

  render() {
    const ctx = this.ctx;

    // Background fill
    ctx.fillStyle = "#071018";
    ctx.fillRect(0, 0, this.width, this.height);

    // Optional background atlas draw
    if (areaBackgroundImg.complete) {
      const a = areaCoords[this.area];
      if (a) {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(areaBackgroundImg, a.sx, a.sy, 768, 512, 0, 0, this.width, this.height);
        ctx.globalAlpha = 1;
      }
    }

    // Player
    ctx.save();
    if (this.player.invincible > 0 && Math.floor(this.frame / 6) % 2 === 0) ctx.globalAlpha = 0.35;

    const sp = CharacterSprites[this.playerClass];
    if (sp && sp.complete) {
      ctx.drawImage(sp, this.player.x, this.player.y, this.player.w, this.player.h);
    } else {
      ctx.fillStyle = "#58a6ff";
      ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
    }
    ctx.restore();

    // Player bullets (center-based)
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = b.color || "#fff";
      const r = rectFromCenter(b);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }

    // Enemies + HP bars
    for (const e of this.enemies) {
      // Telegraph
      if (e.telegraphing) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(e.x - 4, e.y - 4, e.w + 8, e.h + 8);
      }

      // Body
      ctx.fillStyle = e.color || "#f00";
      ctx.fillRect(e.x, e.y, e.w, e.h);

      // HP bar (restored)
      const hp = Math.max(0, e.hp || 0);
      const max = Math.max(1, e.maxHp || 1);
      const pct = hp / max;

      const barW = e.w;
      const barH = 6;
      const bx = e.x;
      const by = e.y - 10;

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(bx, by, barW, barH);

      ctx.fillStyle = e.isElite ? "#facc15" : "#22c55e";
      ctx.fillRect(bx, by, barW * pct, barH);

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.strokeRect(bx, by, barW, barH);
    }

    // Enemy bullets (center-based)
    for (const eb of this.enemyBullets) {
      const r = rectFromCenter(eb);
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  updateHUD() {
    const s = document.getElementById("score");
    const l = document.getElementById("lives");
    const lv = document.getElementById("level");
    const wi = document.getElementById("weapon-info");

    if (s) s.innerText = this.score;
    if (l) l.innerText = this.player.lives;
    if (lv) lv.innerText = this.level;
    if (wi) wi.innerText = (this.player.weaponType || "WEAPON").toUpperCase();
  }
}

let game = null;
function startGame(pClass) {
  const cs = document.getElementById("classSelect");
  if (cs) cs.style.display = "none";

  const canvas = document.getElementById("canvas");
  game = new Game(canvas, pClass);
  game.start();
}
