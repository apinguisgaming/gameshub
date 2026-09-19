/**
 * Engine Layer
 * Modular, Object-Oriented JavaScript.
 */

class AssetManager {
    constructor() { 
        this.cache = {}; 
        this.boundsCache = {}; // Stores { offsetX, offsetY } for each sprite key
    }
    
    loadImage(key, path, analyzeGrid = false) {
        return new Promise((resolve) => {
            if (this.cache[key]) { resolve(this.cache[key]); return; }
            const img = new Image();
            img.onload = () => { 
                this.cache[key] = { img, loaded: true }; 
                if (analyzeGrid) { this.calculateSpriteBounds(key, img); }
                resolve(this.cache[key]); 
            };
            img.onerror = () => { this.cache[key] = { img: null, loaded: false }; resolve(this.cache[key]); };
            img.src = path;
        });
    }

    getImage(key) { return this.cache[key]; }

    /**
     * Smart Placement: Analyzes the first frame of a spritesheet to find actual pixel bounds.
     * We want to find the offset needed to move the 'visual center/bottom' to (0,0).
     */
    calculateSpriteBounds(key, img) {
        const sw = img.width / 4;
        const sh = img.height / 4;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the first frame (usually front-facing)
        tempCtx.drawImage(img, 0, 0, sw, sh, 0, 0, sw, sh);
        const imageData = tempCtx.getImageData(0, 0, sw, sh).data;
        
        let minX = sw, minY = sh, maxX = 0, maxY = 0;
        let hasPixels = false;

        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const alpha = imageData[(y * sw + x) * 4 + 3];
                if (alpha > 50) { // Slight threshold for noise
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                    hasPixels = true;
                }
            }
        }

        if (hasPixels) {
            // We want the logical center of the POI (Point of Interest) to be at 0,0.
            // Or better yet, the visual feet to be at 0,0 if it's a character.
            // Let's go with visual center for general placement.
            const visualCenterX = (minX + maxX) / 2;
            const visualCenterY = (minY + maxY) / 2;
            
            // The offset is what we subtract from the draw call to put the visual center at the target point.
            this.boundsCache[key] = {
                offsetX: (sw / 2) - visualCenterX,
                offsetY: (sh / 2) - visualCenterY 
            };
        } else {
            this.boundsCache[key] = { offsetX: 0, offsetY: 0 };
        }
    }

    getOffset(key) {
        return this.boundsCache[key] || { offsetX: 0, offsetY: 0 };
    }
}

function getDirection(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 2 : 1;
    else return dy > 0 ? 0 : 3;
}

class FloatingText {
    constructor(x, y, text, color, duration = 1.0) {
        this.x = x; this.y = y; this.text = text; this.color = color;
        this.baseDuration = duration; this.life = duration; this.vy = -35;
    }
    update(dt) { this.life -= dt; this.y += this.vy * dt; }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life / this.baseDuration);
        ctx.fillStyle = this.color; ctx.font = '8px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText(this.text, this.x, this.y); ctx.restore();
    }
}

class StatusEffectManager {
    constructor(target) { this.target = target; this.effects = {}; }
    hasEffect(effectId) { return !!this.effects[effectId]; }
    applyEffect(effectId) {
        const effectData = GameData.statusEffects[effectId]; if (!effectData) return;
        if (this.effects[effectId]) this.effects[effectId].duration = effectData.duration;
        else this.effects[effectId] = { data: effectData, duration: effectData.duration, timer: 0 };
    }
    update(dt) {
        const isLimber = this.target.ability === 'limber';
        const isMagicGuard = this.target.ability === 'magic_guard';
        
        for (const [id, e] of Object.entries(this.effects)) {
            // Limber check
            if (isLimber && (id === 'paralyze' || id === 'freeze')) {
                delete this.effects[id]; continue;
            }

            e.duration -= dt;
            if (e.data.tickRate > 0) {
                e.timer += dt; 
                if (e.timer >= 1 / e.data.tickRate) { 
                    e.timer -= 1 / e.data.tickRate; 
                    // Magic Guard ignores DoT damage
                    if (!isMagicGuard) {
                        this.target.takeDamage(e.data.damagePerTick, null, false); 
                        if (this.target.game) this.target.game.addFloatingText(this.target.x, this.target.y - 20, Math.floor(e.data.damagePerTick).toString(), e.data.color); 
                    }
                }
            }
            if (e.duration <= 0) delete this.effects[id];
        }
    }
    getSpeedModifier() {
        let mod = 1.0; for (const e of Object.values(this.effects)) { if (e.data.stunned) return 0; if (e.data.speedModifier !== undefined) mod *= e.data.speedModifier; }
        return mod;
    }
    getFilter() {
        if (this.effects['freeze']) return 'brightness(1.2) sepia(1) hue-rotate(180deg) saturate(2)';
        if (this.effects['paralyze']) return 'brightness(1.5) sepia(1) hue-rotate(20deg) saturate(3)';
        if (this.effects['burn']) return 'brightness(0.8) sepia(1) hue-rotate(-30deg) saturate(3)';
        if (this.target.isFrisked) return 'brightness(1.2) contrast(1.2) saturate(1.5)';
        return 'none';
    }
}

class Enemy {
    constructor(game, dataId, abilityChanceOverride = null, bountyValue = 0) {
        this.game = game; this.dataId = dataId; this.data = GameData.enemies[dataId]; this.waypoints = GameData.mapConfig;
        this.x = this.waypoints[0].x; this.y = this.waypoints[0].y; this.waypointIndex = 1; this.health = this.data.hp; this.maxHealth = this.data.hp;
        this.bountyValue = bountyValue;
        this.statusManager = new StatusEffectManager(this); this.alive = true; this.distTravelled = 0; this.direction = 0; this.frame = 0; this.animTimer = 0;
        this.illusionHits = 0; this.isFrisked = false;
        
        // Randomize Ability
        this.ability = null;
        const chance = abilityChanceOverride ?? this.data.abilityChance ?? 0;
        const possible = this.data.possibleAbilities ?? [];
        if (Math.random() < chance && possible.length > 0) {
            this.ability = possible[Math.floor(Math.random() * possible.length)];
        }
        if (this.ability === 'illusion') this.illusionHits = GameData.enemyAbilities['illusion'].shieldHits;
    }
    update(dt) {
        if (!this.alive) return; 
        this.statusManager.update(dt); 
        if (!this.alive) return;
        
        const wp = this.waypoints[this.waypointIndex]; 
        if (!wp) { this.game.loseLives(1); this.alive = false; return; }
        
        const dx = wp.x - this.x; const dy = wp.y - this.y; const distToWp = Math.hypot(dx, dy);
        this.direction = getDirection(dx, dy);

        // Update current terrain reference
        const col = Math.floor(this.x / GameData.config.gridSize);
        const row = Math.floor(this.y / GameData.config.gridSize);
        this.currentTerrain = this.game.terrainLookup[`${col},${row}`] || 'land';
        
        let abilityMult = 1.0;    
        if (this.statusManager.hasEffect('poison')) {
            const towersNearby = this.game.towers.filter(t => t.abilities && t.abilities.includes('merciless') && Math.hypot(t.x - this.x, t.y - this.y) <= t.computedStats.range);
            towersNearby.forEach(t => { t.isMercilessActive = true; }); 
        }
        
        if (this.ability) {
            const ab = GameData.enemyAbilities[this.ability];
            if (ab && ab.type === 'scaling') {
                this.speedScale = (this.speedScale || 1.0) + (dt * ab.speedIncreasePerSec);
            }
            if (ab && ab.type === 'tick') {
                this.regenTimer = (this.regenTimer || 0) + dt;
                if (this.regenTimer >= ab.tickInterval) {
                    this.health = Math.min(this.maxHealth, this.health + (this.maxHealth * ab.healPercent));
                    this.regenTimer = 0;
                }
            }
            if (ab && ab.type === 'drain') {
                this.game.money = Math.max(0, this.game.money - (ab.drainPerSec * dt));
            }
            if (ab && (ab.type === 'conditional' || ab.id === 'guts')) {
                const triggerStatuses = ab.triggerStatuses || ['burn', 'paralyze', 'poison'];
                const hasStatus = Object.keys(this.statusManager.effects).some(s => triggerStatuses.includes(s));
                if (hasStatus) abilityMult *= ab.speedMultiplier;
            }
        }
        
        // --- Aura Detection (Intimidate, etc.) ---
        let minSpeedMod = 1.0;
        this.game.towers.forEach(t => {
            if (t.abilities && t.abilities.includes('intimidate')) {
                if (Math.hypot(t.x - this.x, t.y - this.y) <= t.computedStats.range) {
                    const ab = GameData.towerAbilities['intimidate'];
                    if (ab.modifier < minSpeedMod) minSpeedMod = ab.modifier;
                }
            }
        });
        abilityMult *= minSpeedMod;
        
        let speed = this.data.spd * this.statusManager.getSpeedModifier() * (this.speedScale || 1.0) * abilityMult;
        if (speed > 0) { this.animTimer += dt * (speed / 10); this.frame = Math.floor(this.animTimer) % 4; }
        const moveDist = speed * dt;
        if (distToWp <= moveDist) { this.x = wp.x; this.y = wp.y; this.waypointIndex++; this.distTravelled += distToWp; }
        else { this.x += (dx / distToWp) * moveDist; this.y += (dy / distToWp) * moveDist; this.distTravelled += moveDist; }

        // Shadow Tag Lock (Lock nearby towers)
        if (this.ability === 'shadow_tag') {
            this.game.towers.forEach(t => {
                if (Math.hypot(t.x - this.x, t.y - this.y) <= (GameData.enemyAbilities['shadow_tag'].lockRange || 100)) {
                    t.isUILocked = true;
                }
            });
        }
    }
    takeDamage(amount, penetration = 0, crit = false, sourceTower = null, moveData = null) {
        let finalMult = 1.0;
        if (this.ability) {
            const ab = GameData.enemyAbilities[this.ability];
            const isMoldBreaker = sourceTower?.abilities?.includes('mold_breaker');
            if (ab && ab.type === 'resistance' && sourceTower && !isMoldBreaker) {
                const tags = moveData ? moveData.tags || [] : (sourceTower.data.tags || []);
                const intersects = ab.resists.some(r => tags.includes(r));
                if (intersects) finalMult *= ab.resistMultiplier;
            }
            if (ab && (ab.type === 'proximity_resist' || ab.id === 'pack_hunter')) {
                const nearby = this.game.enemies.filter(e => e !== this && e.alive && Math.hypot(e.x - this.x, e.y - this.y) <= 50).length;
                finalMult *= Math.max(0.1, 1 - (nearby * ab.resistPerAlly));
            }
        }

        let effArmor = 0;
        let isSpecial = moveData?.category === 'special';
        let relevantDef = isSpecial ? (this.data.spDef || 0) : (this.data.def || 0);

        // Sand Hide (Terrain Check)
        if (this.ability === 'sand_hide' && !isSpecial) {
            const ab = GameData.enemyAbilities['sand_hide'];
            if (this.currentTerrain === ab.terrain) relevantDef *= ab.multiplier;
        }

        // Unaware Check
        if (this.ability === 'unaware' || (this.ability && GameData.enemyAbilities[this.ability].type === 'stat_ignore')) {
            // Strip level-up multipliers and items
            if (sourceTower) {
                const baseStats = sourceTower.data.baseStats;
                const baseAtk = isSpecial ? (baseStats.spatk || 0) : (baseStats.atk || 0);
                // Apply the same normalization (/ 10) to the unaware override
                amount = (baseAtk * (moveData?.power || 1.0)) / 10;
                penetration = baseStats.armorPenetration || 0;
            }
            effArmor = relevantDef;
        } else {
            effArmor = Math.max(0, relevantDef - (penetration || 0));
        }

        let effDmg = Math.max(1, amount - effArmor) * finalMult;
        
        // Illusion Check
        if (this.ability === 'illusion' && this.illusionHits > 0) {
            effDmg = 1; this.illusionHits--;
            if (this.game) this.game.addFloatingText(this.x, this.y - 15, "BLOCK", "#94a3b8");
        }
        
        // --- Sturdy Check (Condition: Full HP) ---
        const isSturdy = this.ability === 'sturdy' && !this.sturdyUsed;
        const isMoldBreaker = sourceTower?.abilities?.includes('mold_breaker');
        if (isSturdy && !isMoldBreaker && this.health === this.maxHealth && effDmg >= this.health) {
            effDmg = this.health - 1;
            this.sturdyUsed = true;
            if (this.game && amount > 0) this.game.addFloatingText(this.x, Math.max(0, this.y - 20), "STURDY", "#cbd5e1");
        }
        
        // --- Recoil Stun (On Hit) ---
        if (this.ability && sourceTower) {
            const ab = GameData.enemyAbilities[this.ability];
            if (ab && ab.type === 'recoil_stun' && ab.trigger === 'on_hit') {
                let duration = ab.stunDuration;
                let minResist = 1.0;
                this.game.towers.forEach(t => {
                    if (t.abilities && t.abilities.includes('friend_guard')) {
                        if (Math.hypot(t.x - sourceTower.x, t.y - sourceTower.y) <= t.computedStats.range) {
                            let res = GameData.towerAbilities['friend_guard'].resist;
                            if (res < minResist) minResist = res;
                        }
                    }
                });
                duration *= minResist;
                sourceTower.stunTimer = Math.max(sourceTower.stunTimer || 0, duration);
                if (this.game) this.game.addFloatingText(sourceTower.x, sourceTower.y, `STUNNED!`, "#ef4444", 0.8);
            }
        }

        const actualHit = Math.min(this.health, effDmg);
        const overkill = Math.max(0, effDmg - this.health);
        
        this.health -= effDmg; 
        
        if (this.game && this.game.trackDamage) this.game.trackDamage(sourceTower, actualHit, overkill);
        if (this.game && amount > 0 && this.game.addFloatingText) this.game.addFloatingText(this.x, Math.max(0, this.y - 10), Math.round(effDmg).toString(), crit ? '#fbbf24' : '#ffffff');
        
        // Emergency Exit
        if (this.ability === 'emergency_exit' && (this.health / this.maxHealth) < GameData.enemyAbilities['emergency_exit'].hpThreshold && !this.hasExited) {
             this.distTravelled += GameData.enemyAbilities['emergency_exit'].teleportDist;
             this.hasExited = true;
             // Teleport along path
             let currentDist = 0;
             for (let i = 0; i < this.waypoints.length - 1; i++) {
                 let d = Math.hypot(this.waypoints[i+1].x - this.waypoints[i].x, this.waypoints[i+1].y - this.waypoints[i].y);
                 if (currentDist + d > this.distTravelled) {
                     let ratio = (this.distTravelled - currentDist) / d;
                     this.x = this.waypoints[i].x + (this.waypoints[i+1].x - this.waypoints[i].x) * ratio;
                     this.y = this.waypoints[i].y + (this.waypoints[i+1].y - this.waypoints[i].y) * ratio;
                     this.waypointIndex = i + 1;
                     break;
                 }
                 currentDist += d;
             }
             if (this.game) this.game.addFloatingText(this.x, this.y, "EXIT!", "#8b5cf6");
        }

        if (this.health <= 0) { 
            this.alive = false; 
            if (this.ability && sourceTower) {
                const ab = GameData.enemyAbilities[this.ability];
                if (ab && ab.type === 'recoil_stun' && ab.trigger === 'on_death') {
                    let duration = ab.stunDuration || 3.0;
                    let minResist = 1.0;
                    this.game.towers.forEach(t => {
                        if (t.abilities && t.abilities.includes('friend_guard')) {
                            if (Math.hypot(t.x - sourceTower.x, t.y - sourceTower.y) <= t.computedStats.range) {
                                let res = GameData.towerAbilities['friend_guard'].resist;
                                if (res < minResist) minResist = res;
                            }
                        }
                    });
                    duration *= minResist;
                    sourceTower.stunTimer = Math.max(sourceTower.stunTimer || 0, duration);
                    if (this.game) this.game.addFloatingText(sourceTower.x, sourceTower.y, "STUNNED!", "#ef4444");
                }
            }
            if (sourceTower) {
                // Moxie Growth
                if (sourceTower.abilities && sourceTower.abilities.includes('moxie')) {
                    sourceTower.moxieKills = (sourceTower.moxieKills || 0) + 1;
                    sourceTower.calculateStats(); 
                }
                // Pickup Item
                if (sourceTower.abilities && sourceTower.abilities.includes('pickup')) {
                    const ab = GameData.towerAbilities['pickup'];
                    if (Math.random() < ab.chance) {
                        this.game.money += ab.bonusMoney;
                        this.game.addFloatingText(this.x, this.y, `+$${ab.bonusMoney}`, "#facc15");
                    }
                }
            }
            this.game.enemyKilled(this, sourceTower); 
        }
    }
    draw(ctx) {
        const key = 'enemy_walk_' + this.dataId;
        const asset = this.game.assetManager.getImage(key); 
        ctx.save(); 
        ctx.translate(this.x, this.y);
        
        if (asset && asset.loaded) {
            const offset = this.game.assetManager.getOffset(key);
            ctx.filter = this.statusManager.getFilter();
            this.game.drawSpritesheet(ctx, asset.img, this.direction, this.frame, 52, offset, -10);
            ctx.filter = 'none';
        }
        // Design-accurate Life Bar (Pixel Art style with shadow)
        const hpPerc = this.health / this.maxHealth;
        const barW = 32; const barH = 5; const bx = -16; const by = -28;
        
        // Shadow/Border (Black)
        ctx.fillStyle = '#000';
        ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
        
        // Background (Red)
        ctx.fillStyle = '#cf1322';
        ctx.fillRect(bx, by, barW, barH);
        
        // Progress (Green)
        if (hpPerc > 0) {
            ctx.fillStyle = '#3f9237';
            ctx.fillRect(bx, by, barW * hpPerc, barH);
        }
        ctx.restore();
    }
}

class PersistentZone {
    constructor(game, x, y, data, stats, tower) {
        this.game = game; this.x = x; this.y = y; this.data = data; this.stats = stats; this.tower = tower;
        this.duration = data.zoneDuration; this.tickTimer = 0;
    }
    update(dt) {
        this.duration -= dt; this.tickTimer += dt;
        if (this.tickTimer >= 1.0) {
            this.tickTimer -= 1.0;
            this.game.enemies.forEach(e => {
                if (e.alive && Math.hypot(e.x - this.x, e.y - this.y) <= this.data.zoneRadius) {
                    if (e.ability && GameData.enemyAbilities[e.ability].ignoreGround) return;
                    e.takeDamage(this.stats.damage, this.stats.armorPenetration, false);
                    if (this.data.applyStatus) e.statusManager.applyEffect(this.data.applyStatus);
                }
            });
        }
    }
    draw(ctx) {
        ctx.save(); ctx.globalAlpha = Math.min(0.5, this.duration);
        ctx.fillStyle = this.data.applyStatus === 'burn' ? '#ea580c' : '#a855f7';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.data.zoneRadius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Projectile {
    constructor(game, x, y, target, tower, moveData) {
        this.game = game; this.x = x; this.y = y; this.target = target; this.tower = tower;
        this.stats = tower.computedStats; this.data = moveData; 
        this.moveData = moveData;
        
        // Merciless Check
        let isMerciless = this.tower.abilities && this.tower.abilities.includes('merciless');
        let targetPoisoned = target.statusManager.hasEffect('poison');
        
        this.isCrit = isMerciless && targetPoisoned ? true : (Math.random() < this.stats.critChance);
        this.damage = this.stats.damage * (this.isCrit ? this.stats.critMultiplier : 1.0); 
        this.alive = true;
        this.chainCount = 0; this.chainHitList = [];
    }
    update(dt) {
        if (!this.alive) return; if (!this.target.alive && this.data.attackType !== 'zone' && this.data.attackType !== 'chain') { this.alive = false; return; }
        
        let dx = this.target.x - this.x; let dy = this.target.y - this.y; 
        if (!this.target.alive) { dx = (this.lastTargetX || this.target.x) - this.x; dy = (this.lastTargetY || this.target.y) - this.y; }
        else { this.lastTargetX = this.target.x; this.lastTargetY = this.target.y; }
        
        let isNoGuard = this.tower.abilities && this.tower.abilities.includes('no_guard');
        let dist = Math.hypot(dx, dy); const moveDist = isNoGuard ? 9999 : this.data.projectileSpeed * dt;
        if (dist <= moveDist || dist === 0) { 
            let cont = this.applyHit(this.target); 
            if (!cont) this.alive = false; 
        }
        else { this.x += (dx / dist) * moveDist; this.y += (dy / dist) * moveDist; }
    }
    applyHit(enemy) {
        let isMoldBreaker = this.tower.abilities && this.tower.abilities.includes('mold_breaker');
        let ignoreEnemyAbilities = false;
        if (isMoldBreaker) { ignoreEnemyAbilities = true; }

        if (!ignoreEnemyAbilities && enemy.ability) {
            const enemyAb = GameData.enemyAbilities[enemy.ability];
            if (enemyAb && enemyAb.type === 'ignore_secondary') {
                // If the enemy has an ability that ignores secondary effects,
                // and this projectile's attackType is 'splash', 'zone', or 'chain',
                // then we should not apply those effects.
                if (this.data.attackType === 'splash' || this.data.attackType === 'zone' || this.data.attackType === 'chain') {
                    // For now, we'll just prevent the splash/zone/chain effect entirely if it's meant to be ignored.
                    // A more nuanced approach might be needed if 'ignore_secondary' only applies to status effects.
                    // For this change, we'll assume it means the secondary attack type itself.
                    // However, the original code didn't have this check, so let's stick to the original intent
                    // and only apply this if the ability specifically prevents the *damage* or *status* from secondary types.
                    // The instruction only asks to replace GameData.abilities, not to change logic unless specified.
                    // The provided snippet for Projectile.applyHit is not complete, so I'll integrate the `isMoldBreaker` and `enemyAb` checks carefully.
                }
            }
        }

        if (this.data.attackType === 'splash') { 
            for (let e of this.game.enemies) { 
                if (e.alive && Math.hypot(e.x - enemy.x, e.y - enemy.y) <= this.data.splashRadius) { 
                    // Shield Dust Check
                    if (e.ability === 'shield_dust' && !isMoldBreaker) continue;
                    e.takeDamage(this.damage, this.stats.armorPenetration, this.isCrit, this.tower, this.moveData); 
                    this.applyOnHitAbilities(e); 
                     if (this.data.applyStatus) {
                        let chance = this.data.statusChance || 1.0;
                        if (this.tower.abilities?.includes('serene_grace')) chance *= 2;
                        if (Math.random() < chance) e.statusManager.applyEffect(this.data.applyStatus);
                    }
                } 
            } return false; 
        }
        else if (this.data.attackType === 'zone') {
            this.game.zones.push(new PersistentZone(this.game, enemy.x, enemy.y, this.data, this.stats, this.tower));
            return false;
        }
        else if (this.data.attackType === 'chain') {
            if (enemy.alive) { 
                enemy.takeDamage(this.damage, this.stats.armorPenetration, this.isCrit, this.tower, this.moveData); 
                this.applyOnHitAbilities(enemy); 
                if (this.data.applyStatus && !(enemy.ability === 'shield_dust' && !isMoldBreaker)) {
                let chance = this.data.statusChance || 1.0;
                if (this.tower.abilities?.includes('serene_grace')) chance *= 2;
                if (Math.random() < chance) enemy.statusManager.applyEffect(this.data.applyStatus); 
            }
            }
            this.chainHitList.push(enemy);
            if (this.chainCount < this.data.chainCount - 1) {
                let next = this.game.enemies.find(e => e.alive && !this.chainHitList.includes(e) && Math.hypot(e.x - enemy.x, e.y - enemy.y) <= this.data.chainRadius);
                if (next) { this.target = next; this.x = enemy.x; this.y = enemy.y; this.chainCount++; return true; }
            }
            return false;
        }
        else { if (enemy.alive) { 
            enemy.takeDamage(this.damage, this.stats.armorPenetration, this.isCrit, this.tower, this.moveData); 
            this.applyOnHitAbilities(enemy); 
            if (this.data.applyStatus) {
                const hasShieldDust = enemy.ability === 'shield_dust' && !isMoldBreaker;
                if (!hasShieldDust) {
                    let chance = this.data.statusChance || 1.0;
                    if (this.tower.abilities?.includes('serene_grace')) chance *= 2;
                    if (Math.random() < chance) enemy.statusManager.applyEffect(this.data.applyStatus);
                }
            }
        } return false; }
    }
    applyOnHitAbilities(enemy) {
        if (!this.tower.abilities) return;
        this.tower.abilities.forEach(aId => {
            const ab = GameData.towerAbilities[aId];
            if (ab && ab.type === 'on_hit') {
                let chance = ab.statusChance;
                if (this.tower.abilities.includes('serene_grace')) chance *= GameData.towerAbilities['serene_grace'].multiplier;
                if (Math.random() < chance) {
                    const isMoldBreaker = this.tower.abilities?.includes('mold_breaker');
                    if (enemy.ability === 'shield_dust' && !isMoldBreaker) return;
                    enemy.statusManager.applyEffect(ab.applyStatus);
                    this.game.addFloatingText(enemy.x, enemy.y - 25, ab.applyStatus.toUpperCase(), '#ffffff', 0.8);
                }
            }
        });
    }
    draw(ctx) {
        ctx.fillStyle = '#ffffff'; if (this.data.applyStatus === 'burn') ctx.fillStyle = '#f97316'; else if (this.data.applyStatus === 'freeze') ctx.fillStyle = '#38bdf8'; else if (this.data.applyStatus === 'paralyze') ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); ctx.fill();
    }
}

class Tower {
    constructor(game, dataId, x, y, abilitySlot = null, savedUnlockedMoves = null, savedCurrentMoveId = null, savedNature = null) {
        this.game = game; this.x = x; this.y = y; this.level = 1; this.heldItem = null; this.targetingPriority = 'first'; this.cooldown = 0; this.direction = 0;
        const col = Math.floor(x / GameData.config.gridSize);
        const row = Math.floor(y / GameData.config.gridSize);
        this.terrain = this.game.terrainLookup[`${col},${row}`] || 'land';
        
        const natureKeys = Object.keys(GameData.natures);
        this.nature = savedNature || natureKeys[Math.floor(Math.random() * natureKeys.length)];

        this.data = GameData.towers[dataId];
        this.abilitySlot = abilitySlot;
        this.unlockedMoves = savedUnlockedMoves || [];
        this.currentMoveId = savedCurrentMoveId || null;
        
        if (this.abilitySlot === null) {
            const possible = this.data.possibleAbilities || [];
            if (possible.length > 0) {
                this.abilitySlot = Math.floor(Math.random() * possible.length);
            } else {
                this.abilitySlot = 0;
            }
        }
        
        this.setData(dataId);
    }
    setData(dataId) { 
        this.dataId = dataId; 
        this.data = GameData.towers[dataId]; 
        this.abilities = [];
        const possible = this.data.possibleAbilities || [];
        if (possible.length > 0) {
            const slot = Math.min(this.abilitySlot, possible.length - 1);
            this.abilities = [possible[slot]];
        } else if (this.data.abilities) {
            this.abilities = [...this.data.abilities];
        }
        this.updateLearnsetMoves();
        this.calculateStats(); 
    }
    updateLearnsetMoves() {
        if (!this.data.learnset) return;
        this.data.learnset.forEach(m => {
            if (this.level >= m.level && !this.unlockedMoves.includes(m.moveId)) {
                this.unlockedMoves.push(m.moveId);
                if (!this.currentMoveId) this.currentMoveId = m.moveId;
            }
        });
        if (!this.currentMoveId && this.unlockedMoves.length > 0) {
            this.currentMoveId = this.unlockedMoves[0];
        }
    }
    equipItem(itemId) { this.heldItem = itemId; this.calculateStats(); }
    levelUp() { this.level++; if (this.data.evolution && this.level >= this.data.evolution.targetLevel) this.setData(this.data.evolution.nextTowerId); else this.updateLearnsetMoves(); this.calculateStats(); this.game.recalcAllStats(); }
    calculateStats() {
        const levelScale = 1 + ((this.level - 1) * 0.15);
        let moveData = this.currentMoveId ? GameData.moves[this.currentMoveId] : null;
        let movePower = moveData ? moveData.power : 1.0;
        let speedMod = moveData ? moveData.speedModifier : 1.0;
        let isSpecial = moveData?.category === 'special';

        let natureObj = GameData.natures[this.nature] || { atk: 1.0, spatk: 1.0, spd: 1.0 };
        const baseStatValue = isSpecial ? (this.data.baseStats.spatk || 0) : (this.data.baseStats.atk || 0);
        const natureMod = isSpecial ? natureObj.spatk : natureObj.atk;

        const scaledAtk = baseStatValue * levelScale * natureMod;
        
        // Normalization: Divide raw stat block by 10 to balance against enemy HP pools
        const rawDamage = (scaledAtk * movePower) / 10;
        
        this.computedStats = { 
            damage: rawDamage, 
            range: this.data.baseStats.range, 
            spd: this.data.baseStats.spd * speedMod * natureObj.spd, 
            critChance: this.data.baseStats.critChance, 
            critMultiplier: this.data.baseStats.critMultiplier, 
            armorPenetration: this.data.baseStats.armorPenetration 
        };
        
        // Moxie Scaling
        if (this.abilities && this.abilities.includes('moxie')) {
            const moxieAb = GameData.towerAbilities['moxie'];
            const bonus = Math.min(moxieAb.cap, (this.moxieKills || 0) * moxieAb.dmgBonusPerKill);
            this.computedStats.damage *= (1 + bonus);
        }

        let dmgMult = 1.0, atkSpdMult = 1.0, rangeMult = 1.0;
        
        // Aura Context (Unique Auras only)
        const activeAuras = new Set();
        let symbiosisDmgMod = 1.0, symbiosisSpdMod = 1.0;
        if (this.game && this.game.towers) {
            for (let other of this.game.towers) {
                if (other === this) continue;
                const dist = Math.hypot(other.x - this.x, other.y - this.y);
                const abilities = other.abilities || [];
                
                if (abilities.includes('battery') && dist <= 50) activeAuras.add('battery');
                if (abilities.includes('symbiosis') && dist <= other.computedStats.range && other.heldItem) {
                    const item = GameData.items[other.heldItem];
                    const factor = GameData.towerAbilities['symbiosis'].shareFactor;
                    if (item.stats.damageMultiplier) {
                        let m = 1 + (item.stats.damageMultiplier - 1) * factor;
                        if (m > symbiosisDmgMod) symbiosisDmgMod = m;
                    }
                    if (item.stats.attackSpeedMultiplier) {
                        let m = 1 + (item.stats.attackSpeedMultiplier - 1) * factor;
                        if (m > symbiosisSpdMod) symbiosisSpdMod = m;
                    }
                }
                if (other.currentMoveId && GameData.moves[other.currentMoveId].attackType === 'aura' && GameData.moves[other.currentMoveId].auraType === 'buff_atk_spd' && dist <= other.computedStats.range) {
                    activeAuras.add('buff_atk_spd');
                }
            }
        }
        
        dmgMult *= symbiosisDmgMod;
        atkSpdMult *= symbiosisSpdMod;
        
        if (activeAuras.has('battery')) atkSpdMult *= GameData.towerAbilities['battery'].auraMultiplier;
        if (activeAuras.has('buff_atk_spd')) {
            const bestAura = this.game.towers.find(t => t.currentMoveId && GameData.moves[t.currentMoveId].attackType === 'aura' && GameData.moves[t.currentMoveId].auraType === 'buff_atk_spd');
            if (bestAura) atkSpdMult *= GameData.moves[bestAura.currentMoveId].auraMultiplier;
        }

        if (this.heldItem) {
            const item = GameData.items[this.heldItem];
            if (item && item.stats) {
                if (item.stats.damageMultiplier) dmgMult *= item.stats.damageMultiplier;
                if (item.stats.attackSpeedMultiplier) atkSpdMult *= item.stats.attackSpeedMultiplier;
                if (item.stats.critChanceBonus) this.computedStats.critChance += item.stats.critChanceBonus;
                if (item.stats.critMultiplierBonus) this.computedStats.critMultiplier += item.stats.critMultiplierBonus;
            }
        }
        
        if (this.abilities) {
            for (let aId of this.abilities) {
                const ab = GameData.towerAbilities[aId]; if (!ab) continue;
                if (ab.type === 'low_hp_boost' || ['overgrow', 'blaze', 'torrent', 'swarm'].includes(ab.id)) {
                    if (this.game.lives <= GameData.config.startingLives * ab.threshold) {
                        if (ab.dmgMultiplier) dmgMult *= ab.dmgMultiplier;
                        if (ab.speedMultiplier) atkSpdMult *= ab.speedMultiplier;
                    }
                }
                if (ab.type === 'passive' || ab.id === 'huge_power' || ab.id === 'technician') {
                    if (ab.dmgMultiplier) dmgMult *= ab.dmgMultiplier;
                    if (ab.atkSpeedMultiplier) atkSpdMult *= ab.atkSpeedMultiplier;
                }
                if (ab.critChanceBonus) this.computedStats.critChance += ab.critChanceBonus;
                if (ab.critMultBonus) this.computedStats.critMultiplier += ab.critMultBonus;
                if (ab.rangeMultiplier) rangeMult *= ab.rangeMultiplier;
                if (ab.type === 'terrain' && ab.terrain === this.terrain) {
                    if (ab.dmgMultiplier) dmgMult *= ab.dmgMultiplier;
                    if (ab.speedMultiplier) atkSpdMult *= ab.speedMultiplier;
                    if (ab.rangeMultiplier) rangeMult *= ab.rangeMultiplier;
                }
                if (ab.id === 'helping_hand') {
                    const allies = this.game.towers.filter(other => other !== this && Math.hypot(other.x - this.x, other.y - this.y) <= this.computedStats.range);
                    dmgMult *= (1 + (allies.length * ab.dmgBonusPerAlly));
                }
            }
        }
        
        this.computedStats.damage *= dmgMult;
        this.computedStats.spd *= atkSpdMult;
        this.computedStats.range *= rangeMult;
    }
    getUpgradeCost() { return Math.floor(GameData.towers[this.dataId].cost * 0.25 * this.level); }
    update(dt) {
        this.isUILocked = false; // Reset every frame. Enemy update loop will set to true if shadow tag is active
        if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
        
        // Frisk Logic
        if (this.abilities && this.abilities.includes('frisk')) {
            this.game.enemies.forEach(e => {
                if (e.alive && !e.isFrisked && Math.hypot(e.x - this.x, e.y - this.y) <= this.computedStats.range) {
                    e.isFrisked = true;
                    this.game.addFloatingText(e.x, e.y - 20, "FRISKED!", "#fbbf24", 0.8);
                }
            });
        }

        if (this.cooldown > 0) this.cooldown -= dt;
        if (this.currentMoveId && GameData.moves[this.currentMoveId].attackType === 'aura') return; // Auras don't actively attack
        let target = this.findTarget();
        if (target) { this.direction = getDirection(target.x - this.x, target.y - this.y); if (this.cooldown <= 0) { this.fire(target); this.cooldown = 1 / this.computedStats.spd; } }
    }
    findTarget() {
        let targets = this.game.enemies.filter(e => e.alive && Math.hypot(e.x - this.x, e.y - this.y) <= this.computedStats.range);
        if (targets.length === 0) return null; if (this.targetingPriority === 'first') targets.sort((a, b) => b.distTravelled - a.distTravelled); else if (this.targetingPriority === 'last') targets.sort((a, b) => a.distTravelled - b.distTravelled); else if (this.targetingPriority === 'strongest') targets.sort((a, b) => b.health - a.health); else if (this.targetingPriority === 'weakest') targets.sort((a, b) => a.health - b.health);
        return targets[0];
    }
    fire(target) { 
        if (!this.currentMoveId) return;
        const moveData = GameData.moves[this.currentMoveId];
        this.game.projectiles.push(new Projectile(this.game, this.x, this.y, target, this, moveData)); 
        if (this.abilities && this.abilities.includes('skill_link')) {
            if (Math.random() < GameData.towerAbilities['skill_link'].chance) {
                this.game.projectiles.push(new Projectile(this.game, this.x, this.y, target, this, moveData));
                this.game.addFloatingText(this.x, this.y - 45, "MULTI-HIT", "#3b82f6", 0.8);
            }
        }
    }
    draw(ctx, isSelected) {
        const key = 'tower_walk_' + this.dataId;
        const asset = this.game.assetManager.getImage(key); 
        ctx.save(); 
        ctx.translate(this.x, this.y);
        
        const isBeingMoved = this.game.draggedTower === this;
        if (isSelected || isBeingMoved) { 
            ctx.fillStyle = isBeingMoved ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)'; 
            ctx.strokeStyle = isBeingMoved ? '#3b82f6' : 'rgba(255, 255, 255, 0.4)'; 
            ctx.beginPath(); ctx.arc(0, 0, this.computedStats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); 
        }
        
        if (asset && asset.loaded) {
            const offset = this.game.assetManager.getOffset(key);
            this.game.drawSpritesheet(ctx, asset.img, this.direction, 0, 52, offset, 0);
        } else { 
            ctx.fillStyle = this.data.placeholderColor; ctx.fillRect(-16, -16, 32, 32); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-16, -16, 32, 32); 
        }
        // Pixel Art Level Text with Shadow
        ctx.font = '8px "Press Start 2P"'; ctx.textAlign = 'center';
        // Shadow
        ctx.fillStyle = '#000';
        ctx.fillText("Lv." + this.level, 2, -34);
        // Main Text
        ctx.fillStyle = '#fff';
        ctx.fillText("Lv." + this.level, 0, -36);
        ctx.restore();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas'); 
        const prefix = "/static/tower/";
            GameData.config.mapImage = prefix + GameData.config.mapImage;
            [GameData.towers, GameData.enemies].forEach(collection => {
                Object.values(collection).forEach(obj => {
                    if (obj.iconPath) obj.iconPath = prefix + obj.iconPath;
                    if (obj.walkingSprite) obj.walkingSprite = prefix + obj.walkingSprite;
                });
            });
        this.ctx = this.canvas.getContext('2d'); 
        this.ctx.imageSmoothingEnabled = false; // Keep pixel art sharp
        this.assetManager = new AssetManager(); this.loadAssets();
        this.towers = []; this.enemies = []; this.projectiles = []; this.floatingTexts = []; this.zones = [];
        this.money = GameData.config.startingMoney; this.lives = GameData.config.startingLives; this.waveIndex = 0; this.enemiesToSpawn = 0; this.spawnTimer = 0; this.waveActive = false;
        this.currentGroupIndex = 0; this.spawnedInGroup = 0; this.lastWaveIndex = -1;
        this.selectedTower = null; this.placementMode = null; this.mousePos = { x: 0, y: 0 };
         this.draggedTower = null; this.dragOrigin = { x: 0, y: 0 };
        this.randomBuyCount = 0;
        this.bench = []; // Pokémon owned but not placed
        this.inventory = {}; // itemID: count
        this.tmTargetingMode = null;
        this.terrainLookup = {}; this.initTerrain(); this.bindUI(); this.updateHUD();
        this.timeScale = 1.0; this.isPaused = false;
        this.autoSaveTimer = 10;
        if (typeof GameAdmin !== 'undefined') GameAdmin.init(this);
        this.lastTime = performance.now();
        this.loadSaveState(true); 
        this.updateInventoryView();
        
        // Check for fresh game (No towers, No bench, Wave 0)
        if (this.towers.length === 0 && this.bench.length === 0 && this.waveIndex === 0) {
            this.showStarterSelection();
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    autoSave(dt) {
        this.autoSaveTimer -= dt;
        if (this.autoSaveTimer <= 0) {
            console.log("Auto-saving game...");
            this.saveGame(true); // true = quiet save
            this.autoSaveTimer = 10;
        }
    }

    initTerrain() {
        const raw = GameData.terrainMap; if (!raw) return;
        const values = Object.values(raw); if (values.length === 0) return;
        if (typeof values[0] === 'string') { this.terrainLookup = { ...raw }; } else {
            this.terrainLookup = {};
            for (const [tag, rects] of Object.entries(raw)) {
                for (const [tx, ty, tw, th] of rects) {
                    for (let x = tx; x < tx + tw; x++) { for (let y = ty; y < ty + th; y++) { this.terrainLookup[`${x},${y}`] = tag; } }
                }
            }
        }
    }

    loadAssets() {
        this.assetManager.loadImage('map', GameData.config.mapImage);
        for (const data of Object.values(GameData.towers)) { 
            if (data.iconPath) this.assetManager.loadImage('tower_icon_' + data.id, data.iconPath); 
            if (data.walkingSprite) this.assetManager.loadImage('tower_walk_' + data.id, data.walkingSprite, true); 
        }
        for (const data of Object.values(GameData.enemies)) { 
            if (data.iconPath) this.assetManager.loadImage('enemy_icon_' + data.id, data.iconPath); 
            if (data.walkingSprite) this.assetManager.loadImage('enemy_walk_' + data.id, data.walkingSprite, true); 
        }
    }

    inspectEnemy(id, instanceEnem = null) {
        const enemy = GameData.enemies[id]; if (!enemy) return;
        const panel = document.getElementById('enemy-stat-preview'); panel.classList.remove('hidden');
        document.getElementById('enemy-inspect-name').innerText = enemy.name.toUpperCase();
        document.getElementById('enemy-inspect-hp').innerText = `HP: ${instanceEnem ? Math.round(instanceEnem.health) : enemy.hp}`;
        document.getElementById('enemy-inspect-spd').innerText = instanceEnem ? (instanceEnem.data.spd * (instanceEnem.speedScale || 1.0)).toFixed(1) : enemy.spd;
        document.getElementById('enemy-inspect-def').innerText = enemy.def;
        document.getElementById('enemy-inspect-spdef').innerText = enemy.spDef;
        
        const abContainer = document.getElementById('enemy-inspect-abilities');
        if (instanceEnem && instanceEnem.isFrisked) {
             const abId = instanceEnem.ability;
             const ab = abId ? GameData.enemyAbilities[abId] : null;
             if (ab) {
                 abContainer.innerHTML = `
                    <div style="margin-bottom: 8px; color: var(--text-muted); font-size: 6px;">Active Ability:</div>
                    <div class="ability-box">
                        <h4>${ab.name}</h4>
                        <p>${ab.description}</p>
                    </div>
                 `;
             } else {
                 abContainer.innerHTML = '<span style="color:#666">No Active Ability</span>';
             }
        } else {
            const possibleIds = GameData.waves[this.waveIndex]?.possibleAbilities ?? enemy.possibleAbilities ?? [];
            const chance = GameData.waves[this.waveIndex]?.abilityChance ?? enemy.abilityChance ?? 0;
            
            if (possibleIds.length > 0) {
                let html = '<div style="margin-bottom: 8px; color: var(--text-muted); font-size: 6px;">Potential Abilities:</div>';
                possibleIds.forEach(id => {
                    const ab = GameData.enemyAbilities[id];
                    if (ab) {
                        html += `
                            <div class="ability-box">
                                <h4>${ab.name}</h4>
                                <p>${ab.description}</p>
                            </div>
                        `;
                    }
                });
                if (chance > 0) {
                    html += `<div class="ability-chance-tag">Spawn Chance: ${Math.round(chance * 100)}%</div>`;
                }
                abContainer.innerHTML = html;
            } else {
                abContainer.innerHTML = '';
            }
        }

        const portrait = document.getElementById('enemy-inspect-portrait');
        portrait.src = enemy.iconPath;
        portrait.style.backgroundColor = enemy.placeholderColor;

        document.getElementById('enemy-scout-empty-msg')?.classList.add('hidden');
    }

    updateWaveTab() {
        const content = document.getElementById('wave-details-content');
        if (this.waveIndex >= GameData.waves.length) {
            content.innerHTML = '<p class="empty-msg">All Waves Cleared!</p>'; return;
        }

        if (this.waveIndex !== this.lastWaveIndex) {
            document.getElementById('enemy-stat-preview')?.classList.add('hidden');
            document.getElementById('enemy-scout-empty-msg')?.classList.remove('hidden');
            this.lastWaveIndex = this.waveIndex;
        }

        const wave = GameData.waves[this.waveIndex];
        
        let groupsHtml = '';
        const uniqueEnemies = new Set();
        wave.groups.forEach((g, idx) => {
            const enemy = GameData.enemies[g.enemyId];
            groupsHtml += `<div class="stat-box">Stage ${idx+1}: <span>${g.count}x ${enemy.name}</span></div>`;
            uniqueEnemies.add(g.enemyId);
        });

        let scoutHtml = '';
        uniqueEnemies.forEach(id => {
            const enemy = GameData.enemies[id];
            scoutHtml += `
                <div class="wave-enemy-entry scout-mini" onclick="window.game.inspectEnemy('${id}')">
                    <div class="icon-container">
                        <img src="${enemy.iconPath}" />
                    </div>
                </div>
            `;
        });

        content.innerHTML = `
            <div style="margin-bottom: 12px; font-size: 8px; color: var(--secondary)">WAVE ${this.waveIndex + 1} OVERVIEW:</div>
            ${groupsHtml}
            <div style="margin-top: 12px; margin-bottom: 6px;">Scout:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${scoutHtml}
            </div>
            <p style="font-size: 6px; margin-top: 4px; color: var(--text-muted)">(Click icons for details)</p>
        `;
    }

    drawSpritesheet(ctx, img, direction, frame, size = 52, offset = { offsetX: 0, offsetY: 0 }, vBias = 0) {
        const sw = img.width / 4; const sh = img.height / 4;
        const scale = size / sw;
        // Apply scaled smart placement offset + optional manual bias.
        ctx.drawImage(img, frame * sw, direction * sh, sw, sh, (-size / 2) + (offset.offsetX * scale), (-size / 2) + (offset.offsetY * scale) + vBias, size, size);
    }

    bindUI() {
        // Tower Buy Buttons
        const listContainer = document.getElementById('tower-list');
        
        // --- Random Buy Button ---
        const rBtn = document.createElement('div'); 
        rBtn.className = 'tower-btn'; 
        rBtn.id = 'random-buy-btn'; // Critical for the update function to find it
        
        rBtn.innerHTML = `
            <div class="icon-container" style="background:#444; font-size: 24px; color: #fff; line-height: 48px;">?</div>
            <span>RANDOM</span>
            <span class="tower-cost">$${this.getRandomBuyPrice()}</span>
        `;

        rBtn.onclick = () => {
            const currentPrice = this.getRandomBuyPrice();
            if (this.money >= currentPrice) {
                const pool = this.getShopPool();
                const randomId = pool[Math.floor(Math.random() * pool.length)];
                
                this.money -= currentPrice;
                this.randomBuyCount++; // Increment count FIRST
                
                this.bench.push(new Tower(this, randomId, null, null));
                
                this.updateHUD(); 
                this.updateRandomButton(); // Update UI SECOND
                this.updateTeamList();
                
                this.addFloatingText(this.canvas.width/2, this.canvas.height/2, `GET: ${GameData.towers[randomId].name.toUpperCase()}`, "#facc15");
            } else { 
                this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "NOT ENOUGH MONEY", "#ef4444"); 
            }
        };
        listContainer.appendChild(rBtn);

        const shopPool = this.getShopPool();
        for (const id of shopPool) {
            const data = GameData.towers[id]; const btn = document.createElement('div'); btn.className = 'tower-btn';
            btn.innerHTML = `<div class="icon-container" style="background:${data.placeholderColor}"><img src="${data.iconPath}" /></div><span>${data.name}</span><span class="tower-cost">$${data.cost}</span>`;
            btn.onclick = () => { 
                if (this.money >= data.cost) { 
                    this.money -= data.cost;
                    this.bench.push(new Tower(this, id, null, null));
                    this.updateHUD(); this.updateTeamList();
                } else this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "Not enough money!", "#ef4444"); 
            };
            listContainer.appendChild(btn);
        }

        const upBtn = document.getElementById('level-up-btn');
        upBtn.addEventListener('mouseenter', () => this.levelUpPreview(true));
        upBtn.addEventListener('mouseleave', () => this.levelUpPreview(false));

        // Tab Switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.remove('hidden');
                
                // If shop tab is opened, make sure items are rendered
                if (btn.dataset.tab === 'tab-shop') {
                    this.renderItemsShop();
                }
                if (btn.dataset.tab === 'tab-wave') {
                    this.updateWaveTab();
                }
            };
        });

        // Event Listeners
        this.canvas.addEventListener('mousemove', (e) => { 
            const rect = this.canvas.getBoundingClientRect(); 
            this.mousePos.x = e.clientX - rect.left; 
            this.mousePos.y = e.clientY - rect.top; 
            if (this.draggedTower) {
                this.draggedTower.x = this.mousePos.x;
                this.draggedTower.y = this.mousePos.y;
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            // Cannot drag if wave is active OR we are trying to place a new tower
            if (this.waveActive || this.placementMode) return;
            for (let t of this.towers) {
                if (Math.hypot(t.x - this.mousePos.x, t.y - this.mousePos.y) <= 20) {
                    this.draggedTower = t;
                    this.dragOrigin = { x: t.x, y: t.y };
                    this.selectedTower = t; // Select while dragging
                    break;
                }
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (!this.draggedTower) return;
            
            const isValid = this.checkPlacement(this.draggedTower.dataId, this.mousePos.x, this.mousePos.y);
            
            if (isValid) {
                // Update internal terrain reference for the new spot
                const col = Math.floor(this.draggedTower.x / GameData.config.gridSize);
                const row = Math.floor(this.draggedTower.y / GameData.config.gridSize);
                this.draggedTower.terrain = this.terrainLookup[`${col},${row}`] || 'land';
                
                this.draggedTower.calculateStats();
                this.updateInspector();
                this.addFloatingText(this.draggedTower.x, this.draggedTower.y, "REPOSITIONED", "#3b82f6", 0.5);
            } else {
                // Snap back
                this.draggedTower.x = this.dragOrigin.x;
                this.draggedTower.y = this.dragOrigin.y;
                this.addFloatingText(this.mousePos.x, this.mousePos.y, "INVALID", "#ef4444", 0.5);
            }
            
            this.draggedTower = null;
            // Ensure guard doesn't trigger on fresh clicks
            this.dragOrigin = { x: this.mousePos.x, y: this.mousePos.y };
        });

        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        this.canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.placementMode = null; document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected')); });
        document.getElementById('inspect-target').addEventListener('change', (e) => { if (this.selectedTower) this.selectedTower.targetingPriority = e.target.value; });
        document.getElementById('level-up-btn').addEventListener('click', () => { 
            if (this.selectedTower) { 
                if (this.selectedTower.stunTimer > 0) {
                    this.addFloatingText(this.selectedTower.x, this.selectedTower.y, "LOCKED!", "#ef4444");
                    return;
                }
                let cost = this.selectedTower.getUpgradeCost(); if (this.money >= cost) { this.money -= cost; this.selectedTower.levelUp(); this.updateHUD(); this.updateInspector(); } 
            } 
        });
        
        document.getElementById('inspect-item-select').addEventListener('change', (e) => {
            if (!this.selectedTower) return;
            const newID = e.target.value;
            const oldID = this.selectedTower.heldItem;

            if (newID === oldID) return;

            // Unequip old
            if (oldID) {
                this.inventory[oldID] = (this.inventory[oldID] || 0) + 1;
            }

            // Equip new
            if (newID) {
                if (this.inventory[newID] > 0) {
                    this.inventory[newID]--;
                    this.selectedTower.equipItem(newID);
                } else {
                    alert("No more of this item in stash!");
                    this.selectedTower.equipItem(null);
                }
            } else {
                this.selectedTower.equipItem(null);
            }

            this.updateInspector();
            this.updateTeamList();
            this.updateInventoryView();
        });

        document.getElementById('inspect-move-select')?.addEventListener('change', (e) => {
            if (!this.selectedTower) return;
            this.selectedTower.currentMoveId = e.target.value;
            this.selectedTower.calculateStats();
            this.updateInspector();
        });

        document.getElementById('start-wave-btn').addEventListener('click', () => this.startNextWave());
        
        // Time Controls
        const setSpeed = (speed, btnId) => {
            this.timeScale = speed;
            this.isPaused = false;
            ['btn-pause', 'btn-1x', 'btn-2x', 'btn-4x'].forEach(id => document.getElementById(id).classList.remove('active'));
            document.getElementById(btnId).classList.add('active');
        };
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            ['btn-pause', 'btn-1x', 'btn-2x', 'btn-4x'].forEach(id => document.getElementById(id).classList.remove('active'));
            if (this.isPaused) document.getElementById('btn-pause').classList.add('active');
            else document.getElementById(`btn-${this.timeScale}x`).classList.add('active');
        });
        document.getElementById('btn-1x').addEventListener('click', () => setSpeed(1, 'btn-1x'));
        document.getElementById('btn-2x').addEventListener('click', () => setSpeed(2, 'btn-2x'));
        document.getElementById('btn-4x').addEventListener('click', () => setSpeed(4, 'btn-4x'));
        
        // Sell
        document.getElementById('sell-btn').addEventListener('click', () => this.sellTower());
        
        // Save/Load/Wipe
        document.getElementById('wipe-btn').addEventListener('click', () => this.wipeData());
    }

    checkPlacement(towerId, x, y) {
        const data = GameData.towers[towerId];
        const col = Math.floor(x / GameData.config.gridSize);
        const row = Math.floor(y / GameData.config.gridSize);
        const key = `${col},${row}`;
        const terrain = this.terrainLookup[key] || 'land'; 
        if (terrain === 'no_placement') return false;
        if (data.abilities && data.abilities.includes('levitate')) return true;
        if (terrain === 'path') return false;
        return data.placementTags.includes(terrain);
    }

    onCanvasClick(e) {
        // If in placement mode or teaching TMs, ignore the drag guard and process immediately
        const isUtilityMode = this.placementMode || this.tmTargetingMode;
        
        // Only apply drag guard if we aren't placing/teaching
        if (!isUtilityMode && Math.hypot(this.mousePos.x - this.dragOrigin.x, this.mousePos.y - this.dragOrigin.y) > 5) {
            return;
        }

        if (this.tmTargetingMode) {
            let target = this.towers.find(t => Math.hypot(t.x - this.mousePos.x, t.y - this.mousePos.y) <= 20);
            if (target) {
                this.attemptTeachTM(target, this.tmTargetingMode);
            } else {
                this.addFloatingText(this.mousePos.x, this.mousePos.y, "CANCELLED", "#94a3b8");
                this.tmTargetingMode = null;
            }
            return;
        }

        if (this.placementMode) {
            const t = this.placementMode;
            if (this.checkPlacement(t.dataId, this.mousePos.x, this.mousePos.y)) {
                t.x = this.mousePos.x; t.y = this.mousePos.y;
                const col = Math.floor(t.x / GameData.config.gridSize);
                const row = Math.floor(t.y / GameData.config.gridSize);
                t.terrain = this.terrainLookup[`${col},${row}`] || 'land';
                
                this.towers.push(t);
                this.bench = this.bench.filter(b => b !== t); // Remove from bench
                this.placementMode = null;
                this.recalcAllStats(); this.updateHUD(); this.updateTeamList();
            } else this.addFloatingText(this.mousePos.x, this.mousePos.y, "Invalid Terrain!", "#ef4444");
            return;
        }
        this.selectedTower = null; 
        for (let t of this.towers) { if (Math.hypot(t.x - this.mousePos.x, t.y - this.mousePos.y) <= 20) { this.selectedTower = t; break; } }
        
        // If no tower selected, try to select an enemy for Frisk data visualization
        if (!this.selectedTower) {
            for (let e of this.enemies) {
                if (e.alive && Math.hypot(e.x - this.mousePos.x, e.y - this.mousePos.y) <= 20) {
                    this.inspectEnemy(e.dataId, e);
                    document.querySelector('[data-tab="tab-wave"]').click();
                    return;
                }
            }
        }

        if (this.selectedTower) {
            // Auto switch to inspect tab
            document.querySelector('[data-tab="tab-inspect"]').click();
        }
        this.updateInspector();
        this.updateTeamList(); // Highlight selected in list if needed
        this.updateWaveTab();
    }
    updateHUD() { 
        document.getElementById('money-display').innerText = Math.floor(this.money); 
        document.getElementById('lives-display').innerText = this.lives; 
        document.getElementById('wave-display').innerText = this.waveIndex + (this.waveActive ? 1 : 0); 
        this.updateWaveTab();
    }
    
    updateTeamList() {
        const list = document.getElementById('my-team-list');
        list.innerHTML = '';

        // Combine Bench and Active Towers
        const allMembers = [
            ...this.bench.map(t => ({ tower: t, status: 'bench' })),
            ...this.towers.map(t => ({ tower: t, status: 'active' }))
        ];

        if (allMembers.length === 0) {
            list.innerHTML = '<p class="empty-msg">No Pokémon on team.</p>';
            return;
        }

        allMembers.forEach((item) => {
            const t = item.tower;
            const el = document.createElement('div');
            el.className = 'team-member';
            
            const isPlacing = this.placementMode === t;
            if (isPlacing || this.selectedTower === t) el.classList.add('selected');
            if (item.status === 'bench') el.style.borderStyle = 'dashed';

            el.innerHTML = `
                <div class="icon-container" style="${item.status === 'bench' ? 'filter: brightness(0.7);' : ''}">
                    <img src="${t.data.iconPath}">
                </div>
                <div class="team-member-info">
                    <span>${t.data.name} Lv.${t.level}</span>
                    <span style="color:${item.status === 'bench' ? '#facc15' : 'var(--secondary)'}">
                        ${isPlacing ? '[PLACING...]' : (item.status === 'bench' ? '[BENCHED]' : (t.heldItem ? GameData.items[t.heldItem].name : 'No Item'))}
                    </span>
                </div>
            `;

            el.onclick = () => {
                if (this.tmTargetingMode) {
                    this.attemptTeachTM(t, this.tmTargetingMode);
                    return;
                }
                if (item.status === 'bench') {
                    this.placementMode = t; 
                    this.selectedTower = t;
                } else {
                    this.placementMode = null;
                    this.selectedTower = t;
                }
                this.updateInspector();
                this.updateTeamList();
            };
            list.appendChild(el);
        });
    }

    updateInspector() {
        const panel = document.getElementById('inspection-panel'); 
        const emptyMsg = document.getElementById('inspect-empty-msg');
        if (!this.selectedTower) { 
            panel.classList.add('hidden'); 
            emptyMsg.classList.remove('hidden');
            return; 
        }
        panel.classList.remove('hidden');
        emptyMsg.classList.add('hidden');
        const t = this.selectedTower; const d = t.data; const stats = t.computedStats;
        const levelScale = 1 + ((t.level - 1) * 0.15);
        document.getElementById('inspect-name').innerText = d.name; 
        document.getElementById('inspect-level').innerText = t.level; 
        
         // Nature Colors for Core Stats
        const nData = GameData.natures[t.nature] || { atk: 1.0, spatk: 1.0, spd: 1.0 };
        document.getElementById('inspect-nature').innerText = `(${t.nature})`;
        
        const formatStat = (val, mod) => {
            let color = '#ffffff'; // Default White
            if (mod > 1.0) color = '#22c55e'; // Buff Green
            if (mod < 1.0) color = '#ef4444'; // Nerf Red
            return `<span style="color: ${color};">${val}</span>`;
        };

        // Calculate actual current stats (Base * Level Scale * Nature)
        const lvlScale = 1 + ((t.level - 1) * 0.15);
        const curAtk = (d.baseStats.atk || 0) * lvlScale * nData.atk;
        const curSpatk = (d.baseStats.spatk || 0) * lvlScale * nData.spatk;
        const curSpd = (d.baseStats.spd || 1.0) * nData.spd; // Speed doesn't scale with level

        document.getElementById('inspect-base-atk').innerHTML = formatStat(Math.round(curAtk), nData.atk);
        document.getElementById('inspect-base-spatk').innerHTML = formatStat(Math.round(curSpatk), nData.spatk);
        document.getElementById('inspect-base-spd').innerHTML = formatStat(curSpd.toFixed(2), nData.spd);

        // Secondary Combat Stats
        document.getElementById('inspect-dmg').innerText = stats.damage.toFixed(1);
        document.getElementById('inspect-range').innerText = stats.range.toFixed(0); 
        document.getElementById('inspect-crit').innerText = (stats.critChance * 100).toFixed(0) + '%'; 

        // Fire Rate Color Logic (Compare computed speed to nature-base speed)
        const rateEl = document.getElementById('inspect-rate');
        const finalRate = stats.spd;
        const natureBaseSpd = (d.baseStats.spd || 1.0) * nData.spd;
        
        rateEl.innerText = finalRate.toFixed(2) + '/s';
        if (finalRate > natureBaseSpd + 0.01) rateEl.style.color = '#22c55e'; // Buffed by Move/Item
        else if (finalRate < natureBaseSpd - 0.01) rateEl.style.color = '#ef4444'; // Nerfed by Move/Item
        else rateEl.style.color = '#ffffff';

        document.getElementById('inspect-target').value = t.targetingPriority;
        
        const tagsContainer = document.getElementById('inspect-tags');
        if (tagsContainer) {
            tagsContainer.innerHTML = (d.tags || []).map(tag => `<span style="font-size: 6px; padding: 2px 4px; background: #333; color: #fff; border: 1px solid #555; text-transform: uppercase;">${tag}</span>`).join('');
        }
        
        // Move Card Rendering
        const moveSel = document.getElementById('inspect-move-select');
        moveSel.innerHTML = '';
        if (t.unlockedMoves && t.unlockedMoves.length > 0) {
            t.unlockedMoves.forEach(mId => {
                const md = GameData.moves[mId];
                const opt = document.createElement('option'); opt.value = mId; opt.innerText = md ? md.name : mId;
                moveSel.appendChild(opt);
            });
            moveSel.value = t.currentMoveId;
            
            const curMove = GameData.moves[t.currentMoveId];
            if (curMove) {
                document.getElementById('move-name-display').innerText = curMove.name;
                const tagEl = document.getElementById('move-type-display');
                const tName = curMove.tags && curMove.tags[0] ? curMove.tags[0] : 'normal';
                tagEl.innerText = tName.toUpperCase();
                tagEl.className = `type-tag ${tName.toLowerCase()}`;
                
                document.getElementById('move-cat-display').innerText = curMove.category.toUpperCase();
                document.getElementById('move-cat-display').style.color = curMove.category === 'special' ? '#c084fc' : '#f87171';
                document.getElementById('move-pow-display').innerText = curMove.power;
            }
        }

        // Abilities
        const abContainer = document.getElementById('inspect-abilities-container');
        abContainer.innerHTML = (t.abilities || []).map(aId => {
            const a = GameData.towerAbilities[aId];
            if (!a) return ``;
            return `<div style="margin-bottom: 6px;"><strong>${a.name} (Ability):</strong> <span style="color:#94a3b8">${a.description}</span></div>`;
        }).join('');

        const upBtn = document.getElementById('level-up-btn'); const cost = t.getUpgradeCost(); const isEvolving = d.evolution && t.level + 1 >= d.evolution.targetLevel; upBtn.querySelector('span').innerText = cost + (isEvolving ? ' (Evolve)' : ''); upBtn.style.background = isEvolving ? '#8b5cf6' : 'var(--accent)';
        
        let totalCost = d.cost;
        for (let i = 1; i < t.level; i++) totalCost += Math.floor(d.cost * 0.25 * i);
        document.getElementById('sell-btn').querySelector('span').innerText = Math.floor(totalCost * 0.7);
        
        const portrait = document.getElementById('inspect-portrait');
        portrait.src = d.iconPath;
        portrait.style.backgroundColor = d.placeholderColor;
        
        // Update Item Overlay & Select
        const sel = document.getElementById('inspect-item-select');
        const abbr = document.getElementById('item-abbr-text');
        const slotUI = document.getElementById('item-slot-display');
        sel.innerHTML = '<option value="">(No Item)</option>';
        
        if (t.heldItem) {
            const item = GameData.items[t.heldItem];
            const opt = document.createElement('option'); opt.value = t.heldItem; opt.innerText = item.name + " (Eqp)";
            sel.appendChild(opt);
            sel.value = t.heldItem;
            
            abbr.innerText = item.name.substring(0,2).toUpperCase();
            slotUI.style.background = '#3b82f6';
            slotUI.style.borderColor = '#60a5fa';
        } else {
            abbr.innerText = '+';
            slotUI.style.background = '#333';
            slotUI.style.borderColor = '#555';
        }

        for (const [id, count] of Object.entries(this.inventory)) {
            if (count > 0 && id !== t.heldItem) {
                const item = GameData.items[id];
                const opt = document.createElement('option'); opt.value = id; opt.innerText = `${item.name} (${count})`;
                sel.appendChild(opt);
            }
        }

        // --- SIMULATION MODE OVERRIDES ---
        if (typeof SimulationMode !== 'undefined' && SimulationMode.enabled) {
            SimulationMode.injectEditorTools();
        }
    }
    renderItemsShop() {
        const list = document.getElementById('item-list'); 
        if (list.childElementCount > 0) return; // Don't re-render if already rendered
        
        list.innerHTML = '';
        for (const [id, item] of Object.entries(GameData.items)) {
            const el = document.createElement('div'); el.className = 'item-card'; el.innerHTML = `<div class="item-info"><h4>${item.name}</h4><p>${item.description}</p></div><div><button class="buy-btn">$${item.cost}</button></div>`;
            el.querySelector('.buy-btn').onclick = () => { 
                if (this.money >= item.cost) { 
                    this.money -= item.cost; 
                    this.inventory[id] = (this.inventory[id] || 0) + 1;
                    this.updateHUD(); 
                    this.updateInventoryView();
                    this.recalcAllStats();
                    this.updateHUD();
                    if (this.selectedTower) this.updateInspector();
                    this.addFloatingText(this.canvas.width/2, this.canvas.height-100, `Bought ${item.name}!`, "#facc15");
                } else alert("Not enough money!"); 
            };
            list.appendChild(el);
        }
    }

    updateInventoryView() {
        const list = document.getElementById('inventory-list');
        if (!list) return;
        list.innerHTML = '';
        let hasItems = false;
        for (const [id, count] of Object.entries(this.inventory)) {
            if (count > 0) {
                hasItems = true;
                const item = GameData.items[id];
                const el = document.createElement('div');
                el.className = 'team-member';
                el.innerHTML = `<div class="team-member-info"><span>${item.name} (x${count})</span><span>${item.type==='tm'?'Click to use':'Stashed'}</span></div>`;
                if (item.type === 'tm') {
                    el.onclick = () => {
                        this.tmTargetingMode = id;
                        this.addFloatingText(this.canvas.width/2, this.canvas.height - 40, "SELECT POKEMON TO TEACH", "#3b82f6");
                    };
                }
                list.appendChild(el);
            }
        }
        if (!hasItems) list.innerHTML = '<p class="empty-msg">No items.</p>';
    }

    sellTower() {
        if (!this.selectedTower) return;
        if (this.selectedTower.stunTimer > 0) {
            this.addFloatingText(this.selectedTower.x, this.selectedTower.y, "LOCKED!", "#ef4444");
            return;
        }
        const t = this.selectedTower;
        let totalCost = GameData.towers[t.dataId].cost;
        for (let i = 1; i < t.level; i++) totalCost += Math.floor(GameData.towers[t.dataId].cost * 0.25 * i);
        const refund = Math.floor(totalCost * 0.7);
        this.money += refund;
        if (t.heldItem) this.inventory[t.heldItem] = (this.inventory[t.heldItem] || 0) + 1;
        this.towers = this.towers.filter(tower => tower !== t);
        this.selectedTower = null;
        this.recalcAllStats();
        this.updateHUD();
        this.updateInspector();
        this.updateTeamList();
        this.updateInventoryView();
        this.addFloatingText(t.x, t.y, `+$${refund}`, "#facc15");
    }

    getSaveKey() {
        const username = (window.GAMEHUB_USER && window.GAMEHUB_USER.username) ? window.GAMEHUB_USER.username : 'guest';
        return 'pokemonTDSave_' + username;
    }

    saveGame(isQuiet = false) {
        const saveData = {
            money: this.money, lives: this.lives, waveIndex: this.waveIndex, inventory: this.inventory, randomBuyCount: this.randomBuyCount,
            bench: this.bench.map(t => ({ dataId: t.dataId, level: t.level, abilitySlot: t.abilitySlot, nature: t.nature, unlockedMoves: t.unlockedMoves, currentMoveId: t.currentMoveId })),
            towers: this.towers.map(t => ({ dataId: t.dataId, x: t.x, y: t.y, level: t.level, heldItem: t.heldItem, abilitySlot: t.abilitySlot, targetingPriority: t.targetingPriority, unlockedMoves: t.unlockedMoves, currentMoveId: t.currentMoveId, nature: t.nature }))
        };
        const key = this.getSaveKey();
        localStorage.setItem(key, JSON.stringify(saveData));

        // Cloud Save Sync
        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
        try {
            fetch('/api/save/tower', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? {'X-Auth-Token': token} : {})
                },
                body: JSON.stringify({ state: saveData })
            }).catch(() => {});
        } catch(e) {}

        if (!isQuiet) this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "GAME SAVED", "#22c55e", 2.0);
        else {
            this.addFloatingText(this.canvas.width - 100, 20, "Auto-Saving...", "#94a3b8", 0.5);
        }
    }

    applySaveData(data, isSilent = false) {
        if (!data) return;
        this.money = data.money; this.lives = data.lives; this.waveIndex = data.waveIndex; this.inventory = data.inventory || {}; 
        this.randomBuyCount = data.randomBuyCount || 0;
        
        this.updateRandomButton();

        this.bench = (data.bench || []).map(tData => new Tower(this, tData.dataId, null, null, tData.abilitySlot, tData.unlockedMoves, tData.currentMoveId, tData.nature));
        this.towers = (data.towers || []).map(tData => {
            const t = new Tower(this, tData.dataId, tData.x, tData.y, tData.abilitySlot, tData.unlockedMoves, tData.currentMoveId, tData.nature);
            t.level = tData.level; t.heldItem = tData.heldItem; t.targetingPriority = tData.targetingPriority || 'first';
            t.calculateStats(); return t;
        });
        this.enemies = []; this.projectiles = []; this.floatingTexts = []; this.zones = []; this.waveActive = false; this.enemiesToSpawn = 0; this.spawnTimer = 0; this.selectedTower = null; this.placementMode = null;
        this.recalcAllStats();
        this.updateHUD(); this.updateInspector(); this.updateTeamList(); this.updateInventoryView();
        if (!isSilent) this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "GAME LOADED", "#3b82f6", 2.0);
    }

    loadSaveState(isSilent = false) {
        const key = this.getSaveKey();
        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');

        if (!this._cloudChecked) {
            this._cloudChecked = true;
            fetch('/api/save/tower', {
                headers: token ? {'X-Auth-Token': token} : {}
            }).then(r => r.json()).then(cloud => {
                if (cloud && cloud.state && Object.keys(cloud.state).length > 0) {
                    localStorage.setItem(key, JSON.stringify(cloud.state));
                    this.applySaveData(cloud.state, isSilent);
                } else {
                    const localStr = localStorage.getItem(key);
                    if (localStr) {
                        try {
                            this.applySaveData(JSON.parse(localStr), isSilent);
                        } catch(e) {}
                    }
                }
            }).catch(() => {
                const localStr = localStorage.getItem(key);
                if (localStr) {
                    try {
                        this.applySaveData(JSON.parse(localStr), isSilent);
                    } catch(e) {}
                }
            });
            return;
        }

        const saveStr = localStorage.getItem(key);
        if (saveStr) {
            try {
                this.applySaveData(JSON.parse(saveStr), isSilent);
            } catch(e) {
                console.error(e);
                if (!isSilent) alert("Save corrupted.");
            }
        }
    }

    wipeData() {
        if(confirm("Wipe all save data for this account?")) {
            const key = this.getSaveKey();
            localStorage.removeItem(key);
            localStorage.removeItem('pokemonTDSave');
            const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
            fetch('/api/save/tower', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? {'X-Auth-Token': token} : {})
                },
                body: JSON.stringify({ state: null })
            }).catch(() => {});
            location.reload();
        }
    }

    startNextWave() { 
        if (this.waveActive) return; 
        if (this.waveIndex >= GameData.waves.length) { alert("Alpha Complete!"); return; } 
        
        const wave = GameData.waves[this.waveIndex];
        this.currentWaveReward = wave.reward || 100;
        this.currentWaveTotalHp = 0;
        
        // Calculate total HP of the wave for bounty distribution
        wave.groups.forEach(g => {
            const eData = GameData.enemies[g.enemyId];
            if (eData) this.currentWaveTotalHp += (eData.hp * g.count);
        });
        
        // Failsafe division
        this.currentWaveTotalHp = Math.max(1, this.currentWaveTotalHp);

        this.waveActive = true; 
        this.currentGroupIndex = 0;
        this.spawnedInGroup = 0;
        this.spawnTimer = 0; 
        this.updateHUD(); 
    }
    
    levelUpPreview(show) {
        if (!this.selectedTower) return;
        const t = this.selectedTower;
        const elDmg = document.getElementById('inspect-dmg');
        if (!elDmg) return;

        if (show) {
            const curDmg = t.computedStats.damage;
            
            // Temporarily level up and let the engine perfectly calculate next level states
            t.level++;
            t.calculateStats();
            const nextDmg = t.computedStats.damage;
            
            // Revert changes back safely
            t.level--;
            t.calculateStats();

            const diffDmg = nextDmg - curDmg;
            elDmg.innerHTML = `${curDmg.toFixed(1)} <span style="color:#22c55e">(+${diffDmg.toFixed(1)})</span>`;
        } else {
            elDmg.innerText = t.computedStats.damage.toFixed(1);
        }
    }

    recalcAllStats() { this.towers.forEach(t => t.calculateStats()); }

    attemptTeachTM(pokemon, tmId) {
        const tmItem = GameData.items[tmId];
        if (!tmItem || tmItem.type !== 'tm') return;

        if (pokemon.data.tmList && pokemon.data.tmList.includes(tmItem.moveId)) {
            if (!pokemon.unlockedMoves.includes(tmItem.moveId)) {
                pokemon.unlockedMoves.push(tmItem.moveId);
                this.inventory[tmId]--;
                this.addFloatingText(pokemon.x || this.canvas.width/2, pokemon.y || this.canvas.height/2, "LEARNED!", "#22c55e");
                pokemon.calculateStats();
                this.tmTargetingMode = null;
                this.updateInventoryView();
                this.updateTeamList();
                if (this.selectedTower === pokemon) this.updateInspector();
            } else {
                this.addFloatingText(this.mousePos.x, this.mousePos.y, "ALREADY KNOWN", "#94a3b8");
            }
        } else {
            this.addFloatingText(this.mousePos.x, this.mousePos.y, "INCOMPATIBLE", "#ef4444");
        }
    }

    showStarterSelection() {
        const modal = document.getElementById('starter-modal');
        const container = document.getElementById('starter-options');
        modal.classList.remove('hidden');
        container.innerHTML = '';

        GameData.config.starterIds.forEach(id => {
            const data = GameData.towers[id];
            const card = document.createElement('div');
            card.className = 'starter-card';
            card.innerHTML = `
                <div class="icon-container" style="background:${data.placeholderColor}">
                    <img src="${data.iconPath}">
                </div>
                <h3>${data.name.toUpperCase()}</h3>
            `;
            card.onclick = () => {
                this.bench.push(new Tower(this, id, null, null));
                modal.classList.add('hidden');
                this.updateTeamList();
                this.saveGame(true);
                this.addFloatingText(this.canvas.width/2, this.canvas.height/2, `${data.name} joined the team!`, "#10b981", 2.0);
            };
            container.appendChild(card);
        });
    }

    getShopPool() {
        // Returns only Pokémon explicitly marked as buyable in game-data.js
        return Object.keys(GameData.towers).filter(id => GameData.towers[id].buyable === true);
    }

    getRandomBuyPrice() { 
        // Exponential growth: Base * (1.4 ^ count)
        return Math.floor(80 * Math.pow(1.8, this.randomBuyCount)); 
    }

    updateRandomButton() {
        const btn = document.getElementById('random-buy-btn');
        if (btn) {
            const priceTag = btn.querySelector('.tower-cost');
            if (priceTag) priceTag.innerText = `$${this.getRandomBuyPrice()}`;
        }
    }
    enemyKilled(enemy, sourceTower = null) { 
        // Bounty is now precisely calculated by the wave pool
        let bounty = enemy.bountyValue || 0;

        if (sourceTower && sourceTower.abilities) {
            sourceTower.abilities.forEach(aId => {
                const ab = GameData.towerAbilities[aId];
                if (ab && ab.moneyMultiplier) bounty *= ab.moneyMultiplier;
            });
        }
        // Pay Day Check
        if (enemy.ability === 'pay_day') {
            const bonus = GameData.enemyAbilities['pay_day'].bonus;
            bounty += bonus;
            this.addFloatingText(enemy.x, enemy.y - 30, `+$${bonus} PAY DAY`, "#facc15");
        }

        this.money += Math.round(bounty); 
        this.updateHUD();
        if (this.selectedTower) this.updateInspector(); 
    }
    loseLives(amt) { this.lives -= amt; this.recalcAllStats(); this.updateHUD(); if (this.lives <= 0) { this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "GAME OVER", "#ef4444", 5.0); setTimeout(() => location.reload(), 2000); } }
    addFloatingText(x, y, text, color, duration = 1.0) { this.floatingTexts.push(new FloatingText(x, y, text, color, duration)); }
    loop(timestamp) {
        let realDt = (timestamp - this.lastTime) / 1000;
        if (realDt > 0.1) realDt = 0.1; // Cap dt to prevent huge jumps
        this.lastTime = timestamp; 
        
        this.autoSave(realDt);
        this.update(realDt); 
        this.draw();
        
        requestAnimationFrame((t) => this.loop(t));
    }
    update(dt) {
        if (this.isPaused) return;
        dt *= this.timeScale;
        if (this.waveActive) { 
            const wave = GameData.waves[this.waveIndex];
            const group = wave.groups[this.currentGroupIndex];

            if (group) {
                this.spawnTimer -= dt; 
                if (this.spawnTimer <= 0 && this.spawnedInGroup < group.count) { 
                    // Calculate HP-weighted bounty
                    const eData = GameData.enemies[group.enemyId];
                    const calcBounty = this.currentWaveReward * (eData.hp / this.currentWaveTotalHp);
                    
                    this.enemies.push(new Enemy(this, group.enemyId, group.abilityChance, calcBounty)); 
                    this.spawnedInGroup++; 
                    this.spawnTimer = group.interval; 
                } 

                // Transition to next group
                if (this.spawnedInGroup >= group.count) {
                    this.currentGroupIndex++;
                    this.spawnedInGroup = 0;
                    this.spawnTimer = 0.5; // Small delay between groups
                }
            }
            
            // End Wave
            if (this.currentGroupIndex >= wave.groups.length && this.enemies.length === 0) { 
                this.waveActive = false;
                
                // Honey Gather & End Wave Effects
                this.towers.forEach(t => {
                    if (t.abilities && t.abilities.includes('honey_gather')) {
                        const bonus = GameData.towerAbilities['honey_gather'].bonusMoney;
                        this.money += bonus;
                        this.addFloatingText(t.x, t.y, `+$${bonus}`, "#facc15");
                    }
                });

                this.waveIndex++; this.updateHUD(); 
                if (this.waveIndex >= GameData.waves.length) {
                    this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "YOU WIN", "#22c55e", 5.0); 
                } else if (document.getElementById('auto-wave-toggle').checked) {
                    this.startNextWave();
                }
            } 
        }
        this.towers.forEach(t => t.update(dt)); this.enemies.forEach(e => e.update(dt)); this.projectiles.forEach(p => p.update(dt)); this.floatingTexts.forEach(f => f.update(dt)); this.zones.forEach(z => z.update(dt));
        this.enemies = this.enemies.filter(e => e.alive); this.projectiles = this.projectiles.filter(p => p.alive); this.floatingTexts = this.floatingTexts.filter(f => f.life > 0); this.zones = this.zones.filter(z => z.duration > 0);
    }
    draw() {
        this.ctx.fillStyle = '#1e1e28'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const mapImg = this.assetManager.getImage('map'); if (mapImg && mapImg.loaded) this.ctx.drawImage(mapImg.img, 0, 0, this.canvas.width, this.canvas.height);
        this.zones.forEach(z => z.draw(this.ctx));
        let renderables = [...this.towers.map(t => ({ y: t.y, draw: (ctx) => t.draw(ctx, t === this.selectedTower) })), ...this.enemies.map(e => ({ y: e.y, draw: (ctx) => e.draw(ctx) }))];
        renderables.sort((a,b) => a.y - b.y); renderables.forEach(r => r.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx)); this.floatingTexts.forEach(f => f.draw(this.ctx));
        if (this.placementMode) {
            const t = this.placementMode; const isValid = this.checkPlacement(t.dataId, this.mousePos.x, this.mousePos.y);
            this.ctx.save(); this.ctx.globalAlpha = 0.5; 
            this.ctx.fillStyle = isValid ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
            this.ctx.beginPath(); this.ctx.arc(this.mousePos.x, this.mousePos.y, 20, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.strokeStyle = isValid ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
            this.ctx.beginPath(); this.ctx.arc(this.mousePos.x, this.mousePos.y, t.computedStats.range, 0, Math.PI * 2); this.ctx.stroke(); this.ctx.restore();
        }
        if (typeof GameAdmin !== 'undefined' && GameAdmin.active) GameAdmin.draw(this.ctx);
    }
}
window.onload = () => { window.game = new GameEngine(); };
