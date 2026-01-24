/* Enemy definitions and spawn logic */

window.enemyData = window.enemyData || {
  rappy:     { w: 36, h: 36, hp: 1,  speed: 3,   color: "#facc15", canShoot: true,  shootFreq: 120 },
  booma:     { w: 42, h: 42, hp: 3,  speed: 2,   color: "#2ea043", canShoot: false },
  sinow:     { w: 50, h: 50, hp: 5,  speed: 3.5, color: "#c084fc", canShoot: true,  shootFreq: 90 },
  hildebear: { w: 80, h: 80, hp: 15, speed: 1.5, color: "#78350f", canShoot: true,  isElite: true, shootFreq: 150 },
  baranz:    { w: 75, h: 75, hp: 20, speed: 1.2, color: "#ef4444", canShoot: true,  isElite: true, shootFreq: 180 }
};

window.areaEnemies = window.areaEnemies || {
  forest: ["rappy", "booma", "sinow", "hildebear"],
  caves:  ["booma", "sinow", "hildebear", "baranz"],
  mines:  ["sinow", "baranz"],
  ruins:  ["hildebear", "baranz"]
};

if (typeof randRange === "undefined") {
  function randRange(a, b) {
    return a + Math.random() * (b - a);
  }
}

Game.prototype.spawnEnemy = function () {
  const pool = window.areaEnemies[this.area] || ["rappy"];

  let type = pool[Math.floor(Math.random() * pool.length)];
  const base = window.enemyData[type] || window.enemyData.rappy;

  let isElite = !!base.isElite;

  if (typeof Difficulty !== "undefined") {
    const eliteRoll = Difficulty.eliteBaseChance + (this.level * Difficulty.eliteBonusPerLevel);
    if (!isElite && Math.random() < eliteRoll) {
      const elites = pool.filter((k) => window.enemyData[k] && window.enemyData[k].isElite);
      if (elites.length) {
        type = elites[Math.floor(Math.random() * elites.length)];
        isElite = true;
      }
    }
  }

  const def = window.enemyData[type] || window.enemyData.rappy;

  let hp = def.hp;
  let speed = def.speed;

  if (typeof Difficulty !== "undefined") {
    const hpScale = 1 + this.level * Difficulty.enemyHpScalePerLevel;
    const spScale = 1 + this.level * Difficulty.enemySpeedScalePerLevel;
    hp = Math.max(1, Math.round(def.hp * hpScale * (isElite ? Difficulty.eliteHpMult : 1)));
    speed = def.speed * spScale * (isElite ? Difficulty.eliteSpeedMult : 1);
  }

  const enemy = {
    type,
    x: this.width + 10,
    y: Math.random() * (this.height - def.h),
    w: def.w,
    h: def.h,
    hp,
    maxHp: hp,
    speed,
    color: def.color,
    canShoot: !!def.canShoot,
    isElite,
    shootFreq: def.shootFreq || 140,
    shotTimer: 0,
    telegraphing: false,
    slowed: 0
  };

  this.enemies.push(enemy);
};

Game.prototype.enemyShoot = function (e) {
  const ex = e.x + e.w / 2;
  const ey = e.y + e.h / 2;

  const px = this.player.x + this.player.w / 2;
  const py = this.player.y + this.player.h / 2;

  const angle = Math.atan2(py - ey, px - ex);

  let baseSpeed = 4 + this.level * 0.2;

  const speedMult = typeof Difficulty !== "undefined" ? Difficulty.enemyBulletSpeedMult : 1;
  const sizeMult = typeof Difficulty !== "undefined" ? Difficulty.enemyBulletSizeMult : 1;

  const size = (e.isElite ? 12 : 9) * sizeMult;

  const fire = (ang) => {
    this.enemyBullets.push({
      x: ex,
      y: ey,
      vx: Math.cos(ang) * baseSpeed * speedMult,
      vy: Math.sin(ang) * baseSpeed * speedMult,
      w: size,
      h: size
    });
  };

  if (e.isElite) {
    for (let i = 0; i < 4; i++) fire(angle + i * (Math.PI / 2));
  } else {
    fire(angle);
  }
};
