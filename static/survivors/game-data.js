/* 
=========================================================================
   GOTHIC SURVIVORS - DATA DEFINITIONS
=========================================================================
This file contains the "database" of the game. All game entities 
(weapons, enemies, projectiles, passives) are defined here as data. 
The game engine reads this data to bring them to life. This separation
allows for easy creation of new content without touching the engine code.
*/
const WEAPON_LEVEL_UP_SCALING = {
    flatDmg: 2,         // Flat damage added per level
    cooldown: 0.03,     // 3% cooldown reduction per level
    speed: 0.1,         // 10% projectile speed increase per level
    area: 0.15,         // 15% area increase per level
    amountInterval: 2,  // Gain +1 amount every N levels
    pierceInterval: 3,  // Gain +1 pierce every N levels
};

const SOUL_CONDUCTOR_RATES = {
    killsPerStack: 100, // Number of kills to gain a damage stack
    damagePerStack: [0.005, 0.008, 0.010, 0.0115, 0.0125] // Dmg% per stack at levels 1-5
};

const GAME_DATA = {
    visuals: { ...GAME_GRAPHICS },

    PLAYER_DEFAULTS: {
        r: 15,
        baseStats: { maxHp: 100, moveSpeed: 200, magnet: 100, might: 1, area: 1, speedProj: 1, duration: 1, range: 1, amount: 0, cooldown: 1, critChance: 0.05, critDmg: 2.0, armor: 0, regen: 0, xpGain: 1, thornsDmg: 0, timeCrystal: 0, elementalFocus: {}, bleedChance: 0, bleedDps: 5, shieldOnKill: 0, dodgeChance: 0, rechargeShieldTime: 35, healNova: 0, chickenBonus: 0, madman: false, isGlassCannon: false, doubloonChance: 0, soul: 0, faction: 'player' }
    },
    CONFIG: {
        // Core Game Rules
        TARGET_TIME: 15 * 60,
        INITIAL_SPAWN_DELAY: 3.0,

        // Audio Settings
        AUDIO: { masterVolume: 0.05, bgmVolume: 0.25, sfxVolume: 0.8 },

        // Player Settings
        PLAYER: {
            xpBase: 5,
            xpLevelMultiplier: 10,
            xpLevelExponent: 0.05,
            invulnOnHitDuration: 0.5,
            screenShakeOnHit: 5,
            doubloonsForRevenant: 10,
        },

        // AI Settings
        AI: {
            behaviorUpdateRate: 10, // How many times per second an enemy checks its behaviors.
            allyRetargetTimeMin: 0.5,
            allyRetargetTimeMax: 1.5,
            allySeparationForce: 800,
            allySeparationRadiusMultiplier: 2.5,
            allyAggroRange: 400,
        },

        // Physics & Collision
        PHYSICS: {
            knockbackMultiplier: 5,
            boomerangCatchRadius: 40,
            homingTurnRate: 5,
            enemySeparationForce: 800,
            enemySeparationRadiusMultiplier: 1.5,
        },

        // Spawning & Enemy Rules
        SPAWNING: {
            waveIntervalRampDuration: 120.0,
            initialWaveInterval: 6.0,
            finalWaveIntervalRamp: 4.0,
            lateGameRampDuration: 600.0,
            minimumWaveInterval: 0.20,
            initialWaveSize: 2,
            waveSizeGrowthRate: 5,
            enemyHpScalingFactor: 300,
            eliteTimeRequirement: 60,
            eliteChance: 0.005,
            eliteHpMultiplier: 4,
            eliteSizeMultiplier: 1.5,
            eliteDamageMultiplier: 2,
            eliteXpMultiplier: 5,
            eliteChestChance: 1.0,
            cursedDmgMultiplier: 1.25,
            shieldedDmgMultiplier: 0.25,
            curseExplosionRadius: 100,
            curseExplosionChance: 0.25,
        },

        // Status Effect Visuals & Logic
        STATUS_EFFECTS: {
            bleedParticle: { chance: 0.15, color: '#8a0303', size: [2, 4], speed: [10, 30], life: 0.6 },
            deathParticle: { color: '#555', count: 8 },
            poisonPuddle: { color: 'rgba(102, 204, 0, 0.4)', borderColor: 'rgba(51, 102, 0, 0.8)' }
        },

        // Collectibles & World Objects
        COLLECTIBLES: {
            chestRadius: 20,
            doubloonRadius: 8,
            chestDespawnTime: 10,
            chestParticle: { count: 50, color: '#ffd700', size: [1, 3], speed: [50, 150], life: [0.3, 0.6] },
            xpMagnetSpeed: 600,
            xpMergeTimeMin: 2.0,
            xpMergeTimeMax: 3.0,
            xpMergeRadiusMultiplier: 8,
            xpMergeResetTimer: 1.0,
            xpOrbHoverOffset: 10,
            xpOrbTiers: [
                { threshold: 5, colors: ['#4da6ff', '#002266'], r: 5 },
                { threshold: 20, colors: ['#55ff55', '#004400'], r: 7 },
                { threshold: 100, colors: ['#ff5555', '#440000'], r: 9 },
                { threshold: 250, colors: ['#7435daff', '#23084eff'], r: 11 },
                { threshold: Infinity, colors: ['#ffd700', '#cfa538'], r: 12 }
            ],
        },

        // Visual & Presentation Settings
        PRESENTATION: {
            TILE_SIZE: 256,
            imageSmoothing: false,
            particleGravity: 200,
            levelUpScreen: {
                numChoices: 5,
                floorChickenHeal: 0.3,
            },
            hudWarningTime: 60,
            hudColors: { timerNormal: '#cfa538', timerWarning: '#f00' },
            hudWarningFlickerSpeed: 60, // Slower is faster
            projectileDespawnDist: 2000,
            enemyHitFlashDuration: 0.1,
            damageTextDuration: 0.8,
            damageTextSpeed: -40,
            damageTextYOffset: -20,
            damageTextXVariance: 10,
            damageTextCritSize: 24,
            damageTextNormalSize: 16,
            damageTextColors: {
                enemy: '#ffffff',
                crit: '#ffff00',
                player: '#ff4444',
            },
            lightningDuration: 0.3,
            lightningSegments: 5,
            lightningJaggedness: 15,
        },

        // Chest Rewards - NEW
        CHEST_REWARDS: [
            { id: 'swiftness', weight: 10, effect: { type: 'applyBuffToPlayer', buffId: 'swiftness', duration: 10 } },
            { id: 'rage', weight: 10, effect: { type: 'applyBuffToPlayer', buffId: 'rage', duration: 10 } },
            { id: 'haste', weight: 10, effect: { type: 'applyBuffToPlayer', buffId: 'haste', duration: 10 } },
            { id: 'magnetism', weight: 8, effect: { type: 'magnetizeAllOrbs' } },
            { id: 'heal', weight: 15, effect: { type: 'healPlayer', percent: 0.3 } },
            { id: 'invuln', weight: 5, effect: { type: 'applyInvulnToPlayer', duration: 5 } },
            { id: 'barrage', weight: 7, effect: { type: 'applyBuffToPlayer', buffId: 'barrage', duration: 8 } },
            { id: 'levelup', weight: 3, effect: { type: 'grantXP', amount: 'next_level' } }
        ],
    },

    // =========================================================================
    // 1. BUFFS & EFFECTS REGISTRY
    // =========================================================================
    buffs: {
        'adrenaline_rush': {
            mods: [
                { stat: 'moveSpeed', op: 'mul', value: 1.3 },
                { stat: 'cooldown', op: 'mul', value: 0.8 }
            ]
        },
        'swiftness': { mods: [{ stat: 'moveSpeed', op: 'mul', value: 1.5 }] },
        'rage': { mods: [{ stat: 'might', op: 'mul', value: 1.5 }] },
        'haste': { mods: [{ stat: 'cooldown', op: 'mul', value: 0.5 }] },
        'barrage': { onApply: (player) => { player.weapons.forEach(w => w.cooldown = 0); } }
    },

    effects: {
        spawnEffect: (target, source, effectDef) => {
            const game = source.game;
            let x, y;
            const pos = effectDef.position || (target ? 'target' : 'source');
            if (pos === 'target' && target) { x = target.x; y = target.y; }
            else if (pos === 'player') { x = game.player.x; y = game.player.y; }
            else { x = source.x || game.player.x; y = source.y || game.player.y; }

            const effectSource = {
                game: game,
                x: source.x || game.player.x,
                y: source.y || game.player.y,
                stats: source.stats ? source.stats :
                    ((typeof source.getStats === 'function') ?
                        source.getStats(source.def.attacks[0]) :
                        { dmg: source.damage || 0, kb: source.kb || 0, area: 1, duration: 1, amount: 0 })
            };

            // Pass the original target entity to the ActiveEffect constructor
            const effect = new ActiveEffect(game, effectSource, effectDef, x, y, target);
            game.activeEffects.push(effect);
        },
        dealDamage: (target, source, effectDef) => {
            if (typeof target.takeDamage !== 'function') { return; }

            if (effectDef.damages) {
                const allowedFactions = Array.isArray(effectDef.damages) ? effectDef.damages : [effectDef.damages];
                if (!allowedFactions.includes(target.faction)) {
                    return;
                }
            }

            const baseDmg = source.stats ? source.stats.dmg : source.damage;
            const knockback = source.stats ? source.stats.kb : source.kb;
            let finalDmg = baseDmg * (effectDef.multiplier || 1);
            let isCrit = false;

            if (source.game && source.game.player) {
                const pStats = source.game.player.getCurrentStats();
                isCrit = Math.random() < pStats.critChance;
                if (isCrit) { finalDmg *= pStats.critDmg; }
            }

            target.takeDamage(finalDmg, isCrit, knockback, M.angle(source.x, source.y, target.x, target.y));
        },
        applyStatus: (target, source, effectDef) => {
            if (!effectDef.status) return;
            if (effectDef.status === 'chill') target.applyChill(effectDef.amount, effectDef.duration);
            if (effectDef.status === 'curse') target.applyCurse(effectDef.duration);
            if (effectDef.status === 'bleed') {
                const pStats = source.game.player.getCurrentStats();
                if (pStats.bleedChance > 0 && Math.random() < pStats.bleedChance) {
                    target.applyBleed(pStats.bleedDps, 3);
                }
            }
        },
        pullTarget: (target, source, effectDef) => {
            const pullAngle = M.angle(target.x, target.y, source.game.player.x, source.game.player.y);
            target.vx += Math.cos(pullAngle) * effectDef.force;
            target.vy += Math.sin(pullAngle) * effectDef.force;
        },



        spawnEnemy: (target, source, effectDef) => {
            for (let i = 0; i < (effectDef.count || 1); i++) {
                const x = target.x + M.rand(-effectDef.spread, effectDef.spread);
                const y = target.y + M.rand(-effectDef.spread, effectDef.spread);
                source.game.enemies.push(new Enemy(source.game, GAME_DATA.enemies[effectDef.key], x, y));
            }
        },
        costPlayerHealth: (target, source, effectDef) => {
            if (source.game.player.hp > effectDef.amount) {
                source.game.player.hp -= effectDef.amount;
                return true;
            }
            return false;
        },
        setFlag: (target, source, effectDef) => {
            // Target for enemy flags is the enemy itself (the source of the event)
            source[effectDef.key] = effectDef.value;
            if (effectDef.duration) {
                setTimeout(() => { if (source.active) source[effectDef.key] = !effectDef.value; }, effectDef.duration * 1000);
            }
        },
        dash: (target, source, effectDef) => {
            if (source.behaviorState.isDashing) return;

            source.behaviorState.isDashing = true;
            const angle = M.angle(source.x, source.y, source.game.player.x, source.game.player.y);
            source.vx = Math.cos(angle) * effectDef.speed;
            source.vy = Math.sin(angle) * effectDef.speed;
            setTimeout(() => {
                if (source.active) {
                    source.behaviorState.isDashing = false;
                    source.vx = 0;
                    source.vy = 0;
                }
            }, effectDef.duration * 1000);
        },
        shieldAlliesInRange: (target, source, effectDef) => {
            source.game.enemies.forEach(o => {
                if (o !== source && M.distSq(source.x, source.y, o.x, o.y) < effectDef.range ** 2) {
                    o.shielded = effectDef.duration;
                }
            });
        },
        fireProjectiles: (target, source, effectDef) => {
            const projDef = GAME_DATA.projectiles[effectDef.projectile];
            if (!projDef) return;

            const pStats = effectDef.projectileStats;
            const attackStats = {
                dmg: source.damage * (pStats.dmgMultiplier || 1),
                dur: pStats.duration,
                kb: pStats.kb,
                area: 1,
                pierce: 999,
                range: pStats.duration * pStats.speed,
                spd: pStats.speed
            };
            const fakeWeapon = { game: source.game, getStats: () => attackStats, key: `enemy_${effectDef.projectile}` };

            if (effectDef.pattern === 'radial') {
                for (let i = 0; i < effectDef.count; i++) {
                    const angle = (Math.PI * 2 / effectDef.count) * i;
                    const vx = Math.cos(angle) * attackStats.spd;
                    const vy = Math.sin(angle) * attackStats.spd;

                    // THIS IS THE FINAL, CORRECTED CONSTRUCTOR CALL.
                    // My previous versions had a critical typo in the argument list.
                    const p = new Projectile(source.game, fakeWeapon, projDef, attackStats, source.x, source.y, vx, vy, angle, source);
                    source.game.projectiles.push(p);
                }
            }
        },


        // NEW EFFECTS FOR CHEST REWARDS
        applyBuffToPlayer: (target, source, effectDef) => {
            source.game.player.buffs[effectDef.buffId] = effectDef.duration;
            const buffDef = GAME_DATA.buffs[effectDef.buffId];
            if (buffDef && buffDef.onApply) {
                buffDef.onApply(source.game.player);
            }
        },
        healPlayer: (target, source, effectDef) => {
            const player = source.game.player;
            player.hp = Math.min(player.stats.maxHp, player.hp + player.stats.maxHp * effectDef.percent);
            S.play('heal', source.game.state);
        },
        magnetizeAllOrbs: (target, source, effectDef) => {
            source.game.gems.forEach(g => g.magnetized = true);
        },
        applyInvulnToPlayer: (target, source, effectDef) => {
            source.game.player.invulnTimer = Math.max(source.game.player.invulnTimer, effectDef.duration);
        },
        grantXP: (target, source, effectDef) => {
            if (effectDef.amount === 'next_level') {
                source.game.player.gainXp(source.game.player.nextLevelXp);
            } else {
                source.game.player.gainXp(effectDef.amount);
            }
        },
    },

    // =========================================================================
    // 1A. ACTIVE EFFECT BEHAVIORS
    // =========================================================================
    behaviors: {
        instantArea: (effect) => {
            const behavior = effect.def.behavior;
            const potentialTargets = [...effect.game.enemies, effect.game.player];
            const damageSource = { ...effect.source, x: effect.x, y: effect.y };
            const collisionRadius = effect.animation ? effect.maxRadius : effect.r;

            for (const target of potentialTargets) {
                if (!target.active) continue;

                if (behavior.excludeInitialTarget && target === effect.initialTarget) {
                    continue;
                }

                const distSq = M.distSq(effect.x, effect.y, target.x, target.y);
                if (distSq < (collisionRadius + target.r) ** 2) {
                    effect.game.effectSystem.processEffects(target, damageSource, behavior.onHitEffects);
                }
            }
        },
        particleEmitter: (effect) => {
            const pDef = effect.def.behavior.particle;
            if (!pDef) return;
            for (let i = 0; i < (pDef.count || 1); i++) {
                const p = effect.game.particlePool.get().reset(
                    effect.game, effect.x, effect.y, pDef.color,
                    M.rand(pDef.size[0], pDef.size[1]),
                    M.rand(pDef.speed[0], pDef.speed[1]),
                    M.rand(pDef.life[0], pDef.life[1])
                );
                if (!pDef.gravity) p.vy -= GAME_DATA.CONFIG.PRESENTATION.particleGravity;
                effect.game.particles.push(p);
            }
        },
        chain: (effect) => {
            const behavior = effect.def.behavior;
            const stats = effect.source.stats;

            // CORRECTED: The total number of targets is derived *only* from the stats provided.
            const totalTargets = stats.amount || 1;
            const searchRadius = (behavior.searchRadius || 250) * stats.area;

            const startNode = effect.initialTarget;
            if (!startNode || !startNode.active) { effect.life = 0; return; }

            let currentTarget = startNode;
            let chain = [startNode];

            for (let i = 0; i < totalTargets - 1; i++) {
                let nextTarget = null;
                let minDst = Infinity;
                for (const e of effect.game.enemies) {
                    if (!e.active || chain.includes(e)) continue;
                    const d = M.distSq(currentTarget.x, currentTarget.y, e.x, e.y);
                    if (d < searchRadius ** 2 && d < minDst) {
                        minDst = d;
                        nextTarget = e;
                    }
                }
                if (nextTarget) { chain.push(nextTarget); currentTarget = nextTarget; }
                else { break; }
            }

            effect.path = chain.map(e => ({ x: e.x, y: e.y }));
            const pristineDamage = effect.source.stats.dmg;

            for (let i = 0; i < chain.length; i++) {
                const chainedTarget = chain[i];
                const knockbackOrigin = (i === 0) ? effect.game.player : chain[i - 1];

                const linkStats = { ...effect.source.stats };
                linkStats.dmg = pristineDamage * Math.max(0.1, 1.0 - i * (behavior.damageFalloff || 0.3));

                const effectSource = {
                    ...effect.source,
                    stats: linkStats,
                    x: knockbackOrigin.x,
                    y: knockbackOrigin.y
                };
                effect.game.effectSystem.processEffects(chainedTarget, effectSource, behavior.onChainEffects);
            }
        },
        groundEffect: (effect) => {
            effect.tickTimer -= effect.game.dt;
            if (effect.tickTimer > 0) return;
            effect.tickTimer = effect.def.behavior.tickRate || 0.5;

            const behavior = effect.def.behavior;
            const damageEffectDef = behavior.onTickEffects.find(e => e.type === 'dealDamage');
            const targetFactions = damageEffectDef && damageEffectDef.damages ?
                (Array.isArray(damageEffectDef.damages) ? damageEffectDef.damages : [damageEffectDef.damages])
                : ['enemy'];

            let hitOccurred = false;
            if (targetFactions.includes('enemy')) {
                // EFFICIENT: Get only the enemies in the same grid cell(s) as the effect.
                const nearbyEnemies = effect.game.enemyGrid.getNearby(effect);
                for (const e of nearbyEnemies) {
                    if (e.active && M.collides(effect, e)) {
                        effect.game.effectSystem.processEffects(e, effect.source, behavior.onTickEffects);
                        hitOccurred = true;
                    }
                }
            }
            if (targetFactions.includes('player')) {
                if (M.collides(effect, effect.game.player)) {
                    effect.game.effectSystem.processEffects(effect.game.player, effect.source, behavior.onTickEffects);
                    hitOccurred = true;
                }
            }
            if (hitOccurred && behavior.sound) S.play(sound, effect.game.state);
        },
    },

    // =========================================================================
    // 2. PROJECTILES
    // =========================================================================
    projectiles: {
        'wand_missile': {
            r: 8,
            pierce: 0,
            visual: { type: 'procedural', key: 'wand_missile' },
            movement: { type: 'linear' },
            destroyOnHit: true,
            handlers: [
                {
                    trigger: { conditions: [{ type: 'onHit' }] },
                    effects: [
                        { type: 'dealDamage', damages: 'enemy' },
                        { type: 'applyStatus', status: 'bleed' },
                        {
                            type: 'spawnEffect',
                            position: 'target',
                            visual: {
                                key: 'electric_nova_draw',
                                duration: 0.6,
                                animation: { type: 'scaleIn', duration: 0.15 }
                            },
                            behavior: {
                                type: 'instantArea',
                                excludeInitialTarget: true,
                                radius: 60,
                                onHitEffects: [
                                    { type: 'dealDamage', damages: 'enemy' }
                                ]
                            }
                        }
                    ]
                }
            ]
        },
        'axe': {
            r: 15,
            pierce: 99,
            clearHitListPeriodically: 0.1,
            visual: { type: 'procedural', key: 'axe' },
            movement: { type: 'arc', gravity: 1400 },
            components: [{ type: 'rotation', speed: 10 }],
            handlers: [
                { trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'enemy' }, { type: 'applyStatus', status: 'bleed' }] }
            ]
        },
        'cross': {
            r: 12,
            pierce: 999,
            clearHitListPeriodically: 0.1,
            visual: { type: 'procedural', key: 'cross' },
            movement: { type: 'boomerang', durationMultiplier: 2 },
            components: [{ type: 'rotation', speed: 15 }],
            handlers: [
                { trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'enemy' }, { type: 'applyStatus', status: 'bleed' }] }
            ]
        },
        'silver_stake': {
            r: 6,
            pierce: 1,
            visual: { type: 'procedural', key: 'silver_stake' },
            movement: { type: 'linear' },
            handlers: [
                { trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'enemy' }, { type: 'applyStatus', status: 'bleed' }] }
            ]
        },
        'holy_water_vial': {
            r: 8,
            visual: { type: 'procedural', key: 'holy_water_vial' },
            movement: { type: 'arc', gravity: 800 },
            destroyOnHit: false,
            handlers: [
                {
                    trigger: { conditions: [{ type: 'onExpire' }] },
                    effects: [{
                        type: 'spawnEffect',
                        position: 'target',
                        visual: { key: 'holy_ground_draw', animation: { type: 'scaleIn', duration: 0.25 } },
                        behavior: {
                            type: 'groundEffect',
                            radius: 60,
                            duration: 3.0,
                            tickRate: 0.5,
                            onTickEffects: [
                                { type: 'dealDamage', damages: 'enemy' },
                                { type: 'applyStatus', status: 'curse', duration: 3 }
                            ]
                        }
                    }]
                }
            ]
        },
        'blood_orb': {
            r: 10,
            pierce: 0,
            visual: { type: 'procedural', key: 'blood_orb' },
            movement: { type: 'homing', turnRate: 5 },
            destroyOnHit: true,
            handlers: [
                { trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'enemy' }, { type: 'applyStatus', status: 'bleed' }] }
            ]
        },
        'chain_link': {
            r: 5,
            pierce: 999,
            visual: { type: 'procedural', key: 'chain_link' },
            movement: { type: 'linear' },
            handlers: [
                { trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'enemy' }, { type: 'pullTarget', force: 500 }] }
            ]
        },
        'behemoth_rock': {
            r: 8,
            pierce: 0,
            visual: { type: 'procedural', key: 'behemoth_rock' },
            movement: { type: 'linear' },
            destroyOnHit: true,
            handlers: [
                { trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'player' }] }
            ]
        },
        'ghostly_bolt': {
            r: 10,
            pierce: 0,
            visual: { type: 'procedural', key: 'ghostly_bolt' },
            movement: { type: 'linear' },
            destroyOnHit: true,
            handlers: [
                { trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'enemy' }, { type: 'applyStatus', status: 'chill', amount: 0.1, duration: 1 }] }
            ]
        },
        'storm_bolt': {
            r: 7,
            pierce: 1,
            visual: { type: 'procedural', key: 'storm_bolt_draw' },
            movement: { type: 'linear' },
            destroyOnHit: true,
            handlers: [
                { trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'enemy' }] }
            ]
        },
        
    },

    // =========================================================================
    // 3. WEAPONS
    // =========================================================================
    weapons: {
        'wand': {
            name: 'Magic Wand', type: 'projectile',
            svg: `<svg viewBox="0 0 24 24"><path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM21 3l-1.5.8L18 2l.8 1.5L18 5l1.5-.8L21 5l-.8-1.5zm-8 9.5L5 20.5 3.5 19 11.5 11 13 12.5z" fill="#4da6ff"/></svg>`,
            description: "Fires magic missiles at the nearest enemies.",
            attacks: [{
                id: 'main_shot',
                stats: { baseDmg: 10, baseCd: 1.0, baseSpd: 500, baseRange: 1600, basePierce: 0, kb: 150 },
                targeting: 'nearest',
                actions: [{ type: 'fireProjectile', projectile: 'wand_missile', sound: 'wand', delayBetweenShots: 100 }]
            }]
        },
        'axe': {
            name: 'Heavy Axe', type: 'physical',
            svg: `<svg viewBox="0 0 24 24"><path d="M12 2L4 10h3v12h10V10h3L12 2zm-3 8l3-3 3 3H9z" fill="#cc4444"/></svg>`,
            description: "Throws axes in a high arc. High Damage.",
            attacks: [{
                id: 'main_throw',
                stats: { baseDmg: 40, baseCd: 2.5, baseSpd: -500, baseDur: 3, basePierce: 99, baseArea: 1.5, kb: 400 },
                targeting: 'directional', angle: -Math.PI / 2,
                actions: [{ type: 'lobProjectile', projectile: 'axe', sound: 'axe', lobType: 'directional', spreadVelocity: 200 }]
            }]
        },
        'cross': {
            name: 'Cross', type: 'projectile',
            svg: `<svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5 5 2 7-7-4-7 4 2-7-5-5h7z" fill="#44ffaa"/></svg>`,
            description: "Throws crosses that return to you.",
            attacks: [{
                id: 'main_throw',
                stats: { baseDmg: 25, baseCd: 2.5, baseSpd: 700, baseRange: 700, basePierce: 999, baseArea: 1.2, kb: 250 },
                targeting: 'random',
                actions: [{ type: 'fireProjectile', projectile: 'cross', sound: 'whip' }]
            }]
        },
        'garlic': {
            name: 'Garlic Aura', type: 'aura',
            svg: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#fff" opacity="0.5"/></svg>`,
            description: "Damages nearby enemies periodically.",
            grantsComponent: {
                type: 'aura',
                attackId: 'pulse',
                radius: 80,
                tickRate: 0.5,
                sound: 'garlic',
                effects: [{ type: 'dealDamage' }],
                visual: { key: 'garlic_aura_draw' }
            },
            attacks: [{
                id: 'pulse',
                stats: { baseDmg: 5, baseArea: 1.0, kb: 50, baseCd: 999 },
                targeting: 'none',
                actions: []
            }]
        },
        'laser': {
            name: 'Laser Beam', type: 'elemental',
            svg: `<svg viewBox="0 0 24 24"><path d="M3 11h18v2H3z" fill="#ff66ff"/><path d="M1 9h22v6H1z" opacity="0.5" fill="#ff66ff"/></svg>`,
            description: "Fires a continuous beam through enemies.",
            attacks: [{
                id: 'main_beam',
                stats: { baseDmg: 8, baseCd: 4.0, baseDur: 1.5, kb: 10, baseRange: 10000 },
                targeting: 'nearest',
                actions: [{ type: 'spawnBeam', duration: 'stat:dur', tickRate: 0.2, baseWidth: 40, sound: 'axe', visual: 'laser_beam_draw' }]
            }]
        },
        'lightning': {
            name: 'Chain Lightning', type: 'elemental',
            svg: `<svg viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z" fill="#ffff00"/></svg>`,
            description: "Arcs to a number of enemies. Levels and the Amount stat increase the number of targets.",
            attacks: [{
                id: 'main_chain',
                // CORRECTED: The number of targets is now defined here as baseAmount.
                stats: { baseDmg: 20, baseCd: 1.8, kb: 100, baseRange: 500, baseAmount: 3 },
                targeting: 'nearest',
                actions: [{
                    type: 'spawnEffect',
                    sound: 'lightning',
                    position: 'target',
                    visual: { type: 'lightning', duration: 0.3 },
                    behavior: {
                        type: 'chain',
                        damageFalloff: 0.3,
                        onChainEffects: [{ type: 'dealDamage' }]
                    }
                }]
            }]
        },
        'holy_water': {
            name: 'Holy Water Vial', type: 'holy',
            svg: `<svg viewBox="0 0 24 24"><path d="M12 2L6 8v12h12V8l-6-6zm0 2.83L15.17 8H8.83L12 4.83z" fill="#ffffaa"/></svg>`,
            description: "Lobs a vial that creates a pool of consecrated ground.",
            attacks: [{
                id: 'main_lob',
                stats: { baseDmg: 10, baseCd: 4.0, baseSpd: -400, baseDur: 3.0, baseArea: 1.2, kb: 0, baseRange: 300 },
                targeting: 'random',
                actions: [{ type: 'lobProjectile', projectile: 'holy_water_vial', sound: 'summon', lobType: 'targeted', projectileDuration: 1, targetSpread: 80 }]
            }]
        },
        'miasma': {
            name: 'Miasma Flask', type: 'aura',
            svg: `<svg viewBox="0 0 24 24"><path d="M12 2c-4 0-8 3-8 7 0 2 1 4 3 5-2 1-3 3-3 5h16c0-2-1-4-3-5 2-1 3-3 3-5 0-4-4-7-8-7z" fill="#88ff00"/></svg>`,
            description: "Leaves a trail of poisonous clouds.",
            attacks: [{
                id: 'main_trail',
                stats: { baseDmg: 10, baseCd: 1.5, baseDur: 3.0, baseArea: 1.2, kb: 0 },
                targeting: 'none',
                actions: [{ type: 'leaveTrail', radius: 40, effect: { type: 'generic', hitRate: 0.5 } }]
            }]
        },
        'silver_stakes': {
            name: 'Silver Stakes', type: 'projectile',
            svg: `<svg viewBox="0 0 24 24"><path d="M2 12h20M12 2v20" stroke="#c0c0c0" stroke-width="2" transform="rotate(45 12 12)"/></svg>`,
            description: "Fires sharp stakes in the direction you are moving.",
            attacks: [{
                id: 'main_shot',
                stats: { baseDmg: 20, baseCd: 0.8, baseSpd: 800, baseRange: 800, basePierce: 1, kb: 100 },
                targeting: 'moveDirection', spread: 0.4,
                actions: [{ type: 'fireProjectile', projectile: 'silver_stake', sound: 'whip' }]
            }]
        },
        'orbit_blade': {
            name: 'Orbit Blade', type: 'physical',
            svg: `<svg viewBox="0 0 24 24" fill="#ffcc00"><path d="M 12 2 L 14 8 L 22 9 L 16 14 L 18 22 L 12 18 L 6 22 L 8 14 L 2 9 L 10 8 Z" /></svg>`,
            description: "Summons permanent orbiting blades. Levels and Amount add more blades.",
            grantsComponent: {
                type: 'orbital',
                attackId: 'orbital_hit',
                radius: 120,
                rotationSpeed: 3,
                size: 15,
                effects: [{ type: 'dealDamage' }],
                visual: { key: 'orbit_blade_draw' }
            },
            attacks: [{
                id: 'orbital_hit',
                stats: { baseDmg: 15, baseArea: 1.0, kb: 200, baseCd: 999 },
                targeting: 'none',
                actions: []
            }]
        },
        'blood_tome': {
            name: 'Blood Tome', type: 'projectile',
            svg: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 13l-4-4h8l-4 4z" fill="#8a0303"/></svg>`,
            description: "Costs 1 HP to fire a homing orb. Damage increases as your health gets lower.",
            attacks: [{
                id: 'main_shot',
                stats: { baseDmg: 25, baseCd: 1.5, baseSpd: 200, baseRange: 800, kb: 200 },
                targeting: 'nearest',
                handlers: [{ trigger: { conditions: [{ type: 'onFire' }] }, effects: [{ type: 'costPlayerHealth', amount: 1 }] }],
                damageModifiers: [{ type: 'missingHealth', maxMultiplier: 2.0 }],
                actions: [{ type: 'fireProjectile', projectile: 'blood_orb', sound: 'bloodtome' }]
            }]
        },
        'chains': {
            name: 'Chains of Torment', type: 'physical',
            svg: `<svg viewBox="0 0 24 24"><path d="M10.59 13.41c.39.39 1.02.39 1.41 0l5.66-5.66-1.41-1.41-5.66 5.66-1.41 1.41zM4.41 19.59c-.39-.39-1.02-.39-1.41 0l-1.59 1.59 1.41 1.41 1.59-1.59c.39-.39.39-1.02 0-1.41z" fill="#999"/></svg>`,
            description: "Fires chains that pull enemies towards you.",
            attacks: [{
                id: 'main_shot',
                stats: { baseDmg: 5, baseCd: 1.8, baseSpd: 600, baseRange: 300, basePierce: 999, kb: 0 },
                targeting: 'horizontal',
                actions: [{ type: 'fireProjectile', projectile: 'chain_link', sound: 'whip' }]
            }]
        },
        'necronomicon': {
            name: 'Necronomicon', type: 'summon',
            svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="#aaa"/><path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="#aaa"/></svg>`,
            description: "Summons skeletons to fight for you.",
            attacks: [{
                id: 'main_summon',
                stats: { baseDmg: 12, baseCd: 8.0, baseDur: 10.0, kb: 50 },
                targeting: 'none',
                actions: [{ type: 'summonAlly', allyKey: 'skeleton_ally', sound: 'summon' }]
            }]
        },
        'sentient_spirit': {
            name: 'Sentient Spirit', type: 'summon',
            svg: `<svg viewBox="0 0 24 24"><path d="M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-4-4 1.41-1.41L10 16.17l6.59-6.59L18 11l-8 8z" fill="#e0e0e0"/></svg>`,
            description: "Summons a friendly spirit that drifts through enemies.",
            attacks: [{
                id: 'main_summon',
                stats: { baseDmg: 18, baseCd: 12.0, baseDur: 999 },
                targeting: 'none',
                actions: [{ type: 'summonAlly', allyKey: 'spirit_ally', sound: 'summon' }]
            }]
        },
        'ghostly_fire': {
            name: 'Ghostly Fire', type: 'elemental',
            svg: `<svg viewBox="0 0 24 24"><path d="M13.5 0c-4 3-4.5 5.5-4.5 5.5s.5-2.5 4.5-5.5m-2 7C8.5 7 5 9.5 5 12.5S8.5 18 11.5 18s6.5-2.5 6.5-5.5S14.5 7 11.5 7z" fill="#aaddff"/></svg>`,
            description: "Launches spectral bolts at random nearby enemies.",
            attacks: [{
                id: 'main_shot',
                stats: { baseDmg: 12, baseCd: 0.8, baseSpd: 400, baseRange: 450, basePierce: 0, kb: 50 },
                targeting: 'random',
                actions: [{ type: 'fireProjectile', projectile: 'ghostly_bolt', sound: 'wand' }]
            }]
        },
        'wand_of_storms': {
            name: 'Wand of Storms', type: 'elemental',
            svg: `<svg viewBox="0 0 24 24" fill="#88aaff"><path d="M16.5 6.5l-9 9M12 2l-2.5 9h5L12 2zm-7 13l-2.5 4h19l-2.5-4h-14z"/></svg>`,
            description: "Fires piercing bolts of lightning and periodically releases a nova of electricity.",
            attacks: [
                {
                    id: 'primary_bolt',
                    stats: { baseDmg: 12, baseCd: 0.8, baseArea: 1.0, baseSpd: 600, baseRange: 1200, basePierce: 1, kb: 100 },
                    targeting: 'nearest',
                    actions: [
                        { type: 'fireProjectile', projectile: 'storm_bolt', sound: 'lightning' }
                    ]
                },
                {
                    id: 'nova_pulse',
                    stats: { baseDmg: 25, baseCd: 5.0, baseArea: 1.5, kb: 600 },
                    targeting: 'none',
                    actions: [{
                        type: 'spawnEffect',
                        position: 'player',
                        sound: 'garlic',
                        visual: { key: 'electric_nova_draw', duration: 0.6, animation: { type: 'scaleIn', duration: 0.15 } },
                        behavior: {
                            type: 'instantArea',
                            radius: 100,
                            onHitEffects: [{ type: 'dealDamage', damages: 'enemy' }]
                        }
                    }]
                }
            ]
        },
        
    },

    // =========================================================================
    // 4. ALLIES
    // =========================================================================
    allies: {
        'skeleton_ally': {
            r: 10, speed: 150,
            visual: { type: 'procedural', key: 'skeleton_ally_draw' },
            behavior: { type: 'melee', attackCooldown: 0.5 }
        },
        'spirit_ally': {
            r: 12, speed: 80,
            visual: { type: 'procedural', key: 'spirit_ally_draw' },
            behavior: { type: 'contact', hitCooldown: 0.8 }
        }
    },

    // =========================================================================
    // 5. PASSIVES
    // =========================================================================
    passives: [
        { id: 'adrenaline', name: 'Adrenaline Rush', desc: 'On hit, +30% Speed/CDR for 5s', handlers: [{ trigger: { conditions: [{ type: 'onPlayerHit' }] }, effects: [{ type: 'applyBuff', buff: 'adrenaline_rush', duration: 5 }] }], svg: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-6h-2v6zm0-8h2V7h-2v2z" fill="#ffa500"/></svg>` },
        {
            id: 'rechargingShield', name: 'Aegis of Faith', desc: 'Gain a shield that blocks one hit. Recharges in 30s. Each level reduces recharge time by 5s.',
            mods: [{ stat: 'rechargeShieldTime', op: 'add', value: -5 }],
            handlers: [{
                trigger: { conditions: [{ type: 'onShieldBreak' }] },
                effects: [{
                    type: 'spawnEffect',
                    position: 'player',
                    visual: { key: 'shield_break_draw', duration: 0.4, animation: { type: 'scaleIn', duration: 0.1 } },
                    behavior: { type: 'visualOnly', radius: 80, duration: 0.4 }
                }]
            }],
            svg: `<svg viewBox="0 0 24 24" fill="#cfa538"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>`
        },
        { id: 'xpBonus', name: 'Alchemist\'s Satchel', desc: '+10% XP gain. Floor chickens may grant power-ups.', mods: [{ stat: 'xpGain', op: 'add', value: 0.1 }, { stat: 'chickenBonus', op: 'add', value: 1 }], svg: `<svg viewBox="0 0 24 24" fill="#8b4513"><path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>` },
        { id: 'magnet', name: 'Attractorb', desc: '+30% Pickup Range', mods: [{ stat: 'magnet', op: 'mul', value: 1.3 }], svg: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#a0a"/></svg>` },
        { id: 'bleed', name: 'Barbed Chain', desc: 'Your attacks have a +10% chance to cause Bleed (damage over time).', mods: [{ stat: 'bleedChance', op: 'add', value: 0.1 }], svg: `<svg viewBox="0 0 24 24"><path d="M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 15.17l6.59-6.59L19 10l-8 8z" fill="#777"/></svg>` },
        { id: 'area', name: 'Candelabrador', desc: '+10% Area', mods: [{ stat: 'area', op: 'add', value: 0.1 }], svg: `<svg viewBox="0 0 24 24"><path d="M11 2H7v17H5v3h14v-3h-2V2h-4v9h-2V2z" fill="#cfa538"/><circle cx="9" cy="1" r="2" fill="#fa0"/><circle cx="15" cy="1" r="2" fill="#fa0"/></svg>` },
        { id: 'doubloon', name: 'Cursed Doubloon', desc: 'Enemies may drop Cursed Doubloons (XP). Every 10 collected spawns a powerful Revenant.', mods: [{ stat: 'doubloonChance', op: 'add', value: 0.05 }], svg: `<svg viewBox="0 0 24 24" fill="#111"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="#333"/></svg>` },
        { id: 'amount', name: 'Duplicator', desc: '+1 Projectile', mods: [{ stat: 'amount', op: 'add', value: 1 }], svg: `<svg viewBox="0 0 24 24"><path d="M11 17h2v-4h4v-2h-4V7h-2v4H7v2h4v4zm-6 4h14V3H5v18z" fill="#0ff"/></svg>` },
        { id: 'elemental', name: 'Elemental Focus', desc: '+15% random weapon type damage', isDynamic: true, onSelect: (player) => { const types = ['projectile', 'aura', 'physical', 'elemental', 'summon', 'holy']; const chosen = types[M.randInt(0, types.length - 1)]; player.stats.elementalFocus[chosen] = (player.stats.elementalFocus[chosen] || 0) + 0.15; }, svg: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#8a2be2"/></svg>` },
        { id: 'cd', name: 'Empty Tome', desc: '-8% Cooldown', mods: [{ stat: 'cooldown', op: 'mul', value: 0.92 }], svg: `<svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" fill="#a5a"/></svg>` },
        { id: 'dodge', name: 'Ethereal Cloak', desc: '+5% chance to Dodge attacks.', mods: [{ stat: 'dodgeChance', op: 'add', value: 0.05 }], svg: `<svg viewBox="0 0 24 24" fill="#fff" opacity="0.7"><path d="M12 2L1 21h22L12 2zm-1 17h2v-2h-2v2zm0-4h2V7h-2v8z"/></svg>` },
        { id: 'crit', name: 'Executioner\'s Hood', desc: '+5% Crit Chance, +15% Crit Damage', mods: [{ stat: 'critChance', op: 'add', value: 0.05 }, { stat: 'critDmg', op: 'add', value: 0.15 }], svg: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#333"/><path d="M12 4c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" fill="#555"/></svg>` },
        { id: 'might', name: 'Gauntlet', desc: '+10% Damage', mods: [{ stat: 'might', op: 'add', value: 0.1 }], svg: `<svg viewBox="0 0 24 24"><path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 4c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2zm4 0c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2zm4 0c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2z" fill="#f44"/></svg>` },
        { id: 'glassCannon', name: 'Glass Shard', maxLevel: 1, desc: '+200% Damage. Your Max HP is locked to 1.', mods: [{ stat: 'might', op: 'mul', value: 3 }, { stat: 'isGlassCannon', op: 'set', value: true }], svg: `<svg viewBox="0 0 24 24" fill="#add8e6"><path d="M12 2L1 21h22L12 2z"/></svg>` },
        { id: 'health', name: 'Hollow Heart', desc: '+20% Max HP', mods: [{ stat: 'maxHp', op: 'mul', value: 1.2 }], onSelect: (player) => { player.hp += player.stats.maxHp * 0.2; }, svg: `<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#b33"/></svg>` },
        { id: 'madman', name: 'Masque of the Madman', maxLevel: 1, desc: '+20% Move Speed, but you cannot stop moving.', mods: [{ stat: 'moveSpeed', op: 'mul', value: 1.2 }, { stat: 'madman', op: 'set', value: true }], svg: `<svg viewBox="0 0 24 24" fill="#800080"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>` },
        { id: 'shieldOnKill', name: 'Philosopher\'s Stone', desc: '+5% Damage. Gain a small temporary shield on kill.', mods: [{ stat: 'might', op: 'add', value: 0.05 }], handlers: [{ trigger: { conditions: [{ type: 'onKill' }] }, effects: [{ type: 'applyBuff', buff: 'tempShield', amount: 0.5 }] }], svg: `<svg viewBox="0 0 24 24" fill="#ffd700"><path d="M12 2l-10 9h5v11h10V11h5L12 2z"/></svg>` },
        { id: 'regen', name: 'Pummarola', desc: '+0.5 HP/s Recovery', mods: [{ stat: 'regen', op: 'add', value: 0.5 }], svg: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#f88"/></svg>` },
        { id: 'healNova', name: 'Quicksilver Locket', desc: 'Become immune to slows. When you heal, release a pushback nova.', mods: [{ stat: 'healNova', op: 'add', value: 1 }], svg: `<svg viewBox="0 0 24 24" fill="#c0c0c0"><circle cx="12" cy="12" r="10"/></svg>` },
        { id: 'soul', name: 'Soul Conductor', desc: 'Each level grants scaling Dmg per 100 kills (diminishing returns).', mods: [{ stat: 'soul', op: 'add', value: 1 }], svg: `<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 4.42 3.05 8.11 7.14 8.84.29.05.57.06.86.06s.57-.01.86-.06C18.95 19.11 22 15.42 22 11c0-4.97-4.03-9-9-9z" fill="#ff00ff"/></svg>` },
        { id: 'greed', name: 'Stone of Greed', desc: '+25% XP Gain, -5% Move Speed', mods: [{ stat: 'xpGain', op: 'add', value: 0.25 }, { stat: 'moveSpeed', op: 'mul', value: 0.95 }], svg: `<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z" fill="#ffd700"/></svg>` },
        { id: 'thorns', name: 'Thorned Armor', desc: 'Deal 25% of Might as damage on touch', mods: [{ stat: 'thornsDmg', op: 'add', value: 0.25 }], svg: `<svg viewBox="0 0 24 24"><path d="M12 2L2 7v5c0 5.55 4.48 10 10 10s10-4.45 10-10V7l-10-5z" fill="#8b0000"/></svg>` },
        { id: 'time', name: 'Time Crystal', desc: 'Every 60s, freeze enemies for 2s', mods: [{ stat: 'timeCrystal', op: 'add', value: 1 }], svg: `<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="#00ffff"/></svg>` },
        { id: 'speed', name: 'Winged Boots', desc: '+10% Move Speed', mods: [{ stat: 'moveSpeed', op: 'add', value: 20 }], svg: `<svg viewBox="0 0 24 24"><path d="M19 5h-4V3H9v16h3v-2h2v-2h2v-2h1v-3h1V7h1V5zM5 19h4v2H5z" fill="#ffaaaa"/><path d="M5 19v-6l-3 3z" fill="#fff"/></svg>` },
        { id: 'scope', name: 'Hunter\'s Scope', desc: '+20% Projectile Range', mods: [{ stat: 'range', op: 'add', value: 0.2 }], svg: `<svg viewBox="0 0 24 24"><path d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3m0-5C6.48 4 2 8.48 2 14s4.48 10 10 10 10-4.48 10-10S17.52 4 12 4zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#8b4513"/></svg>` },
        {
            id: 'frost_attunement', name: 'Frost Attunement', maxLevel: 5, desc: 'Magic Wand missiles have a 10% chance per level to become a Frost Shard, Chilling the target and all other enemies in a small area.', svg: `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4l6 10H6l6-10z" fill="#add8e6"/></svg>`, mods: [{
                stat: 'projectileModifier', op: 'add', value: {
                    targetWeaponKey: 'wand', chancePerLevel: 0.10, effectsToAdd: [
                        { type: 'applyStatus', status: 'chill', amount: 0.5, duration: 3 },
                        {
                            type: 'spawnEffect',
                            position: 'target',
                            behavior: {
                                type: 'instantArea',
                                radius: 80,
                                onHitEffects: [{ type: 'applyStatus', status: 'chill', amount: 0.5, duration: 3 }]
                            }
                        }
                    ], visualSwap: 'frost_shard'
                }
            }]
        },
    ],

    // =========================================================================
    // 6. ENEMIES
    // =========================================================================
    enemies: {
        'bat': { r: 10, hp: 5, speed: 120, dmg: 5, xp: 1, visual: { key: 'bat_draw' }, handlers: [{ trigger: { conditions: [{ type: 'onDeath' }] }, effects: [{ type: 'spawnEffect', position: 'target', behavior: { type: 'particleEmitter', particle: { count: 8, color: '#555', size: [1, 3], speed: [50, 150], life: [0.3, 0.6], gravity: true } } }] }] },
        'zombie': { r: 12, hp: 15, speed: 80, dmg: 8, xp: 2, visual: { key: 'zombie_draw' } },
        'skeleton': { r: 12, hp: 30, speed: 90, dmg: 10, xp: 3, visual: { key: 'skeleton_draw' } },
        'ghost': { r: 10, hp: 20, speed: 150, dmg: 12, xp: 4, kbResist: 50, visual: { key: 'ghost_draw' } },
        'golem': { r: 20, hp: 200, speed: 40, dmg: 20, xp: 20, kbResist: 200, visual: { key: 'golem_draw' } },
        'imp': {
            r: 8, hp: 8, speed: 200, dmg: 7, xp: 2,
            visual: { key: 'imp_draw' },
            components: [
                { type: 'movement', pattern: 'weave', strength: 80, frequency: 20 }
            ]
        },
        'slime': { r: 15, hp: 40, speed: 70, dmg: 10, xp: 3, visual: { key: 'slime_draw' }, handlers: [{ trigger: { conditions: [{ type: 'onDeath' }] }, effects: [{ type: 'spawnEnemy', key: 'miniSlime', count: 2, spread: 5 }] }] },
        'miniSlime': { r: 8, hp: 10, speed: 100, dmg: 5, xp: 1, visual: { key: 'mini_slime_draw' } },
        'shaman': {
            r: 13, hp: 50, speed: 70, dmg: 12, xp: 10, kbResist: 100,
            visual: { key: 'shaman_draw' },
            handlers: [
                {
                    trigger: { conditions: [{ type: 'onUpdate' }, { type: 'cooldown', id: 'shield', time: 10 }] },
                    effects: [
                        { type: 'shieldAlliesInRange', range: 200, duration: 5 }
                    ]
                }
            ]
        },
        'phaser': {
            r: 12, hp: 30, speed: 100, dmg: 15, xp: 8, kbResist: 200,
            visual: { key: 'phaser_draw' },
            initialFlags: { isInvisible: true },
            handlers: [
                {
                    trigger: { conditions: [{ type: 'onUpdate' }, { type: 'distanceToPlayer', lessThan: 250 }, { type: 'isFlagTrue', key: 'isInvisible' }] },
                    effects: [
                        { type: 'setFlag', key: 'isInvisible', value: false }
                    ]
                }
            ]
        },
        'behemoth': {
            r: 35, hp: 800, speed: 30, dmg: 30, xp: 50, kbResist: 500,
            visual: { key: 'behemoth_draw' },
            handlers: [
                {
                    trigger: { conditions: [{ type: 'onUpdate' }, { type: 'cooldown', id: 'stomp', time: [5, 8] }] },
                    effects: [
                        {
                            type: 'fireProjectiles',
                            pattern: 'radial',
                            projectile: 'behemoth_rock',
                            count: 12,
                            projectileStats: { speed: 150, duration: 8, kb: 200 }
                        }
                    ]
                }
            ]
        },
        'reaper': {
            r: 14, hp: 80, speed: 160, dmg: 25, xp: 15, kbResist: 400,
            visual: { key: 'reaper_draw' },
            handlers: [
                {
                    trigger: {
                        operator: 'AND',
                        conditions: [
                            { type: 'onUpdate' },
                            { type: 'cooldown', id: 'dash', time: [6, 8] },
                            { type: 'distanceToPlayer', lessThan: 400 }
                        ]
                    },
                    effects: [
                        { type: 'setFlag', key: 'isInvulnerable', value: true, duration: 0.35 },
                        { type: 'dash', speed: 500, duration: 0.35 }
                    ]
                }
            ]
        },
        'abomination': {
            r: 22, hp: 450, speed: 35, dmg: 20, xp: 40, kbResist: 600,
            visual: { key: 'abomination_draw' },
            handlers: [
                {
                    trigger: { conditions: [{ type: 'onUpdate' }, { type: 'cooldown', id: 'poison', time: 1 }] },
                    effects: [{
                        type: 'spawnEffect',
                        position: 'source',
                        visual: { key: 'poison_puddle_draw' },
                        behavior: {
                            type: 'groundEffect',
                            radius: 45,
                            duration: 6,
                            tickRate: 0.5,
                            onTickEffects: [{ type: 'dealDamage', damages: 'player' }]
                        }
                    }]
                },
                {
                    trigger: { conditions: [{ type: 'onDeath' }] },
                    effects: [{ type: 'spawnEnemy', key: 'miniSlime', count: 3, spread: 25 }]
                }
            ]
        },
        'revenant': { r: 20, hp: 3000, speed: 100, dmg: 40, xp: 200, kbResist: 999, visual: { key: 'revenant_draw' } },
    },

    SPAWN_SCHEDULE: [
        { time: 0, types: ['bat', 'zombie'] },
        { time: 120, types: ['bat', 'zombie', 'skeleton', 'imp'] },
        { time: 300, types: ['skeleton', 'ghost', 'slime', 'phaser', 'reaper'] },
        { time: 480, types: ['shaman', 'golem', 'abomination'] },
        { time: 720, types: ['behemoth'] },
    ]

};

