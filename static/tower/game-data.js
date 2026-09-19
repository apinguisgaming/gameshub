

/**
 * Game Data Layer
 * This file strictly drives the engine. There is NO hardcoded logic for specific towers.
 * It provides configurations, stats, strings, and assets paths.
 */
const GameData = {
    // Global Config
    config: {
        startingMoney: 75,
        startingLives: 20,
        mapWidth: 800,
        mapHeight: 600,
        gridSize: 16, // 16x16 squares
        mapImage: 'maps/1-1.png',
        starterIds: ['bulbasaur', 'charmander', 'squirtle']
    },

    // Nature System Modifiers
    natures: {
        'hardy': { atk: 1.0, spatk: 1.0, spd: 1.0 },
        'lonely': { atk: 1.1, spatk: 1.0, spd: 1.0 },
        'adamant': { atk: 1.1, spatk: 0.9, spd: 1.0 },
        'naughty': { atk: 1.1, spatk: 1.0, spd: 1.0 },
        'brave': { atk: 1.1, spatk: 1.0, spd: 0.9 },
        'bold': { atk: 0.9, spatk: 1.0, spd: 1.0 },
        'modest': { atk: 0.9, spatk: 1.1, spd: 1.0 },
        'mild': { atk: 1.0, spatk: 1.1, spd: 1.0 },
        'quiet': { atk: 1.0, spatk: 1.1, spd: 0.9 },
        'timid': { atk: 0.9, spatk: 1.0, spd: 1.1 },
        'hasty': { atk: 1.0, spatk: 1.0, spd: 1.1 },
        'jolly': { atk: 1.0, spatk: 0.9, spd: 1.1 },
        'naive': { atk: 1.0, spatk: 1.0, spd: 1.1 }
    },
    
    // Status Effects System
    statusEffects: {
        burn: { id: 'burn', name: 'Burn', duration: 3.0, tickRate: 1.0, damagePerTick: 10, speedModifier: 1.0, stunned: false, color: '#ef4444' },
        paralyze: { id: 'paralyze', name: 'Paralyze', duration: 2.5, tickRate: 0, damagePerTick: 0, speedModifier: 0.4, stunned: false, color: '#facc15' },
        freeze: { id: 'freeze', name: 'Freeze', duration: 1.5, tickRate: 0, damagePerTick: 0, speedModifier: 0, stunned: true, color: '#38bdf8' },
        poison: { id: 'poison', name: 'Poison', duration: 4.0, tickRate: 1.0, damagePerTick: 5, speedModifier: 1.0, stunned: false, color: '#a855f7' }
    },

    // Split Abilities System
    towerAbilities: {
        // --- STARTER/LOW HP BOOSTS ---
        'overgrow': { id: 'overgrow', name: 'Overgrow', description: 'Boosts damage by 50% when player lives are below 30%.', type: 'low_hp_boost', threshold: 0.3, dmgMultiplier: 1.5 },
        'blaze': { id: 'blaze', name: 'Blaze', description: 'Boosts Fire damage by 50% when player lives are below 30%.', type: 'low_hp_boost', threshold: 0.3, dmgMultiplier: 1.5 },
        'torrent': { id: 'torrent', name: 'Torrent', description: 'Boosts Water damage by 50% when player lives are below 30%.', type: 'low_hp_boost', threshold: 0.3, dmgMultiplier: 1.5 },
        'swarm': { id: 'swarm', name: 'Swarm', description: 'Boosts Attack Speed by 50% when player lives are below 30%.', type: 'low_hp_boost', threshold: 0.3, speedMultiplier: 1.5 },

        // --- TOWER PASSIVES (Defenders) ---
        'intimidate': { id: 'intimidate', name: 'Intimidate', description: 'Aura: Slows enemies within range by 20%.', type: 'aura', effect: 'speed', modifier: 0.8 },
        'pickup': { id: 'pickup', name: 'Pickup', description: '15% chance to generate $3 extra when defeating an enemy.', type: 'on_kill', chance: 0.15, bonusMoney: 3 },
        'super_luck': { id: 'super_luck', name: 'Super Luck', description: 'Flat +15% to Critical Hit chance.', type: 'passive', critChanceBonus: 0.15 },
        'sniper': { id: 'sniper', name: 'Sniper', description: 'Increases Critical Hit damage multiplier by +1.0.', type: 'passive', critMultBonus: 1.0 },
        'compound_eyes': { id: 'compound_eyes', name: 'Compound Eyes', description: 'Increases attack range by 25%.', type: 'passive', rangeMultiplier: 1.25 },
        'huge_power': { id: 'huge_power', name: 'Huge Power', description: 'Doubles raw damage, but attacks 20% slower.', type: 'passive', dmgMultiplier: 2.0, atkSpeedMultiplier: 0.8 },
        'technician': { id: 'technician', name: 'Technician', description: 'Boosts damage of low-base-stat moves by 50%.', type: 'passive', dmgMultiplier: 1.5 },
        'thick_fat': { id: 'thick_fat', name: 'Thick Fat', description: 'Reduces damage taken from Fire and Ice attacks by 50%.', type: 'resistance', resists: ['fire', 'ice'], resistMultiplier: 0.5 },
        'magic_guard': { id: 'magic_guard', name: 'Magic Guard', description: 'Takes damage from attacks, but immune to damage-over-time (Burn/Poison).', type: 'immunity', ignoresDoT: true },
        'unaware': { id: 'unaware', name: 'Unaware', description: 'Ignores attacking tower level and items (acts as Lv.1).', type: 'stat_ignore' },
        
        // --- ON-HIT TOWER EFFECTS ---
        'static': { id: 'static', name: 'Static', description: 'Attacks have a 10% chance to Paralyze the target.', type: 'on_hit', applyStatus: 'paralyze', statusChance: 0.10 },
        'flame_body': { id: 'flame_body', name: 'Flame Body', description: 'Attacks have a 10% chance to Burn the target.', type: 'on_hit', applyStatus: 'burn', statusChance: 0.10 },
        'poison_point': { id: 'poison_point', name: 'Poison Point', description: 'Attacks have a 10% chance to Poison the target.', type: 'on_hit', applyStatus: 'poison', statusChance: 0.10 },

        // --- TERRAIN ABILITIES ---
        'swift_swim': { id: 'swift_swim', name: 'Swift Swim', description: 'Doubles Attack Speed when placed in Water.', type: 'terrain', terrain: 'water', speedMultiplier: 2.0 },
        'chlorophyll': { id: 'chlorophyll', name: 'Chlorophyll', description: 'Doubles Attack Speed when placed in Grass.', type: 'terrain', terrain: 'grass', speedMultiplier: 2.0 },
        'sand_veil': { id: 'sand_veil', name: 'Sand Veil', description: 'Increases Range by 50% when placed on Mountains.', type: 'terrain', terrain: 'mountain', rangeMultiplier: 1.5 },
        'adaptability': { id: 'adaptability', name: 'Adaptability', description: 'Increases Damage by 50% when placed on Normal Land.', type: 'terrain', terrain: 'land', dmgMultiplier: 1.5 },
        'rain_dish': { id: 'rain_dish', name: 'Rain Dish', description: 'Boosts Damage by 50% when placed in Water.', type: 'terrain', terrain: 'water', dmgMultiplier: 1.5 },

        // --- SOCIAL ABILITIES ---
        'helping_hand': { id: 'helping_hand', name: 'Helping Hand', description: 'Gains 10% Damage for each other Pokémon within its range.', type: 'proximity', range: 'own', dmgBonusPerAlly: 0.1 },

        // --- ECONOMY & UTILITY ---
        'honey_gather': { id: 'honey_gather', name: 'Honey Gather', description: 'Generates $5 at the end of every wave.', type: 'end_wave', bonusMoney: 5 },
        'frisk': { id: 'frisk', name: 'Frisk', description: 'Instantly reveals full stats of enemies that enter range.', type: 'utility' },
        'levitate': { id: 'levitate', name: 'Levitate', description: 'Can be placed on any terrain tile.', type: 'placement_bypass' },

        // --- COMBAT ENHANCERS ---
        'moxie': { id: 'moxie', name: 'Moxie', description: 'Gains +1% permanent damage per kill (caps at 50%).', type: 'growth', dmgBonusPerKill: 0.01, cap: 0.5 },
        'skill_link': { id: 'skill_link', name: 'Skill Link', description: '25% chance to fire a second free projectile.', type: 'trigger', chance: 0.25 },
        'merciless': { id: 'merciless', name: 'Merciless', description: 'Guaranteed Critical Hits against Poisoned enemies.', type: 'conditional_crit', status: 'poison' },
        'serene_grace': { id: 'serene_grace', name: 'Serene Grace', description: 'Doubles the chance of applying on-hit status effects.', type: 'stat_boost', multiplier: 2.0 },
        'mold_breaker': { id: 'mold_breaker', name: 'Mold Breaker', description: 'Attacks ignore enemy defensive abilities.', type: 'bypass' },
        'no_guard': { id: 'no_guard', name: 'No Guard', description: 'Projectiles are hitscan (instant hit).', type: 'projectile_mod' },
        'solar_power': { id: 'solar_power', name: 'Solar Power', description: 'Boosts Damage by 50% at all times, but generates 20% less money per kill.', type: 'passive', dmgMultiplier: 1.5, moneyMultiplier: 0.8 },
        'lightning_rod': { id: 'lightning_rod', name: 'Lightning Rod', description: 'Boosts Range by 15% and Damage by 10%.', type: 'passive', rangeMultiplier: 1.15, dmgMultiplier: 1.1 },

        // --- TOWER AURAS ---
        'battery': { id: 'battery', name: 'Battery', description: 'Aura: Boosts Attack Speed of adjacent Towers by 15%.', type: 'aura', auraType: 'buff_atk_spd', auraMultiplier: 1.15 },
        'symbiosis': { id: 'symbiosis', name: 'Symbiosis', description: 'Shares 50% of held item bonuses with towers in range.', type: 'aura_item_share', shareFactor: 0.5 },
        'friend_guard': { id: 'friend_guard', name: 'Friend Guard', description: 'Allies in range take 50% less recoil damage.', type: 'aura_recoil_resist', resist: 0.5 }
    },

    enemyAbilities: {
        // --- BASIC ENEMY ABILITIES ---
        'sturdy': { id: 'sturdy', name: 'Sturdy', description: 'Cannot be defeated in one hit. Always survives with at least 1 HP once.', type: 'survival', triggered: false },
        'speed_boost': { id: 'speed_boost', name: 'Speed Boost', description: 'Movement speed increases by 5% every second spent on the map.', type: 'scaling', speedIncreasePerSec: 0.05 },
        'regenerator': { id: 'regenerator', name: 'Regenerator', description: 'Heals 5% of max HP every 2 seconds.', type: 'tick', healPercent: 0.05, tickInterval: 2.0 },
        'magic_guard': { id: 'magic_guard', name: 'Magic Guard', description: 'Takes damage from attacks, but immune to damage-over-time (Burn/Poison).', type: 'immunity', ignoresDoT: true },
        'limber': { id: 'limber', name: 'Limber', description: 'Completely immune to Paralyze and Freeze.', type: 'immunity', immuneTo: ['paralyze', 'freeze'] },
        'iron_barbs': { id: 'iron_barbs', name: 'Iron Barbs', description: 'Stuns the attacking Tower for 0.5s on every hit.', type: 'recoil_stun', trigger: 'on_hit', stunDuration: 0.5 },
        'thick_fat': { id: 'thick_fat', name: 'Thick Fat', description: 'Reduces damage taken from Fire and Ice attacks by 50%.', type: 'resistance', resists: ['fire', 'ice'], resistMultiplier: 0.5 },
        'guts': { id: 'guts', name: 'Guts', description: 'Movement speed doubles if afflicted by Burn, Paralyze, or Poison.', type: 'conditional', triggerStatuses: ['burn', 'paralyze', 'poison'], speedMultiplier: 2.0 },
        'technician': { id: 'technician', name: 'Technician', description: 'Boosts attack power? (Placeholder for enemies)', type: 'passive', dmgMultiplier: 1.5 },
        'levitate': { id: 'levitate', name: 'Levitate', description: 'Completely immune to ground-based area attacks.', type: 'immunity', ignoreGround: true },

        // --- ADVANCED ENEMY ABILITIES ---
        'emergency_exit': { id: 'emergency_exit', name: 'Emergency Exit', description: 'Teleports forward when HP drops below 50%.', type: 'teleport_trigger', hpThreshold: 0.5, teleportDist: 120 },
        'illusion': { id: 'illusion', name: 'Illusion', description: 'Takes only 1 damage from the first 3 hits.', type: 'hit_shield', shieldHits: 3 },
        'shield_dust': { id: 'shield_dust', name: 'Shield Dust', description: 'Immune to splash damage and status effects.', type: 'ignore_secondary' },
        'unaware': { id: 'unaware', name: 'Unaware', description: 'Ignores attacking tower level and items (acts as Lv.1).', type: 'stat_ignore' },
        'aftermath': { id: 'aftermath', name: 'Aftermath', description: 'Stuns the tower that kills it for 3 seconds.', type: 'recoil_stun', trigger: 'on_death', stunDuration: 3.0 },
        'shadow_tag': { id: 'shadow_tag', name: 'Shadow Tag', description: 'Locks nearby towers: cannot level up, sell, or swap items.', type: 'aura_lock', lockRange: 100 },
        'corrosion': { id: 'corrosion', name: 'Corrosion', description: 'Drains $1 per second while on the map.', type: 'drain', drainPerSec: 1 },
        'pack_hunter': { id: 'pack_hunter', name: 'Pack Hunter', description: 'Takes 10% less damage per nearby ally.', type: 'proximity_resist', resistPerAlly: 0.1 },
        'sand_hide': { id: 'sand_hide', name: 'Sand Hide', description: 'Doubles Defense while on Mountain terrain.', type: 'terrain_buff', terrain: 'mountain', stat: 'def', multiplier: 2.0 },
        'pay_day': { id: 'pay_day', name: 'Pay Day', description: 'Grants an extra $50 bonus when defeated.', type: 'extra_bounty', bonus: 50 }
    },

    // Central Move Library
    moves: {
        'tackle': { id: 'tackle', name: 'Tackle', category: 'physical', power: 10, attackType: 'single', projectileSpeed: 300, applyStatus: null, speedModifier: 1.0, tags: ['normal'] },
        'body_slam': { id: 'body_slam', name: 'Body Slam', category: 'physical', power: 30, attackType: 'single', projectileSpeed: 400, applyStatus: 'paralyze', statusChance: 0.3, speedModifier: 0.8, tags: ['normal'] },
        'hyper_beam': { id: 'hyper_beam', name: 'Hyper Beam', category: 'special', power: 90, attackType: 'single', projectileSpeed: 600, applyStatus: null, speedModifier: 0.3, tags: ['normal'] },

        'vine_whip': { id: 'vine_whip', name: 'Vine Whip', category: 'physical', power: 15, attackType: 'single', projectileSpeed: 350, applyStatus: null, speedModifier: 1.0, tags: ['grass'] },
        'razor_leaf': { id: 'razor_leaf', name: 'Razor Leaf', category: 'physical', power: 18, attackType: 'single', projectileSpeed: 350, applyStatus: 'paralyze', statusChance: 0.1, speedModifier: 0.9, tags: ['grass'] },
        'petal_blizzard': { id: 'petal_blizzard', name: 'Petal Blizzard', category: 'physical', power: 25, attackType: 'splash', splashRadius: 60, projectileSpeed: 400, applyStatus: 'paralyze', statusChance: 0.2, speedModifier: 0.8, tags: ['grass'] },
        'solar_beam': { id: 'solar_beam', name: 'Solar Beam', category: 'special', power: 50, attackType: 'single', projectileSpeed: 500, applyStatus: null, speedModifier: 0.5, tags: ['grass'] },

        'scratch': { id: 'scratch', name: 'Scratch', category: 'physical', power: 10, attackType: 'single', projectileSpeed: 350, applyStatus: null, speedModifier: 1.0, tags: ['normal'] },
        'ember': { id: 'ember', name: 'Ember', category: 'special', power: 15, attackType: 'single', projectileSpeed: 400, applyStatus: 'burn', statusChance: 0.1, speedModifier: 1.0, tags: ['fire'] },
        'flamethrower': { id: 'flamethrower', name: 'Flamethrower', category: 'special', power: 25, attackType: 'single', projectileSpeed: 450, applyStatus: 'burn', statusChance: 0.1, speedModifier: 1.0, tags: ['fire'] },
        'fire_blast': { id: 'fire_blast', name: 'Fire Blast', category: 'special', power: 40, attackType: 'splash', splashRadius: 60, projectileSpeed: 400, applyStatus: 'burn', speedModifier: 0.6, tags: ['fire'] },

        'water_gun': { id: 'water_gun', name: 'Water Gun', category: 'special', power: 12, attackType: 'single', projectileSpeed: 320, applyStatus: null, speedModifier: 1.0, tags: ['water'] },
        'water_pulse': { id: 'water_pulse', name: 'Water Pulse', category: 'special', power: 18, attackType: 'single', projectileSpeed: 350, applyStatus: 'freeze', statusChance: 0.2, speedModifier: 0.9, tags: ['water'] },
        'hydro_pump': { id: 'hydro_pump', name: 'Hydro Pump', category: 'special', power: 35, attackType: 'splash', splashRadius: 70, projectileSpeed: 450, applyStatus: 'freeze', statusChance: 0.1, speedModifier: 0.7, tags: ['water'] },
        'surf': { id: 'surf', name: 'Surf', category: 'special', power: 25, attackType: 'splash', splashRadius: 80, projectileSpeed: 300, applyStatus: null, speedModifier: 0.8, tags: ['water'] },

        'ice_beam': { id: 'ice_beam', name: 'Ice Beam', category: 'special', power: 25, attackType: 'single', projectileSpeed: 450, applyStatus: 'freeze', statusChance: 0.25, speedModifier: 1.0, tags: ['ice'] },
        'blizzard': { id: 'blizzard', name: 'Blizzard', category: 'special', power: 45, attackType: 'splash', splashRadius: 65, projectileSpeed: 400, applyStatus: 'freeze', statusChance: 0.15, speedModifier: 0.5, tags: ['ice'] },

        'thunder_shock': { id: 'thunder_shock', name: 'Thunder Shock', category: 'special', power: 12, attackType: 'single', projectileSpeed: 500, applyStatus: 'paralyze', statusChance: 0.1, speedModifier: 1.1, tags: ['electric'] },
        'thunderbolt': { id: 'thunderbolt', name: 'Thunderbolt', category: 'special', power: 20, attackType: 'chain', chainCount: 3, chainRadius: 100, projectileSpeed: 500, applyStatus: 'paralyze', statusChance: 0.15, speedModifier: 1.0, tags: ['electric'] },
        'thunder': { id: 'thunder', name: 'Thunder', category: 'special', power: 40, attackType: 'chain', chainCount: 5, chainRadius: 120, projectileSpeed: 600, applyStatus: 'paralyze', statusChance: 0.2, speedModifier: 0.6, tags: ['electric'] },

        'poison_sting': { id: 'poison_sting', name: 'Poison Sting', category: 'physical', power: 8, attackType: 'single', projectileSpeed: 400, applyStatus: 'poison', statusChance: 0.2, speedModifier: 1.2, tags: ['poison'] },
        'sludge': { id: 'sludge', name: 'Sludge', category: 'special', power: 15, attackType: 'zone', zoneDuration: 5.0, zoneRadius: 30, projectileSpeed: 250, applyStatus: 'poison', speedModifier: 0.6, tags: ['poison'] },
        'sludge_bomb': { id: 'sludge_bomb', name: 'Sludge Bomb', category: 'special', power: 25, attackType: 'zone', zoneDuration: 6.0, zoneRadius: 50, projectileSpeed: 300, applyStatus: 'poison', speedModifier: 0.9, tags: ['poison'] },

        'rock_throw': { id: 'rock_throw', name: 'Rock Throw', category: 'physical', power: 15, attackType: 'splash', splashRadius: 40, projectileSpeed: 350, applyStatus: null, speedModifier: 0.9, tags: ['rock'] },
        'rock_slide': { id: 'rock_slide', name: 'Rock Slide', category: 'physical', power: 25, attackType: 'splash', splashRadius: 60, projectileSpeed: 350, applyStatus: null, speedModifier: 0.8, tags: ['rock'] },
        'earthquake': { id: 'earthquake', name: 'Earthquake', category: 'physical', power: 45, attackType: 'splash', splashRadius: 100, projectileSpeed: 600, applyStatus: null, speedModifier: 0.5, tags: ['ground'] },

        'helping_hand_move': { id: 'helping_hand_move', name: 'Helping Hand', category: 'special', power: 0, attackType: 'aura', auraType: 'buff_atk_spd', auraMultiplier: 1.3, speedModifier: 1.0, tags: ['normal'] }
    },

     // Towers (Pokémon) Config
    towers: {
        'bulbasaur': {
            id: 'bulbasaur', name: 'Bulbasaur', cost: 100, iconPath: 'pokemon/icon/001.png', walkingSprite: 'pokemon/walking/001.png', placeholderColor: '#22c55e',
            baseStats: { atk: 19, spatk: 17, range: 125, spd: 1.05, critChance: 0.1, critMultiplier: 1.75, armorPenetration: 1 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 3, moveId: 'vine_whip' }],
            tmList: ['solar_beam', 'sludge_bomb'],
            possibleAbilities: ['overgrow', 'chlorophyll'],
            evolution: { targetLevel: 16, nextTowerId: 'ivysaur' }, placementTags: ['land', 'grass'], tags: ['grass', 'poison']
        },
        'ivysaur': {
            id: 'ivysaur', name: 'Ivysaur', cost: 350, iconPath: 'pokemon/icon/002.png', walkingSprite: 'pokemon/walking/002.png', placeholderColor: '#16a34a',
            baseStats: { atk: 37, spatk: 35, range: 140, spd: 1.3, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'vine_whip' }, { level: 7, moveId: 'razor_leaf' }],
            tmList: ['solar_beam', 'sludge_bomb'],
            possibleAbilities: ['overgrow', 'chlorophyll'],
            evolution: { targetLevel: 32, nextTowerId: 'venusaur' }, placementTags: ['land', 'grass'], tags: ['grass', 'poison']
        },
        'venusaur': {
            id: 'venusaur', name: 'Venusaur', cost: 950, iconPath: 'pokemon/icon/003.png', walkingSprite: 'pokemon/walking/003.png', placeholderColor: '#15803d',
            baseStats: { atk: 80, spatk: 90, range: 160, spd: 1.1, critChance: 0.15, critMultiplier: 2.0, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'razor_leaf' }, { level: 15, moveId: 'petal_blizzard' }],
            tmList: ['solar_beam', 'sludge_bomb'],
            possibleAbilities: ['overgrow', 'chlorophyll', 'thick_fat'],
            evolution: null, placementTags: ['land', 'grass'], tags: ['grass', 'poison']
        },
        'charmander': {
            id: 'charmander', name: 'Charmander', cost: 120, iconPath: 'pokemon/icon/004.png', walkingSprite: 'pokemon/walking/004.png', placeholderColor: '#f97316',
            baseStats: { atk: 21, spatk: 21, range: 110, spd: 1.1, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'scratch' }, { level: 4, moveId: 'ember' }],
            tmList: ['fire_blast', 'solar_beam'],
            possibleAbilities: ['blaze', 'moxie'],
            evolution: { targetLevel: 16, nextTowerId: 'charmeleon' }, placementTags: ['land', 'mountain'], tags: ['fire']
        },
        'charmeleon': {
            id: 'charmeleon', name: 'Charmeleon', cost: 400, iconPath: 'pokemon/icon/005.png', walkingSprite: 'pokemon/walking/005.png', placeholderColor: '#ea580c',
            baseStats: { atk: 45, spatk: 40, range: 120, spd: 1.2, critChance: 0.15, critMultiplier: 1.8, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'ember' }, { level: 8, moveId: 'flamethrower' }],
            tmList: ['fire_blast', 'solar_beam'],
            possibleAbilities: ['blaze', 'moxie'],
            evolution: { targetLevel: 36, nextTowerId: 'charizard' }, placementTags: ['land', 'mountain'], tags: ['fire']
        },
        'charizard': {
            id: 'charizard', name: 'Charizard', cost: 1100, iconPath: 'pokemon/icon/006.png', walkingSprite: 'pokemon/walking/006.png', placeholderColor: '#b91c1c',
            baseStats: { atk: 85, spatk: 100, range: 150, spd: 1.1, critChance: 0.2, critMultiplier: 2.0, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'flamethrower' }, { level: 12, moveId: 'fire_blast' }],
            tmList: ['fire_blast', 'solar_beam'],
            possibleAbilities: ['blaze', 'moxie', 'solar_power'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['fire', 'flying']
        },
        'squirtle': {
            id: 'squirtle', name: 'Squirtle', cost: 110, iconPath: 'pokemon/icon/007.png', walkingSprite: 'pokemon/walking/007.png', placeholderColor: '#0ea5e9',
            baseStats: { atk: 19, spatk: 22, range: 130, spd: 1.1, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 2 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 4, moveId: 'water_gun' }],
            tmList: ['surf', 'hydro_pump'],
            possibleAbilities: ['torrent', 'rain_dish'],
            evolution: { targetLevel: 16, nextTowerId: 'wartortle' }, placementTags: ['land', 'water'], tags: ['water']
        },
        'wartortle': {
            id: 'wartortle', name: 'Wartortle', cost: 380, iconPath: 'pokemon/icon/008.png', walkingSprite: 'pokemon/walking/008.png', placeholderColor: '#0284c7',
            baseStats: { atk: 40, spatk: 45, range: 140, spd: 1.2, critChance: 0.1, critMultiplier: 1.6, armorPenetration: 6 },
            learnset: [{ level: 1, moveId: 'water_gun' }, { level: 7, moveId: 'water_pulse' }],
            tmList: ['surf', 'hydro_pump'],
            possibleAbilities: ['torrent', 'rain_dish'],
            evolution: { targetLevel: 36, nextTowerId: 'blastoise' }, placementTags: ['land', 'water'], tags: ['water']
        },
        'blastoise': {
            id: 'blastoise', name: 'Blastoise', cost: 1050, iconPath: 'pokemon/icon/009.png', walkingSprite: 'pokemon/walking/009.png', placeholderColor: '#0369a1',
            baseStats: { atk: 85, spatk: 100, range: 180, spd: 1.0, critChance: 0.2, critMultiplier: 2.2, armorPenetration: 25 },
            learnset: [{ level: 1, moveId: 'water_pulse' }, { level: 14, moveId: 'hydro_pump' }],
            tmList: ['surf', 'hydro_pump'],
            possibleAbilities: ['torrent', 'rain_dish'],
            evolution: null, placementTags: ['land', 'water'], tags: ['water']
        },
        'pikachu': {
            id: 'pikachu', name: 'Pikachu', buyable: true, cost: 150, iconPath: 'pokemon/icon/025.png', walkingSprite: 'pokemon/walking/025.png', placeholderColor: '#facc15',
            baseStats: { atk: 19, spatk: 23, range: 110, spd: 1.2, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'thunder_shock' }, { level: 6, moveId: 'thunderbolt' }],
            tmList: ['thunder', 'surf'],
            possibleAbilities: ['static', 'super_luck', 'lightning_rod'],
            evolution: null, placementTags: ['land'], tags: ['electric']
        },
        'grimer': {
            id: 'grimer', name: 'Grimer', buyable: true, cost: 200, iconPath: 'pokemon/icon/088.png', walkingSprite: 'pokemon/walking/088.png', placeholderColor: '#a855f7',
            baseStats: { atk: 15, spatk: 25, range: 90, spd: 0.9, critChance: 0.0, critMultiplier: 1.0, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'sludge' }, { level: 5, moveId: 'sludge_bomb' }],
            tmList: ['sludge_bomb', 'fire_blast'],
            possibleAbilities: ['poison_point'],
            evolution: null, placementTags: ['land', 'water'], tags: ['poison']
        },
        'clefairy': {
            id: 'clefairy', name: 'Clefairy', buyable: true, cost: 250, iconPath: 'pokemon/icon/035.png', walkingSprite: 'pokemon/walking/035.png', placeholderColor: '#f472b6',
            baseStats: { atk: 10, spatk: 30, range: 100, spd: 1.0, critChance: 0, critMultiplier: 1, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'helping_hand_move' }],
            tmList: ['solar_beam', 'fire_blast', 'thunder', 'surf', 'sludge_bomb'],
            possibleAbilities: ['magic_guard', 'friend_guard', 'unaware'],
            evolution: null, placementTags: ['land'], tags: ['fairy', 'normal']
        },
        // --- CATERPIE LINE (Early Game Support/Special) ---
        'caterpie': {
            id: 'caterpie', name: 'Caterpie', buyable: true, cost: 40, iconPath: 'pokemon/icon/010.png', walkingSprite: 'pokemon/walking/010.png', placeholderColor: '#4ade80',
            baseStats: { atk: 10, spatk: 5, range: 80, spd: 1.0, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'tackle' }],
            tmList: [],
            possibleAbilities: ['shield_dust', 'swarm'],
            evolution: { targetLevel: 7, nextTowerId: 'metapod' }, placementTags: ['land', 'grass'], tags: ['bug']
        },
        'metapod': {
            id: 'metapod', name: 'Metapod', cost: 50, iconPath: 'pokemon/icon/011.png', walkingSprite: 'pokemon/walking/011.png', placeholderColor: '#4ade80',
            baseStats: { atk: 7, spatk: 10, range: 80, spd: 0.9, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'tackle' }],
            tmList: [],
            possibleAbilities: ['shield_dust', 'swarm'],
            evolution: { targetLevel: 10, nextTowerId: 'butterfree' }, placementTags: ['land', 'grass'], tags: ['bug']
        },
        'butterfree': {
            id: 'butterfree', name: 'Butterfree', cost: 400, iconPath: 'pokemon/icon/012.png', walkingSprite: 'pokemon/walking/012.png', placeholderColor: '#a78bfa',
            baseStats: { atk: 20, spatk: 55, range: 160, spd: 1.2, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'razor_leaf' }, { level: 10, moveId: 'sludge_bomb' }],
            tmList: ['solar_beam', 'fire_blast', 'thunder'],
            possibleAbilities: ['compound_eyes', 'serene_grace'],
            evolution: null, placementTags: ['land', 'grass'], tags: ['bug', 'flying']
        },
        // --- WEEDLE LINE (Early Game Physical Crit) ---
        'weedle': {
            id: 'weedle', name: 'Weedle', buyable: true, cost: 40, iconPath: 'pokemon/icon/013.png', walkingSprite: 'pokemon/walking/013.png', placeholderColor: '#facc15',
            baseStats: { atk: 12, spatk: 4, range: 80, spd: 1.1, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'poison_sting' }],
            tmList: [],
            possibleAbilities: ['shield_dust', 'swarm'],
            evolution: { targetLevel: 7, nextTowerId: 'kakuna' }, placementTags: ['land', 'grass'], tags: ['bug', 'poison']
        },
        'kakuna': {
            id: 'kakuna', name: 'Kakuna', cost: 50, iconPath: 'pokemon/icon/014.png', walkingSprite: 'pokemon/walking/014.png', placeholderColor: '#eab308',
            baseStats: { atk: 8, spatk: 4, range: 80, spd: 0.8, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'poison_sting' }],
            tmList: [],
            possibleAbilities: ['shield_dust', 'swarm'],
            evolution: { targetLevel: 10, nextTowerId: 'beedrill' }, placementTags: ['land', 'grass'], tags: ['bug', 'poison']
        },
        'beedrill': {
            id: 'beedrill', name: 'Beedrill', cost: 400, iconPath: 'pokemon/icon/015.png', walkingSprite: 'pokemon/walking/015.png', placeholderColor: '#ca8a04',
            baseStats: { atk: 65, spatk: 15, range: 130, spd: 1.5, critChance: 0.25, critMultiplier: 2.0, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'poison_sting' }, { level: 10, moveId: 'scratch' }],
            tmList: ['sludge_bomb'],
            possibleAbilities: ['sniper', 'swarm'],
            evolution: null, placementTags: ['land', 'grass'], tags: ['bug', 'poison']
        },

        // --- GASTLY LINE (Special Sweeper) ---
        'gastly': {
            id: 'gastly', name: 'Gastly', buyable: true, cost: 200, iconPath: 'pokemon/icon/092.png', walkingSprite: 'pokemon/walking/092.png', placeholderColor: '#c084fc',
            baseStats: { atk: 10, spatk: 35, range: 120, spd: 1.1, critChance: 0.1, critMultiplier: 1.8, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'sludge' }, { level: 5, moveId: 'water_pulse' }],
            tmList: ['thunderbolt', 'fire_blast', 'sludge_bomb'],
            possibleAbilities: ['levitate', 'static'],
            evolution: { targetLevel: 25, nextTowerId: 'apollo' }, placementTags: ['land'], tags: ['ghost', 'poison']
        },
        'apollo': {
            id: 'apollo', name: 'Apollo', cost: 200, iconPath: 'pokemon/icon/093.png', walkingSprite: 'pokemon/walking/093.png', placeholderColor: '#c084fc',
            baseStats: { atk: 15, spatk: 55, range: 125, spd: 1.2, critChance: 0.1, critMultiplier: 1.8, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'sludge' }, { level: 5, moveId: 'water_pulse' }],
            tmList: ['thunderbolt', 'fire_blast', 'sludge_bomb'],
            possibleAbilities: ['levitate', 'static'],
            evolution: { targetLevel: 36, nextTowerId: 'gengar' }, placementTags: ['land'], tags: ['ghost', 'poison']
        },
        'gengar': {
            id: 'gengar', name: 'Gengar', cost: 1200, iconPath: 'pokemon/icon/094.png', walkingSprite: 'pokemon/walking/094.png', placeholderColor: '#7e22ce',
            baseStats: { atk: 30, spatk: 110, range: 140, spd: 1.6, critChance: 0.2, critMultiplier: 2.0, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'sludge_bomb' }, { level: 15, moveId: 'thunder' }],
            tmList: ['thunder', 'fire_blast', 'hydro_pump'],
            possibleAbilities: ['levitate', 'merciless'],
            evolution: null, placementTags: ['land'], tags: ['ghost', 'poison']
        },

        // --- GEODUDE LINE (Physical Splash Defenders) ---
        'geodude': {
            id: 'geodude', name: 'Geodude', buyable: true, cost: 120, iconPath: 'pokemon/icon/074.png', walkingSprite: 'pokemon/walking/074.png', placeholderColor: '#a8a29e',
            baseStats: { atk: 25, spatk: 10, range: 90, spd: 0.7, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'rock_throw' }],
            tmList: ['earthquake', 'fire_blast'],
            possibleAbilities: ['sturdy', 'sand_veil'],
            evolution: { targetLevel: 25, nextTowerId: 'graveler' }, placementTags: ['land', 'mountain'], tags: ['rock', 'ground']
        },
        'graveler': {
            id: 'graveler', name: 'Graveler', cost: 350, iconPath: 'pokemon/icon/075.png', walkingSprite: 'pokemon/walking/075.png', placeholderColor: '#78716c',
            baseStats: { atk: 45, spatk: 15, range: 100, spd: 0.7, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'rock_throw' }, { level: 12, moveId: 'rock_slide' }],
            tmList: ['earthquake', 'fire_blast'],
            possibleAbilities: ['sturdy', 'sand_veil'],
            evolution: { targetLevel: 40, nextTowerId: 'golem' }, placementTags: ['land', 'mountain'], tags: ['rock', 'ground']
        },
        'golem': {
            id: 'golem', name: 'Golem', cost: 1000, iconPath: 'pokemon/icon/076.png', walkingSprite: 'pokemon/walking/076.png', placeholderColor: '#44403c',
            baseStats: { atk: 90, spatk: 20, range: 120, spd: 0.8, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 30 },
            learnset: [{ level: 1, moveId: 'rock_slide' }, { level: 20, moveId: 'earthquake' }],
            tmList: ['earthquake', 'fire_blast'],
            possibleAbilities: ['sturdy', 'sand_veil'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['rock', 'ground']
        },

        // --- GROWLITHE LINE (Fast Fire Physical/Special Mix) ---
        'growlithe': {
            id: 'growlithe', name: 'Growlithe', buyable: true, cost: 180, iconPath: 'pokemon/icon/058.png', walkingSprite: 'pokemon/walking/058.png', placeholderColor: '#fb923c',
            baseStats: { atk: 25, spatk: 20, range: 100, spd: 1.2, critChance: 0.075, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'scratch' }, { level: 6, moveId: 'ember' }],
            tmList: ['flamethrower', 'fire_blast'],
            possibleAbilities: ['intimidate', 'flame_body'],
            evolution: { targetLevel: 30, nextTowerId: 'arcanine' }, placementTags: ['land', 'mountain'], tags: ['fire']
        },
        'arcanine': {
            id: 'arcanine', name: 'Arcanine', cost: 1300, iconPath: 'pokemon/icon/059.png', walkingSprite: 'pokemon/walking/059.png', placeholderColor: '#ea580c',
            baseStats: { atk: 95, spatk: 85, range: 130, spd: 1.4, critChance: 0.15, critMultiplier: 1.5, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'flamethrower' }, { level: 20, moveId: 'fire_blast' }],
            tmList: ['solar_beam', 'thunderbolt'],
            possibleAbilities: ['intimidate', 'flame_body'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['fire']
        },

        // --- MACHOP LINE (Pure Physical Powerhouse) ---
        'machop': {
            id: 'machop', name: 'Machop', buyable: true, cost: 150, iconPath: 'pokemon/icon/066.png', walkingSprite: 'pokemon/walking/066.png', placeholderColor: '#94a3b8',
            baseStats: { atk: 35, spatk: 10, range: 90, spd: 0.8, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 5, moveId: 'scratch' }],
            tmList: ['fire_blast', 'earthquake'], 
            possibleAbilities: ['guts', 'no_guard'],
            evolution: { targetLevel: 28, nextTowerId: 'machoke' }, placementTags: ['land', 'mountain'], tags: ['fighting']
        },
        'machoke': {
            id: 'machoke', name: 'Machoke', cost: 350, iconPath: 'pokemon/icon/067.png', walkingSprite: 'pokemon/walking/067.png', placeholderColor: '#94a3b8',
            baseStats: { atk: 50, spatk: 20, range: 90, spd: 0.9, critChance: 0.15, critMultiplier: 2.0, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 5, moveId: 'scratch' }],
            tmList: ['fire_blast', 'earthquake'], 
            possibleAbilities: ['guts', 'no_guard'],
            evolution: { targetLevel: 45, nextTowerId: 'machamp' }, placementTags: ['land', 'mountain'], tags: ['fighting']
        },
        'machamp': {
            id: 'machamp', name: 'Machamp', cost: 1150, iconPath: 'pokemon/icon/068.png', walkingSprite: 'pokemon/walking/068.png', placeholderColor: '#475569',
            baseStats: { atk: 85, spatk: 30, range: 110, spd: 1.0, critChance: 0.25, critMultiplier: 2.5, armorPenetration: 25 },
            learnset: [{ level: 1, moveId: 'razor_leaf' }, { level: 15, moveId: 'earthquake' }],
            tmList: ['fire_blast', 'hydro_pump'],
            possibleAbilities: ['guts', 'no_guard'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['fighting']
        },

        // --- MAGNEMITE LINE (Anti-Armor Utility) ---
        'magnemite': {
            id: 'magnemite', name: 'Magnemite', buyable: true, cost: 220, iconPath: 'pokemon/icon/081.png', walkingSprite: 'pokemon/walking/081.png', placeholderColor: '#cbd5e1',
            baseStats: { atk: 15, spatk: 25, range: 110, spd: 1.0, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'thunder_shock' }],
            tmList: ['thunderbolt', 'thunder'],
            possibleAbilities: ['sturdy', 'lightning_rod'],
            evolution: { targetLevel: 30, nextTowerId: 'magneton' }, placementTags: ['land', 'mountain'], tags: ['electric', 'steel']
        },
        'magneton': {
            id: 'magneton', name: 'Magneton', cost: 850, iconPath: 'pokemon/icon/082.png', walkingSprite: 'pokemon/walking/082.png', placeholderColor: '#94a3b8',
            baseStats: { atk: 30, spatk: 75, range: 130, spd: 1.2, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'thunder_shock' }, { level: 5, moveId: 'thunderbolt' }],
            tmList: ['thunder', 'sludge_bomb'],
            possibleAbilities: ['sturdy', 'lightning_rod'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['electric', 'steel']
        },

        // --- ENDGAME INDIVIDUALS ---
        'lapras': {
            id: 'lapras', name: 'Lapras', buyable: true, cost: 600, iconPath: 'pokemon/icon/131.png', walkingSprite: 'pokemon/walking/131.png', placeholderColor: '#38bdf8',
            baseStats: { atk: 60, spatk: 85, range: 140, spd: 0.9, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'water_pulse' }, { level: 15, moveId: 'ice_beam' }, { level: 30, moveId: 'hydro_pump' }],
            tmList: ['surf', 'thunderbolt'],
            possibleAbilities: ['thick_fat', 'rain_dish'],
            evolution: null, placementTags: ['water'], tags: ['water', 'ice']
        },
        'snorlax': {
            id: 'snorlax', name: 'Snorlax', buyable: true, cost: 1200, iconPath: 'pokemon/icon/143.png', walkingSprite: 'pokemon/walking/143.png', placeholderColor: '#0f766e',
            baseStats: { atk: 110, spatk: 65, range: 150, spd: 0.6, critChance: 0.15, critMultiplier: 2.5, armorPenetration: 20 },
            learnset: [{ level: 1, moveId: 'body_slam' }, { level: 25, moveId: 'hyper_beam' }],
            tmList: ['earthquake', 'fire_blast', 'surf', 'thunder'],
            possibleAbilities: ['thick_fat', 'immunity'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['normal']
        }
    },

    // Enemies Config
    enemies: {
        'caterpie': {
            id: 'caterpie', name: 'Caterpie', iconPath: 'pokemon/icon/010.png', walkingSprite: 'pokemon/walking/010.png', placeholderColor: '#4ade80',
            hp: 30, spd: 65, def: 1, spDef: 1, immunities: [], possibleAbilities: ['shield_dust'], abilityChance: 0.1, bounty: 3
        },
        'weedle': {
            id: 'weedle', name: 'Weedle', iconPath: 'pokemon/icon/013.png', walkingSprite: 'pokemon/walking/013.png', placeholderColor: '#facc15',
            hp: 35, spd: 65, def: 1, spDef: 1, immunities: [], possibleAbilities: ['shield_dust'], abilityChance: 0.1, bounty: 3
        },
        'rattata': {
            id: 'rattata', name: 'Rattata', iconPath: 'pokemon/icon/019.png', walkingSprite: 'pokemon/walking/019.png', placeholderColor: '#94a3b8',
            hp: 50, spd: 80, def: 2, spDef: 2, immunities: [], possibleAbilities: ['technician', 'guts'], abilityChance: 0.2, bounty: 5
        },
        'pidgey': {
            id: 'pidgey', name: 'Pidgey', iconPath: 'pokemon/icon/016.png', walkingSprite: 'pokemon/walking/016.png', placeholderColor: '#d6d3d1',
            hp: 40, spd: 85, def: 2, spDef: 2, immunities: [], possibleAbilities: ['guts', 'speed_boost', 'levitate'], abilityChance: 0.3, bounty: 6
        },
        'ekans': {
            id: 'ekans', name: 'Ekans', iconPath: 'pokemon/icon/023.png', walkingSprite: 'pokemon/walking/023.png', placeholderColor: '#a855f7',
            hp: 70, spd: 75, def: 5, spDef: 5, immunities: ['poison'], possibleAbilities: [], abilityChance: 0.2, bounty: 7
        },
        'geodude': {
            id: 'geodude', name: 'Geodude', iconPath: 'pokemon/icon/074.png', walkingSprite: 'pokemon/walking/074.png', placeholderColor: '#78716c',
            hp: 150, spd: 35, def: 35, spDef: 5, immunities: ['paralyze'], possibleAbilities: ['iron_barbs', 'sturdy'], abilityChance: 0.4, bounty: 12
        },
        'gastly': {
            id: 'gastly', name: 'Gastly', iconPath: 'pokemon/icon/092.png', walkingSprite: 'pokemon/walking/092.png', placeholderColor: '#c084fc',
            hp: 70, spd: 70, def: 2, spDef: 25, immunities: ['paralyze'], possibleAbilities: ['magic_guard', 'levitate'], abilityChance: 0.5, bounty: 8
        },
        'koffing': {
            id: 'koffing', name: 'Koffing', iconPath: 'pokemon/icon/109.png', walkingSprite: 'pokemon/walking/109.png', placeholderColor: '#8b5cf6',
            hp: 120, spd: 55, def: 40, spDef: 15, immunities: ['poison'], possibleAbilities: ['levitate'], abilityChance: 1.0, bounty: 15
        },
        'raticate': {
            id: 'raticate', name: 'Raticate', iconPath: 'pokemon/icon/020.png', walkingSprite: 'pokemon/walking/020.png', placeholderColor: '#92400e',
            hp: 200, spd: 95, def: 20, spDef: 20, bounty: 25, possibleAbilities: ['guts'], abilityChance: 0.5
        },
        'pidgeotto': {
            id: 'pidgeotto', name: 'Pidgeotto', iconPath: 'pokemon/icon/017.png', walkingSprite: 'pokemon/walking/017.png', placeholderColor: '#d6d3d1',
            hp: 220, spd: 105, def: 35, spDef: 30, bounty: 30, possibleAbilities: ['speed_boost', 'levitate'], abilityChance: 0.4
        },
        'graveler': {
            id: 'graveler', name: 'Graveler', iconPath: 'pokemon/icon/075.png', walkingSprite: 'pokemon/walking/075.png', placeholderColor: '#57534e',
            hp: 450, spd: 30, def: 80, spDef: 15, bounty: 45, possibleAbilities: ['sturdy', 'iron_barbs'], abilityChance: 1.0
        },
        'slowpoke': {
            id: 'slowpoke', name: 'Slowpoke', iconPath: 'pokemon/icon/079.png', walkingSprite: 'pokemon/walking/079.png', placeholderColor: '#f472b6',
            hp: 350, spd: 25, def: 25, spDef: 25, bounty: 35, possibleAbilities: ['regenerator', 'unaware'], abilityChance: 0.8
        },
        'zubat': {
            id: 'zubat', name: 'Zubat', iconPath: 'pokemon/icon/041.png', walkingSprite: 'pokemon/walking/041.png', placeholderColor: '#a855f7',
            hp: 95, spd: 110, def: 10, spDef: 15, bounty: 20, possibleAbilities: ['levitate'], abilityChance: 1.0
        },
        'abra': {
            id: 'abra', name: 'Abra', iconPath: 'pokemon/icon/063.png', walkingSprite: 'pokemon/walking/063.png', placeholderColor: '#fde047',
            hp: 60, spd: 115, def: 5, spDef: 50, bounty: 40, possibleAbilities: ['emergency_exit'], abilityChance: 1.0
        },
        'voltorb': {
            id: 'voltorb', name: 'Voltorb', iconPath: 'pokemon/icon/100.png', walkingSprite: 'pokemon/walking/100.png', placeholderColor: '#ef4444',
            hp: 100, spd: 150, def: 25, spDef: 25, bounty: 30, possibleAbilities: ['aftermath', 'speed_boost'], abilityChance: 0.8
        },
        'chansey': {
            id: 'chansey', name: 'Chansey', iconPath: 'pokemon/icon/113.png', walkingSprite: 'pokemon/walking/113.png', placeholderColor: '#fbcfe8',
            hp: 1200, spd: 45, def: 1, spDef: 300, bounty: 150, possibleAbilities: ['regenerator'], abilityChance: 1.0
        },
        'onix': {
            id: 'onix', name: 'Onix', iconPath: 'pokemon/icon/095.png', walkingSprite: 'pokemon/walking/095.png', placeholderColor: '#78716c',
            hp: 750, spd: 40, def: 150, spDef: 10, bounty: 85, possibleAbilities: ['sturdy'], abilityChance: 1.0
        },
        'sandshrew': {
            id: 'sandshrew', name: 'Sandshrew', iconPath: 'pokemon/icon/027.png', walkingSprite: 'pokemon/walking/027.png', placeholderColor: '#d97706',
            hp: 160, spd: 60, def: 55, spDef: 15, bounty: 25, possibleAbilities: ['sand_hide'], abilityChance: 1.0
        },
        'kingler': {
            id: 'kingler', name: 'Kingler', iconPath: 'pokemon/icon/099.png', walkingSprite: 'pokemon/walking/099.png', placeholderColor: '#dc2626',
            hp: 400, spd: 55, def: 100, spDef: 15, bounty: 75, possibleAbilities: [], abilityChance: 0.5
        },
        'magikarp': {
            id: 'magikarp', name: 'Magikarp', iconPath: 'pokemon/icon/129.png', walkingSprite: 'pokemon/walking/129.png', placeholderColor: '#f87171',
            hp: 1, spd: 15, def: 0, spDef: 0, bounty: 100, possibleAbilities: [], abilityChance: 0.1
        },
        'meowth': {
            id: 'meowth', name: 'Meowth', iconPath: 'pokemon/icon/052.png', walkingSprite: 'pokemon/walking/052.png', placeholderColor: '#fef3c7',
            hp: 80, spd: 100, def: 15, spDef: 15, bounty: 15, possibleAbilities: ['pay_day'], abilityChance: 1.0
        },
        'beedrill': {
            id: 'beedrill', name: 'Beedrill', iconPath: 'pokemon/icon/015.png', walkingSprite: 'pokemon/walking/015.png', placeholderColor: '#fef3c7',
            hp: 250, spd: 120, def: 15, spDef: 40, bounty: 65, possibleAbilities: ['speed_boost'], abilityChance: 0.6
        },
        'gyarados': {
            id: 'gyarados', name: 'Gyarados', iconPath: 'pokemon/icon/130.png', walkingSprite: 'pokemon/walking/130.png', placeholderColor: '#0284c7',
            hp: 2000, spd: 65, def: 50, spDef: 50, bounty: 300, possibleAbilities: [], abilityChance: 1.0
        },
        'snorlax': {
            id: 'snorlax', name: 'Snorlax', iconPath: 'pokemon/icon/143.png', walkingSprite: 'pokemon/walking/143.png', placeholderColor: '#0f766e',
            hp: 4000, spd: 20, def: 60, spDef: 80, bounty: 400, possibleAbilities: ['thick_fat'], abilityChance: 1.0
        },
        'dragonite': {
            id: 'dragonite', name: 'Dragonite', iconPath: 'pokemon/icon/149.png', walkingSprite: 'pokemon/walking/149.png', placeholderColor: '#ea580c',
            hp: 8000, spd: 60, def: 100, spDef: 100, bounty: 1000, possibleAbilities: ['inner_focus', 'levitate'], abilityChance: 1.0
        }
    },

    items: {
        'quick_claw': { id: 'quick_claw', name: 'Quick Claw', type: 'equip', cost: 150, description: 'Increases Attack Speed by 40%.', stats: { attackSpeedMultiplier: 1.4 } },
        'scope_lens': { id: 'scope_lens', name: 'Scope Lens', type: 'equip', cost: 200, description: 'Adds +15% Crit Chance and +0.5x Crit Damage.', stats: { critChanceBonus: 0.15, critMultiplierBonus: 0.5 } },
        'macho_brace': { id: 'macho_brace', name: 'Macho Brace', type: 'equip', cost: 250, description: 'Increases Damage 2x but halves Attack Speed.', stats: { damageMultiplier: 2.0, attackSpeedMultiplier: 0.5 } },
        'tm_solar_beam': { id: 'tm_solar_beam', name: 'TM: Solar Beam', type: 'tm', moveId: 'solar_beam', cost: 500, description: 'Teaches Solar Beam.' },
        'tm_fire_blast': { id: 'tm_fire_blast', name: 'TM: Fire Blast', type: 'tm', moveId: 'fire_blast', cost: 500, description: 'Teaches Fire Blast.' },
        'tm_surf': { id: 'tm_surf', name: 'TM: Surf', type: 'tm', moveId: 'surf', cost: 500, description: 'Teaches Surf.' },
        'tm_thunder': { id: 'tm_thunder', name: 'TM: Thunder', type: 'tm', moveId: 'thunder', cost: 500, description: 'Teaches Thunder.' },
        'tm_earthquake': { id: 'tm_earthquake', name: 'TM: Earthquake', type: 'tm', moveId: 'earthquake', cost: 600, description: 'Teaches Earthquake.' },
        'tm_sludge_bomb': { id: 'tm_sludge_bomb', name: 'TM: Sludge Bomb', type: 'tm', moveId: 'sludge_bomb', cost: 400, description: 'Teaches Sludge Bomb.' }
    },

    waves: [
        // Intro
        { id: 1, reward: 10, groups: [{ enemyId: 'caterpie', count: 5, interval: 1.3, abilityChance: 0.0 }] },
        { id: 2, reward: 15, groups: [{ enemyId: 'weedle', count: 6, interval: 1.0, abilityChance: 0.0 }, { enemyId: 'caterpie', count: 4, interval: 1.5, abilityChance: 0.0 }] },
        { id: 3, reward: 25, groups: [{ enemyId: 'rattata', count: 8, interval: 0.8, abilityChance: 0.0 }] },
        { id: 4, reward: 40, groups: [{ enemyId: 'pidgey', count: 12, interval: 0.7, abilityChance: 0.2 }] },
        { id: 5, reward: 65, groups: [
            { enemyId: 'rattata', count: 10, interval: 0.5, abilityChance: 0.3 },
            { enemyId: 'ekans', count: 3, interval: 1.0, abilityChance: 0.2 }
        ]},
        // Early Ramp
        { id: 6, reward: 90, groups: [
            { enemyId: 'pidgey', count: 12, interval: 0.5, abilityChance: 0.3 },
            { enemyId: 'gastly', count: 4, interval: 1.0, abilityChance: 0.2 }
        ]},
        { id: 7, reward: 120, groups: [
            { enemyId: 'rattata', count: 10, interval: 0.4, abilityChance: 0.5 },
            { enemyId: 'gastly', count: 5, interval: 1.25, abilityChance: 0.2 },
            { enemyId: 'pidgey', count: 10, interval: 0.4, abilityChance: 0.5 }
        ]},
        { id: 8, reward: 140, groups: [
            { enemyId: 'geodude', count: 5, interval: 1.5, abilityChance: 0.1 },
            { enemyId: 'rattata', count: 15, interval: 0.4, abilityChance: 0.2 }
        ]},
        { id: 9, reward: 140, groups: [
            { enemyId: 'ekans', count: 10, interval: 0.75, abilityChance: 0.2 },
            { enemyId: 'geodude', count: 3, interval: 1.0, abilityChance: 0.3 },
            { enemyId: 'zubat', count: 8, interval: 0.8, abilityChance: 0.5 },
            { enemyId: 'geodude', count: 6, interval: 1.25, abilityChance: 0.3 }
        ]},
        { id: 10, reward: 200, groups: [ // Mini-boss 1
            { enemyId: 'raticate', count: 2, interval: 3.0, abilityChance: 1.0 },
            { enemyId: 'pidgeotto', count: 3, interval: 2.0, abilityChance: 0.5 }
        ]},
        // Mid-game Intro
        { id: 11, reward: 160, groups: [
            { enemyId: 'pidgey', count: 20, interval: 0.4, abilityChance: 0.2 },
            { enemyId: 'gastly', count: 10, interval: 0.8, abilityChance: 0.4 },
            { enemyId: 'geodude', count: 5, interval: 1.0, abilityChance: 0.8 }
        ]},
        { id: 12, reward: 160, groups: [
            { enemyId: 'sandshrew', count: 12, interval: 1.0, abilityChance: 0.5 },
            { enemyId: 'koffing', count: 4, interval: 2.0, abilityChance: 1.0 }
        ]},
        { id: 13, reward: 180, groups: [
            { enemyId: 'slowpoke', count: 5, interval: 2.5, abilityChance: 0.5 },
            { enemyId: 'zubat', count: 15, interval: 0.5, abilityChance: 0.5 }
        ]},
        { id: 14, reward: 180, groups: [
            { enemyId: 'pidgeotto', count: 8, interval: 1.5, abilityChance: 0.5 },
            { enemyId: 'voltorb', count: 5, interval: 0.8, abilityChance: 0.8 },
            { enemyId: 'abra', count: 2, interval: 3.0, abilityChance: 1.0 }
        ]},
        { id: 15, reward: 250, groups: [ // Def/SpDef Check
            { enemyId: 'chansey', count: 1, interval: 5.0, abilityChance: 1.0 },
            { enemyId: 'onix', count: 2, interval: 4.0, abilityChance: 1.0 }
        ]},
        // Mid-game Advanced
        { id: 16, reward: 200, groups: [
            { enemyId: 'meowth', count: 25, interval: 0.3, abilityChance: 0.5 },
            { enemyId: 'gastly', count: 10, interval: 0.8, abilityChance: 0.5 }
        ]},
        { id: 17, reward: 220, groups: [
            { enemyId: 'graveler', count: 6, interval: 1.5, abilityChance: 0.8 },
            { enemyId: 'beedrill', count: 5, interval: 1.0, abilityChance: 0.6 }
        ]},
        { id: 18, reward: 220, groups: [
            { enemyId: 'kingler', count: 6, interval: 1.8, abilityChance: 0.5 },
            { enemyId: 'slowpoke', count: 8, interval: 2.0, abilityChance: 0.8 }
        ]},
        { id: 19, reward: 250, groups: [
            { enemyId: 'koffing', count: 10, interval: 1.2, abilityChance: 1.0 },
            { enemyId: 'voltorb', count: 10, interval: 0.8, abilityChance: 0.8 },
            { enemyId: 'magikarp', count: 1, interval: 1.0, abilityChance: 1.0 }
        ]},
        { id: 20, reward: 400, groups: [ // Boss 1
            { enemyId: 'gyarados', count: 1, interval: 5.0, abilityChance: 1.0 },
            { enemyId: 'zubat', count: 10, interval: 0.5, abilityChance: 1.0 }
        ]},
        // Late Game
        { id: 21, reward: 280, groups: [
            { enemyId: 'pidgeotto', count: 15, interval: 0.8, abilityChance: 0.6 },
            { enemyId: 'raticate', count: 10, interval: 1.0, abilityChance: 0.6 }
        ]},
        { id: 22, reward: 300, groups: [
            { enemyId: 'onix', count: 5, interval: 2.0, abilityChance: 1.0 },
            { enemyId: 'graveler', count: 10, interval: 1.0, abilityChance: 0.8 }
        ]},
        { id: 23, reward: 320, groups: [
            { enemyId: 'chansey', count: 3, interval: 3.0, abilityChance: 1.0 },
            { enemyId: 'abra', count: 6, interval: 2.0, abilityChance: 1.0 }
        ]},
        { id: 24, reward: 350, groups: [
            { enemyId: 'beedrill', count: 15, interval: 0.6, abilityChance: 0.8 },
            { enemyId: 'kingler', count: 10, interval: 1.2, abilityChance: 0.5 }
        ]},
        { id: 25, reward: 500, groups: [ // Boss 2
            { enemyId: 'snorlax', count: 1, interval: 5.0, abilityChance: 1.0 },
            { enemyId: 'meowth', count: 15, interval: 0.3, abilityChance: 1.0 }
        ]},
        // Endgame
        { id: 26, reward: 400, groups: [
            { enemyId: 'gyarados', count: 2, interval: 4.0, abilityChance: 1.0 },
            { enemyId: 'voltorb', count: 15, interval: 0.5, abilityChance: 1.0 }
        ]},
        { id: 27, reward: 450, groups: [
            { enemyId: 'chansey', count: 5, interval: 2.5, abilityChance: 1.0 },
            { enemyId: 'onix', count: 5, interval: 2.5, abilityChance: 1.0 }
        ]},
        { id: 28, reward: 500, groups: [
            { enemyId: 'snorlax', count: 2, interval: 4.0, abilityChance: 1.0 },
            { enemyId: 'koffing', count: 15, interval: 0.8, abilityChance: 1.0 }
        ]},
        { id: 29, reward: 600, groups: [
            { enemyId: 'pidgeotto', count: 30, interval: 0.4, abilityChance: 0.8 },
            { enemyId: 'beedrill', count: 20, interval: 0.5, abilityChance: 0.8 },
            { enemyId: 'abra', count: 5, interval: 1.5, abilityChance: 1.0 }
        ]},
        { id: 30, reward: 1000, groups: [ // Final Boss
            { enemyId: 'dragonite', count: 1, interval: 10.0, abilityChance: 1.0 },
            { enemyId: 'gyarados', count: 1, interval: 3.0, abilityChance: 1.0 },
            { enemyId: 'snorlax', count: 1, interval: 3.0, abilityChance: 1.0 }
        ]}
    ],

    mapConfig: [
        { "x": 401, "y": 3 },
        { "x": 401, "y": 69 },
        { "x": 136, "y": 73 },
        { "x": 138, "y": 205 },
        { "x": 667, "y": 212 },
        { "x": 667, "y": 366 },
        { "x": 137, "y": 376 },
        { "x": 135, "y": 537 },
        { "x": 802, "y": 532 }
    ],

    // Grid terrain data (sparse map of [x][y] = tag)
    // Keys are "col,row" strings for efficiency
    terrainMap: {
  "no_placement": [
    [0,0,24,4],
    [26,0,24,7],
    [0,4,8,1],
    [0,5,2,7],
    [7,5,1,9],
    [9,5,17,1],
    [9,6,8,1],
    [20,6,6,1],
    [9,7,6,2],
    [22,7,3,2],
    [28,7,22,1],
    [34,8,16,1],
    [9,9,4,3],
    [20,9,3,3],
    [41,9,9,3],
    [13,10,7,2],
    [23,10,2,2],
    [30,10,5,2],
    [37,10,4,2],
    [42,12,8,3],
    [8,13,33,2],
    [8,15,11,1],
    [38,15,3,8],
    [42,15,2,15],
    [8,16,4,2],
    [7,18,4,5],
    [48,18,2,15],
    [44,19,4,11],
    [26,20,6,3],
    [0,22,2,6],
    [11,22,15,1],
    [32,22,6,1],
    [7,23,1,15],
    [9,24,33,2],
    [9,26,6,7],
    [16,26,3,2],
    [40,26,2,7],
    [0,28,1,10],
    [38,29,2,4],
    [15,30,2,3],
    [20,30,18,3],
    [45,30,3,3],
    [1,32,1,6],
    [17,32,3,1],
    [42,32,3,1],
    [5,33,2,5],
    [2,34,1,4],
    [4,34,1,4],
    [8,34,42,4],
    [3,35,1,3]
  ],
  "path": [
    [24,0,2,5],
    [8,4,16,1],
    [8,5,1,8],
    [9,12,33,1],
    [41,13,1,11],
    [8,23,33,1],
    [8,24,1,10],
    [9,33,41,1]
  ],
  "grass": [
    [2,5,5,28],
    [0,12,2,10],
    [7,14,1,4],
    [1,28,1,4],
    [2,33,3,1],
    [3,34,1,1]
  ],
  "land": [
    [17,6,3,4],
    [15,7,2,3],
    [20,7,2,2],
    [25,7,3,5],
    [28,8,1,4],
    [13,9,2,1],
    [23,9,2,1],
    [29,9,12,1],
    [29,10,1,2],
    [35,10,2,2],
    [15,26,1,4],
    [19,26,21,3],
    [16,28,3,2],
    [19,29,19,1],
    [17,30,3,2],
    [42,30,3,2]
  ],
  "water": [
    [19,15,16,5],
    [12,16,7,6],
    [35,16,3,6],
    [11,18,1,4],
    [19,20,7,2],
    [32,20,3,2]
  ],
  "mountain": [
    [44,15,6,3],
    [44,18,4,1]
  ]
},
};