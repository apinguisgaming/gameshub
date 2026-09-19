/* 
=========================================================================
   GOTHIC SURVIVORS - GAME ENGINE
=========================================================================
This file contains the core logic of the game. It is designed to be
data-agnostic, meaning it processes the data defined in "game-data.js"
without having any hard-coded knowledge of specific items or enemies.
*/

// =========================================================================
// 1. CONFIGURATION & STATELESS UTILITIES
// =========================================================================
const C = {
    WIDTH: window.innerWidth,
    HEIGHT: window.innerHeight,
    TARGET_TIME: 15 * 60,
    TILE_SIZE: 256
};

const M = {
    distSq: (x1, y1, x2, y2) => (x2-x1)**2 + (y2-y1)**2,
    angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    rand: (min, max) => Math.random() * (max - min) + min,
    randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    lerp: (a, b, t) => a + (b - a) * t,
    collides: (a, b) => M.distSq(a.x, a.y, b.x, b.y) < (a.r + b.r)**2,
    formatTime: (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`,
    randWeighted: (items) => {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        for (const item of items) {
            if (random < item.weight) {
                return item;
            }
            random -= item.weight;
        }
        return items[items.length - 1];
    }
};

const S = {
    ctx: null, master: null, bgmGain: null, sfxGain: null, muted: false, noiseBuffer: null,
    init: function() { if (this.ctx) return; const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.setValueAtTime(GAME_DATA.CONFIG.AUDIO.masterVolume, this.ctx.currentTime); this.master.connect(this.ctx.destination); this.bgmGain = this.ctx.createGain(); this.bgmGain.gain.value = GAME_DATA.CONFIG.AUDIO.bgmVolume; this.bgmGain.connect(this.master); this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = GAME_DATA.CONFIG.AUDIO.sfxVolume; this.sfxGain.connect(this.master); const bSize = this.ctx.sampleRate * 1; this.noiseBuffer = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate); const data = this.noiseBuffer.getChannelData(0); for(let i=0; i<bSize; i++) data[i] = Math.random()*2 - 1; this.play('start'); },
    toggleMute: function() { this.muted = !this.muted; if(this.ctx) this.master.gain.setValueAtTime(this.muted?0:GAME_DATA.CONFIG.AUDIO.masterVolume, this.ctx.currentTime); document.getElementById('mute-btn').innerText = this.muted ? "UNMUTE [M]" : "MUTE [M]"; },
    osc: function(freq, type, dest, t = this.ctx.currentTime) { const o = this.ctx.createOscillator(); o.type=type; o.frequency.value=freq; o.connect(dest); o.start(t); return o; },
    env: function(dest, a, d, s, r, vol=1, t=this.ctx.currentTime) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+a); g.gain.exponentialRampToValueAtTime(s*vol||0.001, t+a+d); g.gain.exponentialRampToValueAtTime(0.001, t+a+d+r); g.connect(dest); return g; },
    noise: function(dest, t=this.ctx.currentTime) { const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer; src.loop=true; src.connect(dest); src.start(t); return src; },
    play: function(id, state) { if(!this.ctx || this.muted || state === 'paused') return; if(GAME_AUDIO_BANK[id]) { GAME_AUDIO_BANK[id](this); } }
};

// =========================================================================
// 2. BASE CLASSES & COMPONENTS
// =========================================================================

class ObjectPool {
    constructor(ObjectClass, initialSize = 20) {
        this.ObjectClass = ObjectClass;
        this.pool = [];
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new this.ObjectClass());
        }
    }

    get() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return new this.ObjectClass();
    }

    release(obj) {
        this.pool.push(obj);
    }
}

class SpatialGrid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    getKey(x, y) {
        return `${Math.floor(x / this.cellSize)}_${Math.floor(y / this.cellSize)}`;
    }

    add(entity) {
        const key = this.getKey(entity.x, entity.y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push(entity);
    }

    getNearby(entity) {
        const nearby = [];
        const x = Math.floor(entity.x / this.cellSize);
        const y = Math.floor(entity.y / this.cellSize);
        for (let i = x - 1; i <= x + 1; i++) {
            for (let j = y - 1; j <= y + 1; j++) {
                const key = `${i}_${j}`;
                if (this.grid.has(key)) {
                    nearby.push(...this.grid.get(key));
                }
            }
        }
        return nearby;
    }

    clear() {
        this.grid.clear();
    }
}

class CollisionSystem {
    constructor() {
        this.enemyGrid = new SpatialGrid(100); // Cell size can be tweaked for performance
    }

    update(enemies, dt) {
        // 1. Rebuild the grid with current enemy positions
        this.enemyGrid.clear();
        for (const enemy of enemies) {
            this.enemyGrid.add(enemy);
        }

        // 2. Apply separation forces
        const cfg = GAME_DATA.CONFIG.PHYSICS;
        const force = cfg.enemySeparationForce;
        const radiusMultiplier = cfg.enemySeparationRadiusMultiplier;

        for (const e of enemies) {
            const nearbyEnemies = this.enemyGrid.getNearby(e);
            const separationRadiusSq = (e.r * radiusMultiplier) ** 2;

            for (const other of nearbyEnemies) {
                if (e === other) continue;

                const distSq = M.distSq(e.x, e.y, other.x, other.y);

                // Apply force if enemies are overlapping or very close
                if (distSq > 0 && distSq < separationRadiusSq) {
                    const pushAngle = M.angle(other.x, other.y, e.x, e.y);
                    // The force is stronger when enemies are closer
                    const pushForce = (1 - (distSq / separationRadiusSq)) * force;
                    e.vx += Math.cos(pushAngle) * pushForce * dt;
                    e.vy += Math.sin(pushAngle) * pushForce * dt;
                }
            }
        }
    }
}

class Entity { 
    constructor(game, x, y, r) { this.game = game; this.x = x; this.y = y; this.r = r; this.active = true; this.z = y; }
    drawShadow(ctx) { GAME_GRAPHICS.entity_draw_shadow(this, ctx); }
    update() {}
    draw(ctx) {}
}

class Particle extends Entity {
    constructor(game, x, y, color, size, speed, life) {
        super(game || null, x, y, size);
        if (game) this.reset(game, x, y, color, size, speed, life);
    }
    reset(game, x, y, color, size, speed, life) {
        this.game = game; this.x = x; this.y = y; this.r = size; this.active = true;
        this.color = color; this.life = life; this.maxLife = life;
        const a = M.rand(0, Math.PI * 2); this.vx = Math.cos(a) * speed; this.vy = Math.sin(a) * speed;
        return this;
    }
    update() { this.x += this.vx * this.game.dt; this.y += this.vy * this.game.dt; this.vy += GAME_DATA.CONFIG.PRESENTATION.particleGravity * this.game.dt; this.life -= this.game.dt; if (this.life <= 0) this.active = false; }
    draw(ctx) { GAME_GRAPHICS.particle_draw(this, ctx); }
}
function spawnParticles(game, x, y, color, count) { for (let i = 0; i < count; i++) { const p = game.particlePool.get().reset(game, x, y, color, M.rand(1,3), M.rand(50,150), M.rand(0.3, 0.6)); game.particles.push(p); } }

class DamageText {
    constructor(game, x, y, dmg, isCrit, isPlayerDamage = false) {
        if (game) this.reset(game, x, y, dmg, isCrit, isPlayerDamage);
    }
    reset(game, x, y, dmg, isCrit, isPlayerDamage = false) {
        const cfg = GAME_DATA.CONFIG.PRESENTATION;
        this.game = game;
        this.x = x + M.rand(-cfg.damageTextXVariance, cfg.damageTextXVariance);
        this.y = y + cfg.damageTextYOffset;
        this.text = Math.round(dmg);
        if (isPlayerDamage) {
            this.color = cfg.damageTextColors.player;
        } else {
            this.color = isCrit ? cfg.damageTextColors.crit : cfg.damageTextColors.enemy;
        }
        this.size = isCrit ? cfg.damageTextCritSize : cfg.damageTextNormalSize;
        this.life = cfg.damageTextDuration;
        this.vy = cfg.damageTextSpeed;
        this.active = true;
        return this;
    }
    update() { this.y += this.vy * this.game.dt; this.vy += GAME_DATA.CONFIG.PRESENTATION.particleGravity * this.game.dt; this.life -= this.game.dt; if (this.life <= 0) this.active = false; }
    draw(ctx) { GAME_GRAPHICS.damage_text_draw(this, ctx); }
}

class ActiveEffect extends Entity {
    constructor(game, source, def, x, y, initialTarget = null) {
    const behavior = def.behavior || {};
    const visual = def.visual || {};
    const stats = source.stats;

    const scaledRadius = (behavior.radius || 0) * (stats.area || 1);
    super(game, x, y, scaledRadius);
    
    this.source = source;
    this.def = def;
    this.initialTarget = initialTarget; // Store the target
    this.life = (behavior.duration || visual.duration || 0) * (stats.duration || 1);
    this.maxLife = this.life;
    this.tickTimer = 0;
    this.path = [];

    this.animation = visual.animation || null;
    if (this.animation) {
        this.animTimer = 0;
        this.maxRadius = this.r;
        this.r = 0;
    }

    if (behavior.type && ['instantArea', 'particleEmitter', 'chain'].includes(behavior.type)) {
        const behaviorFunc = GAME_DATA.behaviors[behavior.type];
        if (behaviorFunc) behaviorFunc(this);
    }
}

    update() {
        if (this.life <= 0) { this.active = false; return; }
        this.life -= this.game.dt;

        // Animate radius if applicable
        if (this.animation && this.r < this.maxRadius) {
            this.animTimer += this.game.dt;
            const progress = Math.min(1.0, this.animTimer / this.animation.duration);
            this.r = M.lerp(0, this.maxRadius, progress);
        }

        // --- BEHAVIOR UPDATE ---
        // Execute persistent behaviors that run every frame
        const behavior = this.def.behavior;
        if (behavior && behavior.type && ['groundEffect'].includes(behavior.type)) {
            const behaviorFunc = GAME_DATA.behaviors[behavior.type];
            if (behaviorFunc) behaviorFunc(this);
        }
    }

    draw(ctx) {
        this.z = this.y - 1;
        const visual = this.def.visual;
        if (!visual) return;

        if (visual.type === 'lightning' && this.path.length > 0 && GAME_DATA.visuals.lightning_effect_draw) {
            const effectData = { startPoint: { x: this.game.player.x, y: this.game.player.y }, path: this.path, life: this.life };
            GAME_DATA.visuals.lightning_effect_draw(effectData, ctx);
        }
        else if (visual.key && GAME_DATA.visuals[visual.key]) {
            GAME_DATA.visuals[visual.key](ctx, this, this.game);
        }
    }
}

// =========================================================================
// 3. GENERIC ENTITY CLASSES
// =========================================================================
class Projectile extends Entity {
    constructor(game, weapon, def, attackStats, x, y, vx, vy, angle, owner) {
        super(game, x, y, def.r * attackStats.area);
        this.owner = owner;
        this.weapon = weapon;
        this.def = def;
        this.damage = attackStats.dmg; 
        this.pierce = def.pierce !== undefined ? def.pierce : attackStats.pierce;
        this.duration = attackStats.dur; 
        if (attackStats.range > 0 && attackStats.spd > 0) {
            let travelDuration = attackStats.range / attackStats.spd;
            if (this.def.movement.durationMultiplier) {
                travelDuration *= this.def.movement.durationMultiplier;
            }
            this.duration = travelDuration;
        }
        this.kb = attackStats.kb; this.area = attackStats.area;
        this.vx = vx; this.vy = vy; this.angle = angle;
        this.hitList = new Set();
        this.hitListClearTimer = def.clearHitListPeriodically || 0;
        this.rotation = 0;
        this.timer = 0;
        this.initialPos = { x, y };
        this.target = weapon.lastTarget;
        this.visualKey = this.def.visual.key;

    }
    update() {
        this.game.componentSystem.update(this);
        this.z = this.y;
        this.timer += this.game.dt;
        this.duration -= this.game.dt;
        if (this.duration <= 0) {
            this.onExpire();
        }
        const despawnDist = GAME_DATA.CONFIG.PRESENTATION.projectileDespawnDist;
        if(M.distSq(this.x, this.y, this.game.player.x, this.game.player.y) > despawnDist**2) {
            this.active = false;
        }
    }
    draw(ctx) { if(this.def.visual && GAME_GRAPHICS[this.visualKey]) GAME_GRAPHICS[this.visualKey](ctx, this, this.game); }
    
    handleCollision(target) {
    // Announce the 'onHit' event to the universal handler system so data-driven effects can fire.
    this.game.handlerSystem.processEvent(this, 'onHit', { target });

    // Handle the physical consequences of the collision.
    this.pierce--;
    this.hitList.add(target);

    S.play('hit', this.game.state);

    // --- New Destruction Logic ---
    // First, check for explicit data flags, as they have the highest priority.
    if (this.def.destroyOnHit === false) {
        // Do nothing. The designer has explicitly commanded this projectile to never be destroyed on hit.
    } else if (this.def.destroyOnHit === true) {
        // The designer has explicitly commanded this projectile to always be destroyed on hit.
        this.active = false;
    } else {
        // If no explicit flag is set, fall back to the default piercing behavior.
        if (this.pierce < 0) {
            this.active = false;
        }
    }
}
    onExpire() { 
        this.game.handlerSystem.processEvent(this, 'onExpire', { target: null });
        this.active = false; 
    }
}

class WeaponInstance {
    constructor(game, key) {
        this.game = game;
        this.key = key;
        this.def = GAME_DATA.weapons[key];
        this.level = 1;
        this.maxLevel = 8;
        this.lastTarget = null;
        this.activeEffects = {};

        this.cooldowns = {};
        this.def.attacks.forEach(attack => {
            this.cooldowns[attack.id] = 0;
        });
    }
    
    // MODIFIED: This method now correctly calculates stats for a SPECIFIC attack definition.
    getStats(attackDef, playerStats) {
        const pStats = playerStats || this.game.player.getCurrentStats();
        const baseStats = attackDef.stats; // Use the stats from the specific attack

        // Apply global player buffs (Might, Area, etc.)
        const soulLevel = this.game.player.passives['soul'] || 0;
        let soulBonus = 0;
        if (soulLevel > 0) {
            const currentTotalRate = SOUL_CONDUCTOR_RATES.damagePerStack[soulLevel - 1] || SOUL_CONDUCTOR_RATES.damagePerStack[4];
            soulBonus = Math.floor(this.game.kills / SOUL_CONDUCTOR_RATES.killsPerStack) * currentTotalRate;
        }
        const elementalBonus = (pStats.elementalFocus[this.def.type] || 0);
        
        // Apply weapon level-up scaling
        const levelUps = this.level - 1;
        const s = WEAPON_LEVEL_UP_SCALING;
        // (FIX) All references now correctly point to baseStats, not this.def.stats
        const flatAdjustedBaseDmg = (baseStats.baseDmg || 0) + (s.flatDmg * levelUps);
        const weaponPercentBonus = (baseStats.scalingBonus || 0.20) * levelUps;
        
        let finalDamage = flatAdjustedBaseDmg * (1 + weaponPercentBonus + soulBonus + elementalBonus) * pStats.might;

        // Apply special damage modifiers from the attack definition
        if(attackDef.damageModifiers) {
            for(const mod of attackDef.damageModifiers){
                if(mod.type === 'missingHealth'){
                    const missingHpMult = 1 + ((pStats.maxHp - this.game.player.hp) / pStats.maxHp) * (mod.maxMultiplier -1);
                    finalDamage *= missingHpMult;
                }
            }
        }

        return {
            dmg: finalDamage,
            cd: (baseStats.baseCd || 99) * (1 - levelUps * s.cooldown) * pStats.cooldown,
            spd: (baseStats.baseSpd || 0) * (1 + levelUps * s.speed) * pStats.speedProj,
            dur: (baseStats.baseDur || 0) * (1 + levelUps * s.speed) * pStats.duration,
            area: (baseStats.baseArea || 1) * (1 + levelUps * s.area) * pStats.area,
            range: (baseStats.baseRange || 0) * pStats.range,
            amount: (baseStats.baseAmount || 1) + Math.floor(this.level / s.amountInterval) + pStats.amount,
            pierce: (baseStats.basePierce || 0) + Math.floor(this.level / s.pierceInterval),
            kb: baseStats.kb || 0
        };
    }
    getDescription() { return this.def.description; }
    getSVG() { return this.def.svg; }
}

class Ally extends Entity {
    constructor(game, x, y, key, weaponInstance, attackStats) {
        const def = GAME_DATA.allies[key];
        super(game, x, y, def.r);
        this.def = def;
        this.weaponInstance = weaponInstance;
        this.damage = attackStats.dmg;
        this.life = attackStats.dur;
        this.speed = def.speed;
        this.hitCooldown = def.behavior.attackCooldown || def.behavior.hitCooldown || 1.0;
        this.timer = 0; this.animOff = M.rand(0, Math.PI);
        this.target = null; this.retargetTimer = M.rand(GAME_DATA.CONFIG.AI.allyRetargetTimeMin, GAME_DATA.CONFIG.AI.allyRetargetTimeMax);
    }
    update() { this.game.allySystem.update(this); }
    draw(ctx) { if(this.def.visual && GAME_GRAPHICS[this.def.visual.key]) GAME_GRAPHICS[this.def.visual.key](this, ctx, this.game); }
}

class ExperienceOrb extends Entity {
    constructor(game, x, y, value) { super(game, x, y, 6); const cfg = GAME_DATA.CONFIG.COLLECTIBLES; this.value = value; this.vx = 0; this.vy = 0; this.magnetized = false; this.animOff = M.rand(0, Math.PI); this.mergeTimer = M.rand(cfg.xpMergeTimeMin, cfg.xpMergeTimeMax); this.updateVisuals(); }
    updateVisuals() {
        const tiers = GAME_DATA.CONFIG.COLLECTIBLES.xpOrbTiers;
        for (const tier of tiers) {
            if (this.value < tier.threshold) {
                this.cols = tier.colors;
                this.r = tier.r;
                return;
            }
        }
    }
    update() { const cfg = GAME_DATA.CONFIG.COLLECTIBLES; this.z = this.y - cfg.xpOrbHoverOffset; const distToPlayerSq = M.distSq(this.x, this.y, this.game.player.x, this.game.player.y); if (this.magnetized || distToPlayerSq < this.game.player.getCurrentStats().magnet**2) { this.magnetized = true; const angle = M.angle(this.x, this.y, this.game.player.x, this.game.player.y); const speed = cfg.xpMagnetSpeed; this.vx = M.lerp(this.vx, Math.cos(angle) * speed, 5 * this.game.dt); this.vy = M.lerp(this.vy, Math.sin(angle) * speed, 5 * this.game.dt); this.x += this.vx * this.game.dt; this.y += this.vy * this.game.dt; if (distToPlayerSq < (this.game.player.r + this.r + 10)**2) { this.active = false; this.game.player.gainXp(this.value); if (!this.game.gemSoundPlayedThisFrame) { S.play('gem', this.game.state); this.game.gemSoundPlayedThisFrame = true; } } } if (this.mergeTimer > 0) { this.mergeTimer -= this.game.dt; return; } const neighbors = this.game.xpGrid.getNearby(this); const mergeRadiusSq = (this.r * cfg.xpMergeRadiusMultiplier)**2; for (const other of neighbors) { if (this === other || !other.active) continue; if (M.distSq(this.x, this.y, other.x, other.y) < mergeRadiusSq) { this.value += other.value; other.active = false;  this.updateVisuals(); this.mergeTimer = cfg.xpMergeResetTimer; this.game.particles.push(new Particle(this.game, this.x, this.y, this.cols[0], 5, 20, 0.2)); return; } } }
    draw(ctx) { GAME_GRAPHICS.experience_orb_draw(this, ctx, this.game); }
}
class Chest extends Entity {
    constructor(game, x,y) { super(game, x, y, GAME_DATA.CONFIG.COLLECTIBLES.chestRadius); this.life = GAME_DATA.CONFIG.COLLECTIBLES.chestDespawnTime; this.animOff = M.rand(0, Math.PI); }
    update() { this.life -= this.game.dt; if (this.life <= 0) this.active = false; }
    draw(ctx) { GAME_GRAPHICS.chest_draw(this, ctx, this.game); }
}
class CursedDoubloon extends Entity {
    constructor(game, x, y) { super(game, x, y, GAME_DATA.CONFIG.COLLECTIBLES.doubloonRadius); this.animOff = M.rand(0, Math.PI); }
    update() { if (M.collides(this, this.game.player)) { this.game.player.doubloonCounter++; this.active = false; S.play('gem', this.game.state); } }
    draw(ctx) { GAME_GRAPHICS.cursed_doubloon_draw(this, ctx, this.game); }

}

// =========================================================================
// 4. ACTOR & ENEMY CLASSES
// =========================================================================
class Player extends Entity {
    constructor(game) {
        super(game, 0, 0, GAME_DATA.PLAYER_DEFAULTS.r);
        this.baseStats = { ...GAME_DATA.PLAYER_DEFAULTS.baseStats };
        this.stats = { ...this.baseStats }; 
        this.hp = this.stats.maxHp; 
        this.xp = 0; 
        this.level = 1; 
        this.nextLevelXp = GAME_DATA.CONFIG.PLAYER.xpBase;
        this.weapons = []; this.passives = {}; this.invulnTimer = 0; this.regenTimer = 0; this.facingX = 1; this.lastMoveDir = {x:1, y:0};
        this.buffs = {}; this.timeCrystalTimer = 0; this.walkFrame = 0; 
        this.tempShield = 0; this.rechargeShield = 0; this.rechargeShieldTimer = 0;
        this.doubloonCounter = 0;
        this.activeComponents = [];
        this.faction = 'player';
        this.addWeapon('wand');
    }
    getCurrentStats() {
        let current = {...this.stats};
        // Apply buffs from data
        for (const buffId in this.buffs) {
            if (this.buffs[buffId] > 0) {
                const buffDef = GAME_DATA.buffs[buffId];
                if (buffDef && buffDef.mods) {
                    buffDef.mods.forEach(mod => {
                        if (mod.op === 'add') current[mod.stat] += mod.value;
                        else if (mod.op === 'mul') current[mod.stat] *= mod.value;
                        else if (mod.op === 'set') current[mod.stat] = mod.value;
                    });
                }
            }
        }
        if (this.buffs.tempShield > 0) this.tempShield = Math.max(this.tempShield, this.buffs.tempShield);
        return current;
    }
    update() {
        this.game.playerSystem.update(this);
        this.game.componentSystem.update(this);
        this.weapons.forEach(w => this.game.weaponSystem.update(w));
        for(const chest of this.game.chests) { if (M.collides(this, chest)) { chest.active = false; this.openChest(); } }
    }
    draw(ctx) {
        this.game.componentSystem.draw(this, ctx);
        GAME_GRAPHICS.player_draw(this, ctx, this.game);
    }
    takeDamage(amount) { if (this.invulnTimer > 0 || this.game.state !== 'running') return; const pCfg = GAME_DATA.CONFIG.PLAYER; const cStats = this.getCurrentStats(); if (cStats.dodgeChance > 0 && Math.random() < cStats.dodgeChance) { this.invulnTimer = pCfg.invulnOnHitDuration; S.play('whip', this.game.state); return; } if (this.rechargeShield > 0) { this.rechargeShield = 0; this.invulnTimer = pCfg.invulnOnHitDuration; S.play('ui', this.state); this.game.dispatch('onShieldBreak', { target: this }); return; } if (this.tempShield > 0) { this.tempShield -= amount; this.invulnTimer = pCfg.invulnOnHitDuration; S.play('hit', this.state); return; } const actualDmg = Math.max(1, amount - this.stats.armor); this.hp -= actualDmg; this.invulnTimer = pCfg.invulnOnHitDuration; this.game.screenShake = pCfg.screenShakeOnHit; this.game.damageTexts.push(this.game.damageTextPool.get().reset(this.game, this.x, this.y, actualDmg, false, true));
    this.game.dispatch('onPlayerHit', { damage: actualDmg }); S.play('hurt', this.state); if (this.hp <= 0) this.game.gameOver(); }
    gainXp(amount) { this.xp += amount * this.stats.xpGain; if (this.xp >= this.nextLevelXp) { this.xp -= this.nextLevelXp; this.levelUp(); } this.game.updateHud(); }
    levelUp() { const cfg = GAME_DATA.CONFIG.PLAYER; this.level++; this.nextLevelXp = Math.floor(cfg.xpBase + this.level * cfg.xpLevelMultiplier * (1 + this.level * cfg.xpLevelExponent)); S.play('levelup', this.state); this.game.state = 'levelup'; this.game.generateUpgrades(); }
    addWeapon(key) {
        // Prevent adding duplicate weapons
        if (this.weapons.some(w => w.key === key)) return;

        const newWeapon = new WeaponInstance(this.game, key);
        this.weapons.push(newWeapon);

        // If the weapon grants a component, add it to the player's active components.
        if (newWeapon.def.grantsComponent) {
            const compDef = newWeapon.def.grantsComponent;
            this.activeComponents.push({
                id: newWeapon.key, 
                def: compDef,
                weapon: newWeapon,
                timer: compDef.tickRate || 0,
                rot: 0,
                blades: [], // For orbitals
                radius: 0  // For auras
            });
        }
    }
    openChest() {
        S.play('chest', this.state);
        const pCfg = GAME_DATA.CONFIG.COLLECTIBLES.chestParticle;
        for (let i = 0; i < pCfg.count; i++) {
            const p = this.game.particlePool.get().reset(this.game, this.x, this.y, pCfg.color, M.rand(pCfg.size[0], pCfg.size[1]), M.rand(pCfg.speed[0], pCfg.speed[1]), M.rand(pCfg.life[0], pCfg.life[1]));
            this.game.particles.push(p);
        }
        const reward = M.randWeighted(GAME_DATA.CONFIG.CHEST_REWARDS);
        if (reward && reward.effect) {
            this.game.effectSystem.processEffects(null, { game: this.game }, [reward.effect]);
        }
    }
}

class Enemy extends Entity {
    constructor(game, def, x, y) {
        super(game, x, y, def.r);
        this.faction = 'enemy'; 
        this.def = def;
        this.hp = def.hp * (1 + game.time / GAME_DATA.CONFIG.SPAWNING.enemyHpScalingFactor);
        this.maxHp = this.hp;
        this.speed = def.speed;
        this.damage = def.dmg;
        this.xp = def.xp;
        this.kbResist = def.kbResist || 0;
        this.vx = 0; this.vy = 0; this.flash = 0; this.auraTimer = 0; this.aoeTimer = 0;
        this.isElite = false; this.frozen = 0; this.shielded = 0; this.isInvisible = false; this.isInvulnerable = false;
        this.movementOverridden = false;
        this.behaviorState = {}; 
        this.cooldowns = {};
        this.animOff = M.rand(0, Math.PI * 2);
        this.chill = {duration: 0, amount: 0};
        this.bleed = null;
        this.curse = 0;
        this.updateTimer = M.rand(0, 1 / GAME_DATA.CONFIG.AI.behaviorUpdateRate);

        if (this.def.initialFlags) {
            for (const flag in this.def.initialFlags) {
                this[flag] = this.def.initialFlags[flag];
            }
        }
    }

    applyChill(amount, duration) { this.chill.amount = Math.max(this.chill.amount, amount); this.chill.duration = Math.max(this.chill.duration, duration); }
    applyBleed(dps, duration) { if (!this.bleed || dps > this.bleed.dps) this.bleed = {dps, duration}; }
    applyCurse(duration) { this.curse = Math.max(this.curse, duration); }
    update() { this.game.enemySystem.update(this); }
    draw(ctx) {
    if (this.isInvisible) return;

    if (this.def.visual && GAME_GRAPHICS[this.def.visual.key]) {
        this.drawShadow(ctx);
        ctx.save();
        ctx.translate(Math.floor(this.x), Math.floor(this.y));
        if (this.vx < 0) ctx.scale(-1, 1);
        if (this.flash > 0) {ctx.globalCompositeOperation = 'lighter';ctx.fillStyle = '#fff';}
        GAME_GRAPHICS[this.def.visual.key](ctx, this, this.game);
            if (this.chill.duration > 0 && GAME_GRAPHICS.status_chilled_tint) {GAME_GRAPHICS.status_chilled_tint(ctx, this, this.game);}   ctx.restore(); }
    if (this.isElite) {ctx.fillStyle = 'rgba(255,255,0,0.2)';ctx.beginPath();ctx.arc(this.x, this.y, this.r * 1.5, 0, Math.PI * 2);ctx.fill();}
    if (this.shielded > 0) {GAME_GRAPHICS.status_shielded(ctx, this, this.game);}
    if (this.curse > 0) {GAME_GRAPHICS.status_cursed(ctx, this, this.game);}
    if (this.chill.duration > 0 && GAME_GRAPHICS.status_chilled_ground) {GAME_GRAPHICS.status_chilled_ground(ctx, this, this.game);}
    }
    takeDamage(amount, isCrit, kb, angle) { if (this.isInvisible || this.isInvulnerable) return; const cfg = GAME_DATA.CONFIG.SPAWNING; let finalDmg = amount; if (this.shielded > 0) finalDmg *= cfg.shieldedDmgMultiplier; if (this.curse > 0) finalDmg *= cfg.cursedDmgMultiplier; this.hp -= finalDmg; this.flash = GAME_DATA.CONFIG.PRESENTATION.enemyHitFlashDuration; this.game.damageTexts.push(this.game.damageTextPool.get().reset(this.game, this.x, this.y, finalDmg, isCrit, false)); const kbf = Math.max(0, kb - this.kbResist); const kbm = GAME_DATA.CONFIG.PHYSICS.knockbackMultiplier; this.x += Math.cos(angle) * kbf * this.game.dt * kbm; this.y += Math.sin(angle) * kbf * this.game.dt * kbm; this.vx = 0; this.vy = 0; if (this.hp <= 0) this.die(); }
    die() { const sCfg = GAME_DATA.CONFIG.SPAWNING; const eCfg = GAME_DATA.CONFIG.STATUS_EFFECTS; this.active = false; this.game.kills++; this.game.dispatch('onKill', { enemy: this });  this.game.handlerSystem.processEvent(this, 'onDeath', { target: this }); this.game.gems.push(new ExperienceOrb(this.game, this.x, this.y, this.xp * (this.isElite ? sCfg.eliteXpMultiplier : 1))); if(this.isElite && Math.random() < sCfg.eliteChestChance) this.game.chests.push(new Chest(this.game, this.x, this.y)); if (this.game.player.stats.doubloonChance > 0 && Math.random() < this.game.player.stats.doubloonChance) { this.game.collectibles.push(new CursedDoubloon(this.game, this.x, this.y)); } if (this.curse > 0) { this.game.enemies.forEach(e => { if(M.distSq(this.x, this.y, e.x, e.y) < sCfg.curseExplosionRadius**2 && Math.random() < sCfg.curseExplosionChance) e.applyCurse(3); });} this.game.updateHud(); }
}

// =========================================================================
// 5. GAME SYSTEMS
// =========================================================================
class MovementSystem {
     update(entity, dt) {
        const def = entity.def.movement; if (!def) return;
        const pCfg = GAME_DATA.CONFIG.PHYSICS;
        switch(def.type) {
            case 'linear': entity.x += entity.vx * dt; entity.y += entity.vy * dt; break;
            case 'arc': entity.vy += def.gravity * dt; entity.x += entity.vx * dt; entity.y += entity.vy * dt; break;
            case 'boomerang':
                const returnTime = entity.duration / 2;
                const stats = entity.weapon.getStats(entity.weapon.def.attacks[0]);
                if (entity.timer < returnTime) {
                    const speed = stats.spd * (1 - (entity.timer / returnTime));
                    entity.x += Math.cos(entity.angle) * speed * dt;
                    entity.y += Math.sin(entity.angle) * speed * dt;
                } else {
                    const returnAngle = M.angle(entity.x, entity.y, entity.game.player.x, entity.game.player.y);
                    const returnSpeed = stats.spd;
                    entity.x += Math.cos(returnAngle) * returnSpeed * dt;
                    entity.y += Math.sin(returnAngle) * returnSpeed * dt;
                    if (M.distSq(entity.x, entity.y, entity.game.player.x, entity.game.player.y) < pCfg.boomerangCatchRadius**2) {
                        entity.active = false;
                    }
                }
                break;
            case 'homing':
                if (entity.target && entity.target.active) {
                    const angle = M.angle(entity.x, entity.y, entity.target.x, entity.target.y);
                    const speed = entity.weapon.getStats(entity.weapon.def.attacks[0]).spd; 
                    const turnRate = def.turnRate || pCfg.homingTurnRate;
                    entity.vx = M.lerp(entity.vx, Math.cos(angle) * speed, turnRate * dt);
                    entity.vy = M.lerp(entity.vy, Math.sin(angle) * speed, turnRate * dt);
                }
                entity.x += entity.vx * dt; entity.y += entity.vy * dt;
                break;
        }
    }
}

class WeaponSystem {
    update(weapon) {
        // Update cooldowns
        for (const attackId in weapon.cooldowns) {
            if (weapon.cooldowns[attackId] > 0) {
                weapon.cooldowns[attackId] -= weapon.game.dt;
            }
        }

        // Handle special active effects like beams and orbitals
        if (weapon.activeEffects.beam && weapon.activeEffects.beam.timer > 0) {
            this.handleBeam(weapon);
        }
        
        // THE FIX: Update logic for permanent auras is now managed here.
        if (weapon.activeEffects.aura) {
            const aura = weapon.activeEffects.aura;
            const p = weapon.game.player;
            aura.x = p.x;
            aura.y = p.y;
            
            // Recalculate radius based on current player stats
            const attackDef = weapon.def.attacks.find(a => a.id === aura.attackId);
            if (attackDef) {
                 const stats = weapon.getStats(attackDef);
                 aura.radius = aura.baseRadius * stats.area;
            }
        }

        // Trigger attacks
        for (const attackDef of weapon.def.attacks) {
            if (attackDef.type === 'orbital') {
                this.handleOrbital(weapon, attackDef);
                continue;
            }

            if (weapon.cooldowns[attackDef.id] <= 0) {
                const attackStats = weapon.getStats(attackDef);
                this.attack(weapon, attackDef, attackStats);
                weapon.cooldowns[attackDef.id] = attackStats.cd;
            }
        }
    }

    attack(weapon, attackDef, attackStats) {
        const p = weapon.game.player;
        if (attackDef.handlers) {
            const handlerSource = { ...weapon, def: attackDef };
            weapon.game.handlerSystem.processEvent(handlerSource, 'onFire', { target: null });
        }

        let targets = [], angles = [];
        const numToFire = attackDef.amountIsInternal ? 1 : attackStats.amount;

        switch (attackDef.targeting) {
            case 'nearest':
                targets = p.game.getNearestEnemies(numToFire, attackStats.range);
                break;
            case 'random':
                const enemiesInRange = p.game.getEnemiesInRange(attackStats.range);
                if (enemiesInRange.length > 0) {
                    for (let i = 0; i < numToFire; i++) targets.push(enemiesInRange[M.randInt(0, enemiesInRange.length - 1)]);
                } else {
                    for (let i = 0; i < numToFire; i++) {
                        const randomAngle = M.rand(0, Math.PI * 2);
                        const randomDist = M.rand(0, attackStats.range);
                        targets.push({ x: p.x + Math.cos(randomAngle) * randomDist, y: p.y + Math.sin(randomAngle) * randomDist, active: true });
                    }
                }
                break;
            case 'moveDirection':
                for (let i = 0; i < numToFire; i++) {
                    const spread = attackDef.spread || 0;
                    angles.push(M.angle(0, 0, p.lastMoveDir.x, p.lastMoveDir.y) + M.lerp(-spread / 2, spread / 2, i / (attackStats.amount - 1 || 1)));
                }
                break;
            case 'horizontal':
                for (let i = 0; i < numToFire; i++) angles.push(i % 2 === 0 ? 0 : Math.PI);
                break;
            case 'directional':
                for (let i = 0; i < numToFire; i++) angles.push(attackDef.angle);
                break;
        }

        if (attackDef.targeting !== 'none' && targets.length === 0 && angles.length === 0) {
            weapon.cooldowns[attackDef.id] = 0.1;
            return;
        }
        weapon.lastTarget = targets[0];

        const finalAngles = angles.length > 0 ? angles : targets.map(t => M.angle(p.x, p.y, t.x, t.y));
        attackDef.actions.forEach(actionDef => this.executeAction(weapon, attackDef, attackStats, targets, finalAngles, actionDef));
    }

    executeAction(weapon, attackDef, attackStats, targets, angles, actionDef) {
        const p = weapon.game.player;

        switch (actionDef.type) {
            case 'fireProjectile':
                this.fireProjectiles(weapon, attackStats, angles, null, actionDef);
                break;
            
            case 'lobProjectile':
                this.fireProjectiles(weapon, attackStats, angles, (proj, i) => {
                    proj.vy = attackStats.spd;
                    if (actionDef.lobType === 'directional') {
                        const spreadVel = actionDef.spreadVelocity || 0;
                        proj.vx = (attackStats.amount > 1) ? M.lerp(-1, 1, i / (attackStats.amount - 1)) * spreadVel : 0;
                    } else {
                        const flightTime = actionDef.projectileDuration;
                        const target = targets[i] || targets[targets.length - 1];
                        if (!flightTime || !target) { proj.active = false; return; }
                        
                        const spreadRadius = actionDef.targetSpread || 0;
                        let landingSpot = { x: target.x + M.rand(-spreadRadius, spreadRadius), y: target.y + M.rand(-spreadRadius, spreadRadius) };
                        if (M.distSq(p.x, p.y, landingSpot.x, landingSpot.y) > attackStats.range ** 2) {
                            const targetAngle = M.angle(p.x, p.y, landingSpot.x, landingSpot.y);
                            landingSpot = { x: p.x + Math.cos(targetAngle) * attackStats.range, y: p.y + Math.sin(targetAngle) * attackStats.range };
                        }

                        const finalAngle = M.angle(p.x, p.y, landingSpot.x, landingSpot.y);
                        const dist = Math.sqrt(M.distSq(p.x, p.y, landingSpot.x, landingSpot.y));
                        const horizontalSpeed = dist / flightTime;
                        proj.duration = flightTime;
                        proj.vx = Math.cos(finalAngle) * horizontalSpeed;
                        proj.vy = Math.sin(finalAngle) * horizontalSpeed + attackStats.spd;
                        proj.angle = finalAngle;
                    }
                }, actionDef);
                break;

            case 'spawnBeam':
                const angle = targets[0] ? M.angle(p.x, p.y, targets[0].x, targets[0].y) : M.rand(0, Math.PI * 2);
                weapon.activeEffects.beam = { timer: attackStats.dur, angle: angle, tickRate: actionDef.tickRate, baseWidth: actionDef.baseWidth, visual: actionDef.visual, attackStats: attackStats };
                break;

            case 'damageInAura':
                // This action is now ONLY for damage. Visuals must be a separate action.
                if (actionDef.sound) S.play(actionDef.sound, weapon.game.state);
                const r = actionDef.radius * attackStats.area;
                for (const e of p.game.enemies) {
                    if (M.distSq(p.x, p.y, e.x, e.y) < (r + e.r)**2) {
                        const isCrit = Math.random() < p.getCurrentStats().critChance;
                        const dmg = attackStats.dmg * (isCrit ? p.getCurrentStats().critDmg : 1);
                        e.takeDamage(dmg, isCrit, attackStats.kb, M.angle(p.x, p.y, e.x, e.y));
                    }
                }
                break;

            case 'spawnEffect':
                const effectSource = { ...weapon, stats: attackStats };
                weapon.game.effectSystem.processEffects(targets[0], effectSource, [actionDef]);
                if (actionDef.sound) S.play(actionDef.sound, weapon.game.state);
                break;

            case 'executeEffectsOnTargets':
                if (actionDef.sound) S.play(actionDef.sound, weapon.game.state);
                targets.forEach(target => weapon.game.effectSystem.processEffects(target, weapon, actionDef.effects));
                break;
            
            case 'leaveTrail':
                weapon.game.staticEffects.push(new StaticEffect(weapon.game, p.x, p.y, actionDef.radius * attackStats.area, attackStats.dur, attackStats.dmg, attackStats.kb, actionDef.effect.type, actionDef.effect));
                break;

            case 'summonAlly':
                const currentAllies = weapon.game.allies.filter(al => al.weaponInstance === weapon).length;
                if (currentAllies < attackStats.amount) {
                    if (actionDef.sound) S.play(actionDef.sound, weapon.game.state);
                    weapon.game.allies.push(new Ally(weapon.game, p.x, p.y, actionDef.allyKey, weapon, attackStats));
                }
                break;
        }
    }

    fireProjectiles(weapon, attackStats, angles, modifierFunc = null, actionDef) {
        const p = weapon.game.player;
        const projectileDef = GAME_DATA.projectiles[actionDef.projectile];
        if (!projectileDef) return;

        const hasDelay = actionDef.delayBetweenShots && actionDef.delayBetweenShots > 0;
        
        const createProjectile = (index, angle) => {
            const proj = new Projectile(weapon.game, weapon, projectileDef, attackStats, p.x, p.y, Math.cos(angle) * attackStats.spd, Math.sin(angle) * attackStats.spd, angle, p);
            if (modifierFunc) modifierFunc(proj, index, angle);
            weapon.game.projectiles.push(proj);
        };

        if (hasDelay) {
            for (let i = 0; i < angles.length; i++) {
                const angle = angles[i];
                const delay = actionDef.delayBetweenShots * i;
                setTimeout(() => {
                    if (weapon.game.state !== 'running') return;
                    if (actionDef.sound) S.play(actionDef.sound, weapon.game.state);
                    createProjectile(i, angle);
                }, delay);
            }
        } else {
            if (actionDef.sound) S.play(actionDef.sound, weapon.game.state);
            for (let i = 0; i < angles.length; i++) {
                createProjectile(i, angles[i]);
            }
        }
    }

    handleBeam(weapon) {
        const beam = weapon.activeEffects.beam; beam.timer -= weapon.game.dt;
        if(beam.timer <= 0) { weapon.activeEffects.beam = null; return; }
        if (weapon.game.frameCount % Math.floor(beam.tickRate / weapon.game.dt) !== 0) return;
        
        const s = beam.attackStats; const p = weapon.game.player;
        const beamHalfWidth = (beam.baseWidth * s.area) / 2;
        const dirX = Math.cos(beam.angle); const dirY = Math.sin(beam.angle);
        for (const e of p.game.enemies) {
            const vecToEnemyX = e.x - p.x; const vecToEnemyY = e.y - p.y;
            if (vecToEnemyX * dirX + vecToEnemyY * dirY <= 0) continue; 
            if (Math.abs(vecToEnemyX * dirY - vecToEnemyY * dirX) < e.r + beamHalfWidth) {
                const isCrit = Math.random() < p.getCurrentStats().critChance;
                e.takeDamage(s.dmg * (isCrit ? p.getCurrentStats().critDmg : 1), isCrit, s.kb, beam.angle);
            }
        }
    }
}

class EnemySystem {
    update(e) {
        const game = e.game;
        e.z = e.y;
        game.componentSystem.update(e);

        // Update internal state timers
        for (const id in e.cooldowns) {
            if (e.cooldowns[id] > 0) e.cooldowns[id] -= game.dt;
        }
        if (e.chill.duration > 0) { e.chill.duration -= game.dt; if (e.chill.duration <= 0) e.chill.amount = 0; }
        if (e.bleed) { e.bleed.duration -= game.dt; if (e.bleed.duration <= 0) e.bleed = null; else { if (game.frameCount % 30 == 0) e.takeDamage(e.bleed.dps, false, 0, 0); const pCfg = GAME_DATA.CONFIG.STATUS_EFFECTS.bleedParticle; if (Math.random() < pCfg.chance) { game.particles.push(game.particlePool.get().reset(game, e.x + M.rand(-e.r*0.5, e.r*0.5), e.y, pCfg.color, M.rand(pCfg.size[0], pCfg.size[1]), M.rand(pCfg.speed[0], pCfg.speed[1]), pCfg.life)); } } }
        if (e.curse > 0) e.curse -= game.dt;
        if (e.frozen > 0) { e.frozen -= game.dt; return; }

        // Fire the 'onUpdate' event for the Handler System to process
        e.updateTimer -= game.dt;
        if (e.updateTimer <= 0) {
            e.updateTimer = 1 / GAME_DATA.CONFIG.AI.behaviorUpdateRate;
            game.handlerSystem.processEvent(e, 'onUpdate');
        }

        // Standard Movement
        if (!e.behaviorState.isDashing) {
            const currentSpeed = e.speed * (1 - e.chill.amount);
            const angle = M.angle(e.x, e.y, game.player.x, game.player.y);
            e.vx = M.lerp(e.vx, Math.cos(angle) * currentSpeed, 5 * game.dt);
            e.vy = M.lerp(e.vy, Math.sin(angle) * currentSpeed, 5 * game.dt);
        }

        e.x += e.vx * game.dt;
        e.y += e.vy * game.dt;

        // Collision & other checks
        if (!e.isInvisible && M.collides(e, game.player)) { game.player.takeDamage(e.damage, e); const pStats = game.player.stats; if(pStats.thornsDmg > 0 && (e.thornsTimer || 0) <= 0) { e.takeDamage(pStats.might * pStats.thornsDmg, false, 0, 0); e.thornsTimer = 0.5; } }
        if (e.flash > 0) e.flash -= game.dt;
        if (e.shielded > 0) e.shielded -= game.dt;
        if (M.distSq(e.x, e.y, game.player.x, game.player.y) > (C.WIDTH + 300)**2) { e.active = false; }
    }
}

class PlayerSystem {
    update(p) {
        const game = p.game; const cStats = p.getCurrentStats();
        if (cStats.isGlassCannon && p.hp > 1) { p.hp = 1; p.stats.maxHp = 1; }
        for (const buff in p.buffs) { if (p.buffs[buff] > 0) p.buffs[buff] -= game.dt; }
        if (p.stats.timeCrystal > 0) { p.timeCrystalTimer += game.dt; if (p.timeCrystalTimer >= 60) { p.timeCrystalTimer = 0; game.enemies.forEach(e => e.frozen = 2 * p.stats.timeCrystal); S.play('levelup', game.state); } }
        let dx = 0, dy = 0; const input = game.input;
        if (input.up) dy -= 1; if (input.down) dy += 1; if (input.left) dx -= 1; if (input.right) dx += 1;
        if (dx !== 0 || dy !== 0) { const mag = Math.sqrt(dx*dx + dy*dy); p.lastMoveDir.x = dx / mag; p.lastMoveDir.y = dy / mag; input.lastMoveDir.x = p.lastMoveDir.x; input.lastMoveDir.y = p.lastMoveDir.y; } else if (cStats.madman) { dx = p.lastMoveDir.x; dy = p.lastMoveDir.y; }
        if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
        p.x += dx * cStats.moveSpeed * game.dt; p.y += dy * cStats.moveSpeed * game.dt;
        if (dx !== 0) { p.facingX = Math.sign(dx); p.walkFrame += game.dt * 12; } else { p.walkFrame = 0; }
        p.z = p.y; game.camera.x = M.lerp(game.camera.x, p.x, 10 * game.dt); game.camera.y = M.lerp(game.camera.y, p.y, 10 * game.dt);
        const oldHp = p.hp;
        if (p.hp < p.stats.maxHp && p.stats.regen > 0) { p.regenTimer += game.dt; if (p.regenTimer >= 1) { p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.regen); p.regenTimer = 0; } }
        if (p.hp > oldHp && cStats.healNova > 0) { game.enemies.forEach(e => { if(M.distSq(p.x, p.y, e.x, e.y) < (150*cStats.area)**2) { const a=M.angle(p.x,p.y,e.x,e.y); e.vx += Math.cos(a)*500; e.vy += Math.sin(a)*500; }}); }
        if (p.invulnTimer > 0) p.invulnTimer -= game.dt;
        if (p.tempShield > 0) p.tempShield -= game.dt * 0.5; else p.tempShield = 0;
        if (p.stats.rechargeShieldTime < 35 && p.rechargeShield <= 0) { p.rechargeShieldTimer += game.dt; if (p.rechargeShieldTimer >= p.stats.rechargeShieldTime) { p.rechargeShield = 1; p.rechargeShieldTimer = 0; } }
        if (p.doubloonCounter >= 10) { p.doubloonCounter -= 10; const angle = M.rand(0, Math.PI * 2); const dist = C.WIDTH/2 + 50; game.enemies.push(new Enemy(game, GAME_DATA.enemies.revenant, p.x + Math.cos(angle)*dist, p.y + Math.sin(angle)*dist)); S.play('gameover', game.state); }
    }
}

class AllySystem {
    update(ally) {
        const cfg = GAME_DATA.CONFIG.AI;
        ally.life -= ally.game.dt; ally.timer -= ally.game.dt; ally.retargetTimer -= ally.game.dt; ally.z = ally.y;
        if (ally.life <= 0) ally.active = false;
        if (!ally.target || !ally.target.active || ally.retargetTimer <= 0) { this.findNewTarget(ally); ally.retargetTimer = M.rand(cfg.allyRetargetTimeMin, cfg.allyRetargetTimeMax); }
        let moveX = 0, moveY = 0;
        if (ally.target) { const angle = M.angle(ally.x, ally.y, ally.target.x, ally.target.y); moveX += Math.cos(angle) * ally.speed; moveY += Math.sin(angle) * ally.speed; }
        const separationForce = cfg.allySeparationForce; const separationRadiusSq = (ally.r * cfg.allySeparationRadiusMultiplier)**2;
        for (const otherAlly of ally.game.allies) { if (otherAlly === ally) continue; const distSq = M.distSq(ally.x, ally.y, otherAlly.x, otherAlly.y); if (distSq > 0 && distSq < separationRadiusSq) { const angle = M.angle(otherAlly.x, otherAlly.y, ally.x, ally.y); const force = (1 - (distSq / separationRadiusSq)) * separationForce; moveX += Math.cos(angle) * force; moveY += Math.sin(angle) * force; } }
        ally.x += moveX * ally.game.dt; ally.y += moveY * ally.game.dt;
        
        if (ally.def.behavior.type === 'melee' && ally.target && ally.timer <= 0 && M.collides(ally, ally.target)) {
            const isCrit = Math.random() < ally.game.player.getCurrentStats().critChance;
            ally.target.takeDamage(ally.damage * (isCrit ? ally.game.player.getCurrentStats().critDmg : 1), isCrit, 50, M.angle(ally.x, ally.y, ally.target.x, ally.target.y)); 
            ally.timer = ally.hitCooldown;
        } else if (ally.def.behavior.type === 'contact' && ally.timer <= 0) {
            for (const enemy of ally.game.enemies) { if (M.collides(ally, enemy)) { const isCrit = Math.random() < ally.game.player.getCurrentStats().critChance; enemy.takeDamage(ally.damage * (isCrit ? ally.game.player.getCurrentStats().critDmg : 1), isCrit, 0, M.angle(ally.x, ally.y, enemy.x, enemy.y)); } }
            ally.timer = ally.hitCooldown;
        }
    }
    findNewTarget(ally) {
        const targetedEnemies = new Set(ally.game.allies.filter(a => a.target && a.target.active).map(a => a.target));
        let closestUntargeted = null, minUntargetedDist = Infinity;
        const aggroRangeSq = GAME_DATA.CONFIG.AI.allyAggroRange ** 2;
        for (const enemy of ally.game.enemies) { if (targetedEnemies.has(enemy)) continue; const distSq = M.distSq(ally.x, ally.y, enemy.x, enemy.y); if (distSq < aggroRangeSq && distSq < minUntargetedDist) { minUntargetedDist = distSq; closestUntargeted = enemy; } }
        if (closestUntargeted) { ally.target = closestUntargeted; return; }
        let absoluteNearest = null, minAbsoluteDist = Infinity;
        for (const enemy of ally.game.enemies) { const distSq = M.distSq(ally.x, ally.y, enemy.x, enemy.y); if (distSq < minAbsoluteDist) { minAbsoluteDist = distSq; absoluteNearest = enemy; } }
        ally.target = absoluteNearest;
    }
}

class EffectSystem {
    processEffects(target, source, effects) {
        if (!effects) return;
        for(const effectDef of effects) {
            const func = GAME_DATA.effects[effectDef.type];
            if(func) {
                const result = func(target, source, effectDef);
                if (result === false) return false; // allow effects to cancel subsequent ones
            }
        }
        return true;
    }
}

class HandlerSystem {
    constructor(game) {
        this.game = game;
    }

    processEvent(source, eventName, context = {}) {
    const handlers = source.def.handlers;
    if (!handlers) return false;

    for (const handler of handlers) {
        if (this.evaluateTrigger(source, handler.trigger, eventName, context)) {
            let effectSource = this.game.player;
            if (source.hasOwnProperty('x') && source.hasOwnProperty('y')) {
                effectSource = source; // It's an Enemy, Projectile, etc.
            } else if (source.key) {
                effectSource = source; // It's a WeaponInstance
            }

            const target = context.target || source;
            this.game.effectSystem.processEffects(target, effectSource, handler.effects);
        }
    }
}

    evaluateTrigger(source, triggerDef, eventName, context) {
        const conditions = triggerDef.conditions || [];
        if (conditions.length === 0) return false;
        const isListeningForEvent = conditions.some(c => c.type === eventName);
        if (!isListeningForEvent) {
            return false;
        }

        const operator = triggerDef.operator || 'AND';
        if (operator === 'AND') {
            return conditions.every(c => this.evaluateCondition(source, c, eventName, context));
        } else { // 'OR'
            const eventConditionMet = conditions.find(c => c.type === eventName);
            const otherConditionsMet = conditions.some(c => c.type !== eventName && this.evaluateCondition(source, c, eventName, context));
            return eventConditionMet && otherConditionsMet;
        }
    }

    evaluateCondition(source, condition, eventName, context) {
        if (condition.type === eventName) {
            return true;
        }
        switch(condition.type) {
            case 'cooldown':
                if ((source.cooldowns[condition.id] || 0) <= 0) {
                    const time = Array.isArray(condition.time) ? M.rand(condition.time[0], condition.time[1]) : condition.time;
                    source.cooldowns[condition.id] = time;
                    return true;
                }
                return false;

            case 'distanceToPlayer':
                const distSq = M.distSq(source.x, source.y, this.game.player.x, this.game.player.y);
                if (condition.lessThan && distSq < condition.lessThan**2) return true;
                if (condition.greaterThan && distSq > condition.greaterThan**2) return true;
                return false;

            case 'isFlagTrue':
                return source[condition.key] === true;

            default:
                return false;
        }
    }
}

class ComponentSystem {
    constructor(game) {
        this.game = game;
    }

    // Master update function for ANY entity
    update(entity) {
    // THIS IS THE FIX: Check if entity.def exists before trying to access its properties.
    if (entity.def && entity.def.components) { // For components defined on the entity itself (e.g., Imp movement)
        for (const compDef of entity.def.components) {
            this.runComponentLogic(entity, compDef);
        }
    }
    if (entity.activeComponents) { // For components granted to the entity (e.g., Player's aura)
        for (const comp of entity.activeComponents) {
            this.runComponentLogic(entity, comp.def, comp);
        }
    }
}

    // Centralized logic router
    runComponentLogic(entity, compDef, compInstance = null) {
        switch (compDef.type) {
            case 'rotation':
                this.updateRotation(entity, compDef);
                break;
            case 'movement':
                this.updateMovement(entity, compDef);
                break;
            case 'aura':
                this.updateAura(entity, compDef, compInstance);
                break;
            case 'orbital':
                this.updateOrbital(entity, compDef, compInstance);
                break;
        }
    }

    // --- Component Logic ---

    updateRotation(entity, compDef) {
        if (!entity.rotation) entity.rotation = 0;
        entity.rotation += (compDef.speed || 0) * this.game.dt;
    }

    updateMovement(entity, compDef) {
        if (compDef.pattern === 'weave') {
            const angleToPlayer = M.angle(entity.x, entity.y, this.game.player.x, this.game.player.y);
            const perpendicularAngle = angleToPlayer + Math.PI / 2;
            const weaveForce = Math.sin(this.game.time * compDef.frequency) * compDef.strength * this.game.dt;
            entity.x += Math.cos(perpendicularAngle) * weaveForce;
            entity.y += Math.sin(perpendicularAngle) * weaveForce;
        }
    }

    updateAura(entity, compDef, comp) {
    const weapon = comp.weapon;
    const attackDef = weapon.def.attacks.find(a => a.id === compDef.attackId);
    if (!attackDef) return;

    const stats = weapon.getStats(attackDef);
    comp.radius = compDef.radius * stats.area;

    comp.timer -= this.game.dt;
    if (comp.timer <= 0) {
        comp.timer = compDef.tickRate;
        // CORRECTED: The source now includes position from the entity (player).
        const effectSource = { 
            game: weapon.game, 
            damage: stats.dmg, 
            kb: stats.kb,
            x: entity.x,
            y: entity.y
        };
        let hit = false;
        for (const e of this.game.enemies) {
            if (M.distSq(entity.x, entity.y, e.x, e.y) < (comp.radius + e.r)**2) {
                this.game.effectSystem.processEffects(e, effectSource, compDef.effects);
                hit = true;
            }
        }
        if (hit && compDef.sound) S.play(compDef.sound, this.game.state);
    }
}

    updateOrbital(entity, compDef, comp) {
    const weapon = comp.weapon;
    const attackDef = weapon.def.attacks.find(a => a.id === compDef.attackId);
    if (!attackDef) return;
    
    const stats = weapon.getStats(attackDef);
    const pStats = entity.getCurrentStats();
    
    const bladeCount = weapon.level + pStats.amount;
    while (comp.blades.length < bladeCount) { comp.blades.push({ x: 0, y: 0, r: 0, hitList: new Set() }); }
    while (comp.blades.length > bladeCount) { comp.blades.pop(); }

    comp.rot += (compDef.rotationSpeed || 3) * this.game.dt;
    const radius = compDef.radius * stats.area;
    const size = compDef.size * stats.area;
    
    comp.blades.forEach((blade, i) => {
        blade.r = size;
        const angle = comp.rot + (Math.PI * 2 / comp.blades.length) * i;
        blade.x = entity.x + Math.cos(angle) * radius;
        blade.y = entity.y + Math.sin(angle) * radius;

        const newHitList = new Set();
        for (const e of this.game.enemies) {
            if (M.collides(blade, e)) {
                if (!blade.hitList.has(e)) {
                    // CORRECTED: The source now includes position from the blade itself.
                    const effectSource = { 
                        game: weapon.game, 
                        damage: stats.dmg, 
                        kb: stats.kb,
                        x: blade.x,
                        y: blade.y
                    };
                    this.game.effectSystem.processEffects(e, effectSource, compDef.effects);
                    S.play('hit', this.game.state);
                }
                newHitList.add(e);
            }
        }
        blade.hitList = newHitList;
    });
}

    // Drawing Logic (Now accepts a generic 'entity')
    draw(entity, ctx) {
        if (!entity.activeComponents) return;
        for (const comp of entity.activeComponents) {
            if (comp.def.visual && GAME_GRAPHICS[comp.def.visual.key]) {
                if(comp.def.type === 'aura') {
                    GAME_GRAPHICS[comp.def.visual.key](ctx, { x: entity.x, y: entity.y, r: comp.radius }, this.game);
                }
                if(comp.def.type === 'orbital') {
                    comp.blades.forEach(b => GAME_GRAPHICS[comp.def.visual.key](ctx, b.x, b.y, b.r, comp.rot));
                }
            }
        }
    }
}

class DebugSystem {
    constructor() {
        this.shapes = [];
        this.visible = false;
        this.debugElement = document.getElementById('debugInfo');
    }

    toggle() {
        this.visible = !this.visible;
        this.debugElement.style.display = this.visible ? 'block' : 'none';
        S.play('ui');
    }

    addShape(shape) {
        this.shapes.push(shape);
    }

    update(dt) {
        // Update and remove expired shapes
        this.shapes = this.shapes.filter(shape => {
            shape.life -= dt;
            return shape.life > 0;
        });
    }

    updateInfo(game) {
        if (!this.visible || !game.player) return;
        
        const p = game.player;
        const pStats = p.getCurrentStats();

        let debugText = `--- SCENE ---\n`;
        debugText += `Entities: ${game.enemies.length + game.projectiles.length + game.gems.length}\n`;
        debugText += `Kills: ${game.kills}\n\n`;

        debugText += `--- CORE STATS ---\n`;
        debugText += `Might (Dmg): ${Math.round(pStats.might * 100)}%\n`;
        debugText += `Area: ${Math.round(pStats.area * 100)}%\n`;
        debugText += `Cooldown: -${Math.round((1 - pStats.cooldown) * 100)}%\n`;
        debugText += `Amount: +${pStats.amount}\n`;
        debugText += `Proj Speed: ${Math.round(pStats.speedProj * 100)}%\n`;
        debugText += `Duration: ${Math.round(pStats.duration * 100)}%\n\n`;

        debugText += `--- DEFENSIVE STATS ---\n`;
        debugText += `HP: ${Math.floor(p.hp)} / ${p.stats.maxHp}\n`;
        debugText += `Armor: ${pStats.armor}\n`;
        debugText += `Regen: ${pStats.regen.toFixed(1)}/s\n`;
        debugText += `Dodge Chance: ${Math.round(pStats.dodgeChance * 100)}%\n`;
        debugText += `Shield Recharge: ${pStats.rechargeShieldTime < 35 ? pStats.rechargeShieldTime.toFixed(1) + 's' : 'N/A'}\n\n`;

        debugText += `--- COMBAT STATS ---\n`;
        debugText += `Crit Chance: ${Math.round(pStats.critChance * 100)}%\n`;
        debugText += `Crit Damage: x${pStats.critDmg.toFixed(2)}\n`;
        debugText += `Bleed Chance: ${Math.round(pStats.bleedChance * 100)}%\n`;
        debugText += `Thorns Damage: ${Math.round(pStats.thornsDmg * 100)}% of Might\n\n`;

        debugText += `--- UTILITY STATS ---\n`;
        debugText += `Move Speed: ${Math.round(pStats.moveSpeed)}\n`;
        debugText += `Pickup Range: ${Math.round(pStats.magnet)}\n`;
        debugText += `XP Gain: ${Math.round(pStats.xpGain * 100)}%\n`;
        debugText += `Doubloon Chance: ${Math.round(pStats.doubloonChance * 100)}%\n\n`;

        debugText += `--- SPECIAL MODIFIERS ---\n`;
        if (Object.keys(pStats.elementalFocus).length > 0) {
            for (const type in pStats.elementalFocus) {
                debugText += ` > ${type.charAt(0).toUpperCase() + type.slice(1)} Dmg: +${pStats.elementalFocus[type] * 100}%\n`;
            }
        }
        if (p.passives['frost_attunement']) {
            const frostLevel = p.passives['frost_attunement'];
            const frostDef = GAME_DATA.passives.find(p => p.id === 'frost_attunement');
            const modData = frostDef.mods.find(m => m.stat === 'projectileModifier').value;
            const chance = frostLevel * modData.chancePerLevel;
            debugText += `Wand Chill Chance (L${frostLevel}): ${Math.round(chance * 100)}%\n`;
        }
        if (pStats.soul > 0) debugText += `Soul Conductor Lv: ${pStats.soul}\n`;
        if (pStats.timeCrystal > 0) debugText += `Time Crystal Lv: ${pStats.timeCrystal}\n`;
        if (pStats.madman) debugText += `Madman Active: YES\n`;
        if (pStats.isGlassCannon) debugText += `Glass Cannon Active: YES\n`;
        
        debugText += `\n--- WEAPONS ---\n`;
        p.weapons.forEach(weapon => {
            const wStats = weapon.getStats(weapon.def.attacks[0], pStats);
            debugText += `${weapon.def.name} (L${weapon.level})\n > Dmg: ${Math.round(wStats.dmg)} | CD: ${wStats.cd.toFixed(2)}s\n`;
        });
        
        this.debugElement.innerText = debugText;
    }

    draw(ctx, game) {
        if (this.shapes.length === 0 || !game.player) return;

        const p = game.player;

        for (const shape of this.shapes) {
            switch (shape.type) {
                case 'radius_circle':
                    ctx.strokeStyle = `rgba(255, 0, 255, ${shape.life / 3})`; // Fade out
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, shape.radius, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = `rgba(255, 255, 255, ${shape.life / 3})`;
                    ctx.font = '16px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(shape.radius, p.x, p.y - shape.radius - 10);
                    break;
            }
        }
    }
}

// =========================================================================
// 8. MAIN GAME CLASS
// =========================================================================
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.state = 'start'; this.player = null; this.enemies = []; this.projectiles = []; this.gems = []; this.particles = [];
        this.damageTexts = []; this.allies = []; this.activeEffects = []; this.chests = []; this.collectibles = [];

        this.camera = { x: 0, y: 0 }; this.input = { up: false, down: false, left: false, right: false, lastMoveDir: {x: 1, y: 0} };
        this.time = 0; this.kills = 0; this.frameCount = 0; this.lastTime = 0; this.dt = 0; this.screenShake = 0; this.spawnTimer = GAME_DATA.CONFIG.INITIAL_SPAWN_DELAY; this.animTime = 0;
        this.eventListeners = { onKill: [], onPlayerHit: [] };
        this.gemSoundPlayedThisFrame = false;

        this.bgPattern = generateBackgroundPattern(GAME_DATA.CONFIG.PRESENTATION.TILE_SIZE);
        
        // Systems
        this.movementSystem = new MovementSystem();
        this.weaponSystem = new WeaponSystem();
        this.enemySystem = new EnemySystem();
        this.playerSystem = new PlayerSystem();
        this.allySystem = new AllySystem();
        this.effectSystem = new EffectSystem();
        this.handlerSystem = new HandlerSystem(this);
        this.componentSystem = new ComponentSystem(this);
        this.collisionSystem = new CollisionSystem();
        this.debugSystem = new DebugSystem();

        // Object Pools
        this.particlePool = new ObjectPool(Particle, 200);
        this.damageTextPool = new ObjectPool(DamageText, 50);

        // Spatial Grids
        this.xpGrid = new SpatialGrid(50);
        this.enemyGrid = new SpatialGrid(100);
        this.effectGrid = new SpatialGrid(150);

        this.resize(); this.bindEvents();
    }
    
    start() {
        document.getElementById('start-screen').style.display = 'none';
        S.init();
        this.player = new Player(this); this.enemies = []; this.projectiles = []; this.gems = []; this.particles = []; this.damageTexts = []; this.allies = []; this.activeEffects = []; this.chests = []; this.collectibles = [];

        this.time = 0; this.kills = 0; this.camera = { x: this.player.x, y: this.player.y }; this.xpGrid.clear(); this.effectGrid.clear();
        this.eventListeners = { onKill: [], onPlayerHit: [] }; this.state = 'running'; this.lastTime = performance.now();
        document.querySelectorAll('.screen').forEach(el => { if (el.id !== 'start-screen') el.style.display = 'none'; });
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    gameLoop(timestamp) {
        requestAnimationFrame((t) => this.gameLoop(t));
        const rawDt = (timestamp - this.lastTime) / 1000; this.lastTime = timestamp; this.dt = Math.min(rawDt, 0.1);
        if (this.state === 'running') {
            this.time += this.dt; this.animTime += this.dt; this.frameCount++; this.update(); this.updateHud();
            if (this.time >= GAME_DATA.CONFIG.TARGET_TIME) this.victory();
        }
        this.render();
    }
    
    update() {
        this.gemSoundPlayedThisFrame = false;
        this.spawnEnemies();
        this.player.update();

        const updateAndFilter = (arr, pool) => {
            const stillActive = [];
            for (const e of arr) {
                e.update();
                if (e.active) {
                    stillActive.push(e);
                } else if (pool) {
                    pool.release(e);
                }
            }
            return stillActive;
        };
        
        this.collisionSystem.update(this.enemies, this.dt);
        this.enemies = updateAndFilter(this.enemies);
        this.projectiles.forEach(p => this.movementSystem.update(p, this.dt));
        this.projectiles = updateAndFilter(this.projectiles);
        this.allies = updateAndFilter(this.allies);
        this.particles = updateAndFilter(this.particles, this.particlePool);
        this.damageTexts = updateAndFilter(this.damageTexts, this.damageTextPool);
        this.activeEffects = updateAndFilter(this.activeEffects);
        this.chests = updateAndFilter(this.chests);
        this.collectibles = updateAndFilter(this.collectibles);
        
        this.xpGrid.clear(); const stillActiveGems = [];
        for (const gem of this.gems) { gem.update(); if (gem.active) { stillActiveGems.push(gem); this.xpGrid.add(gem); } } this.gems = stillActiveGems;
        
        this.enemyGrid.clear();
        for (const enemy of this.enemies) {
            this.enemyGrid.add(enemy);
}

        this.effectGrid.clear();
        for (const effect of this.activeEffects) {
            if (effect.def.behavior && effect.def.behavior.type === 'groundEffect') {
                this.effectGrid.add(effect);
            }
        }

        this.checkCollisions();
        if (this.screenShake > 0) this.screenShake -= this.dt * 20;
        
        // MODIFIED: Update the debug system
        this.debugSystem.update(this.dt);
        this.debugSystem.updateInfo(this);
    }
    
    render() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        this.ctx.save();
        if (this.screenShake > 0) { this.ctx.translate(M.rand(-this.screenShake, this.screenShake), M.rand(-this.screenShake, this.screenShake)); }
        
        this.ctx.save();
        this.ctx.translate(-Math.floor(this.camera.x) + screenWidth/2, -Math.floor(this.camera.y) + screenHeight/2);
        this.ctx.fillStyle = this.bgPattern; 
        this.ctx.fillRect(Math.floor(this.camera.x - screenWidth/2), Math.floor(this.camera.y - screenHeight/2), screenWidth, screenHeight);
        
        const drawList = [ ...this.gems, ...this.chests, ...this.activeEffects, ...this.enemies, this.player, ...this.allies, ...this.projectiles, ...this.collectibles ];
        drawList.sort((a,b) => a.z - b.z);
        drawList.forEach(e => { if(e.draw) e.draw(this.ctx); });
        
        this.debugSystem.draw(this.ctx, this);

        this.ctx.globalCompositeOperation = 'lighter'; this.particles.forEach(e => e.draw(this.ctx)); this.ctx.globalCompositeOperation = 'source-over';
        
        this.damageTexts.forEach(e => e.draw(this.ctx));
        this.ctx.restore();

        const grad = this.ctx.createRadialGradient(screenWidth/2, screenHeight/2, screenHeight/4, screenWidth/2, screenHeight/2, screenWidth/1.5);
        grad.addColorStop(0, 'transparent'); grad.addColorStop(1, 'rgba(0,0,0,0.7)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, screenWidth, screenHeight);
        this.ctx.restore();
    }
    
    addEventListener(eventName, callback) { if (this.eventListeners[eventName]) { this.eventListeners[eventName].push(callback); } }
    dispatch(eventName, data) {
    // Legacy event listener support
    if (this.eventListeners[eventName]) {
        this.eventListeners[eventName].forEach(callback => callback(data));
    }

    // New universal handler system for passives
    for (const passiveId in this.player.passives) {
        const passiveDef = GAME_DATA.passives.find(p => p.id === passiveId);
        if (passiveDef) {
            const source = { def: passiveDef, game: this };
            // onKill provides enemy, onPlayerHit provides player as the target of the event context
            const context = { target: data.enemy || this.player };
            this.handlerSystem.processEvent(source, eventName, context);
        }
    }
}

    getNearestEnemies(count, maxRange = Infinity) {
        if (this.enemies.length === 0) return [];
        const maxRangeSq = maxRange ** 2;
        const enemiesInRange = [];
        for (const e of this.enemies) {
            const distSq = M.distSq(this.player.x, this.player.y, e.x, e.y);
            if (distSq < maxRangeSq) {
                enemiesInRange.push({ enemy: e, distSq: distSq });
            }
        }
        return enemiesInRange.sort((a, b) => a.distSq - b.distSq).slice(0, count).map(item => item.enemy);
    }

    getEnemiesInRange(maxRange = Infinity) {
        if (this.enemies.length === 0) return [];
        const maxRangeSq = maxRange ** 2;
        const enemiesInRange = [];
        for (const e of this.enemies) {
            if (M.distSq(this.player.x, this.player.y, e.x, e.y) < maxRangeSq) {
                enemiesInRange.push(e);
            }
        }
        return enemiesInRange;
    }
    
    spawnEnemies() {
        this.spawnTimer -= this.dt;
        if (this.spawnTimer <= 0) {
            const cfg = GAME_DATA.CONFIG.SPAWNING;
            const waveSize = cfg.initialWaveSize + Math.floor(this.time / cfg.waveSizeGrowthRate);
            let nextInterval;
            if (this.time < cfg.waveIntervalRampDuration) {
                nextInterval = M.lerp(cfg.initialWaveInterval, cfg.finalWaveIntervalRamp, this.time / cfg.waveIntervalRampDuration);
            } else {
                nextInterval = M.lerp(cfg.finalWaveIntervalRamp, cfg.minimumWaveInterval, Math.min(1.0, (this.time - cfg.waveIntervalRampDuration) / cfg.lateGameRampDuration));
            }
            this.spawnTimer = nextInterval;
            for (let i = 0; i < waveSize; i++) {
                let availableTypes = [];
                GAME_DATA.SPAWN_SCHEDULE.forEach(wave => { if (this.time >= wave.time) availableTypes.push(...wave.types); });
                const typeKey = availableTypes[M.randInt(0, availableTypes.length - 1)];
                const angle = M.rand(0, Math.PI * 2);
                const dist = Math.sqrt((window.innerWidth / 2) ** 2 + (window.innerHeight / 2) ** 2) + M.rand(50, 150);
                const x = this.player.x + Math.cos(angle) * dist;
                const y = this.player.y + Math.sin(angle) * dist;
                const newEnemy = new Enemy(this, GAME_DATA.enemies[typeKey], x, y);
                const eliteCfg = GAME_DATA.CONFIG.SPAWNING;
                if (this.time > eliteCfg.eliteTimeRequirement && Math.random() < eliteCfg.eliteChance) { 
                    newEnemy.isElite = true; 
                    newEnemy.hp *= eliteCfg.eliteHpMultiplier; 
                    newEnemy.maxHp *= eliteCfg.eliteHpMultiplier; 
                    newEnemy.r *= eliteCfg.eliteSizeMultiplier; 
                    newEnemy.damage *= eliteCfg.eliteDamageMultiplier; 
                }
                this.enemies.push(newEnemy);
            }
        }
    }
    
    checkCollisions() {
    // Create a single list of all possible targets in the game.
    const allTargets = [...this.enemies, this.player];

    for (const p of this.projectiles) {
        if (!p.active) continue;

        if (p.def.clearHitListPeriodically) {
            p.hitListClearTimer -= this.dt;
            if (p.hitListClearTimer <= 0) {
                p.hitList.clear();
                p.hitListClearTimer = p.def.clearHitListPeriodically;
            }
        }

        for (const target of allTargets) {
            if (!p.active) break;
            if (target === p.owner || p.hitList.has(target)) {
                continue;
            }
            if (M.collides(p, target)) {
                p.handleCollision(target);
            }
        }
    }
}
    
    togglePause() { if (this.state === 'running') { this.state = 'paused'; S.play('ui', this.state); document.getElementById('pause-screen').style.display = 'flex'; let html = '<h3>Weapons</h3>'; this.player.weapons.forEach(w => html += `<p>${w.def.name}: Lv ${w.level}</p>`); html += '<h3>Stats</h3>'; const s = this.player.stats; html += `<p>Might: ${Math.round(s.might*100)}% | Speed: ${s.moveSpeed} | Cooldown: -${Math.round((1-s.cooldown)*100)}%</p>`; document.getElementById('pause-stats-container').innerHTML = html; } else if (this.state === 'paused') { this.state = 'running'; S.play('ui', this.state); document.getElementById('pause-screen').style.display = 'none'; this.lastTime = performance.now(); } }
    gameOver(isVictory = false) {
        this.state = 'gameover';
        try {
            fetch('/api/save/survivors', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    state: {
                        kills: this.kills,
                        time: this.time,
                        level: this.player ? this.player.level : 1,
                        isVictory: isVictory,
                        date: new Date().toISOString()
                    }
                })
            }).catch(() => {});
        } catch(e) {}
        if(isVictory) { S.play('levelup', this.state); document.getElementById('victory-screen').style.display = 'flex'; document.getElementById('go-stats-victory').innerHTML = `Time Survived <span>${M.formatTime(this.time)}</span><hr>Soul Level <span>${this.player.level}</span><hr>Fiends Slain <span>${this.kills}</span>`; } else { S.play('gameover', this.state); document.getElementById('game-over-screen').style.display = 'flex'; document.getElementById('go-stats').innerHTML = `Time Survived <span>${M.formatTime(this.time)}</span><hr>Soul Level <span>${this.player.level}</span><hr>Fiends Slain <span>${this.kills}</span>`; } }
    victory() { this.gameOver(true); }
    
    generateUpgrades() {
        const container = document.getElementById('cards-container'); container.innerHTML = '';
        document.getElementById('level-up-screen').style.display = 'flex';
        let options = [];
        this.player.weapons.forEach(w => { if (w.level < w.maxLevel) options.push({ type: 'weapon_up', obj: w }); });
        if (this.player.weapons.length < 6) { Object.keys(GAME_DATA.weapons).forEach(key => { if (!this.player.weapons.some(w => w.key === key)) { options.push({ type: 'weapon_new', key: key }); } }); }
        GAME_DATA.passives.forEach(p => { const lvl = this.player.passives[p.id] || 0; if (lvl < (p.maxLevel || 5)) options.push({ type: 'passive', def: p, lvl: lvl }); });
        if (options.length === 0) options.push({ type: 'heal' });
        
        for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
        const numChoices = GAME_DATA.CONFIG.PRESENTATION.levelUpScreen.numChoices;
        const choices = options.slice(0, Math.min(numChoices, options.length));
        choices.forEach(choice => {
            const card = document.createElement('div'); card.className = 'card'; let title, desc, typeStr, typeCol, svg;
            if (choice.type === 'weapon_up') { title = choice.obj.def.name; desc = choice.obj.getDescription(); typeStr = `Level Up: ${choice.obj.level} ➔ ${choice.obj.level+1}`; typeCol = '#4da6ff'; svg = choice.obj.getSVG(); }
            else if (choice.type === 'weapon_new') { const temp = new WeaponInstance(this, choice.key); title = temp.def.name; desc = temp.getDescription(); typeStr = "New Weapon"; typeCol = '#ffd700'; svg = temp.getSVG(); }
            else if (choice.type === 'passive') { title = choice.def.name; desc = choice.def.desc; typeStr = `Level Up: ${choice.lvl} ➔ ${choice.lvl+1}`; typeCol = '#aaa'; svg = choice.def.svg; }
            else { title = "Floor Chicken"; desc = "Heal 30% HP"; typeStr = "Consumable"; typeCol = '#4f4'; svg = `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="8" ry="6" fill="#b85d08"/><rect x="18" y="12" width="4" height="3" fill="#e3c9a6"/></svg>`; }
            card.innerHTML = `<div class="card-title">${title}</div><div class="card-icon-frame">${svg}</div><div class="card-type" style="color:${typeCol}; border-color:${typeCol}">${typeStr}</div><div class="card-desc">${desc}</div>`;
            card.onmouseenter = () => S.play('cardhover', this.state); card.onclick = () => this.selectUpgrade(choice); container.appendChild(card);
        });
    }

    selectUpgrade(choice) {
        S.play('ui', this.state);
        if (choice.type === 'weapon_up') {
            choice.obj.level++;
        } else if (choice.type === 'weapon_new') {
            this.player.addWeapon(choice.key);
        } else if (choice.type === 'passive') {
            const pDef = choice.def;
            this.player.passives[pDef.id] = (this.player.passives[pDef.id] || 0) + 1;
            if (pDef.mods) {
                pDef.mods.forEach(mod => {
                    if (mod.op === 'add') this.player.stats[mod.stat] += mod.value;
                    else if (mod.op === 'mul') this.player.stats[mod.stat] *= mod.value;
                    else if (mod.op === 'set') this.player.stats[mod.stat] = mod.value;
                });
            }
            if(pDef.onSelect) pDef.onSelect(this.player);
        } else if (choice.type === 'heal') {
            this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + this.player.stats.maxHp * GAME_DATA.CONFIG.PRESENTATION.levelUpScreen.floorChickenHeal);
            S.play('heal', this.state);
        }
        document.getElementById('level-up-screen').style.display = 'none';
        this.state = 'running';
        this.lastTime = performance.now();
    }

    updateHud() {
        const p = this.player; if (!p) return;
        document.getElementById('hp-text').innerText = Math.floor(p.hp);
        document.getElementById('hp-bar-fg').style.width = `${Math.max(0, p.hp/p.stats.maxHp)*100}%`;
        document.getElementById('lvl-text').innerText = p.level;
        document.getElementById('xp-bar-fg').style.width = `${(p.xp/p.nextLevelXp)*100}%`;
        document.getElementById('kill-text').innerText = this.kills;
        document.getElementById('time-text').innerText = M.formatTime(this.time);
        const hudCfg = GAME_DATA.CONFIG.PRESENTATION;
        const flickerRate = hudCfg.hudWarningFlickerSpeed;
        if (GAME_DATA.CONFIG.TARGET_TIME - this.time < hudCfg.hudWarningTime) { document.getElementById('time-text').style.color = (this.frameCount % flickerRate < flickerRate / 2) ? hudCfg.hudColors.timerWarning : hudCfg.hudColors.timerNormal; }
    }
    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; this.ctx.imageSmoothingEnabled = GAME_DATA.CONFIG.PRESENTATION.imageSmoothing; }
    
    // DELETED: toggleDebug() and updateDebugInfo() are now gone from the Game class.

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', e => { 
            if(e.repeat) return; 
            const k = e.key.toLowerCase(); 
            if(this.state === 'start' && k === ' ') { this.start(); } 
            if(this.state === 'gameover' && k === 'r') { S.play('ui', this.state); this.start(); } 
            if ('wasd'.includes(k) || k.startsWith('arrow')) { 
                if (k === 'w' || k === 'arrowup') this.input.up = true; 
                if (k === 's' || k === 'arrowdown') this.input.down = true; 
                if (k === 'a' || k === 'arrowleft') this.input.left = true; 
                if (k === 'd' || k === 'arrowright') this.input.right = true; 
            } 
            if (k === 'escape' && (this.state === 'running' || this.state === 'paused')) { this.togglePause(); } 
            // MODIFIED: The 'P' key now calls the debug system's toggle method.
            if (k === 'p') { this.debugSystem.toggle(); } 
            if (k === 'm') S.toggleMute(); 
        });
        window.addEventListener('keyup', e => { 
            const k = e.key.toLowerCase(); 
            if ('wasd'.includes(k) || k.startsWith('arrow')) { 
                if (k === 'w' || k === 'arrowup') this.input.up = false; 
                if (k === 's' || k === 'arrowdown') this.input.down = false; 
                if (k === 'a' || k === 'arrowleft') this.input.left = false; 
                if (k === 'd' || k === 'arrowright') this.input.right = false; 
            } 
        });
        // MODIFIED: The debug button now calls the debug system's toggle method.
        document.getElementById('mute-btn').onclick = () => S.toggleMute(); 
        document.getElementById('debug-btn').onclick = () => this.debugSystem.toggle();
    }
}

// =========================================================================
// 9. GAME INITIALIZATION
// =========================================================================
const game = new Game();

// =========================================================================
// 10. DEBUG CONSOLE COMMANDS
// =========================================================================
window.exec = function(commandString) {
    if (!game || (game.state !== 'running' && game.state !== 'paused')) {
        console.warn("Game not active or paused. Cannot execute command.");
        return;
    }

    const args = commandString.trim().split(' ');
    const command = args.shift().toLowerCase();
    const player = game.player;

    switch (command) {
        case 'radius':
            const radius = parseInt(args[0]);
            if (!isNaN(radius) && radius > 0) {
                game.debugSystem.addShape({ type: 'radius_circle', radius: radius, life: 30.0 });
                console.log(`Drawing debug radius of ${radius} for 30 seconds.`);
            } else {
                console.error("Usage: radius [number]. Example: radius 400");
            }
            break;

        case 'give':
            const itemType = args[0]?.toLowerCase();
            const itemName = args[1]?.toLowerCase();
            const level = parseInt(args[2]);

            if (itemType !== 'weapon' || !itemName || isNaN(level)) {
                console.error("Usage: give weapon [weapon_key] [level]. Example: give weapon axe 8");
                return;
            }
            if (!GAME_DATA.weapons[itemName]) {
                console.error(`Weapon key '${itemName}' not found in GAME_DATA.`);
                return;
            }

            let existingWeapon = player.weapons.find(w => w.key === itemName);
            if (existingWeapon) {
                existingWeapon.level = Math.max(1, level);
                console.log(`Set level of ${existingWeapon.def.name} to ${existingWeapon.level}.`);
            } else {
                if (player.weapons.length >= 6) {
                    console.warn("Cannot add new weapon; inventory is full (6/6).");
                    return;
                }
                player.addWeapon(itemName);
                const newWeapon = player.weapons[player.weapons.length - 1];
                newWeapon.level = Math.max(1, level);
                console.log(`Gave player ${newWeapon.def.name} at level ${newWeapon.level}.`);
            }
            break;

        case 'spawn':
            const enemyKey = args[0]?.toLowerCase();
            const count = parseInt(args[1]);

            if (!enemyKey || isNaN(count) || count <= 0) {
                console.error("Usage: spawn [enemy_key] [count]. Example: spawn bat 50");
                return;
            }
            if (!GAME_DATA.enemies[enemyKey]) {
                console.error(`Enemy key '${enemyKey}' not found in GAME_DATA.`);
                return;
            }

            for (let i = 0; i < count; i++) {
                const angle = M.rand(0, Math.PI * 2);
                const dist = Math.sqrt((window.innerWidth / 2) ** 2 + (window.innerHeight / 2) ** 2) + M.rand(50, 150);
                const x = player.x + Math.cos(angle) * dist;
                const y = player.y + Math.sin(angle) * dist;
                const newEnemy = new Enemy(game, GAME_DATA.enemies[enemyKey], x, y);
                game.enemies.push(newEnemy);
            }
            console.log(`Spawned ${count} of '${enemyKey}'.`);
            break;

        default:
            console.error(`Unknown command: '${command}'`);
            break;
    }
}