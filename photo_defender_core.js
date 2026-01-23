<script>
 const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6T_nPSiK2jQIyWI09Jgcf2g8q9F_6JENVPWoaGbWoft2xIGOCJpnbehX2VJwGXpc/exec";

// Visual Asset Preloading (Placeholder colors if images fail)
const areaBackgroundImg = new Image();
areaBackgroundImg.src = 'areas_background.png';
const areaCoords = { forest: { sx: 0, sy: 0 }, caves: { sx: 768, sy: 0 }, mines: { sx: 0, sy: 512 }, ruins: { sx: 768, sy: 512 } };

const enemyData = {
    rappy: { w: 36, h: 36, hp: 1, speed: 3, color: '#facc15', canShoot: true, shootFreq: 120 },
    booma: { w: 42, h: 42, hp: 3, speed: 2, color: '#2ea043', canShoot: false },
    sinow: { w: 50, h: 50, hp: 5, speed: 3.5, color: '#c084fc', canShoot: true, shootFreq: 90 },
    hildebear: { w: 80, h: 80, hp: 15, speed: 1.5, color: '#78350f', canShoot: true, isElite: true, shootFreq: 150 },
    baranz: { w: 75, h: 75, hp: 20, speed: 1.2, color: '#ef4444', canShoot: true, isElite: true, shootFreq: 180 }
};

class Game {
    constructor(canvas, playerClass) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.running = false;
        this.playerClass = playerClass || 'hunter';
        
        this.player = {
            x: 50, y: this.height / 2 - 20, w: 40, h: 40,
            speed: playerClass === 'ranger' ? 8 : 5,
            lives: playerClass === 'hunter' ? 7 : (playerClass === 'force' ? 2 : 4),
            weaponLevel: 1, syncTimer: 1000, maxSync: 1000,
            damageMultiplier: 1.0, invincible: 0,
            weaponType: playerClass === 'hunter' ? 'saber' : (playerClass === 'force' ? 'tech' : 'handgun'),
            element: 'fire'
        };

        this.score = 0; this.level = 1; this.frame = 0;
        this.bullets = []; this.enemies = []; this.enemyBullets = []; this.powerUps = [];
        this.area = 'forest';
        this.input = {};
        this.initInputs();
    }

    initInputs() {
        window.onkeydown = (e) => this.input[e.code] = true;
        window.onkeyup = (e) => this.input[e.code] = false;
    }

    start() { this.running = true; this.loop(); }

    loop() {
        if (!this.running) return;
        this.update();
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        this.frame++;
        // Movement
        if (this.input['ArrowUp'] || this.input['KeyW']) this.player.y -= this.player.speed;
        if (this.input['ArrowDown'] || this.input['KeyS']) this.player.y += this.player.speed;
        if (this.input['ArrowLeft'] || this.input['KeyA']) this.player.x -= this.player.speed;
        if (this.input['ArrowRight'] || this.input['KeyD']) this.player.x += this.player.speed;

        this.player.y = Math.max(0, Math.min(this.height - this.player.h, this.player.y));
        this.player.x = Math.max(0, Math.min(this.width * 0.4, this.player.x));

        // Difficulty Curve
        this.level = Math.floor(this.score / 2500) + 1;
        this.area = this.level < 5 ? 'forest' : (this.level < 10 ? 'caves' : (this.level < 15 ? 'mines' : 'ruins'));

        // Spawning
        if (this.frame % Math.max(20, 60 - this.level * 2) === 0) this.spawnEnemy();
        if (this.input['Space'] && this.frame % 15 === 0) this.shoot();

        // Projectile Logic
        this.bullets.forEach((b, i) => {
            b.x += b.s; b.y += (b.vy || 0);
            if (b.homing && this.enemies.length > 0) {
                let target = this.enemies[0];
                if (target.y > b.y) b.y += 2; else b.y -= 2;
            }
            if (b.x > this.width) this.bullets.splice(i, 1);
        });

        this.enemies.forEach((e, i) => {
            e.x -= e.speed + (this.level * 0.1);
            
            // Elite Telegraph Logic
            if (e.canShoot) {
                e.shootTimer = (e.shootTimer || 0) + 1;
                if (e.shootTimer > e.shootFreq - 30) e.telegraphing = true;
                if (e.shootTimer >= e.shootFreq) {
                    this.enemyShoot(e);
                    e.shootTimer = 0;
                    e.telegraphing = false;
                }
            }

            if (this.checkCollision(this.player, e)) this.takeHit();
            if (e.x < -100) this.enemies.splice(i, 1);
        });

        this.enemyBullets.forEach((eb, i) => {
            eb.x += eb.vx; eb.y += eb.vy;
            if (this.checkCollision(this.player, eb)) this.takeHit();
            if (eb.x < 0 || eb.x > this.width) this.enemyBullets.splice(i, 1);
        });

        // Collision: Player Bullets -> Enemies
        this.bullets.forEach((b, bi) => {
            this.enemies.forEach((e, ei) => {
                if (this.checkCollision(b, e)) {
                    e.hp -= this.player.damageMultiplier * (this.playerClass === 'hunter' ? 2 : 1);
                    if (!b.piercing) this.bullets.splice(bi, 1);
                    if (e.hp <= 0) this.killEnemy(e, ei);
                }
            });
        });

        this.updateHUD();
    }

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = this.level < 5 ? '#052e16' : '#0e2433';
        ctx.fillRect(0, 0, this.width, this.height);

        // Render Player
        ctx.save();
        if (this.player.invincible > 0 && Math.floor(this.frame / 5) % 2 === 0) ctx.globalAlpha = 0.3;
        ctx.fillStyle = this.playerClass === 'hunter' ? '#f97316' : (this.playerClass === 'force' ? '#a855f7' : '#22c55e');
        ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
        ctx.restore();

        // Render Bullets with UNIQUE ANIMATIONS
        this.bullets.forEach(b => {
            ctx.save();
            ctx.shadowBlur = 10; ctx.shadowColor = b.color || '#fff';
            if (this.playerClass === 'hunter') {
                // Readble Melee Arcs
                ctx.strokeStyle = b.color || '#f97316';
                ctx.lineWidth = 4 + this.player.weaponLevel;
                ctx.beginPath();
                ctx.arc(b.x, b.y, 30 + this.player.weaponLevel * 3, -0.5, 0.5);
                ctx.stroke();
            } else {
                ctx.fillStyle = b.color || '#fff';
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
            ctx.restore();
        });

        // Render Enemies & Telegraphs
        this.enemies.forEach(e => {
            if (e.telegraphing) {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
                ctx.strokeRect(e.x - 5, e.y - 5, e.w + 10, e.h + 10);
            }
            ctx.fillStyle = e.color;
            ctx.fillRect(e.x, e.y, e.w, e.h);
        });

        this.enemyBullets.forEach(eb => {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
        });
    }

    shoot() {
        const lvl = this.player.weaponLevel;
        let b = { x: this.player.x + 40, y: this.player.y + 15, w: 10, h: 4, s: 10, piercing: false, color: '#58a6ff' };

        if (this.playerClass === 'hunter') {
            b.w = 20; b.h = 40; b.piercing = true; b.s = 8;
        } else if (this.playerClass === 'force') {
            b.homing = true; b.color = '#a855f7';
        } else if (this.playerClass === 'ranger') {
            b.s = 15; b.color = '#22c55e';
            if (lvl > 5) this.bullets.push({...b, vy: 1}, {...b, vy: -1});
        }
        this.bullets.push(b);
    }

    enemyShoot(e) {
        const speed = 4 + (this.level * 0.2);
        const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        
        if (e.isElite) {
            // Bullet Hell Cross
            for(let i=0; i<4; i++) {
                let a = angle + (i * Math.PI / 2);
                this.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, w: 10, h: 10 });
            }
        } else {
            this.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, w: 8, h: 8 });
        }
    }

    spawnEnemy() {
        const keys = Object.keys(enemyData);
        const type = keys[Math.floor(Math.random() * keys.length)];
        const def = enemyData[type];
        this.enemies.push({ ...def, x: this.width, y: Math.random() * (this.height - def.h), maxHp: def.hp });
    }

    killEnemy(e, index) {
        this.score += e.isElite ? 500 : 100;
        this.enemies.splice(index, 1);
        if (this.player.weaponLevel < 10 && (e.isElite || Math.random() < 0.2)) {
            this.player.weaponLevel++;
            this.showFloatText("LVL UP!", this.player.x, this.player.y);
        }
    }

    takeHit() {
        if (this.player.invincible > 0) return;
        this.player.lives--;
        this.player.invincible = 90;
        if (this.player.lives <= 0) {
            this.running = false;
            alert("Mission Failed. Score: " + this.score);
            location.reload();
        }
    }

    checkCollision(a, b) {
        return a.x < b.x + (b.w || 10) && a.x + (a.w || 10) > b.x && a.y < b.y + (b.h || 10) && a.y + (a.h || 10) > b.y;
    }

    updateHUD() {
        document.getElementById('score').innerText = this.score;
        document.getElementById('lives').innerText = this.player.lives;
        document.getElementById('level').innerText = this.level;
        document.getElementById('weapon-info').innerText = `${this.player.weaponType.toUpperCase()} L${this.player.weaponLevel}`;
    }

    showFloatText(text, x, y) {
        const el = document.createElement('div');
        el.className = 'dmg-float';
        el.innerText = text;
        el.style.left = (this.canvas.offsetLeft + x) + 'px';
        el.style.top = (this.canvas.offsetTop + y) + 'px';
        document.getElementById('dmg-container').appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    playSfx(freq, type, dur) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + dur);
        } catch(e) {}
    }
}

let game;
function startGame(pClass) {
    document.getElementById('classSelect').style.display = 'none';
    game = new Game(document.getElementById('canvas'), pClass);
    game.start();
}
  </script>
