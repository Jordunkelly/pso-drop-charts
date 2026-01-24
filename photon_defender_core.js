const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6T_nPSiK2jQIyWI09Jgcf2g8q9F_6JENVPWoaGbWoft2xIGOCJpnbehX2VJwGXpc/exec";

/*
 * PSO PHOTON DEFENDER – CORE (RESET)
 * Stable loop, collision, sprites, mobile input
 */

class Game {
  constructor(canvasId, playerClass) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error("Canvas not found");
    this.ctx = this.canvas.getContext("2d");

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.frame = 0;
    this.running = true;

    this.playerClass = playerClass;
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];

    this.area = "forest";
    this.level = 1;
    this.score = 0;

    this.initPlayer();
    this.loadSprites();
    this.initInput();
  }

  /* ---------- PLAYER ---------- */
  initPlayer() {
    const classStats = {
      hunter: { lives: 7, speed: 5 },
      ranger: { lives: 4, speed: 6 },
      force:  { lives: 2, speed: 4 }
    };

    const s = classStats[this.playerClass];

    this.player = {
      x: 60,
      y: this.height / 2 - 20,
      w: 40,
      h: 40,
      speed: s.speed,
      lives: s.lives,
      invincible: 0,
      damage: 1,
      weaponLevel: 1
    };
  }

  /* ---------- SPRITES ---------- */
  loadSprites() {
    this.sprites = {};
    ["hunter", "ranger", "force"].forEach(k => {
      const img = new Image();
      img.src = `raw/sprite-${k}.png`;
      this.sprites[k] = img;
    });
  }

  /* ---------- INPUT (DESKTOP + MOBILE) ---------- */
  initInput() {
    this.input = { up:0, down:0, left:0, right:0, fire:0 };

    window.addEventListener("keydown", e => {
      if (e.code === "ArrowUp" || e.code === "KeyW") this.input.up = 1;
      if (e.code === "ArrowDown" || e.code === "KeyS") this.input.down = 1;
      if (e.code === "ArrowLeft" || e.code === "KeyA") this.input.left = 1;
      if (e.code === "ArrowRight" || e.code === "KeyD") this.input.right = 1;
      if (e.code === "Space") this.input.fire = 1;
    });

    window.addEventListener("keyup", e => {
      if (e.code === "ArrowUp" || e.code === "KeyW") this.input.up = 0;
      if (e.code === "ArrowDown" || e.code === "KeyS") this.input.down = 0;
      if (e.code === "ArrowLeft" || e.code === "KeyA") this.input.left = 0;
      if (e.code === "ArrowRight" || e.code === "KeyD") this.input.right = 0;
      if (e.code === "Space") this.input.fire = 0;
    });

    /* mobile drag */
    let startX, startY;
    this.canvas.addEventListener("touchstart", e => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      this.input.fire = 1;
    });

    this.canvas.addEventListener("touchmove", e => {
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      this.input.left  = dx < -20;
      this.input.right = dx >  20;
      this.input.up    = dy < -20;
      this.input.down  = dy >  20;
    });

    this.canvas.addEventListener("touchend", () => {
      this.input = { up:0, down:0, left:0, right:0, fire:0 };
    });
  }

  /* ---------- LOOP ---------- */
  start() {
    requestAnimationFrame(() => this.loop());
  }

  loop() {
    if (!this.running) return;
    this.frame++;
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  /* ---------- UPDATE ---------- */
  update() {
    const p = this.player;

    if (this.input.up)    p.y -= p.speed;
    if (this.input.down)  p.y += p.speed;
    if (this.input.left)  p.x -= p.speed;
    if (this.input.right) p.x += p.speed;

    p.x = Math.max(0, Math.min(this.width - p.w, p.x));
    p.y = Math.max(0, Math.min(this.height - p.h, p.y));

    if (p.invincible > 0) p.invincible--;

    if (this.frame % 40 === 0 && typeof this.spawnEnemy === "function") {
      this.spawnEnemy();
    }

    this.updateBullets();
    this.updateEnemies();
    this.handleCollisions();
  }

  updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      if (b.x > this.width || b.y < 0 || b.y > this.height) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.x -= e.speed;
      if (e.x + e.w < 0) this.enemies.splice(i, 1);
    }
  }

  /* ---------- COLLISION (FIXED) ---------- */
  handleCollisions() {
    const p = this.player;

    // bullets -> enemies
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (this.rectHit(b, e)) {
          e.hp -= b.damage || 1;
          this.bullets.splice(bi, 1);
          if (e.hp <= 0) {
            this.enemies.splice(ei, 1);
            this.score += 100;
          }
          break;
        }
      }
    }

    // enemies -> player
    for (const e of this.enemies) {
      if (this.rectHit(p, e) && p.invincible === 0) {
        p.lives--;
        p.invincible = 60;
        if (p.lives <= 0) {
          this.running = false;
          alert("Mission Failed");
        }
      }
    }
  }

  rectHit(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  /* ---------- RENDER ---------- */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // player
    const img = this.sprites[this.playerClass];
    if (img?.complete) {
      ctx.drawImage(img, this.player.x, this.player.y, this.player.w, this.player.h);
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
    }

    // bullets
    ctx.fillStyle = "#58a6ff";
    for (const b of this.bullets) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // enemies + HP bars
    for (const e of this.enemies) {
      ctx.fillStyle = e.color || "#f00";
      ctx.fillRect(e.x, e.y, e.w, e.h);

      const hpw = (e.hp / e.maxHp) * e.w;
      ctx.fillStyle = "#00ff88";
      ctx.fillRect(e.x, e.y - 6, hpw, 4);
    }
  }
}

/* ---------- GLOBAL START ---------- */
let game;
window.startGame = function (cls) {
  document.getElementById("classSelect").style.display = "none";
  game = new Game("canvas", cls);
  game.start();
};

postScore() {
  try {
    fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: this.score,
        level: this.level,
        class: this.playerClass,
        ts: Date.now()
      })
    });
  } catch (e) {
    console.warn("Score post failed", e);
  }
}

