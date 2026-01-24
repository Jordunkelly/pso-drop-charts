/* ===============================
   PSO PHOTON DEFENDER – CORE
   Stable collision + game loop
   =============================== */

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;

    // Core state
    this.frame = 0;
    this.level = 1;
    this.score = 0;
    this.area = "forest";
    this.spawnRate = 60;

    // Collections
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerUps = [];

    // Player
    this.player = {
      x: 40,
      y: this.height / 2 - 24,
      w: 32,
      h: 32,
      speed: 4,
      hp: 7,
      maxHp: 7,
      lives: 7,
      damage: 1,
      damageMultiplier: 1,
      weaponLevel: 1,
      weaponFamily: null,
      weaponTier: 0,
      fervor: 1,
      fervorStacks: 0
    };

    this.playerClass = null;

    // Input
    this.input = { up:false, down:false, left:false, right:false };
    this._initInput();

    // FX (optional – safe if weapons.js defines it)
    if (typeof FX !== "undefined") {
      this.fx = new FX(this);
    }

    this.loop = this.loop.bind(this);
  }

  /* ===============================
     INPUT
     =============================== */
  _initInput() {
    window.addEventListener("keydown", e => {
      if (e.key === "ArrowUp") this.input.up = true;
      if (e.key === "ArrowDown") this.input.down = true;
      if (e.key === "ArrowLeft") this.input.left = true;
      if (e.key === "ArrowRight") this.input.right = true;
    });

    window.addEventListener("keyup", e => {
      if (e.key === "ArrowUp") this.input.up = false;
      if (e.key === "ArrowDown") this.input.down = false;
      if (e.key === "ArrowLeft") this.input.left = false;
      if (e.key === "ArrowRight") this.input.right = false;
    });
  }

  /* ===============================
     COLLISION (AABB ONLY)
     =============================== */
  checkCollision(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  /* ===============================
     GAME START
     =============================== */
  start(playerClass) {
    this.playerClass = playerClass;
    requestAnimationFrame(this.loop);
  }

  /* ===============================
     MAIN LOOP
     =============================== */
  loop() {
    this.update();
    this.render();
    requestAnimationFrame(this.loop);
  }

  /* ===============================
     UPDATE
     =============================== */
  update() {
    this.frame++;

    this._updatePlayer();
    this._updateBullets();
    this._updateEnemies();
    this._handleBulletHits();
    this._handlePlayerHits();

    if (this.frame % this.spawnRate === 0) {
      this.spawnEnemy();
    }

    if (this.fx) this.fx.update();
  }

  /* ===============================
     PLAYER
     =============================== */
  _updatePlayer() {
    if (this.input.up) this.player.y -= this.player.speed;
    if (this.input.down) this.player.y += this.player.speed;
    if (this.input.left) this.player.x -= this.player.speed;
    if (this.input.right) this.player.x += this.player.speed;

    // Clamp
    this.player.x = Math.max(0, Math.min(this.width - this.player.w, this.player.x));
    this.player.y = Math.max(0, Math.min(this.height - this.player.h, this.player.y));

    this.shoot();
  }

  /* ===============================
     BULLETS
     =============================== */
  _updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx || 0;
      b.y += b.vy || 0;
      b.life--;

      if (
        b.life <= 0 ||
        b.x > this.width + 80 ||
        b.y < -80 ||
        b.y > this.height + 80
      ) {
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx || 0;
      b.y += b.vy || 0;
      b.life--;

      if (
        b.life <= 0 ||
        b.x < -80 ||
        b.y < -80 ||
        b.y > this.height + 80
      ) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  /* ===============================
     ENEMIES
     =============================== */
  _updateEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      const slowMul = e.slowed ? 0.6 : 1;
      if (e.slowed) e.slowed--;

      e.x -= e.speed * slowMul;

      if (e.canShoot) {
        e.shotTimer--;
        if (e.shotTimer <= 0) {
          if (this.spawnEnemyBullet) this.spawnEnemyBullet(e);
          e.shotTimer = 60;
        }
      }

      if (e.x + e.w < 0) {
        this.enemies.splice(i, 1);
      }
    }
  }

  /* ===============================
     BULLET → ENEMY
     =============================== */
  _handleBulletHits() {
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];

      const bulletBox = {
        x: b.x - b.w / 2,
        y: b.y - b.h / 2,
        w: b.w,
        h: b.h
      };

      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];

        const enemyBox = {
          x: e.x,
          y: e.y,
          w: e.w,
          h: e.h
        };

        if (this.checkCollision(bulletBox, enemyBox)) {
          e.hp -= b.damage || 1;

          if (!b.pierce) {
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
  }

  /* ===============================
     ENEMY BULLET → PLAYER
     =============================== */
  _handlePlayerHits() {
    const playerBox = {
      x: this.player.x,
      y: this.player.y,
      w: this.player.w,
      h: this.player.h
    };

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];

      const bulletBox = {
        x: b.x - b.w / 2,
        y: b.y - b.h / 2,
        w: b.w,
        h: b.h
      };

      if (this.checkCollision(bulletBox, playerBox)) {
        this.player.hp--;
        this.enemyBullets.splice(i, 1);

        if (this.player.hp <= 0) {
          this.player.lives--;
          this.player.hp = this.player.maxHp;
        }
      }
    }
  }

  /* ===============================
     ENEMY SPAWN (delegated logic)
     =============================== */
  spawnEnemy() {
    if (typeof areaEnemies === "undefined" || typeof enemyData === "undefined") return;

    const pool = areaEnemies[this.area] || ["rappy"];
    const type = pool[Math.floor(Math.random() * pool.length)];
    const def = enemyData[type];

    const e = {
      type,
      x: this.width + 20,
      y: Math.random() * (this.height - def.h),
      w: def.w,
      h: def.h,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      color: def.color,
      canShoot: def.canShoot,
      isElite: def.isElite || false,
      shotTimer: 60,
      slowed: 0
    };

    this.enemies.push(e);
  }

  /* ===============================
     KILL ENEMY
     =============================== */
  killEnemy(e) {
    this.score += e.isElite ? 50 : 10;
  }

  /* ===============================
     RENDER
     =============================== */
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Player
    this.ctx.fillStyle = "#58a6ff";
    this.ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);

    // Enemies
    for (const e of this.enemies) {
      this.ctx.fillStyle = e.color || "#f87171";
      this.ctx.fillRect(e.x, e.y, e.w, e.h);
    }

    // Bullets
    for (const b of this.bullets) {
      this.ctx.fillStyle = b.color || "#ffffff";
      this.ctx.fillRect(
        b.x - b.w / 2,
        b.y - b.h / 2,
        b.w,
        b.h
      );
    }

    // Enemy bullets
    this.ctx.fillStyle = "#ef4444";
    for (const b of this.enemyBullets) {
      this.ctx.fillRect(
        b.x - b.w / 2,
        b.y - b.h / 2,
        b.w,
        b.h
      );
    }

    if (this.fx) this.fx.render();
  }
}

/* ===============================
   GLOBAL START HOOK
   =============================== */
window.startGame = function(playerClass) {
  const canvas = document.getElementById("gameCanvas");
  const game = new Game(canvas);
  game.start(playerClass);
};
