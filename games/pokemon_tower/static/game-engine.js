
function formatCurrency(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return Math.floor(num).toString();
}

function fitAbilityText(element) {
    let fontSize = 6.5; // Start at max size
    element.style.fontSize = fontSize + 'px';
    
    // While the text is taller than the container, shrink the font
    // We stop at 4.5px to keep it somewhat readable
    while (element.scrollHeight > element.offsetHeight && fontSize > 4.5) {
        fontSize -= 0.1;
        element.style.fontSize = fontSize + 'px';
    }
}

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

class ChainVisual {
    constructor(targets, color = '#facc15', duration = 0.25) {
        this.points = targets.map(t => ({ x: t.x, y: t.y - 15 })); 
        this.color = color;
        this.duration = duration;
        this.life = duration;
    }
    update(dt) { this.life -= dt; }
    draw(ctx) {
        if (this.life <= 0 || this.points.length < 2) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.duration);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            const midX = (this.points[i-1].x + this.points[i].x) / 2 + (Math.random() - 0.5) * 15;
            const midY = (this.points[i-1].y + this.points[i].y) / 2 + (Math.random() - 0.5) * 15;
            ctx.lineTo(midX, midY);
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.lineWidth = 4; ctx.strokeStyle = this.color; ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.restore();
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
        const immuneList = EffectEngine.getImmunities(this.target);
        const ignoresDoT = EffectEngine.ignoresDoT(this.target);
        
        for (const [id, e] of Object.entries(this.effects)) {
            if (immuneList.includes(id)) {
                delete this.effects[id]; continue;
            }

            e.duration -= dt;
            if (e.data.tickRate > 0) {
                e.timer += dt; 
                if (e.timer >= 1 / e.data.tickRate) { 
                    e.timer -= 1 / e.data.tickRate; 
                    if (!ignoresDoT) {
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

class EffectEngine {
    static checkCondition(entity, cond, game, context = {}) {
        if (!cond) return true;
        switch(cond.type) {
            case 'lives_below': return game.lives <= GameData.config.startingLives * cond.ratio;
            case 'terrain': return entity.terrain === cond.value || entity.currentTerrain === cond.value;
            case 'hp_equals_max': return entity.health === entity.maxHealth && !entity.sturdyUsed;
            case 'hp_below': return (entity.health / entity.maxHealth) < cond.ratio;
            case 'has_status': return Object.keys(entity.statusManager?.effects || {}).some(s => cond.statuses.includes(s));
            case 'target_poisoned': return context.target?.statusManager?.hasEffect('poison');
            case 'not_hit_recently': return entity.lastHitTimer >= cond.threshold;
            case 'incoming_attack_tag': 
                const tags = context.moveData?.tags || context.attacker?.data.tags || [];
                return cond.tags.some(t => tags.includes(t));
            default: return true;
        }
    }

    static getAllEffects(entity) {
        let effects = [];
        const isTower = entity instanceof Tower;
        let abilities = isTower ? (entity.abilities || []) : (entity.ability ? [entity.ability] : []);
        let dict = isTower ? GameData.towerAbilities : GameData.enemyAbilities;
        
        abilities.forEach(aId => { 
            if (dict[aId] && dict[aId].effects) {
                dict[aId].effects.forEach(eff => effects.push({ ...eff, sourceId: aId }));
            }
        });
        if (isTower && entity.heldItem && GameData.items[entity.heldItem]?.effects) {
            GameData.items[entity.heldItem].effects.forEach(eff => effects.push({ ...eff, sourceId: entity.heldItem }));
        }
        if (isTower && entity.currentMoveId && GameData.moves[entity.currentMoveId]?.effects) {
            GameData.moves[entity.currentMoveId].effects.forEach(eff => effects.push({ ...eff, sourceId: entity.currentMoveId }));
        }
        
        return effects;
    }

    static getImmunities(entity) {
        let immunities = [];
        this.getAllEffects(entity).forEach(eff => {
            if (eff.trigger === 'passive' && eff.action === 'immunity' && this.checkCondition(entity, eff.condition, entity.game)) {
                if (eff.statuses) immunities.push(...eff.statuses);
            }
        });
        return immunities;
    }

    static ignoresDoT(entity) {
        return this.getAllEffects(entity).some(eff => eff.trigger === 'passive' && eff.action === 'ignore_dot' && this.checkCondition(entity, eff.condition, entity.game));
    }

    static applyMath(current, op, val) {
        if (current === undefined) current = (op === 'multiply' || op === 'divide') ? 1 : 0;
        switch(op) {
            case 'add': return current + val;
            case 'subtract': return current - val;
            case 'multiply': return current * val;
            case 'divide': return current / (val || 1); // Prevent divide by zero
            default: return current;
        }
    }

    static applyPassives(entity) {
        // 1. Apply Self Passives & Scaling
        this.getAllEffects(entity).forEach(eff => {
            if (eff.trigger === 'passive' && this.checkCondition(entity, eff.condition, entity.game)) {
                if (eff.action === 'modify_stat') {
                    let val = eff.value !== undefined ? eff.value : 0;
                    // Handle Stacked Bonuses (like Moxie)
                    if (eff.stackId) {
                        const finalStackId = (eff.stackId.startsWith('global_')) ? eff.stackId : `${eff.sourceId}_${eff.stackId}`;
                        // Ensure the stack object exists
                        if (!entity.stacks) entity.stacks = {};
                        const stacks = entity.stacks[finalStackId] || 0;
                        const capped = Math.min(stacks, eff.maxStacks || Infinity);
                        
                        if (eff.operation === 'multiply' || eff.operation === 'divide') {
                            // Support for Exponential (Compounding) vs Linear scaling
                            if (eff.stackType === 'exponential') {
                                val = Math.pow(1 + val, capped); // e.g., 1.025^10
                            } else {
                                val = 1 + (val * capped); // e.g., 1 + (0.025 * 10)
                            }
                        } else {
                            val = val * capped;
                        }
                    }
                    // Handle Proximity Bonuses (like Lift Up)
                    if (eff.perAlly && entity instanceof Tower) {
                        const rSq = entity.computedStats.range * entity.computedStats.range;
                        const count = entity.game.towers.filter(t => t !== entity && ((t.x - entity.x)**2 + (t.y - entity.y)**2) <= rSq).length;
                        if (eff.operation === 'multiply' || eff.operation === 'divide') val = 1 + (val * count);
                        else val = val * count;
                    }
                    
                    if (entity instanceof Tower) entity.computedStats[eff.stat] = this.applyMath(entity.computedStats[eff.stat], eff.operation, val);
                    else entity[eff.stat] = this.applyMath(entity[eff.stat], eff.operation, val);
                } else if (eff.action === 'scaling') {
                    let val = 1 + ((eff.speedIncreasePerSec || 0) * (entity.age || 0));
                    if (entity instanceof Tower) entity.computedStats.spd = this.applyMath(entity.computedStats.spd, 'multiply', val);
                    else entity.spd = this.applyMath(entity.spd, 'multiply', val);
                }
            }
        });

        // 2. Apply Incoming Auras (Towers receiving from other Towers)
        if (entity instanceof Tower && entity.game && entity.game.towers) {
            entity.game.towers.forEach(other => {
                if (other === entity) return;
                const distSq = (other.x - entity.x)**2 + (other.y - entity.y)**2;
                const rangeSq = other.computedStats.range * other.computedStats.range;
                
                if (distSq <= rangeSq) {
                    this.getAllEffects(other).forEach(eff => {
                        if (eff.trigger === 'aura' && eff.target === 'tower' && this.checkCondition(other, eff.condition, entity.game)) {
                            if (eff.action === 'modify_stat') {
                                entity.computedStats[eff.stat] = this.applyMath(entity.computedStats[eff.stat], eff.operation, eff.value);
                            } else if (eff.action === 'share_item_stats' && other.heldItem) {
                                const itemEffects = GameData.items[other.heldItem]?.effects || [];
                                itemEffects.forEach(itemEff => {
                                    if (itemEff.action === 'modify_stat') {
                                        let sharedVal = itemEff.value;
                                        if (itemEff.operation === 'multiply') sharedVal = 1 + (itemEff.value - 1) * eff.shareFactor;
                                        else sharedVal = itemEff.value * eff.shareFactor;
                                        entity.computedStats[itemEff.stat] = this.applyMath(entity.computedStats[itemEff.stat], itemEff.operation, sharedVal);
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    static dispatch(entity, trigger, context = {}) {
        // Use the unified function so sourceId is always attached
        let effects = this.getAllEffects(entity);

        // Move effects logic for on_hit (handled by Projectile hitting)
        if (context.moveEffects) effects.push(...context.moveEffects);

        effects.forEach(eff => {
            if (eff.trigger === trigger && this.checkCondition(entity, eff.condition, entity.game)) {
                this.executeAction(entity, eff, context);
            }
        });
    }

     static executeAction(entity, eff, context) {
        const game = entity.game;
        switch(eff.action) {
            case 'prevent_lethal':
                if (context.damage >= entity.health) {
                    context.damage = entity.health - eff.setHp;
                    entity.sturdyUsed = true;
                    game.addFloatingText(entity.x, entity.y - 20, "STURDY", "#cbd5e1");
                }
                break;
            case 'teleport_forward':
                if (!entity.hasTeleported) {
                    entity.distTravelled += eff.distance;
                    entity.hasTeleported = true;
                    entity.syncPositionToPath();
                    game.addFloatingText(entity.x, entity.y, "EXIT!", "#8b5cf6");
                }
                break;
            case 'recoil_stun':
                if (context.attacker) {
                    let stunMult = context.attacker.computedStats.stunDurationMultiplier !== undefined ? context.attacker.computedStats.stunDurationMultiplier : 1.0;
                    context.attacker.stunTimer = Math.max(context.attacker.stunTimer || 0, eff.duration * stunMult);
                    if (stunMult > 0) game.addFloatingText(context.attacker.x, context.attacker.y, "STUNNED!", "#ef4444");
                }
                break;
            case 'modify_money':
                if (Math.random() < (eff.chance || 1.0)) {
                    let change = 0;
                    if (eff.operation === 'add') change = eff.value;
                    else if (eff.operation === 'subtract') change = -eff.value;
                    
                    game.money = Math.max(0, game.money + change);
                    if (change > 0) game.addFloatingText(entity.x, entity.y, `+$${change}`, "#facc15");
                    if (change < 0 && eff.trigger !== 'tick') game.addFloatingText(entity.x, entity.y, `-$${Math.abs(change)}`, "#ef4444");
                }
                break;
            case 'heal':
                let healAmt = eff.operation === 'percent_max' ? entity.maxHealth * eff.value : eff.value;
                entity.health = Math.min(entity.maxHealth, entity.health + healAmt);
                break;
            case 'add_stack':
                entity.stacks = entity.stacks || {};
                const finalStackId = (eff.stackId.startsWith('global_')) ? eff.stackId : `${eff.sourceId}_${eff.stackId}`;
                entity.stacks[finalStackId] = (entity.stacks[finalStackId] || 0) + 1;
                if(entity.calculateStats) entity.calculateStats();
                break;
            case 'apply_status':
                if (Math.random() < (eff.chance || 1.0) * (context.chanceMultiplier || 1.0)) {
                    if (context.target && context.target.statusManager) {
                        context.target.statusManager.applyEffect(eff.status);
                        game.addFloatingText(context.target.x, context.target.y - 25, eff.status.toUpperCase(), '#ffffff', 0.8);
                    }
                }
                break;
            case 'hit_shield':
                const sId = eff.stackId || 'default_shield';
                if (entity.stacks[sId] === undefined) entity.stacks[sId] = eff.value;
                
                if (entity.stacks[sId] > 0) {
                    context.damage = 1;
                    entity.stacks[sId]--;
                    game.addFloatingText(entity.x, entity.y - 15, "BLOCK", "#94a3b8");
                }
                break;
            case 'extra_hit':
                if (Math.random() < (eff.chance || 1.0)) {
                    game.projectiles.push(new Projectile(game, entity.x, entity.y, context.target, entity, context.moveData));
                    game.addFloatingText(entity.x, entity.y - 45, "MULTI-HIT", "#3b82f6", 0.8);
                }
                break;
        }
    }
}

class Enemy {
    constructor(game, dataId, abilityChanceOverride = null, bountyValue = 0, level = 1) {
        this.game = game; this.dataId = dataId; this.data = GameData.enemies[dataId]; this.waypoints = GameData.mapConfig;
        this.x = this.waypoints[0].x; this.y = this.waypoints[0].y; this.waypointIndex = 1; 
        this.level = level;
        
        // 8% scaling per level
        const scale = 1 + (this.level - 1) * 0.08;
        this.maxHealth = this.data.hp * scale;
        this.health = this.maxHealth;
        this.def = (this.data.def || 1) * scale;
        this.spDef = (this.data.spDef || 1) * scale;
        
        this.bountyValue = bountyValue;
        this.statusManager = new StatusEffectManager(this); this.alive = true; this.distTravelled = 0; this.direction = 0; this.frame = 0; this.animTimer = 0;
        this.isFrisked = false; this.lastHitTimer = 0; this.age = 0;
        this.stacks = {}; // Generic state storage for all abilities
        this.flashTimer = 0; this.deathScale = 1.0; this.isDying = false;
        
        this.ability = null;
        const chance = abilityChanceOverride ?? this.data.abilityChance ?? 0;
        const possible = this.data.possibleAbilities ?? [];
        if (Math.random() < chance && possible.length > 0) {
            this.ability = possible[Math.floor(Math.random() * possible.length)];
        }
    }
    update(dt) {
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.isDying) {
            this.deathScale -= dt * 6; // Shrinks to 0 in ~0.16 seconds
            return;
        }
        if (!this.alive) return; 
        this.statusManager.update(dt); 
        
        // Generic Tick System (Triggers once per second)
        this.tickTimer = (this.tickTimer || 0) + dt;
        if (this.tickTimer >= 1.0) {
            this.tickTimer -= 1.0;
            EffectEngine.dispatch(this, 'on_tick');
        }
        if (!this.alive) return;
        
        const wp = this.waypoints[this.waypointIndex]; 
        if (!wp) { this.game.loseLives(1); this.alive = false; return; }
        
        const dx = wp.x - this.x; const dy = wp.y - this.y; const distToWp = Math.hypot(dx, dy);
        this.direction = getDirection(dx, dy);

        this.currentTerrain = this.game.getTerrainAt(this.x, this.y);
        
        this.lastHitTimer += dt;
        this.age += dt;
        let abilityMult = 1.0;    

        // 1. Reset Stats to Base (Prevents infinite frame-by-frame growth)
        const scale = 1 + (this.level - 1) * 0.08;
        this.spd = this.data.spd; 
        this.def = (this.data.def || 1) * scale;
        this.spDef = (this.data.spDef || 1) * scale;

        // 2. Calculate Multipliers from Passives and Auras
        EffectEngine.applyPassives(this); 
        
        for (let i = 0; i < this.game.towers.length; i++) {
            const t = this.game.towers[i];
            EffectEngine.getAllEffects(t).forEach(eff => {
                if (eff.trigger === 'aura' && eff.target === 'enemy' && EffectEngine.checkCondition(t, eff.condition, this.game)) {
                    const rSq = t.computedStats.range * t.computedStats.range;
                    if (((t.x - this.x)**2 + (t.y - this.y)**2) <= rSq) {
                        if (eff.action === 'modify_stat') {
                            if (eff.stat === 'spd') abilityMult = EffectEngine.applyMath(abilityMult, eff.operation, eff.value);
                            else this[eff.stat] = EffectEngine.applyMath(this[eff.stat], eff.operation, eff.value);
                        }
                        if (eff.action === 'reveal_stats' && !this.isFrisked) {
                            this.isFrisked = true;
                            this.game.addFloatingText(this.x, this.y - 20, "REVEALED!", "#fbbf24", 0.8);
                        }
                    }
                }
            });
        }

        // 3. Calculate Speed and Perform Movement (Using modified this.spd instead of hardcoded data.spd)
        this.currentSpeed = this.spd * this.statusManager.getSpeedModifier() * (this.speedScale || 1.0) * abilityMult;
        let speed = this.currentSpeed;

        if (speed > 0) { 
            this.animTimer += dt * (speed / 10); 
            this.frame = Math.floor(this.animTimer) % 4; 
        }
        
        const moveDist = speed * dt;
        if (distToWp <= moveDist) { 
            this.x = wp.x; this.y = wp.y; 
            this.waypointIndex++; 
            this.distTravelled += distToWp; 
        } else { 
            this.x += (dx / distToWp) * moveDist; 
            this.y += (dy / distToWp) * moveDist; 
            this.distTravelled += moveDist; 
        }

        // 3. Handle Management Locks (Shadow Tag, etc.)
        EffectEngine.getAllEffects(this).forEach(eff => {
            if (eff.action === 'lock_management') {
                if (eff.global) {
                    this.game.isManagementLocked = true;
                } else {
                    const rSq = (eff.radius * eff.radius) || 10000;
                    this.game.towers.forEach(t => {
                        if (((t.x - this.x)**2 + (t.y - this.y)**2) <= rSq) t.isUILocked = true;
                    });
                }
            }
        });
    }

    syncPositionToPath() {
        let currentDist = 0;
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            let d = Math.hypot(this.waypoints[i+1].x - this.waypoints[i].x, this.waypoints[i+1].y - this.waypoints[i].y);
            if (currentDist + d > this.distTravelled) {
                let ratio = (this.distTravelled - currentDist) / d;
                this.x = this.waypoints[i].x + (this.waypoints[i+1].x - this.waypoints[i].x) * ratio;
                this.y = this.waypoints[i].y + (this.waypoints[i+1].y - this.waypoints[i].y) * ratio;
                this.waypointIndex = i + 1; break;
            }
            currentDist += d;
        }
    }

    takeDamage(amount, penetration = 0, crit = false, sourceTower = null, moveData = null) {
        this.lastHitTimer = 0;
        let finalMult = 1.0;
        let isSpecial = moveData?.category === 'special';
        let relevantDef = isSpecial ? (this.spDef || 1) : (this.def || 1);
        
        let ignoresAbilities = sourceTower && EffectEngine.getAllEffects(sourceTower).some(eff => eff.action === 'ignore_enemy_abilities');
        let statIgnoreActive = !ignoresAbilities && EffectEngine.getAllEffects(this).some(eff => eff.action === 'stat_ignore');

        let context = { attacker: sourceTower, moveData: moveData, damage: amount };

        if (!ignoresAbilities) {
            EffectEngine.getAllEffects(this).forEach(eff => {
                if (eff.trigger === 'pre_damage' && eff.action === 'modify_incoming_damage' && EffectEngine.checkCondition(this, eff.condition, this.game, context)) {
                    let val = eff.value !== undefined ? eff.value : 0;
                    
                    // Handle dynamic scaling (like Pack Hunter)
                    if (eff.perAlly) {
                        const rSq = (eff.radius * eff.radius) || 2500;
                        const nearby = this.game.enemies.filter(e => e !== this && e.alive && ((e.x - this.x)**2 + (e.y - this.y)**2) <= rSq).length;
                        if (eff.operation === 'multiply' || eff.operation === 'divide') {
                            val = Math.max(0.1, 1 + (nearby * val));
                        } else {
                            val = nearby * val;
                        }
                    }
                    
                    finalMult = EffectEngine.applyMath(finalMult, eff.operation, val);
                }
            });
        }

        let effDmg = amount;
        if (sourceTower && moveData && moveData.power > 0) {
            let P = moveData.power, L = sourceTower.level;
            let attackStat = isSpecial ? sourceTower.computedStats.spatk : sourceTower.computedStats.atk;
            if (statIgnoreActive) {
                penetration = sourceTower.data.baseStats.armorPenetration || 0;
                attackStat = isSpecial ? (sourceTower.data.baseStats.spatk || 1) : (sourceTower.data.baseStats.atk || 1);
            }
            let effArmor = Math.max(1, relevantDef * (1 - (penetration || 0) / 100));
            effDmg = (((2 * L / 5 + 2) * P * (attackStat / effArmor)) / 2) * amount;
        } else if (!sourceTower && !moveData) {
            effDmg = amount;
        } else if (sourceTower && moveData && moveData.power === 0) {
            effDmg = 1 * amount;
        }

        effDmg *= finalMult;
        
        context.damage = effDmg; // Update context with final calculated damage
        if (!ignoresAbilities) EffectEngine.dispatch(this, 'pre_damage', context);
        effDmg = context.damage;

        if (sourceTower && !ignoresAbilities) EffectEngine.dispatch(this, 'on_hit_received', context);

        const actualHit = Math.min(this.health, effDmg);
        const overkill = Math.max(0, effDmg - this.health);
        this.health -= effDmg; 
        
        EffectEngine.dispatch(this, 'post_damage', context);

        if (this.game && this.game.trackDamage) this.game.trackDamage(sourceTower, actualHit, overkill);
        if (this.game && amount > 0 && this.game.addFloatingText) this.game.addFloatingText(this.x, Math.max(0, this.y - 10), Math.round(effDmg).toString(), crit ? '#fbbf24' : '#ffffff');

        if (amount > 0) this.flashTimer = 0.1;

        if (this.health <= 0 && !this.isDying) { 
            this.isDying = true;
            this.alive = false; 
            EffectEngine.dispatch(this, 'on_death', { attacker: sourceTower });
            if (sourceTower) EffectEngine.dispatch(sourceTower, 'on_kill', { target: this });
            this.game.enemyKilled(this, sourceTower); 
        }
    }
    draw(ctx) {
        const key = 'enemy_walk_' + this.dataId;
        const asset = this.game.assetManager.getImage(key); 
        ctx.save(); 
        ctx.translate(this.x, this.y);
        if (this.isDying) {
            const scale = Math.max(0, this.deathScale);
            ctx.scale(scale, scale);
        }
        if (asset && asset.loaded) {
            const offset = this.game.assetManager.getOffset(key);
            if (this.flashTimer > 0) {
                ctx.filter = 'brightness(0.5) sepia(1) saturate(10000%) hue-rotate(-30deg)';
            } else {
                ctx.filter = this.statusManager.getFilter();
            }
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
        
        // Level Indicator
        ctx.font = '8px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText("Lv." + this.level, 0, by - 6);
        ctx.fillStyle = '#fff'; ctx.fillText("Lv." + this.level, -2, by - 8);
        
        ctx.restore();
    }
}

class PersistentZone {
    constructor(game, x, y, data, stats, tower, moveData) {
        this.game = game; this.x = x; this.y = y; this.data = data; this.stats = stats; this.tower = tower; this.moveData = moveData;
        this.duration = data.duration; this.enemyCooldowns = new Map();
        this.blobPoints = [];
        const numPoints = 8 + Math.floor(Math.random() * 4);
        for(let i=0; i<numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const variance = 0.7 + Math.random() * 0.6;
            this.blobPoints.push({ x: Math.cos(angle) * this.data.radius * variance, y: Math.sin(angle) * (this.data.radius * 0.7) * variance });
        }
        this.bokeh = [];
        for(let i=0; i<6; i++) {
            this.bokeh.push({
                ox: (Math.random() - 0.5) * this.data.radius * 1.2,
                oy: (Math.random() - 0.5) * this.data.radius * 0.8,
                r: this.data.radius * (0.15 + Math.random() * 0.25),
                alpha: 0.15 + Math.random() * 0.35
            });
        }
    }
    update(dt) {
        this.duration -= dt;
        this.game.enemies.forEach(e => {
            if (!e.alive) return;
            
            let cd = this.enemyCooldowns.get(e) || 0;
            if (cd > 0) this.enemyCooldowns.set(e, cd - dt);

            if (Math.hypot(e.x - this.x, e.y - this.y) <= this.data.radius) {
                if (e.ability && GameData.enemyAbilities[e.ability]?.ignoreGround) return;
                if ((this.enemyCooldowns.get(e) || 0) <= 0) {
                    e.takeDamage(this.stats.damage, this.stats.armorPenetration, false, this.tower, this.moveData);
                    if (this.data.status) e.statusManager.applyEffect(this.data.status);
                    this.enemyCooldowns.set(e, 1.0); // 1.0s internal tick per enemy
                }
            }
        });
    }
    draw(ctx) {
        ctx.save(); ctx.globalAlpha = Math.min(0.6, this.duration);
        ctx.fillStyle = this.data.status === 'burn' ? '#ea580c' : '#a855f7';
        ctx.beginPath(); ctx.moveTo(this.x + this.blobPoints[0].x, this.y + this.blobPoints[0].y);
        for(let i=1; i<=this.blobPoints.length; i++) {
            const p0 = this.blobPoints[(i - 1) % this.blobPoints.length];
            const p1 = this.blobPoints[i % this.blobPoints.length];
            ctx.quadraticCurveTo(this.x + p0.x, this.y + p0.y, this.x + (p0.x + p1.x)/2, this.y + (p0.y + p1.y)/2);
        }
        ctx.fill();

        ctx.globalCompositeOperation = 'screen';
        this.bokeh.forEach(b => {
            ctx.beginPath();
            ctx.fillStyle = this.data.status === 'burn' ? `rgba(255, 150, 50, ${b.alpha})` : `rgba(200, 100, 255, ${b.alpha})`;
            ctx.arc(this.x + b.ox, this.y + b.oy, b.r, 0, Math.PI*2); ctx.fill();
        });
        ctx.restore();
    }
}

class Projectile {
    constructor(game, x, y, target, tower, moveData) {
        this.game = game; this.x = x; this.y = y; this.target = target; this.tower = tower;
        this.stats = tower.computedStats; this.data = moveData; 
        this.moveData = moveData;
        
        // Generic Conditional Crit Check
        let isGuaranteedCrit = EffectEngine.getAllEffects(this.tower).some(eff => 
            eff.action === 'guaranteed_crit' && EffectEngine.checkCondition(this.tower, eff.condition, this.game, { target: target })
        );
        
        this.isCrit = isGuaranteedCrit ? true : (Math.random() < this.stats.critChance);
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
        let ignoresAbilities = EffectEngine.getAllEffects(this.tower).some(eff => eff.action === 'ignore_enemy_abilities');
        let hitList = [enemy];
        let chainContext = { hitsLeft: 0, radiusSq: 0, alreadyHit: [enemy] };
        let isChain = false;
        
        // 1. Identify all targets (Immediate + AOE + Chain)
        this.data.effects.forEach(eff => {
            if (eff.action === 'splash' && this.stats.splashRadius > 0) {
                const rSq = this.stats.splashRadius * this.stats.splashRadius;
                this.game.enemies.forEach(e => {
                    if (e.alive && e !== enemy && !hitList.includes(e) && ((e.x - enemy.x)**2 + (e.y - enemy.y)**2) <= rSq) hitList.push(e);
                });
            }
            if (eff.action === 'chain' && this.stats.chainCount > 0) {
                isChain = true;
                chainContext.hitsLeft = this.stats.chainCount;
                chainContext.radiusSq = this.stats.chainRadius * this.stats.chainRadius;
            }
             if (eff.action === 'spawn_zone') {
                this.game.zones.push(new PersistentZone(this.game, enemy.x, enemy.y, eff, this.stats, this.tower, this.moveData));
            }
             if (eff.action === 'chain') {
                chainContext.hitsLeft = EffectEngine.applyMath(chainContext.hitsLeft, 'add', eff.count - 1);
                chainContext.radiusSq = Math.max(chainContext.radiusSq || 0, eff.radius * eff.radius);
            }
        });

        // Add Item/Ability Chain Bonuses
        if (this.stats.chainCount > 0) {
            chainContext.hitsLeft = EffectEngine.applyMath(chainContext.hitsLeft, 'add', this.stats.chainCount);
            chainContext.radiusSq = Math.max(chainContext.radiusSq || 0, this.stats.chainRadius * this.stats.chainRadius);
        }

        // 2. Handle the "Chain" recursion
        let currentChainSource = enemy;
        while (chainContext.hitsLeft > 0) {
            let nextTarget = this.game.enemies.find(e => 
                e.alive && 
                !chainContext.alreadyHit.includes(e) && 
                ((e.x - currentChainSource.x)**2 + (e.y - currentChainSource.y)**2) <= chainContext.radiusSq
            );
            
            if (nextTarget) {
                hitList.push(nextTarget);
                chainContext.alreadyHit.push(nextTarget);
                currentChainSource = nextTarget;
                chainContext.hitsLeft--;
            } else break;
        }

        // 3. Execute all effects on the gathered list of targets
        hitList.forEach(target => {
            if (target.ability === 'shield_dust' && target !== enemy && !ignoresAbilities) return; 

           this.data.effects.forEach(eff => {
                if (eff.trigger === 'on_hit') {
                    if (eff.action === 'damage') target.takeDamage(this.damage * (eff.damageMultiplier || 1.0), this.stats.armorPenetration, this.isCrit, this.tower, this.moveData);
                }
            });

            ['burn', 'paralyze', 'freeze', 'poison'].forEach(status => {
                let chance = (this.stats[`${status}Chance`] || 0) * (this.stats.statusChanceMultiplier || 1.0);
                if (chance > 0 && Math.random() < chance) {
                    target.statusManager.applyEffect(status);
                    this.game.addFloatingText(target.x, target.y - 25, status.toUpperCase(), '#ffffff', 0.8);
                }
            });

            EffectEngine.dispatch(this.tower, 'on_hit', { target: target, chanceMultiplier: this.stats.statusChanceMultiplier || 1.0 });
        });

         if ((isChain || this.stats.chainCount > 0) && hitList.length > 1) {
            let color = (this.moveData?.tags?.includes('electric')) ? '#facc15' : '#38bdf8';
            this.game.visualEffects.push(new ChainVisual(hitList, color));
        }

        return false;
    }
    draw(ctx) {
        ctx.fillStyle = '#ffffff'; if (this.data.applyStatus === 'burn') ctx.fillStyle = '#f97316'; else if (this.data.applyStatus === 'freeze') ctx.fillStyle = '#38bdf8'; else if (this.data.applyStatus === 'paralyze') ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); ctx.fill();
    }
}

class Tower {
    constructor(game, dataId, x, y, abilitySlot = null, savedUnlockedMoves = null, savedCurrentMoveId = null, savedNature = null, savedRerollCount = 0) {
        this.game = game; this.x = x; this.y = y; this.level = 1; this.heldItem = null; this.targetingPriority = 'first'; this.cooldown = 0; this.direction = 0;
        this.terrain = this.game.getTerrainAt(x, y);
        
        const natureKeys = Object.keys(GameData.natures);
        this.nature = savedNature || natureKeys[Math.floor(Math.random() * natureKeys.length)];
        this.rerollCount = savedRerollCount;

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
    levelUp() { 
        this.level++; 
        if (this.data.evolution && this.level >= this.data.evolution.targetLevel) {
            this.setData(this.data.evolution.nextTowerId); 
            if (this.game) this.game.addFloatingText(this.x || this.game.canvas.width/2, this.y || this.game.canvas.height/2, "EVOLVED!", "#a855f7", 1.5);
        } else {
            this.updateLearnsetMoves(); 
        }
        this.calculateStats(); 
        this.game.recalcAllStats(); 
    }
     calculateStats() {
        let moveData = this.currentMoveId ? GameData.moves[this.currentMoveId] : null;
        let natureObj = GameData.natures[this.nature] || { atk: 1.0, spatk: 1.0, spd: 1.0 };

        this.computedStats = { 
            atk: (this.data.baseStats.atk || 0) * natureObj.atk,
            spatk: (this.data.baseStats.spatk || 0) * natureObj.spatk,
            range: (this.data.baseStats.range || 100) + (moveData?.extraRange || 0), 
            spd: (this.data.baseStats.spd || 1) * (moveData?.speedModifier || 1) * natureObj.spd, 
            
            // Ingest Move Base Properties into the Stat System
            movePower: moveData?.power || 0,
            projectileSpeed: moveData?.projectileSpeed || 400,
            chainCount: moveData?.chainCount || 0,
            chainRadius: moveData?.chainRadius || 0,
            splashRadius: moveData?.splashRadius || 0,
            
            critChance: this.data.baseStats.critChance || 0, 
            critMultiplier: this.data.baseStats.critMultiplier || 1.5, 
            armorPenetration: this.data.baseStats.armorPenetration || 0,
            damage: 1.0,
            statusChanceMultiplier: 1.0,
            burnChance: 0, paralyzeChance: 0, freezeChance: 0, poisonChance: 0
        };
        
        // Passively apply all dynamically configured JSON effects (Self & Auras)
        EffectEngine.applyPassives(this);
    }
    getUpgradeCost() { return Math.floor(GameData.towers[this.dataId].cost * 0.25 * this.level); }
    update(dt) {
        this.isUILocked = false; 
        if (this.stunTimer > 0) { this.stunTimer -= dt; return; }

        // Modular Tick System: Triggers every 1.0s
        this.tickTimer = (this.tickTimer || 0) + dt;
        if (this.tickTimer >= 1.0) {
            this.tickTimer -= 1.0;
            EffectEngine.dispatch(this, 'on_tick');
        }
        
        // Aura moves skip firing logic; buffs are applied via EffectEngine.applyPassives
        const moveData = this.currentMoveId ? GameData.moves[this.currentMoveId] : null;
        if (moveData && moveData.attackType === 'aura') return; 

        if (this.cooldown > 0) this.cooldown -= dt;
        let target = this.findTarget();
        if (target) { this.direction = getDirection(target.x - this.x, target.y - this.y); if (this.cooldown <= 0) { this.fire(target); this.cooldown = 1 / this.computedStats.spd; } }
    }
    findTarget() {
        const rangeSq = this.computedStats.range * this.computedStats.range;
        let targets = this.game.enemies.filter(e => e.alive && ((e.x - this.x)**2 + (e.y - this.y)**2) <= rangeSq);
        if (targets.length === 0) return null; 
        if (this.targetingPriority === 'first') targets.sort((a, b) => b.distTravelled - a.distTravelled); 
        else if (this.targetingPriority === 'last') targets.sort((a, b) => a.distTravelled - b.distTravelled); 
        else if (this.targetingPriority === 'strongest') targets.sort((a, b) => b.health - a.health); 
        else if (this.targetingPriority === 'weakest') targets.sort((a, b) => a.health - b.health);
        return targets[0];
    }
    fire(target) { 
        if (!this.currentMoveId) return;
        const moveData = GameData.moves[this.currentMoveId];
        this.game.projectiles.push(new Projectile(this.game, this.x, this.y, target, this, moveData)); 
        
        // Dispatch generic attack hooks (handles skill_link natively)
        EffectEngine.dispatch(this, 'on_attack', { target: target, moveData: moveData });
    }
    draw(ctx, isSelected) {
        const key = 'tower_walk_' + this.dataId;
        const asset = this.game.assetManager.getImage(key); 
        ctx.save(); 
        ctx.translate(this.x, this.y);
        
        const isBeingMoved = this.game.draggedTower === this;
        const moveData = this.currentMoveId ? GameData.moves[this.currentMoveId] : null;

        // Draw selection/drag range
        if (isSelected || isBeingMoved) { 
            ctx.fillStyle = isBeingMoved ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)'; 
            ctx.strokeStyle = isBeingMoved ? '#3b82f6' : 'rgba(255, 255, 255, 0.4)'; 
            ctx.beginPath(); ctx.arc(0, 0, this.computedStats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); 
        }

        // Draw Active Aura Move Visual
        if (moveData && moveData.attackType === 'aura') {
            const pulse = (Math.sin(Date.now() / 400) * 0.05) + 0.1; // Subtle pulse logic
            ctx.beginPath(); ctx.arc(0, 0, this.computedStats.range, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`; // Faint Gold
            ctx.fill();
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
            ctx.lineWidth = 1; ctx.stroke();
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
        const prefix = "/static/pokemon_tower/";
        if (GameData.config.mapImage && !GameData.config.mapImage.startsWith(prefix)) GameData.config.mapImage = prefix + GameData.config.mapImage;
        if (GameData.config.terrainMaskImage && !GameData.config.terrainMaskImage.startsWith(prefix)) GameData.config.terrainMaskImage = prefix + GameData.config.terrainMaskImage;
        [GameData.towers, GameData.enemies].forEach(collection => {
            Object.values(collection).forEach(obj => {
                if (obj.iconPath && !obj.iconPath.startsWith(prefix)) obj.iconPath = prefix + obj.iconPath;
                if (obj.walkingSprite && !obj.walkingSprite.startsWith(prefix)) obj.walkingSprite = prefix + obj.walkingSprite;
            });
        });
        
        this.ctx = this.canvas.getContext('2d'); 
        this.ctx.imageSmoothingEnabled = false; // Keep pixel art sharp
        this.assetManager = new AssetManager(); this.loadAssets();
        this.towers = []; this.enemies = []; this.projectiles = []; this.floatingTexts = []; this.zones = []; this.visualEffects = [];
        this.money = GameData.config.startingMoney; this.lives = GameData.config.startingLives; this.waveIndex = 0; this.spawnTimer = 0; this.waveActive = false;
        this.currentGroupIndex = 0; this.spawnedInGroup = 0; this.lastWaveIndex = -1;
        this.selectedTower = null; this.placementMode = null; this.mousePos = { x: 0, y: 0 };
         this.draggedTower = null; this.dragOrigin = { x: 0, y: 0 };
        this.buyCount = 0;
        this.bench = []; // Pokémon owned but not placed
        this.inventory = {}; // itemID: count
        this.tmTargetingMode = null;
        this.terrainImageData = null; this.bindUI(); this.updateHUD();
        this.timeScale = 1.0; this.isPaused = false;
        this.autoSaveTimer = 10;
        if (typeof GameAdmin !== 'undefined') GameAdmin.init(this);
        this.lastTime = performance.now();
        this.loadSaveState(true); 
        this.updateInventoryView();

        // Responsive Scaling & Mobile Setup
        window.addEventListener('resize', () => this.updateResponsiveScale());
        window.addEventListener('orientationchange', () => setTimeout(() => this.updateResponsiveScale(), 150));
        this.updateResponsiveScale();

        const fsBtn = document.getElementById('btn-force-fullscreen');
        if (fsBtn) {
            fsBtn.addEventListener('click', async () => {
                try {
                    if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                    } else if (document.documentElement.webkitRequestFullscreen) {
                        await document.documentElement.webkitRequestFullscreen();
                    }
                    if (screen.orientation && screen.orientation.lock) {
                        await screen.orientation.lock('landscape').catch(() => {});
                    }
                } catch(e) {}
            });
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    autoSave(dt) {
        this.autoSaveTimer -= dt;
        if (this.autoSaveTimer <= 0) {
            this.autoSaveTimer = 10;
            // Prevent auto-save during a wave to prevent the "re-farming" money exploit
            if (!this.waveActive) {
                console.log("Auto-saving game...");
                this.saveGame(true); // true = quiet save
            }
        }
    }

    async loadAssets() {
        this.assetManager.loadImage('map', GameData.config.mapImage);
        
        // Load Terrain Mask Image asynchronously
        if (GameData.config.terrainMaskImage) {
            const mask = await this.assetManager.loadImage('terrain_mask', GameData.config.terrainMaskImage);
            if (mask && mask.img) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = GameData.config.mapWidth;
                tempCanvas.height = GameData.config.mapHeight;
                const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                tempCtx.drawImage(mask.img, 0, 0, tempCanvas.width, tempCanvas.height);
                this.terrainImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
            }
        }

        for (const data of Object.values(GameData.towers)) { 
            if (data.iconPath) this.assetManager.loadImage('tower_icon_' + data.id, data.iconPath); 
            if (data.walkingSprite) this.assetManager.loadImage('tower_walk_' + data.id, data.walkingSprite, true); 
        }
        for (const data of Object.values(GameData.enemies)) { 
            if (data.iconPath) this.assetManager.loadImage('enemy_icon_' + data.id, data.iconPath); 
            if (data.walkingSprite) this.assetManager.loadImage('enemy_walk_' + data.id, data.walkingSprite, true); 
        }
    }

    getTerrainAt(x, y) {
        if (!this.terrainImageData) return 'no_placement';
        x = Math.floor(Math.max(0, Math.min(x, GameData.config.mapWidth - 1)));
        y = Math.floor(Math.max(0, Math.min(y, GameData.config.mapHeight - 1)));
        
        const idx = (y * GameData.config.mapWidth + x) * 4;
        const r = this.terrainImageData[idx], g = this.terrainImageData[idx+1], b = this.terrainImageData[idx+2], a = this.terrainImageData[idx+3];
        
        // Ignore transparent or highly faint pixels
        if (a < 10) return 'no_placement';

        let minDt = Infinity; let best = 'no_placement';
        for (const [tag, color] of Object.entries(GameData.config.terrainColors)) {
            let dt = (r - color[0])**2 + (g - color[1])**2 + (b - color[2])**2;
            if (dt < minDt) { minDt = dt; best = tag; }
        }
        
        // Strict threshold (approx 63 units per channel). 
        // If the pixel is a "blended" edge, it defaults to 'no_placement' to close the gap.
        return minDt > 4000 ? 'no_placement' : best; 
    }

    inspectEnemy(id, instanceEnem = null) {
        const enemy = GameData.enemies[id]; if (!enemy) return;
        const panel = document.getElementById('enemy-stat-preview'); panel.classList.remove('hidden');
        document.getElementById('enemy-inspect-name').innerText = enemy.name.toUpperCase();
        document.getElementById('enemy-inspect-hp').innerText = `HP: ${instanceEnem ? Math.round(instanceEnem.health) : enemy.hp}`;
        document.getElementById('enemy-inspect-spd').innerText = instanceEnem ? (instanceEnem.data.spd * (instanceEnem.speedScale || 1.0)).toFixed(1) : enemy.spd;
        document.getElementById('enemy-inspect-def').innerText = instanceEnem ? Math.round(instanceEnem.def) : enemy.def;
        document.getElementById('enemy-inspect-spdef').innerText = instanceEnem ? Math.round(instanceEnem.spDef) : enemy.spDef;
        
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
            groupsHtml += `<div class="stat-box">Stage ${idx+1}: <span>[Lv.${g.level || 1}] ${g.count}x ${enemy.name}</span></div>`;
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

    renderShop() {
        const listContainer = document.getElementById('tower-list');
        listContainer.innerHTML = '';
        
        // --- Random Buy Button ---
        const rBtn = document.createElement('div'); 
        rBtn.className = 'tower-btn'; 
        rBtn.innerHTML = `
            <div class="icon-container" style="background:#444; font-size: 24px; color: #fff; line-height: 48px;">?</div>
            <span>RANDOM</span>
            <div class="shop-actions">
                <button class="buy-btn-shop" style="width: 100%">Buy $${this.getRandomBuyPrice()}</button>
            </div>
        `;
        rBtn.querySelector('.buy-btn-shop').onclick = () => this.buyPokemon(null, true);
        listContainer.appendChild(rBtn);

        // --- Specific Buy Pool ---
        const shopPool = this.getShopPool();
        for (const id of shopPool) {
            const data = GameData.towers[id]; 
            const btn = document.createElement('div'); 
            btn.className = 'tower-btn';
            btn.innerHTML = `
                <div class="icon-container" style="background:${data.placeholderColor}"><img src="${data.iconPath}" /></div>
                <span>${data.name}</span>
                <div class="shop-actions">
                    <button class="info-btn">i</button>
                    <button class="buy-btn-shop">$${this.getDynamicPrice(data.cost)}</button>
                </div>
            `;
            btn.querySelector('.info-btn').onclick = (e) => { e.stopPropagation(); this.previewShopPokemon(id); };
            btn.querySelector('.buy-btn-shop').onclick = (e) => { e.stopPropagation(); this.buyPokemon(id, false); };
            listContainer.appendChild(btn);
        }
    }

    previewShopPokemon(id) {
        this.selectedTower = new Tower(this, id, null, null);
        this.selectedTower.isPreview = true;
        document.querySelector('[data-tab="tab-inspect"]').click();
        this.updateInspector();
    }

    bindUI() {
        // Init Shop
        this.renderShop();

        const upBtn = document.getElementById('level-up-btn');
        if (upBtn) {
            upBtn.addEventListener('mouseenter', () => this.levelUpPreview(true));
            upBtn.addEventListener('mouseleave', () => this.levelUpPreview(false));
        }

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

        // Event Listeners with Canvas Coordinate Scaling & Touch Support
        const updateCoords = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.mousePos.x = (clientX - rect.left) * (this.canvas.width / rect.width);
                this.mousePos.y = (clientY - rect.top) * (this.canvas.height / rect.height);
            }
        };

        this.canvas.addEventListener('mousemove', (e) => { 
            updateCoords(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('click', (e) => {
            updateCoords(e.clientX, e.clientY);
            this.onCanvasClick(e);
        });

        // Cancel placement or move on right-click or Escape
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.placementMode) {
                this.cancelPlacement();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.placementMode) {
                this.cancelPlacement();
            }
        });

        // Mobile Touch Listeners
        const getTouchPos = (e) => {
            const touch = e.touches[0] || (e.changedTouches && e.changedTouches[0]);
            if (touch) updateCoords(touch.clientX, touch.clientY);
        };

        this.canvas.addEventListener('touchstart', (e) => {
            getTouchPos(e);
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            getTouchPos(e);
        }, { passive: true });

        this.canvas.addEventListener('touchend', (e) => {
            getTouchPos(e);
            this.onCanvasClick(e);
        }, { passive: true });

        this.canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.placementMode = null; document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected')); });
        document.getElementById('inspect-target').addEventListener('change', (e) => { 
            if (this.selectedTower) { 
                this.selectedTower.targetingPriority = e.target.value; 
                document.getElementById('inspect-target-display').innerText = e.target.options[e.target.selectedIndex].text;
            } 
        });
        const inspectUpBtn = document.getElementById('level-up-btn');
        if (inspectUpBtn) inspectUpBtn.addEventListener('click', () => { 
            if (this.selectedTower) { 
                const t = this.selectedTower;
                const cost = t.getUpgradeCost ? t.getUpgradeCost() : 50;
                this.promptConfirm('upgrade', `Are you sure you want to upgrade ${t.data.name} to Lv.${t.level + 1} for $${cost}?`, () => {
                    this.levelUpTower(t);
                });
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

        // Close custom ability dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const container = document.getElementById('inspect-abilities-container');
            const dropdown = document.getElementById('custom-ability-dropdown');
            const arrow = document.getElementById('ability-dropdown-arrow');
            if (container && dropdown && !container.contains(e.target)) {
                dropdown.classList.remove('open');
                dropdown.classList.add('hidden');
                dropdown.style.display = 'none';
                const svg = arrow?.querySelector('.ability-chevron-svg');
                if (svg) svg.classList.remove('open');
            }
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
        
        // Bench / Sell
        const inspectBenchBtn = document.getElementById('bench-btn');
        if (inspectBenchBtn) inspectBenchBtn.addEventListener('click', () => {
            if (this.selectedTower) {
                const t = this.selectedTower;
                const isBenched = this.bench.includes(t);
                if (isBenched) {
                    this.promptConfirm('place', `Are you sure you want to place ${t.data.name} on the field?`, () => {
                        this.placementMode = t;
                        this.updateInspector();
                        this.updateTeamList();
                    });
                } else {
                    this.promptConfirm('bench', `Are you sure you want to bench ${t.data.name}?`, () => {
                        this.benchTower(t);
                    });
                }
            }
        });
        const inspectSellBtn = document.getElementById('sell-btn');
        if (inspectSellBtn) inspectSellBtn.addEventListener('click', () => {
            if (this.selectedTower) {
                const t = this.selectedTower;
                let totalCost = GameData.towers[t.dataId] ? GameData.towers[t.dataId].cost : 100;
                for (let i = 1; i < t.level; i++) totalCost += Math.floor((GameData.towers[t.dataId]?.cost || 100) * 0.25 * i);
                const refund = Math.floor(totalCost * 0.7);
                this.promptConfirm('sell', `Are you sure you want to sell ${t.data.name} for $${refund}?`, () => {
                    this.sellTower(t);
                });
            }
        });
        
        // Save/Load/Wipe
        document.getElementById('wipe-btn').addEventListener('click', () => this.wipeData());
    }

    startPlacement(tower) {
        this.placementMode = tower;
        this.selectedTower = tower;
        this.generatePlacementOverlay(tower);
        this.updateInspector();
        this.updateTeamList();
    }

    cancelPlacement() {
        if (!this.placementMode) return;
        const t = this.placementMode;
        const isRepositioning = this.towers.includes(t);
        if (isRepositioning && this.repositionOrigin) {
            t.x = this.repositionOrigin.x;
            t.y = this.repositionOrigin.y;
            this.addFloatingText(t.x, t.y, "MOVE CANCELLED", "#94a3b8", 0.5);
        } else {
            this.addFloatingText(this.mousePos.x, this.mousePos.y, "CANCELLED", "#94a3b8", 0.5);
        }
        this.placementMode = null;
        this.repositionOrigin = null;
        this._placementOverlay = null;
        this.updateTeamList();
        this.updateInspector();
    }

    generatePlacementOverlay(tower) {
        if (!this.terrainImageData) {
            this._placementOverlay = null;
            return;
        }
        if (!this._overlayCanvas) {
            this._overlayCanvas = document.createElement('canvas');
            this._overlayCanvas.width = GameData.config.mapWidth;
            this._overlayCanvas.height = GameData.config.mapHeight;
        }
        const oCtx = this._overlayCanvas.getContext('2d');
        oCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);

        // Pre-render a subtle tactical grid (grid size 16x16)
        const step = 16;
        for (let y = 0; y < GameData.config.mapHeight; y += step) {
            for (let x = 0; x < GameData.config.mapWidth; x += step) {
                const centerX = x + step / 2;
                const centerY = y + step / 2;
                const isValid = this.checkPlacement(tower.dataId, centerX, centerY);
                if (isValid) {
                    oCtx.fillStyle = 'rgba(34, 197, 94, 0.10)';
                    oCtx.fillRect(x + 1, y + 1, step - 2, step - 2);
                    oCtx.strokeStyle = 'rgba(34, 197, 94, 0.22)';
                    oCtx.strokeRect(x + 0.5, y + 0.5, step - 1, step - 1);
                } else {
                    const terrain = this.getTerrainAt(centerX, centerY);
                    if (terrain === 'no_placement') {
                        oCtx.fillStyle = 'rgba(239, 68, 68, 0.08)';
                        oCtx.fillRect(x + 1, y + 1, step - 2, step - 2);
                    }
                }
            }
        }
        this._placementOverlay = this._overlayCanvas;
    }

    checkPlacement(towerId, x, y) {
        if (x < 16 || x > GameData.config.mapWidth - 16 || y < 16 || y > GameData.config.mapHeight - 16) return false;
        const data = GameData.towers[towerId];
        const terrain = this.getTerrainAt(x, y); 
        
        if (terrain === 'no_placement') return false;
        
        let canBypass = false;
        let absToCheck = data.abilities || data.possibleAbilities || [];
        canBypass = absToCheck.some(aId => {
            const ab = GameData.towerAbilities[aId];
            return ab && ab.effects && ab.effects.some(eff => eff.trigger === 'passive' && eff.action === 'placement_bypass');
        });
        
        if (canBypass && terrain !== 'no_placement') return true;
        return data.placementTags.includes(terrain);
    }

    onCanvasClick(e) {
        // 1. If currently in placement / move mode:
        if (this.placementMode) {
            this.tmTargetingMode = null;
            const t = this.placementMode;
            const isRepositioning = this.towers.includes(t);

            if (this.checkPlacement(t.dataId, this.mousePos.x, this.mousePos.y)) {
                if (!isRepositioning && this.towers.length >= 6) {
                    this.addFloatingText(this.mousePos.x, this.mousePos.y, "MAX 6 ON MAP", "#ef4444");
                    this.placementMode = null;
                    this._placementOverlay = null;
                    this.updateTeamList();
                    return;
                }
                
                t.x = this.mousePos.x;
                t.y = this.mousePos.y;
                t.terrain = this.getTerrainAt(t.x, t.y);
                t.calculateStats();

                if (!isRepositioning) {
                    this.towers.push(t);
                    this.bench = this.bench.filter(b => b !== t);
                    this.addFloatingText(t.x, t.y, "PLACED", "#10b981", 0.5);
                } else {
                    this.addFloatingText(t.x, t.y, "MOVED", "#3b82f6", 0.5);
                }

                this.placementMode = null;
                this.repositionOrigin = null;
                this._placementOverlay = null;
                this.recalcAllStats();
                this.updateHUD();
                this.updateInspector();
                this.updateTeamList();
            } else {
                // Invalid terrain: do NOT stop, continue showing red tint until valid click
                this.addFloatingText(this.mousePos.x, this.mousePos.y, "Invalid Terrain!", "#ef4444");
            }
            return;
        }

        // 2. TM teaching mode
        if (this.tmTargetingMode) {
            let target = this.towers.find(t => Math.hypot(t.x - this.mousePos.x, t.y - this.mousePos.y) <= 20);
            if (target) {
                this.attemptTeachTM(target, this.tmTargetingMode);
            } else {
                this.addFloatingText(this.mousePos.x, this.mousePos.y, "TM CANCELLED", "#94a3b8");
                this.tmTargetingMode = null;
            }
            return;
        }

        // 3. Clicking on a placed tower on the canvas to pick up and move
        let clickedTower = null;
        for (let t of this.towers) {
            if (Math.hypot(t.x - this.mousePos.x, t.y - this.mousePos.y) <= 25) {
                clickedTower = t;
                break;
            }
        }

        if (clickedTower) {
            this.selectedTower = clickedTower;
            this.updateInspector();
            this.updateTeamList();

            if (this.waveActive) {
                this.addFloatingText(clickedTower.x, clickedTower.y, "WAVE IN PROGRESS", "#f59e0b", 0.4);
                return;
            }

            // Pick up the placed Pokémon to move it!
            this.placementMode = clickedTower;
            this.repositionOrigin = { x: clickedTower.x, y: clickedTower.y };
            this.generatePlacementOverlay(clickedTower);
            return;
        }

        // 4. Clicked empty space or enemy
        this.selectedTower = null;
        for (let e of this.enemies) {
            if (e.alive && Math.hypot(e.x - this.mousePos.x, e.y - this.mousePos.y) <= 20) {
                this.inspectEnemy(e.dataId, e);
                document.querySelector('[data-tab="tab-wave"]').click();
                return;
            }
        }
        this.updateInspector();
        this.updateTeamList();
    }
    updateHUD() { 
        const m = Math.floor(this.money), w = this.waveIndex + (this.waveActive ? 1 : 0);
        if (this._lastMoney !== m) { document.getElementById('money-display').innerText = m; this._lastMoney = m; }
        if (this._lastLives !== this.lives) { document.getElementById('lives-display').innerText = this.lives; this._lastLives = this.lives; }
        if (this._lastWave !== w) { document.getElementById('wave-display').innerText = w; this._lastWave = w; }
        this.updateWaveTab();
    }
    
    updateTeamList() {
        const list = document.getElementById('my-team-list');
        list.innerHTML = '';

        // Combine Active and Bench Towers (Placed towers first!)
        const allMembers = [
            ...this.towers.map(t => ({ tower: t, status: 'active' })),
            ...this.bench.map(t => ({ tower: t, status: 'bench' }))
        ];

        if (allMembers.length === 0) {
            list.innerHTML = '<p class="empty-msg">No Pokémon on team.</p>';
            return;
        }

        // Custom SVGs:
        // Upgrade = two ^ stacked on top
        const SVG_UPGRADE = `<svg class="team-btn-svg" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5l5-4 5 4"/><path d="M3 12.5l5-4 5 4"/></svg>`;
        // Warehouse = Warehouse outline (orange when benched, green when placed, used for bench button)
        const SVG_WAREHOUSE = `<svg class="team-btn-svg warehouse-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5L8 2.5l5.5 5V14a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7.5z"/><path d="M6 15V9.5a2 2 0 0 1 4 0V15"/></svg>`;
        // Place = GPS Marker
        const SVG_GPS = `<svg class="team-btn-svg gps-svg" viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path fill-rule="evenodd" d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" clip-rule="evenodd"/></svg>`;
        // Sell = Dollar sign
        const SVG_DOLLAR = `<svg class="team-btn-svg dollar-svg" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="1.5" x2="8" y2="14.5"/><path d="M11 4.5H6.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H5"/></svg>`;

        allMembers.forEach((item) => {
            const t = item.tower;
            const el = document.createElement('div');
            el.className = 'team-member' + (item.status === 'active' ? ' placed' : '');
            
            const isPlacing = this.placementMode === t;
            const isSelected = this.selectedTower === t;
            if (isPlacing || isSelected) el.classList.add('selected');

            const upCost = t.getUpgradeCost ? t.getUpgradeCost() : 50;
            let totalCost = GameData.towers[t.dataId] ? GameData.towers[t.dataId].cost : 100;
            for (let i = 1; i < t.level; i++) totalCost += Math.floor((GameData.towers[t.dataId]?.cost || 100) * 0.25 * i);
            const refund = Math.floor(totalCost * 0.7);

            el.innerHTML = `
                <div class="team-member-icon-box" style="${item.status === 'bench' ? 'filter: brightness(0.85);' : ''}">
                    <img src="${t.data.iconPath}" alt="${t.data.name}">
                </div>
                <div class="team-member-content">
                    <div class="team-member-header">
                        <div class="team-member-name-lvl">
                            <span class="tm-name">${t.data.name}</span>
                            <span class="tm-lvl">Lv.${t.level}</span>
                        </div>
                        <span class="team-status-icon ${item.status === 'bench' ? 'benched' : 'placed'}" title="${item.status === 'bench' ? 'Benched' : 'Placed'}">
                            ${SVG_WAREHOUSE}
                        </span>
                    </div>
                    <div class="team-member-actions">
                        <button class="team-action-btn btn-up" title="Upgrade Lv.${t.level + 1} ($${upCost})">
                            ${SVG_UPGRADE} <span>$${formatCurrency(upCost)}</span>
                        </button>
                        <button class="team-action-btn ${item.status === 'bench' ? 'btn-place' : 'btn-bench'}" title="${item.status === 'bench' ? 'Place on Map' : 'Bench'}">
                            ${item.status === 'bench' ? SVG_GPS + ' <span>PLACE</span>' : SVG_WAREHOUSE + ' <span>BENCH</span>'}
                        </button>
                        <button class="team-action-btn btn-sell" title="Sell ($${refund})">
                            ${SVG_DOLLAR} <span>$${formatCurrency(refund)}</span>
                        </button>
                    </div>
                </div>
            `;

            // Clicking main card: select and inspect
            el.onclick = (e) => {
                if (this.tmTargetingMode) {
                    this.attemptTeachTM(t, this.tmTargetingMode);
                    return;
                }
                this.selectedTower = t;
                this.updateInspector();
                this.updateTeamList();
            };

            // Upgrade Action Button
            const upBtn = el.querySelector('.btn-up');
            upBtn.onclick = (e) => {
                e.stopPropagation();
                this.promptConfirm('upgrade', `Are you sure you want to upgrade ${t.data.name} to Lv.${t.level + 1} for $${upCost}?`, () => {
                    this.levelUpTower(t);
                });
            };

            // Bench or Place Action Button
            const bpBtn = el.querySelector('.btn-place, .btn-bench');
            bpBtn.onclick = (e) => {
                e.stopPropagation();
                if (item.status === 'bench') {
                    this.promptConfirm('place', `Are you sure you want to place ${t.data.name} on the field?`, () => {
                        this.startPlacement(t);
                    });
                } else {
                    this.promptConfirm('bench', `Are you sure you want to bench ${t.data.name}?`, () => {
                        this.benchTower(t);
                    });
                }
            };

            // Sell Action Button
            const sellBtn = el.querySelector('.btn-sell');
            sellBtn.onclick = (e) => {
                e.stopPropagation();
                this.promptConfirm('sell', `Are you sure you want to sell ${t.data.name} for $${refund}?`, () => {
                    this.sellTower(t);
                });
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
        const isPreview = t.isPreview === true;

        // Hide contextual actions if strictly previewing
        const pUpBtn = document.getElementById('level-up-btn');
        const pSellBtn = document.getElementById('sell-btn');
        if (pUpBtn) pUpBtn.style.display = isPreview ? 'none' : 'block';
        if (pSellBtn) pSellBtn.style.display = isPreview ? 'none' : 'block';
        document.getElementById('inspect-item-select').disabled = isPreview;
        document.getElementById('inspect-move-select').disabled = isPreview;

        
        document.getElementById('inspect-name').innerText = d.name; 
        document.getElementById('inspect-level').innerText = t.level;
        
        // Nature Colors & Logic
        const nData = GameData.natures[t.nature] || { atk: 1.0, spatk: 1.0, spd: 1.0 };
        const rerollCost = 50 * Math.pow(2, t.rerollCount || 0);
        
        const natureBtn = document.getElementById('nature-tag-btn');
        document.getElementById('inspect-nature-text').innerText = isPreview ? '????' : t.nature;
        natureBtn.onclick = isPreview ? null : () => window.game.rerollTower('nature');
        natureBtn.title = isPreview ? 'Nature' : `Reroll Nature ($${rerollCost})`;
        
        // Target Dropdown Sync
        const targetSel = document.getElementById('inspect-target');
        targetSel.value = t.targetingPriority;
        document.getElementById('inspect-target-display').innerText = targetSel.options[targetSel.selectedIndex].text;

        // Unified Type Tags (Wrapped in the new border group)
        const tagsContainer = document.getElementById('inspect-tags');
        if (tagsContainer) {
            const tagsHtml = (d.tags ||[]).map(tag => `<span class="type-tag bg-${tag.toLowerCase()}">${tag}</span>`).join('');
            tagsContainer.innerHTML = `<div class="type-group">${tagsHtml}</div>`;
        }

        // Ability Section (Expandable Other Possible Abilities)
        const abText = document.getElementById('ability-text-content');
        const abTrigger = document.getElementById('ability-dropdown-trigger');
        const abDropdown = document.getElementById('custom-ability-dropdown');
        const abArrow = document.getElementById('ability-dropdown-arrow');

        if (abText && abTrigger && abDropdown) {
            abDropdown.innerHTML = '';
            abDropdown.classList.remove('open');
            abDropdown.classList.add('hidden');
            abDropdown.style.display = 'none';
            const svgArrow = abArrow ? abArrow.querySelector('.ability-chevron-svg') : null;
            if (svgArrow) svgArrow.classList.remove('open');

            const getAbilityData = (id) => GameData.towerAbilities?.[id] || GameData.enemyAbilities?.[id] || { id, name: id, description: 'Special ability' };
            const aId = t.abilities && t.abilities[0];
            const a = aId ? getAbilityData(aId) : null;

            if (isPreview) {
                const possibleNames = (d.possibleAbilities || []).map(id => getAbilityData(id)?.name).join(' / ');
                abText.innerHTML = `<div class="custom-ability-title" style="margin-bottom: 2px;">Possible:</div><div style="color:#94a3b8; line-height:1.35; font-size:6px;">${possibleNames || 'None'}</div>`;
            } else if (a) {
                abText.innerHTML = `<div class="custom-ability-title" style="margin-bottom: 3px;">${a.name}</div><div style="color:#f8fafc; font-size:6px; line-height:1.35;">${a.description}</div>`;
            } else {
                abText.innerHTML = `<div style="color:#94a3b8; font-size:6px;">No Ability</div>`;
            }

            // Populate other possible abilities (strictly display/show only)
            const allPossible = d.possibleAbilities || (t.abilities ? t.abilities : []);
            const otherPossible = allPossible.filter(pId => pId !== aId);

            if (otherPossible.length > 0) {
                if (abArrow) abArrow.style.display = 'flex';
                otherPossible.forEach(pId => {
                    const abData = getAbilityData(pId);
                    if (!abData) return;
                    const item = document.createElement('div');
                    item.className = 'custom-ability-item';
                    item.innerHTML = `
                        <div class="custom-ability-title" style="margin-bottom: 3px;">${abData.name}:</div>
                        <div class="custom-ability-desc">${abData.description}</div>
                    `;
                    abDropdown.appendChild(item);
                });

                abTrigger.onclick = (e) => {
                    e.stopPropagation();
                    const isOpen = abDropdown.classList.contains('open') || abDropdown.style.display === 'block';
                    if (isOpen) {
                        abDropdown.classList.remove('open');
                        abDropdown.classList.add('hidden');
                        abDropdown.style.display = 'none';
                        if (svgArrow) svgArrow.classList.remove('open');
                    } else {
                        abDropdown.classList.remove('hidden');
                        abDropdown.classList.add('open');
                        abDropdown.style.display = 'block';
                        if (svgArrow) svgArrow.classList.add('open');
                    }
                };
            } else {
                abTrigger.onclick = null;
                if (abArrow) abArrow.style.display = 'none';
            }
        }
        
        // Formatted Stats logic
        const formatStat = (val, mod) => {
            let color = '#ffffff'; 
            if (!isPreview && mod > 1.0) color = '#22c55e'; 
            if (!isPreview && mod < 1.0) color = '#ef4444'; 
            return `<span style="color: ${color};">${val}</span>`;
        };

        const lvlScale = 1 + ((t.level - 1) * 0.15);
        const curAtk = (d.baseStats.atk || 0) * lvlScale * (isPreview ? 1.0 : nData.atk);
        const curSpatk = (d.baseStats.spatk || 0) * lvlScale * (isPreview ? 1.0 : nData.spatk);
        const curSpd = (d.baseStats.spd || 1.0) * (isPreview ? 1.0 : nData.spd);

        document.getElementById('inspect-base-atk').innerHTML = formatStat(Math.round(curAtk), nData.atk);
        document.getElementById('inspect-base-spatk').innerHTML = formatStat(Math.round(curSpatk), nData.spatk);
        document.getElementById('inspect-base-spd').innerHTML = formatStat(curSpd.toFixed(2), nData.spd);

        let moveData = t.currentMoveId ? GameData.moves[t.currentMoveId] : null;
        let pwr = moveData ? moveData.power : 0;
        let isSpecial = moveData?.category === 'special';
        let genericAtk = isSpecial ? curSpatk : curAtk;
        let displayedDmg = pwr > 0 ? (((2 * t.level / 5 + 2) * pwr * (genericAtk / 50)) / 2) * stats.damage : 0;
        
        document.getElementById('inspect-dmg').innerText = displayedDmg.toFixed(1);
        document.getElementById('inspect-range').innerText = stats.range.toFixed(0); 
        document.getElementById('inspect-crit').innerText = (stats.critChance * 100).toFixed(0) + '%';
        
        const sCont = document.getElementById('inspect-status-container');
        sCont.innerHTML = '';
        const statuses =[
            { k: 'burnChance', l: 'Brn', c: '#ef4444' },
            { k: 'paralyzeChance', l: 'Par', c: '#facc15' },
            { k: 'freezeChance', l: 'Frz', c: '#38bdf8' },
            { k: 'poisonChance', l: 'Psn', c: '#a855f7' }
        ];
        statuses.forEach(s => {
            const chance = (stats[s.k] || 0) * (stats.statusChanceMultiplier || 1.0) * 100;
            if (chance > 0) {
                sCont.innerHTML += `<div style="color:${s.c}">${s.l}:<span style="float:right; color:#fff;">${Math.round(Math.min(100, chance))}%</span></div>`;
            }
        }); 

        const rateEl = document.getElementById('inspect-rate');
        const finalRate = stats.spd;
        const natureBaseSpd = (d.baseStats.spd || 1.0) * (isPreview ? 1.0 : nData.spd);
        
        rateEl.innerText = finalRate.toFixed(2) + '/s';
        if (finalRate > natureBaseSpd + 0.01) rateEl.style.color = '#22c55e'; 
        else if (finalRate < natureBaseSpd - 0.01) rateEl.style.color = '#ef4444'; 
        else rateEl.style.color = '#ffffff';

        // Move Card Rendering
        const moveContainer = document.getElementById('move-container');
        const moveSel = document.getElementById('inspect-move-select');
        moveSel.innerHTML = '';
        
        if (t.unlockedMoves && t.unlockedMoves.length > 0) {
            t.unlockedMoves.forEach(mId => {
                const md = GameData.moves[mId];
                const opt = document.createElement('option'); opt.value = mId; opt.innerText = md ? md.name : mId;
                moveSel.appendChild(opt);
            });
            
            if (d.learnset) {
                d.learnset.forEach(m => {
                    if (!t.unlockedMoves.includes(m.moveId)) {
                        const md = GameData.moves[m.moveId];
                        const opt = document.createElement('option');
                        opt.value = m.moveId; opt.innerText = `[Lv.${m.level}] ${md ? md.name : m.moveId}`;
                        opt.disabled = true; opt.style.color = '#94a3b8';
                        moveSel.appendChild(opt);
                    }
                });
            }

            if (d.tmList) {
                d.tmList.forEach(mId => {
                    if (!t.unlockedMoves.includes(mId)) {
                        const md = GameData.moves[mId];
                        const opt = document.createElement('option');
                        opt.value = mId; opt.innerText = `[TM] ${md ? md.name : mId}`;
                        opt.disabled = true; opt.style.color = '#94a3b8';
                        moveSel.appendChild(opt);
                    }
                });
            }

            if (!isPreview) moveSel.value = t.currentMoveId;
            
            const curMove = GameData.moves[t.currentMoveId];
            if (curMove) {
                document.getElementById('move-name-display').innerText = curMove.name;
                const tagEl = document.getElementById('move-type-display');
                const tName = curMove.tags && curMove.tags[0] ? curMove.tags[0] : 'normal';
                tagEl.innerText = tName.toUpperCase();
                tagEl.className = `type-tag bg-${tName.toLowerCase()}`;
                moveContainer.className = `move-bg-${tName.toLowerCase()}`;
                
                document.getElementById('move-cat-display').innerText = curMove.category.toUpperCase();
                document.getElementById('move-cat-display').style.color = curMove.category === 'special' ? '#c084fc' : '#f87171';
                document.getElementById('move-pow-display').innerText = curMove.power;
            }
        }

        // Evolution Section & Management Lock Handling
        const evoContainer = document.getElementById('inspect-evo-warning');
        const upBtn = document.getElementById('level-up-btn');
        const sellBtn = document.getElementById('sell-btn');
        const itemSel = document.getElementById('inspect-item-select');

        if (this.isManagementLocked) {
            if (upBtn) upBtn.disabled = true;
            if (sellBtn) sellBtn.disabled = true;
            itemSel.disabled = true;
            evoContainer.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; border-radius: 2px; color: #ef4444; padding: 6px; font-size: 6px; text-align: center; text-transform: uppercase;">
                    Shadow Tag: Management Locked
                </div>`;
            evoContainer.classList.remove('hidden');
        } else if (d.evolution && !isPreview) {
            if (upBtn) upBtn.disabled = false;
            if (sellBtn) sellBtn.disabled = false;
            itemSel.disabled = false;
            const nextData = GameData.towers[d.evolution.nextTowerId];
            
            // PROFESSIONAL POLISH: Unified Type Group for the Evolution result
            const evolBadgesHtml = (nextData.tags || []).map(tag => 
                `<span class="type-tag bg-${tag.toLowerCase()}" style="font-size: 5px; padding: 2px 4px;">${tag}</span>`
            ).join('');

            evoContainer.innerHTML = `
                <div style="background: #111; border: 3px solid #0000005e; border-radius: 2px; padding: 6px; display: flex; align-items: center; gap: 10px;">
                    <!-- Evolution Sprite -->
                    <div class="portrait-box" style="width: 32px; height: 32px; flex-shrink: 0; background: #000; border: 1px solid #444; border-radius: 2px;">
                        <img src="${nextData.iconPath}" style="width: 100%; height: 100%; object-fit: contain;">
                    </div>
                    
                    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
                        <!-- Name and Unified Type Badges -->
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 8px; color: #fff; text-shadow: 1px 1px 0 #000;">${nextData.name}</span>
                            <div class="type-group" style="transform: scale(0.9); transform-origin: right;">${evolBadgesHtml}</div>
                        </div>
                        
                        <!-- Condition Text -->
                        <div style="font-size: 6px; color: #94a3b8; letter-spacing: 0.3px;">
                            Evolves at Level ${d.evolution.targetLevel}
                        </div>
                    </div>
                </div>`;
            evoContainer.classList.remove('hidden');
        } else {
            if (upBtn) upBtn.disabled = false;
            if (sellBtn) sellBtn.disabled = false;
            itemSel.disabled = isPreview;
            evoContainer.classList.add('hidden');
        }

        // Action Buttons (Overwrites InnerHTML entirely to fix shadow text ghosting bug)
        const cost = t.getUpgradeCost(); 
        const isEvolving = d.evolution && t.level + 1 >= d.evolution.targetLevel; 

        const formattedCost = formatCurrency(cost);
        
        const SVG_UPGRADE = `<svg class="team-btn-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5l5-4 5 4"/><path d="M3 12.5l5-4 5 4"/></svg>`;
        const SVG_WAREHOUSE = `<svg class="team-btn-svg warehouse-svg" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5L8 2.5l5.5 5V14a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7.5z"/><path d="M6 15V9.5a2 2 0 0 1 4 0V15"/></svg>`;
        const SVG_GPS = `<svg class="team-btn-svg gps-svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path fill-rule="evenodd" d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" clip-rule="evenodd"/></svg>`;
        const SVG_DOLLAR = `<svg class="team-btn-svg dollar-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="1.5" x2="8" y2="14.5"/><path d="M11 4.5H6.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H5"/></svg>`;

        if (upBtn) {
            upBtn.innerHTML = `${SVG_UPGRADE} LVL UP ($${formattedCost})${isEvolving ? ' ▴' : ''}`;
            upBtn.style.background = isEvolving ? '#8b5cf6' : 'var(--accent)';
            upBtn.style.borderColor = isEvolving ? '#6d28d9' : '#be123c';
        }
        
        let totalCost = d.cost;
        for (let i = 1; i < t.level; i++) totalCost += Math.floor(d.cost * 0.25 * i);
        const sellPrice = Math.floor(totalCost * 0.7);
        const formattedSell = formatCurrency(sellPrice);

        if (sellBtn) sellBtn.innerHTML = `${SVG_DOLLAR} SELL ($${formattedSell})`;
        
        const benchBtn = document.getElementById('bench-btn');
        if (benchBtn) {
            const isBenched = this.bench.includes(t);
            benchBtn.innerHTML = isBenched ? `${SVG_GPS} PLACE` : `${SVG_WAREHOUSE} BENCH`;
            benchBtn.style.background = isBenched ? '#064e3b' : '#7c2d12';
            benchBtn.style.borderColor = isBenched ? '#059669' : '#ea580c';
            benchBtn.style.color = isBenched ? '#34d399' : '#fdba74';
        }
        

        const portrait = document.getElementById('inspect-portrait');
        portrait.src = d.iconPath;
        
        
        // Update Item Overlay
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
            slotUI.style.background = '#2563eb';
            slotUI.style.borderColor = '#60a5fa';
        } else {
            abbr.innerText = '+';
            slotUI.style.background = '#27272a';
            slotUI.style.borderColor = '#52525b';
        }

        for (const [id, count] of Object.entries(this.inventory)) {
            if (count > 0 && id !== t.heldItem) {
                const item = GameData.items[id];
                const opt = document.createElement('option'); opt.value = id; opt.innerText = `${item.name} (${count})`;
                sel.appendChild(opt);
            }
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
                    this.saveGame(true);
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

    promptConfirm(actionType, message, onConfirm) {
        const skipKey = 'ptd_skip_confirm_' + actionType;
        if (localStorage.getItem(skipKey) === 'true') {
            onConfirm();
            return;
        }

        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-modal-msg');
        const chk = document.getElementById('confirm-modal-dont-show');
        const yesBtn = document.getElementById('confirm-modal-yes');
        const noBtn = document.getElementById('confirm-modal-no');

        if (!modal || !msgEl || !yesBtn || !noBtn) {
            onConfirm();
            return;
        }

        msgEl.innerText = message;
        if (chk) chk.checked = false;
        modal.classList.remove('hidden');

        const cleanUp = () => {
            modal.classList.add('hidden');
            yesBtn.onclick = null;
            noBtn.onclick = null;
        };

        yesBtn.onclick = () => {
            if (chk && chk.checked) {
                localStorage.setItem(skipKey, 'true');
            }
            cleanUp();
            onConfirm();
        };

        noBtn.onclick = () => {
            cleanUp();
        };
    }

    levelUpTower(targetTower = null) {
        const t = targetTower || this.selectedTower;
        if (!t) return;
        if (this.isManagementLocked) {
            this.addFloatingText(t.x || this.canvas.width/2, t.y || this.canvas.height/2, "MANAGEMENT LOCKED!", "#ef4444");
            return;
        }
        if (t.stunTimer > 0) {
            this.addFloatingText(t.x || this.canvas.width/2, t.y || this.canvas.height/2, "LOCKED!", "#ef4444");
            return;
        }
        const cost = t.getUpgradeCost ? t.getUpgradeCost() : 50;
        if (this.money >= cost) {
            this.money -= cost;
            t.levelUp();
            this.recalcAllStats();
            this.updateHUD();
            this.updateInspector();
            this.updateTeamList();
            this.saveGame(true);
            this.addFloatingText(t.x || this.canvas.width/2, t.y || this.canvas.height/2, "LEVEL UP!", "#22c55e");
        } else {
            this.addFloatingText(t.x || this.canvas.width/2, t.y || this.canvas.height/2, "NEED $" + cost, "#ef4444");
        }
    }

    benchTower(targetTower = null) {
        const t = targetTower || this.selectedTower;
        if (!t) return;
        if (this.isManagementLocked) {
            this.addFloatingText(t.x || this.canvas.width/2, t.y || this.canvas.height/2, "MANAGEMENT LOCKED!", "#ef4444");
            return;
        }
        if (t.stunTimer > 0) {
            this.addFloatingText(t.x || this.canvas.width/2, t.y || this.canvas.height/2, "LOCKED!", "#ef4444");
            return;
        }
        
        const oldX = t.x;
        const oldY = t.y;
        
        // Retain heldItem, just clear coordinates
        t.x = null;
        t.y = null;
        
        this.towers = this.towers.filter(tower => tower !== t);
        if (!this.bench.includes(t)) this.bench.push(t);
        if (this.selectedTower === t) this.selectedTower = null;
        if (this.placementMode === t) this.placementMode = null;
        
        this.recalcAllStats();
        this.updateHUD();
        this.updateInspector();
        this.updateTeamList();
        this.saveGame(true);
        if (oldX !== null && oldY !== null) {
            this.addFloatingText(oldX, oldY, "BENCHED", "#94a3b8");
        }
    }

    sellTower(targetTower = null) {
        const t = targetTower || this.selectedTower;
        if (!t) return;
        if (this.isManagementLocked) {
            this.addFloatingText(t.x || this.mousePos.x, t.y || this.mousePos.y, "MANAGEMENT LOCKED!", "#ef4444");
            return;
        }
        if (t.stunTimer > 0) {
            this.addFloatingText(t.x || this.mousePos.x, t.y || this.mousePos.y, "LOCKED!", "#ef4444");
            return;
        }
        
        let totalCost = GameData.towers[t.dataId] ? GameData.towers[t.dataId].cost : 100;
        for (let i = 1; i < t.level; i++) totalCost += Math.floor((GameData.towers[t.dataId]?.cost || 100) * 0.25 * i);
        const refund = Math.floor(totalCost * 0.7);
        
        this.money += refund;
        
        // Return held item to inventory
        if (t.heldItem) {
            this.inventory[t.heldItem] = (this.inventory[t.heldItem] || 0) + 1;
        }

        // REMOVE from both arrays to fix the ghosting bug
        this.towers = this.towers.filter(tower => tower !== t);
        this.bench = this.bench.filter(tower => tower !== t);
        
        const spawnX = t.x || this.mousePos.x;
        const spawnY = t.y || this.mousePos.y;
        
        if (this.selectedTower === t) this.selectedTower = null;
        if (this.placementMode === t) this.placementMode = null;
        this.recalcAllStats();
        this.updateHUD();
        this.updateInspector();
        this.updateTeamList();
        this.updateInventoryView();
        this.saveGame(true);
        this.addFloatingText(spawnX, spawnY, `+$${refund}`, "#facc15");
    }

    rerollTower(type) {
        if (!this.selectedTower || this.selectedTower.isPreview) return;
        const t = this.selectedTower;
        const cost = 50 * Math.pow(2, t.rerollCount || 0);
        
        if (this.money < cost) {
            this.addFloatingText(t.x || this.canvas.width/2, t.y || this.canvas.height/2, "NOT ENOUGH MONEY", "#ef4444");
            return;
        }
        
        this.money -= cost;
        t.rerollCount = (t.rerollCount || 0) + 1;
        
        if (type === 'nature') {
            const keys = Object.keys(GameData.natures);
            t.nature = keys[Math.floor(Math.random() * keys.length)];
        } else if (type === 'ability') {
            const possible = t.data.possibleAbilities || [];
            if (possible.length > 1) {
                let newSlot;
                do { newSlot = Math.floor(Math.random() * possible.length); } while (newSlot === t.abilitySlot);
                t.abilitySlot = newSlot;
                t.setData(t.dataId);
            }
        }
        
        t.calculateStats();
        this.updateHUD();
        this.updateInspector();
        this.saveGame(true);
        this.addFloatingText(t.x || this.canvas.width/2, t.y || this.canvas.height/2, "REROLLED!", "#38bdf8");
    }

    getSaveKey() {
        const username = (window.GAMEHUB_USER && window.GAMEHUB_USER.username) ? window.GAMEHUB_USER.username : 'guest';
        return 'pokemon_tower_save_' + username;
    }

    saveGame(isQuiet = false) {
       const saveData = {
            money: this.money, lives: this.lives, waveIndex: this.waveIndex, inventory: this.inventory, buyCount: this.buyCount,
            bench: this.bench.map(t => ({ 
                dataId: t.dataId, level: t.level, abilitySlot: t.abilitySlot, nature: t.nature, 
                unlockedMoves: t.unlockedMoves, currentMoveId: t.currentMoveId, heldItem: t.heldItem, rerollCount: t.rerollCount 
            })),
            towers: this.towers.map(t => ({ 
                dataId: t.dataId, x: t.x, y: t.y, level: t.level, heldItem: t.heldItem, abilitySlot: t.abilitySlot, 
                targetingPriority: t.targetingPriority, unlockedMoves: t.unlockedMoves, currentMoveId: t.currentMoveId, 
                nature: t.nature, rerollCount: t.rerollCount 
            }))
        };
        const key = this.getSaveKey();
        localStorage.setItem(key, JSON.stringify(saveData));

        // Cloud Save Sync
        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
        try {
            fetch('/api/save/pokemon_tower', {
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
            // Very subtle indicator to prove it's working
            this.addFloatingText(this.canvas.width - 100, 20, "Auto-Saving...", "#94a3b8", 0.5);
        }
    }

    applySaveData(data, isSilent = false) {
        if (!data) return;
        const starterModal = document.getElementById('starter-modal');
        if (starterModal) starterModal.classList.add('hidden');

        this.money = (data.money !== undefined) ? data.money : GameData.config.startingMoney;
        this.lives = (data.lives !== undefined) ? data.lives : GameData.config.startingLives;
        this.waveIndex = data.waveIndex || 0;
        this.inventory = data.inventory || {}; 
        this.buyCount = data.buyCount || data.randomBuyCount || 0;
        
        this.bench = (data.bench || []).map(tData => {
            const t = new Tower(this, tData.dataId, null, null, tData.abilitySlot, tData.unlockedMoves, tData.currentMoveId, tData.nature, tData.rerollCount);
            t.level = tData.level || 1;
            t.heldItem = tData.heldItem; 
            t.calculateStats(); 
            return t;
        });

        this.towers = (data.towers || []).map(tData => {
            const t = new Tower(this, tData.dataId, tData.x, tData.y, tData.abilitySlot, tData.unlockedMoves, tData.currentMoveId, tData.nature, tData.rerollCount);
            t.level = tData.level; 
            t.heldItem = tData.heldItem; 
            t.targetingPriority = tData.targetingPriority || 'first';
            t.calculateStats(); 
            return t;
        });
        this.enemies = []; this.projectiles = []; this.floatingTexts = []; this.zones = []; this.visualEffects = []; this.waveActive = false; this.enemiesToSpawn = 0; this.spawnTimer = 0; this.selectedTower = null; this.placementMode = null;
        
        this.recalcAllStats();
        this.updateHUD(); this.updateInspector(); this.updateTeamList(); this.updateInventoryView(); this.renderShop();
        if (!isSilent) this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "GAME LOADED", "#3b82f6", 2.0);
    }

    checkStarterNeeded() {
        if (this.towers.length === 0 && this.bench.length === 0 && this.waveIndex === 0) {
            this.showStarterSelection();
        } else {
            const starterModal = document.getElementById('starter-modal');
            if (starterModal) starterModal.classList.add('hidden');
        }
    }

    loadSaveState(isSilent = false) {
        const key = this.getSaveKey();
        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');

        // 1. Immediately attempt synchronous load from localStorage
        let loadedLocal = false;
        const localStr = localStorage.getItem(key) || localStorage.getItem('pokemonTDSave');
        if (localStr) {
            try {
                const localData = JSON.parse(localStr);
                if (localData && ((localData.towers && localData.towers.length > 0) || (localData.bench && localData.bench.length > 0) || (localData.waveIndex && localData.waveIndex > 0))) {
                    this.applySaveData(localData, isSilent);
                    loadedLocal = true;
                }
            } catch(e) {
                console.error("Local save parse error:", e);
            }
        }

        // 2. Check cloud if not checked yet
        if (!this._cloudChecked) {
            this._cloudChecked = true;
            fetch('/api/save/pokemon_tower', {
                headers: token ? {'X-Auth-Token': token} : {}
            }).then(r => r.json()).then(cloud => {
                if (cloud && cloud.state && Object.keys(cloud.state).length > 0) {
                    const cState = cloud.state;
                    if ((cState.towers && cState.towers.length > 0) || (cState.bench && cState.bench.length > 0) || (cState.waveIndex && cState.waveIndex > 0)) {
                        localStorage.setItem(key, JSON.stringify(cState));
                        this.applySaveData(cState, isSilent);
                        return;
                    }
                }
                if (!loadedLocal) {
                    this.checkStarterNeeded();
                }
            }).catch(() => {
                if (!loadedLocal) {
                    this.checkStarterNeeded();
                }
            });
            return;
        }

        // 3. Fallback if cloud was already checked
        if (!loadedLocal) {
            this.checkStarterNeeded();
        }
    }

    wipeData() {
        if(confirm("Wipe all save data for this account?")) {
            const key = this.getSaveKey();
            localStorage.removeItem(key);
            localStorage.removeItem('pokemonTDSave');
            const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
            fetch('/api/save/pokemon_tower', {
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


    updateResponsiveScale() {
        const wrapper = document.getElementById('game-wrapper');
        if (!wrapper) return;
        
        const isPortrait = window.matchMedia("(orientation: portrait) and (max-width: 1024px)").matches;
        if (isPortrait) {
            wrapper.style.transform = 'none';
            return;
        }

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // Native dimensions of game layout: 1420px x 720px
        const baseW = 1420;
        const baseH = 720;
        
        const fitScaleX = (vw - 32) / baseW;
        const fitScaleY = (vh - 32) / baseH;
        // Scale to fit viewport perfectly, capped at 1.25x zoom for large displays
        const targetScale = Math.min(fitScaleX, fitScaleY, 1.25);
        const finalScale = Math.max(0.35, targetScale);

        wrapper.style.transform = `scale(${finalScale.toFixed(3)})`;
        wrapper.style.transformOrigin = 'center center';
    }

    hardReset() {
        this.wipeData();
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

        // Force a save RIGHT before the wave begins. 
        // This ensures the player's tower setup is saved, but any mid-wave money earned is lost if reloaded.
        this.saveGame(true); 

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
        const elAtk = document.getElementById('inspect-base-atk');
        const elSpatk = document.getElementById('inspect-base-spatk');
        if (!elDmg || !elAtk || !elSpatk) return;

        if (show) {
            const nData = GameData.natures[t.nature] || { atk: 1.0, spatk: 1.0, spd: 1.0 };
            const calcActualStats = (level) => {
                const lvlScale = 1 + ((level - 1) * 0.15);
                const curAtk = (t.data.baseStats.atk || 0) * lvlScale * nData.atk;
                const curSpatk = (t.data.baseStats.spatk || 0) * lvlScale * nData.spatk;
                
                let moveData = t.currentMoveId ? GameData.moves[t.currentMoveId] : null;
                let pwr = moveData ? moveData.power : 0;
                let isSpecial = moveData?.category === 'special';
                let genericAtk = isSpecial ? curSpatk : curAtk;
                let displayedDmg = pwr > 0 ? (((2 * level / 5 + 2) * pwr * (genericAtk / 50)) / 2) * t.computedStats.damage : 0;
                
                return { atk: Math.round(curAtk), spatk: Math.round(curSpatk), dmg: displayedDmg };
            };

            const cur = calcActualStats(t.level);
            const next = calcActualStats(t.level + 1);
            
            const formatStat = (val, mod) => {
                let color = mod > 1.0 ? '#22c55e' : (mod < 1.0 ? '#ef4444' : '#ffffff');
                return `<span style="color: ${color};">${val}</span>`;
            };
            
            elAtk.innerHTML = `${formatStat(cur.atk, nData.atk)} <span style="color:#22c55e">(+${next.atk - cur.atk})</span>`;
            elSpatk.innerHTML = `${formatStat(cur.spatk, nData.spatk)} <span style="color:#22c55e">(+${next.spatk - cur.spatk})</span>`;
            elDmg.innerHTML = `${cur.dmg.toFixed(1)} <span style="color:#22c55e">(+${(next.dmg - cur.dmg).toFixed(1)})</span>`;
        } else {
            this.updateInspector();
        }
    }

    recalcAllStats() { this.towers.forEach(t => t.calculateStats()); }

    trackDamage(sourceTower, actualHit, overkill) {
        if (sourceTower) {
            // Used by the Simulation Report
            if (sourceTower.simId !== undefined) {
                this.towerStats[sourceTower.simId].damage += actualHit;
                this.towerStats[sourceTower.simId].overkill += overkill;
            }
            // Used by the Auto-Bot Report
            sourceTower.totalDmgTracked = (sourceTower.totalDmgTracked || 0) + actualHit;
        }
    }

    attemptTeachTM(pokemon, tmId) {
        const tmItem = GameData.items[tmId];
        this.tmTargetingMode = null; // Always clear mode once a target is picked

        if (!tmItem || tmItem.type !== 'tm') return;

        if (pokemon.data.tmList && pokemon.data.tmList.includes(tmItem.moveId)) {
            if (!pokemon.unlockedMoves.includes(tmItem.moveId)) {
                pokemon.unlockedMoves.push(tmItem.moveId);
                this.inventory[tmId]--;
                this.addFloatingText(pokemon.x || this.canvas.width/2, pokemon.y || this.canvas.height/2, "LEARNED!", "#22c55e");
                pokemon.calculateStats();
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

    getDynamicPrice(baseCost) {
        // 50% increase per buy across the board
        return Math.floor(baseCost * Math.pow(1.5, this.buyCount || 0));
    }

    getRandomBuyPrice() { 
        return this.getDynamicPrice(80); 
    }

    buyPokemon(id, isRandom = false) {
        if (this.towers.length + this.bench.length >= 12) {
            this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "TEAM FULL (MAX 12)", "#ef4444");
            return;
        }

        const currentPrice = isRandom ? this.getRandomBuyPrice() : this.getDynamicPrice(GameData.towers[id].cost);
        if (this.money >= currentPrice) {
            let finalId = id;
            if (isRandom) {
                const pool = this.getShopPool();
                finalId = pool[Math.floor(Math.random() * pool.length)];
            }

            this.money -= currentPrice;
            this.buyCount++; 
            this.bench.push(new Tower(this, finalId, null, null));
            
            this.updateHUD(); 
            this.renderShop(); 
            this.updateTeamList();
            
            this.addFloatingText(this.canvas.width/2, this.canvas.height/2, `GET: ${GameData.towers[finalId].name.toUpperCase()}`, "#facc15");
            
            // Force an immediate save to prevent save-scumming the shop/randoms
            this.saveGame(true);
        } else { 
            this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "NOT ENOUGH MONEY", "#ef4444"); 
        }
    }

    enemyKilled(enemy, sourceTower = null) { 
        if (sourceTower) sourceTower.totalKillsTracked = (sourceTower.totalKillsTracked || 0) + 1;
        
        let bounty = enemy.bountyValue || 0;
        let bountyMult = sourceTower ? (sourceTower.computedStats.bountyMultiplier || 1.0) : 1.0;

        // Bounties are cleanly modified by the tower's generic bountyMultiplier stat
        this.money = Math.max(0, this.money + Math.round(bounty * bountyMult)); 
        
        this.updateHUD();
        if (this.selectedTower) this.updateInspector(); 
    }
    loseLives(amt) { 
        this.lives -= amt; 
        this.updateHUD(); 
        if (this.lives <= 0) { 
            this.lives = 0;
            this.isPaused = true; 
            this.showGameOverUI("DEFEAT");
        } 
    }

    showGameOverUI(status) {
        if (document.getElementById('game-over-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'game-over-overlay';
        overlay.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:450px; background:#111; border:4px solid ${status === "VICTORY" ? "#10b981" : "#ef4444"}; padding:20px; color:#fff; z-index:100000; box-shadow:0 0 100px #000; text-align:center; font-family:'Press Start 2P', cursive;`;
         overlay.innerHTML = `
            <h1 style="color:${status === "VICTORY" ? "#10b981" : "#ef4444"}; font-size:18px; margin-bottom:20px;">${status}</h1>
            <div id="extra-stats-container"></div>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="location.reload()" style="flex:1; padding:15px; background:#444; color:#fff; border:none; cursor:pointer; font-size:8px; font-family:inherit;">MAIN MENU</button>
                <button onclick="window.game.hardReset()" style="flex:1; padding:15px; background:${status === "VICTORY" ? "#10b981" : "#ef4444"}; color:#fff; border:none; cursor:pointer; font-size:8px; font-family:inherit;">RETRY</button>
            </div>
        `;
        document.body.appendChild(overlay);
        // If Admin is active, let it fill the extra-stats-container
        if (typeof GameAdmin !== 'undefined') {
            GameAdmin.injectStatsIntoUI();
        }
    }

    addFloatingText(x, y, text, color, duration = 1.0) { this.floatingTexts.push(new FloatingText(x, y, text, color, duration)); }

    loop(timestamp) {
        let realDt = (timestamp - this.lastTime) / 1000;
        if (realDt > 0.1) realDt = 0.1; 
        this.lastTime = timestamp; 
        
        if (!this.isPaused) {
            this.autoSave(realDt);
            this.update(realDt); 
        }
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
    update(dt) {
        if (this.isPaused) return;
        dt *= this.timeScale;

        // Shadow Tag Global Check
        this.isManagementLocked = this.enemies.some(e => e.alive && e.ability === 'shadow_tag_global');

        if (this.waveActive) { 
            const wave = GameData.waves[this.waveIndex];
            const group = wave.groups[this.currentGroupIndex];

            if (group) {
                this.spawnTimer -= dt; 
                if (this.spawnTimer <= 0 && this.spawnedInGroup < group.count) { 
                    // Calculate HP-weighted bounty
                    const eData = GameData.enemies[group.enemyId];
                    const calcBounty = this.currentWaveReward * (eData.hp / this.currentWaveTotalHp);
                    
                    this.enemies.push(new Enemy(this, group.enemyId, group.abilityChance, calcBounty, group.level || 1)); 
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
                
                // Dispatch generic End Wave hooks (handles honey_gather natively)
                this.towers.forEach(t => EffectEngine.dispatch(t, 'on_wave_end'));

                this.waveIndex++; this.updateHUD(); 
                if (this.waveIndex >= GameData.waves.length) {
                    this.addFloatingText(this.canvas.width/2, this.canvas.height/2, "YOU WIN", "#22c55e", 5.0); 
                } else if (document.getElementById('auto-wave-toggle').checked) {
                    this.startNextWave();
                }
            } 
        }
        this.towers.forEach(t => t.update(dt)); 
        this.enemies.forEach(e => e.update(dt)); 
        this.projectiles.forEach(p => p.update(dt)); 
        this.floatingTexts.forEach(f => f.update(dt)); 
        this.zones.forEach(z => z.update(dt));
        this.visualEffects.forEach(v => v.update(dt));

        let eIdx = 0, pIdx = 0, fIdx = 0, zIdx = 0, vIdx = 0;
        for (let i = 0; i < this.enemies.length; i++) if (this.enemies[i].alive || (this.enemies[i].isDying && this.enemies[i].deathScale > 0)) this.enemies[eIdx++] = this.enemies[i];
        for (let i = 0; i < this.projectiles.length; i++) if (this.projectiles[i].alive) this.projectiles[pIdx++] = this.projectiles[i];
        for (let i = 0; i < this.floatingTexts.length; i++) if (this.floatingTexts[i].life > 0) this.floatingTexts[fIdx++] = this.floatingTexts[i];
        for (let i = 0; i < this.zones.length; i++) if (this.zones[i].duration > 0) this.zones[zIdx++] = this.zones[i];
        for (let i = 0; i < this.visualEffects.length; i++) if (this.visualEffects[i].life > 0) this.visualEffects[vIdx++] = this.visualEffects[i];
        
        this.enemies.length = eIdx; 
        this.projectiles.length = pIdx; 
        this.floatingTexts.length = fIdx; 
        this.zones.length = zIdx;
        this.visualEffects.length = vIdx;
    }
    draw() {
        this.ctx.fillStyle = '#1e1e28'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const mapImg = this.assetManager.getImage('map'); if (mapImg && mapImg.loaded) this.ctx.drawImage(mapImg.img, 0, 0, this.canvas.width, this.canvas.height);
        
        // Tactical placement overlay (subtle valid/invalid map tiles)
        if (this.placementMode && this._placementOverlay) {
            this.ctx.drawImage(this._placementOverlay, 0, 0);
        }

        this.zones.forEach(z => z.draw(this.ctx));
        let renderables = [
            ...this.towers.map(t => ({ 
                y: t.y, 
                draw: (ctx) => {
                    if (this.placementMode === t) {
                        ctx.save();
                        ctx.globalAlpha = 0.35;
                        t.draw(ctx, false);
                        ctx.restore();
                    } else {
                        t.draw(ctx, t === this.selectedTower);
                    }
                } 
            })), 
            ...this.enemies.map(e => ({ y: e.y, draw: (ctx) => e.draw(ctx) }))
        ];
        renderables.sort((a,b) => a.y - b.y); renderables.forEach(r => r.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx)); this.floatingTexts.forEach(f => f.draw(this.ctx));
        this.visualEffects.forEach(v => v.draw(this.ctx));
        if (this.placementMode) {
            const t = this.placementMode;
            const isValid = this.checkPlacement(t.dataId, this.mousePos.x, this.mousePos.y);
            this.ctx.save();

            // 1. Attack Range / Area of Effect (Filled + Outlined)
            const range = (t.computedStats && t.computedStats.range) ? t.computedStats.range : (t.baseStats?.range || 120);
            this.ctx.beginPath();
            this.ctx.arc(this.mousePos.x, this.mousePos.y, range, 0, Math.PI * 2);
            // Filled AOE with soft semi-transparent color
            this.ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)';
            this.ctx.fill();
            // Solid outline
            this.ctx.strokeStyle = isValid ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // 2. Draw actual Pokémon walking sprite with green or red tint
            const key = 'tower_walk_' + t.dataId;
            const asset = this.assetManager.getImage(key);
            this.ctx.translate(this.mousePos.x, this.mousePos.y);

            if (asset && asset.loaded && asset.img) {
                const offset = this.assetManager.getOffset(key);
                
                if (!this._placementCanvas) {
                    this._placementCanvas = document.createElement('canvas');
                    this._placementCanvas.width = 64;
                    this._placementCanvas.height = 64;
                    this._placementCtx = this._placementCanvas.getContext('2d');
                }
                const pCanvas = this._placementCanvas;
                const pCtx = this._placementCtx;
                pCtx.clearRect(0, 0, 64, 64);
                
                const sw = asset.img.width / 4;
                const sh = asset.img.height / 4;
                const size = 52;
                const scale = size / sw;
                const dx = (64 - size) / 2 + (offset.offsetX * scale);
                const dy = (64 - size) / 2 + (offset.offsetY * scale);
                
                // Draw base sprite frame
                pCtx.drawImage(asset.img, 0, 0, sw, sh, dx, dy, size, size);
                
                // Overlay color tint on top of sprite pixels
                pCtx.globalCompositeOperation = 'source-atop';
                pCtx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.55)';
                pCtx.fillRect(0, 0, 64, 64);
                pCtx.globalCompositeOperation = 'source-over';

                // Draw tinted sprite onto game canvas
                this.ctx.save();
                this.ctx.shadowColor = isValid ? '#22c55e' : '#ef4444';
                this.ctx.shadowBlur = 10;
                this.ctx.drawImage(pCanvas, -32, -32);
                this.ctx.restore();
            } else {
                // Fallback to tinted box
                this.ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
                this.ctx.fillRect(-16, -16, 32, 32);
            }

            // Draw level badge
            this.ctx.font = '8px "Press Start 2P"';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#000';
            this.ctx.fillText("Lv." + (t.level || 1), 2, -34);
            this.ctx.fillStyle = isValid ? '#4ade80' : '#f87171';
            this.ctx.fillText("Lv." + (t.level || 1), 0, -36);

            this.ctx.restore();
        }
        if (typeof GameAdmin !== 'undefined' && GameAdmin.active) GameAdmin.draw(this.ctx);
    }
}
window.onload = () => { window.game = new GameEngine(); };
