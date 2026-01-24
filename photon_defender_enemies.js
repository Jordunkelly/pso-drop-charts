/*
 * Enemy definitions and spawn logic for PSO Photon Defender – Vampire Survivors flavour
 *
 * This module defines the base set of enemies and an override for the
 * Game.prototype.spawnEnemy method. The spawn logic scales hit points
 * and speed according to the current level and Difficulty settings,
 * promotes more elite spawns over time, and chooses enemies based on
 * the active area. Loading this file after photon_defender_core.js will
 * extend the Game class with the spawnEnemy override without altering
 * the core update/render loop. Additional bullet hell patterns and
 * enemy shooting are handled inside the core or weapons modules.
 */

// Base enemy definitions. Each entry specifies the sprite dimensions,
// hitpoints, speed, colour and whether the enemy can shoot. Elite
// enemies have more HP and unique behaviours.
const enemyData = {
  rappy:    { w: 36, h: 36, hp: 1,  speed: 3,   color: '#facc15', canShoot: true,  shootFreq: 120 },
  booma:    { w: 42, h: 42, hp: 3,  speed: 2,   color: '#2ea043', canShoot: false },
  sinow:    { w: 50, h: 50, hp: 5,  speed: 3.5, color: '#c084fc', canShoot: true,  shootFreq: 90 },
  hildebear:{ w: 80, h: 80, hp: 15, speed: 1.5, color: '#78350f', canShoot: true,  isElite: true, shootFreq: 150 },
  baranz:   { w: 75, h: 75, hp: 20, speed: 1.2, color: '#ef4444', canShoot: true,  isElite: true, shootFreq: 180 }
};

// Map each area to the list of enemy type keys that can appear there.
// Rare/elite enemies are included but will be selected less often.
const areaEnemies = {
  forest: ['rappy', 'booma', 'sinow', 'hildebear'],
  caves:  ['booma', 'sinow', 'hildebear', 'baranz'],
  mines:  ['sinow', 'baranz'],
  ruins:  ['hildebear', 'baranz']
};

// Helper for random number generation if not already defined. The
// weapons module defines randRange; fall back to a local definition
// here to avoid reference errors.
if (typeof randRange === 'undefined') {
  function randRange(a, b) {
    return a + Math.random() * (b - a);
  }
}

/*
 * Override Game.prototype.spawnEnemy to implement Vampire Survivors
 * difficulty scaling and area‑based enemy selection. Enemies spawn
 * slightly off‑screen to the right and move leftwards across the
 * playfield. Hit points and speed increase with level, and elites
 * become more common as the game progresses. The Difficulty object
 * (defined in the weapons module) controls scaling parameters.
 */
Game.prototype.spawnEnemy = function () {
  const pool = areaEnemies[this.area] || ['rappy'];
  // Choose a random enemy from the pool
  let type = pool[Math.floor(Math.random() * pool.length)];
  const base = enemyData[type] || enemyData.rappy;
  // Determine whether this spawn should be elite. Base elites stay elite.
  let isElite = !!base.isElite;
  if (typeof Difficulty !== 'undefined') {
    const eliteRoll = Difficulty.eliteBaseChance + (this.level * Difficulty.eliteBonusPerLevel);
    if (!isElite && Math.random() < eliteRoll) {
      // Attempt to promote to an elite from the same area
      const elites = pool.filter(k => enemyData[k]?.isElite);
      if (elites.length) {
        type = elites[Math.floor(Math.random() * elites.length)];
        isElite = true;
      }
    }
  }
  const def = enemyData[type] || enemyData.rappy;
  // Scale hit points and speed based on level and elite status
  let hp = def.hp;
  let speed = def.speed;
  if (typeof Difficulty !== 'undefined') {
    const hpScale = 1 + this.level * Difficulty.enemyHpScalePerLevel;
    const spScale = 1 + this.level * Difficulty.enemySpeedScalePerLevel;
    hp = Math.max(1, Math.round(def.hp * hpScale * (isElite ? Difficulty.eliteHpMult : 1)));
    speed = def.speed * spScale * (isElite ? Difficulty.eliteSpeedMult : 1);
  }
  // Construct the enemy object and append to the enemies array
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
    canShoot: def.canShoot,
    isElite,
    shootFreq: def.shootFreq,
    shotTimer: 0,
    telegraphing: false,
    slowed: 0
  };
  this.enemies.push(enemy);
};

/*
 * Override Game.prototype.enemyShoot to scale enemy bullets based on
 * Difficulty settings and to produce a cross pattern for elites.
 * Non‑elite enemies fire a single round aimed at the player. Elite
 * enemies fire four bullets in a cross formation. Bullet speed and
 * size are increased according to Difficulty multipliers.
 */
Game.prototype.enemyShoot = function (e) {
  // Centre points for enemy and player
  const ex = e.x + e.w / 2;
  const ey = e.y + e.h / 2;
  const px = this.player.x + this.player.w / 2;
  const py = this.player.y + this.player.h / 2;
  // Angle towards the player
  const angle = Math.atan2(py - ey, px - ex);
  // Base speed scales with level
  let baseSpeed = 4 + (this.level * 0.2);
  // Apply Difficulty multiplier if present
  const speedMult = typeof Difficulty !== 'undefined' ? Difficulty.enemyBulletSpeedMult : 1;
  const sizeMult = typeof Difficulty !== 'undefined' ? Difficulty.enemyBulletSizeMult : 1;
  // Compute bullet size; elites shoot slightly larger rounds
  const size = (e.isElite ? 10 : 8) * sizeMult;
  // Fire bullets
  const fireBullet = (ang) => {
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
    // Four‑way cross pattern
    for (let i = 0; i < 4; i++) {
      const a = angle + i * Math.PI / 2;
      fireBullet(a);
    }
  } else {
    // Single bullet aimed at the player
    fireBullet(angle);
  }
};
