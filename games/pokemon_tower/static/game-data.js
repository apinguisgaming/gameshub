

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
        gridSize: 4, 
        mapImage: 'maps/1-1.png',
        terrainMaskImage: 'maps/1-1_mask.png', 
        terrainColors: {
            'no_placement': [255, 0, 0],       
            'grass': [38, 127, 0],
            'water': [0, 38, 255],                    
            'mountain': [128, 128, 128],      
            'path': [255, 178, 127],           
            'land': [76, 255, 0],                 
        },
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
        paralyze: { id: 'paralyze', name: 'Paralyze', duration: 2.5, tickRate: 0, damagePerTick: 0, speedModifier: 0.25, stunned: false, color: '#facc15' },
        freeze: { id: 'freeze', name: 'Freeze', duration: 2.0, tickRate: 0, damagePerTick: 0, speedModifier: 0, stunned: true, color: '#38bdf8' },
        poison: { id: 'poison', name: 'Poison', duration: 4.0, tickRate: 1.0, damagePerTick: 5, speedModifier: 1.0, stunned: false, color: '#a855f7' }
    },

    // Split Abilities System
    towerAbilities: {
        // --- STARTER/LOW HP BOOSTS ---
        'overgrow': { 
            id: 'overgrow', name: 'Overgrow', description: 'Boosts damage by 80% when player lives are below 50%.', 
            effects: [{ trigger: 'passive', condition: { type: 'lives_below', ratio: 0.5 }, action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 1.8 }] 
        },
        'blaze': { 
            id: 'blaze', name: 'Blaze', description: 'Boosts Fire damage by 80% when player lives are below 50%.', 
            effects: [{ trigger: 'passive', condition: { type: 'lives_below', ratio: 0.5 }, action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 1.8 }] 
        },
        'torrent': { 
            id: 'torrent', name: 'Torrent', description: 'Boosts Water damage by 80% when player lives are below 50%.', 
            effects: [{ trigger: 'passive', condition: { type: 'lives_below', ratio: 0.5 }, action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 1.8 }] 
        },
        'swarm': { 
            id: 'swarm', name: 'Swarm', description: 'Boosts Attack Speed by 80% when player lives are below 50%.', 
            effects: [{ trigger: 'passive', condition: { type: 'lives_below', ratio: 0.5 }, action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 1.8 }] 
        },

        // --- TOWER AURAS & PASSIVES ---
        'intimidate': { 
            id: 'intimidate', name: 'Intimidate', description: 'Aura: Slows enemies within range by 25%.', 
            effects: [{ trigger: 'aura', target: 'enemy', action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 0.75 }] 
        },
        'battery': { 
            id: 'battery', name: 'Battery', description: 'Aura: Boosts Attack Speed of adjacent Towers by 15%.', 
            effects: [{ trigger: 'aura', target: 'tower', action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 1.15 }] 
        },
        'friend_guard': { 
            id: 'friend_guard', name: 'Friend Guard', description: 'Allies in range take 50% less recoil stun.', 
            effects: [{ trigger: 'aura', target: 'tower', action: 'modify_stat', stat: 'stunDurationMultiplier', operation: 'multiply', value: 0.5 }] 
        },
        'pickup': { 
            id: 'pickup', name: 'Pickup', description: '25% chance to generate $3 extra when defeating an enemy.', 
            effects: [{ trigger: 'on_kill', action: 'modify_money', operation: 'add', value: 3, chance: 0.25 }] 
        },
        'super_luck': { 
            id: 'super_luck', name: 'Super Luck', description: 'Flat +15% to Critical Hit chance.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'critChance', operation: 'add', value: 0.15 }] 
        },
        'sniper': { 
            id: 'sniper', name: 'Sniper', description: 'Increases Critical Hit damage multiplier by +1.0.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'critMultiplier', operation: 'add', value: 1.0 }] 
        },
        'compound_eyes': { 
            id: 'compound_eyes', name: 'Compound Eyes', description: 'Increases attack range by 25%.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'range', operation: 'multiply', value: 1.25 }] 
        },
        'huge_power': { 
            id: 'huge_power', name: 'Huge Power', description: 'Doubles raw damage, but attacks 20% slower.', 
            effects: [
                { trigger: 'passive', action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 2.0 },
                { trigger: 'passive', action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 0.8 }
            ] 
        },
        'technician': { 
            id: 'technician', name: 'Technician', description: 'Boosts damage of low-base-stat moves by 30%.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 1.3 }] 
        },

        // --- TRAITS & IMMUNITIES ---
        'magic_guard': { 
            id: 'magic_guard', name: 'Magic Guard', description: 'Immune to damage-over-time (Burn/Poison).', 
            effects: [{ trigger: 'passive', action: 'ignore_dot' }] 
        },
        'symbiosis': { 
            id: 'symbiosis', name: 'Symbiosis', description: 'Shares 50% of held item bonuses with towers in range.', 
            effects: [{ trigger: 'aura', target: 'tower', action: 'share_item_stats', shareFactor: 0.5 }] 
        },
        'unaware': { 
            id: 'unaware', name: 'Unaware', description: 'Ignores attacking tower stats.', 
            effects: [{ trigger: 'passive', action: 'stat_ignore' }] 
        },
        'mold_breaker': { 
            id: 'mold_breaker', name: 'Mold Breaker', description: 'Attacks ignore enemy defensive abilities.', 
            effects: [{ trigger: 'passive', action: 'ignore_enemy_abilities' }] 
        },
        'no_guard': { 
            id: 'no_guard', name: 'No Guard', description: 'Projectiles are hitscan (instant hit).', 
            effects: [{ trigger: 'passive', action: 'hitscan_projectiles' }] 
        },
        'levitate': { 
            id: 'levitate', name: 'Levitate', description: 'Can be placed on any terrain tile.', 
            effects: [{ trigger: 'passive', action: 'placement_bypass' }] 
        },
        'frisk': { 
            id: 'frisk', name: 'Frisk', description: 'Instantly reveals full stats of enemies that enter range.', 
            effects: [{ trigger: 'aura', target: 'enemy', action: 'reveal_stats' }] 
        },

        // --- ON-HIT EFFECTS ---
        'static': { 
            id: 'static', name: 'Static', description: 'Attacks have a 10% chance to Paralyze.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.10 }] 
        },
        'flame_body': { 
            id: 'flame_body', name: 'Flame Body', description: 'Attacks have a 10% chance to Burn.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'burnChance', operation: 'add', value: 0.10 }] 
        },
        'poison_point': { 
            id: 'poison_point', name: 'Poison Point', description: 'Attacks have a 10% chance to Poison.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'poisonChance', operation: 'add', value: 0.10 }] 
        },

        // --- TERRAIN & GROWTH ---
        'swift_swim': { 
            id: 'swift_swim', name: 'Swift Swim', description: 'Doubles Attack Speed when placed in Water.', 
            effects: [{ trigger: 'passive', condition: { type: 'terrain', value: 'water' }, action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 2.0 }] 
        },
        'chlorophyll': { 
            id: 'chlorophyll', name: 'Chlorophyll', description: 'Doubles Attack Speed when placed in Grass.', 
            effects: [{ trigger: 'passive', condition: { type: 'terrain', value: 'grass' }, action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 2.0 }] 
        },
        'sand_veil': { 
            id: 'sand_veil', name: 'Sand Veil', description: 'Increases Range by 50% when on Mountains.', 
            effects: [{ trigger: 'passive', condition: { type: 'terrain', value: 'mountain' }, action: 'modify_stat', stat: 'range', operation: 'multiply', value: 1.5 }] 
        },
        'adaptability': { 
            id: 'adaptability', name: 'Adaptability', description: 'Increases Damage by 50% when on Land.', 
            effects: [{ trigger: 'passive', condition: { type: 'terrain', value: 'land' }, action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 1.5 }] 
        },
        'rain_dish': { 
            id: 'rain_dish', name: 'Rain Dish', description: 'Boosts Damage by 50% when placed in Water.', 
            effects: [{ trigger: 'passive', condition: { type: 'terrain', value: 'water' }, action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 1.5 }] 
        },
        'moxie': { 
            id: 'moxie', name: 'Moxie', description: 'Gains +1% permanent damage per kill (caps at 50%).', 
            effects: [
                { trigger: 'on_kill', action: 'add_stack', stackId: 'kills' },
                { trigger: 'passive', action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 0.01, stackId: 'kills', maxStacks: 50 }
            ] 
        },

        // --- ECONOMY & TRIGGERED ---
        'honey_gather': { 
            id: 'honey_gather', name: 'Honey Gather', description: 'Generates $5 at the end of every wave.', 
            effects: [{ trigger: 'on_wave_end', action: 'modify_money', operation: 'add', value: 5 }] 
        },
        'solar_power': { 
            id: 'solar_power', name: 'Solar Power', description: 'Boosts Damage by 50%, but generates 20% less money.', 
            effects: [
                { trigger: 'passive', action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 1.5 },
                { trigger: 'passive', action: 'modify_stat', stat: 'bountyMultiplier', operation: 'multiply', value: 0.8 }
            ] 
        },
        'skill_link': { 
            id: 'skill_link', name: 'Skill Link', description: '25% chance to fire a second free projectile.', 
            effects: [{ trigger: 'on_attack', action: 'extra_hit', chance: 0.25 }] 
        },
        'merciless': { 
            id: 'merciless', name: 'Merciless', description: 'Guaranteed Critical Hits against Poisoned enemies.', 
            effects: [{ trigger: 'passive', condition: { type: 'target_poisoned' }, action: 'guaranteed_crit' }] 
        },
        'serene_grace': { 
            id: 'serene_grace', name: 'Serene Grace', description: 'Doubles the chance of applying on-hit status effects.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'statusChanceMultiplier', operation: 'multiply', value: 2.0 }] 
        }
    },

    enemyAbilities: {
        // --- SURVIVAL & DEFENSE ---
        'sturdy': { 
            id: 'sturdy', name: 'Sturdy', description: 'Cannot be defeated in one hit from full health.', 
            effects: [{ trigger: 'pre_damage', condition: { type: 'hp_equals_max' }, action: 'prevent_lethal', setHp: 1 }] 
        },
        'thick_fat': { 
            id: 'thick_fat', name: 'Thick Fat', description: 'Reduces damage from Fire and Ice attacks by 50%.', 
            effects: [{ trigger: 'pre_damage', condition: { type: 'incoming_attack_tag', tags: ['fire', 'ice'] }, action: 'modify_incoming_damage', operation: 'multiply', value: 0.5 }] 
        },
        'pack_hunter': { 
            id: 'pack_hunter', name: 'Pack Hunter', description: 'Takes 10% less damage per nearby ally.', 
            effects: [{ trigger: 'pre_damage', action: 'modify_incoming_damage', operation: 'multiply', value: -0.1, perAlly: true, radius: 50 }] 
        },
        'illusion': { 
            id: 'illusion', name: 'Illusion', description: 'Takes only 1 damage from the first 3 hits.', 
            effects: [{ trigger: 'pre_damage', action: 'hit_shield', stackId: 'illusion_shield', value: 3 }] 
        },
        'iron_barbs': { 
            id: 'iron_barbs', name: 'Iron Barbs', description: 'Stuns the attacking Tower for 0.5s on every hit.', 
            effects: [{ trigger: 'on_hit_received', action: 'recoil_stun', duration: 0.5 }] 
        },
        'aftermath': { 
            id: 'aftermath', name: 'Aftermath', description: 'Stuns the killer for 1.2 seconds.', 
            effects: [{ trigger: 'on_death', action: 'recoil_stun', duration: 1.2 }] 
        },

        // --- STATS & CONDITIONALS ---
        'speed_boost': { 
            id: 'speed_boost', name: 'Speed Boost', description: 'Movement speed increases exponentially every second.', 
            effects: [
                { trigger: 'on_tick', action: 'add_stack', stackId: 'timer' },
                { trigger: 'passive', action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 0.025, stackId: 'timer', maxStacks: 30, stackType: 'exponential' }
            ] 
        },
        'regenerator': { 
            id: 'regenerator', name: 'Regenerator', description: 'Heals 5% HP every 2 seconds.', 
            effects: [{ trigger: 'tick', interval: 2.0, action: 'heal', operation: 'percent_max', value: 0.05 }] 
        },
        'guts': { 
            id: 'guts', name: 'Guts', description: 'Movement speed doubles if afflicted by a status effect.', 
            effects: [{ trigger: 'passive', condition: { type: 'has_status', statuses: ['burn', 'paralyze', 'poison'] }, action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 2.0 }] 
        },
        'sprint': { 
            id: 'sprint', name: 'Sprint', description: 'Speeds up if not hit recently.', 
            effects: [{ trigger: 'passive', condition: { type: 'not_hit_recently', threshold: 1.5 }, action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 2.0 }] 
        },
        'sand_hide': { 
            id: 'sand_hide', name: 'Sand Hide', description: 'Doubles Defense while on Mountain terrain.', 
            effects: [{ trigger: 'passive', condition: { type: 'terrain', value: 'mountain' }, action: 'modify_stat', stat: 'def', operation: 'multiply', value: 2.0 }] 
        },

        // --- IMMUNITIES & TRAITS ---
        'magic_guard': { 
            id: 'magic_guard', name: 'Magic Guard', description: 'Immune to damage-over-time (Burn/Poison).', 
            effects: [{ trigger: 'passive', action: 'ignore_dot' }] 
        },
        'limber': { 
            id: 'limber', name: 'Limber', description: 'Completely immune to Paralyze and Freeze.', 
            effects: [{ trigger: 'passive', action: 'immunity', statuses: ['paralyze', 'freeze'] }] 
        },
        'levitate': { 
            id: 'levitate', name: 'Levitate', description: 'Completely immune to ground-based area attacks.', 
            effects: [{ trigger: 'passive', action: 'ignore_ground' }] 
        },
        'shield_dust': { 
            id: 'shield_dust', name: 'Shield Dust', description: 'Immune to splash damage and secondary status effects.', 
            effects: [{ trigger: 'passive', action: 'ignore_secondary' }] 
        },
        'unaware': { 
            id: 'unaware', name: 'Unaware', description: 'Ignores attacking tower level and items.', 
            effects: [{ trigger: 'passive', action: 'stat_ignore' }] 
        },

        // --- TACTICAL & GLOBAL ---
        'emergency_exit': { 
            id: 'emergency_exit', name: 'Emergency Exit', description: 'Teleports forward when HP drops below 50%.', 
            effects: [{ trigger: 'post_damage', condition: { type: 'hp_below', ratio: 0.5 }, action: 'teleport_forward', distance: 120 }] 
        },
        'shadow_tag': { 
            id: 'shadow_tag', name: 'Shadow Tag', description: 'Nearby towers cannot level up or sell.', 
            effects: [{ trigger: 'passive', action: 'lock_management', radius: 100 }] 
        },
        'shadow_tag_global': { 
            id: 'shadow_tag_global', name: 'Shadow Tag Global', description: 'Cannot manage team while on map.', 
            effects: [{ trigger: 'passive', action: 'lock_management', global: true }] 
        },

        // --- ECONOMY ---
        'corrosion': { 
            id: 'corrosion', name: 'Corrosion', description: 'Drains $0.25 per second while on the map.', 
            effects: [{ trigger: 'tick', interval: 1.0, action: 'modify_money', operation: 'subtract', value: 0.25 }] 
        },
        'pay_day': { 
            id: 'pay_day', name: 'Pay Day', description: 'Grants extra $50 when defeated.', 
            effects: [{ trigger: 'on_death', action: 'modify_money', operation: 'add', value: 50 }] 
        }
    },

    // Central Move Library
    moves: {
        // --- NORMAL ---
        'tackle': { id: 'tackle', name: 'Tackle', category: 'physical', power: 10, projectileSpeed: 400, speedModifier: 1.0, tags: ['normal'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'body_slam': { id: 'body_slam', name: 'Body Slam', category: 'physical', power: 30, projectileSpeed: 400, speedModifier: 0.8, tags: ['normal'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.3 }] },
        'hyper_beam': { id: 'hyper_beam', name: 'Hyper Beam', category: 'special', power: 90, projectileSpeed: 600, speedModifier: 0.3, tags: ['normal'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'scratch': { id: 'scratch', name: 'Scratch', category: 'physical', power: 10, projectileSpeed: 350, speedModifier: 1.0, tags: ['normal'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'fury_swipes': { id: 'fury_swipes', name: 'Fury Swipes', category: 'physical', power: 6, projectileSpeed: 1200, speedModifier: 2.5, tags: ['normal'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'quick_attack': { id: 'quick_attack', name: 'Quick Attack', category: 'physical', power: 12, projectileSpeed: 1500, speedModifier: 2.0, tags: ['normal'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'extreme_speed': { id: 'extreme_speed', name: 'Extreme Speed', category: 'physical', power: 30, projectileSpeed: 2500, speedModifier: 3.5, tags: ['normal'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'swift': { id: 'swift', name: 'Swift', category: 'physical', power: 12, projectileSpeed: 800, speedModifier: 0.9, tags: ['normal'], effects: [{ action: 'splash', radius: 45 }, { trigger: 'on_hit', action: 'damage' }] },

        // --- GRASS ---
        'vine_whip': { id: 'vine_whip', name: 'Vine Whip', category: 'physical', power: 20, projectileSpeed: 450, speedModifier: 1.0, tags: ['grass'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'razor_leaf': { id: 'razor_leaf', name: 'Razor Leaf', category: 'physical', power: 21, projectileSpeed: 350, speedModifier: 0.9, tags: ['grass'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.1 }] },
        'petal_blizzard': { id: 'petal_blizzard', name: 'Petal Blizzard', category: 'physical', power: 25, projectileSpeed: 400, speedModifier: 0.8, tags: ['grass'], effects: [{ action: 'splash', radius: 60 }, { trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.2 }] },
        'solar_beam': { id: 'solar_beam', name: 'Solar Beam', category: 'special', power: 50, projectileSpeed: 500, speedModifier: 0.5, tags: ['grass'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'giga_drain': { id: 'giga_drain', name: 'Giga Drain', category: 'special', power: 28, projectileSpeed: 400, speedModifier: 0.9, tags: ['grass'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'leaf_blade': { id: 'leaf_blade', name: 'Leaf Blade', category: 'physical', power: 35, projectileSpeed: 1000, speedModifier: 1.7, tags: ['grass'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'bullet_seed': { id: 'bullet_seed', name: 'Bullet Seed', category: 'physical', power: 7, projectileSpeed: 1200, speedModifier: 2.2, tags: ['grass'], effects: [{ trigger: 'on_hit', action: 'damage' }] },

        // --- FIRE ---
        'ember': { id: 'ember', name: 'Ember', category: 'special', power: 22, projectileSpeed: 500, speedModifier: 0.9, tags: ['fire'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'burnChance', operation: 'add', value: 0.1 }] },
        'flamethrower': { id: 'flamethrower', name: 'Flamethrower', category: 'special', power: 25, projectileSpeed: 450, speedModifier: 1.0, tags: ['fire'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'burnChance', operation: 'add', value: 0.1 }] },
        'fire_blast': { id: 'fire_blast', name: 'Fire Blast', category: 'special', power: 40, projectileSpeed: 400, speedModifier: 0.6, tags: ['fire'], effects: [{ action: 'splash', radius: 60 }, { trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'burnChance', operation: 'add', value: 0.2 }] },

        // --- WATER ---
        'water_gun': { id: 'water_gun', name: 'Water Gun', category: 'special', power: 18, projectileSpeed: 450, speedModifier: 1.0, tags: ['water'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'water_pulse': { id: 'water_pulse', name: 'Water Pulse', category: 'special', power: 18, projectileSpeed: 350, speedModifier: 0.9, tags: ['water'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'freezeChance', operation: 'add', value: 0.2 }] },
        'hydro_pump': { id: 'hydro_pump', name: 'Hydro Pump', category: 'special', power: 35, projectileSpeed: 450, speedModifier: 0.7, tags: ['water'], effects: [{ action: 'splash', radius: 70 }, { trigger: 'on_hit', action: 'damage' }] },
        'surf': { id: 'surf', name: 'Surf', category: 'special', power: 25, projectileSpeed: 300, speedModifier: 0.8, tags: ['water'], effects: [{ action: 'splash', radius: 80 }, { trigger: 'on_hit', action: 'damage' }] },
        'bubble': { id: 'bubble', name: 'Bubble', category: 'special', power: 10, projectileSpeed: 300, speedModifier: 0.9, tags: ['water'], effects: [{ action: 'splash', radius: 65 }, { trigger: 'on_hit', action: 'damage' }] },
        'aqua_jet': { id: 'aqua_jet', name: 'Aqua Jet', category: 'physical', power: 18, projectileSpeed: 1400, speedModifier: 1.8, tags: ['water'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'water_shuriken': { id: 'water_shuriken', name: 'Water Shuriken', category: 'special', power: 8, projectileSpeed: 1500, speedModifier: 2.5, tags: ['water'], effects: [{ trigger: 'on_hit', action: 'damage' }] },

        // --- ICE ---
        'ice_beam': { id: 'ice_beam', name: 'Ice Beam', category: 'special', power: 25, projectileSpeed: 450, speedModifier: 1.0, tags: ['ice'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'freezeChance', operation: 'add', value: 0.25 }] },
        'blizzard': { id: 'blizzard', name: 'Blizzard', category: 'special', power: 45, projectileSpeed: 400, speedModifier: 0.5, tags: ['ice'], effects: [{ action: 'splash', radius: 65 }, { trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'freezeChance', operation: 'add', value: 0.15 }] },

        // --- ELECTRIC ---
        'thunder_shock': { id: 'thunder_shock', name: 'Thunder Shock', category: 'special', power: 12, projectileSpeed: 500, speedModifier: 0.8, tags: ['electric'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.05 }] },
        'thunderbolt': { id: 'thunderbolt', name: 'Thunderbolt', category: 'special', power: 20, projectileSpeed: 500, speedModifier: 1.0, tags: ['electric'], effects: [{ action: 'chain', count: 3, radius: 100 }, { trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.15 }] },
        'thunder': { id: 'thunder', name: 'Thunder', category: 'special', power: 40, projectileSpeed: 600, speedModifier: 0.6, tags: ['electric'], effects: [{ action: 'chain', count: 5, radius: 120 }, { trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.2 }] },
        'thunder_wave': { id: 'thunder_wave', name: 'Thunder Wave', category: 'special', power: 2, projectileSpeed: 800, speedModifier: 0.8, tags: ['electric'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 1.0 }] },
        'shock_wave': { id: 'shock_wave', name: 'Shock Wave', category: 'special', power: 18, projectileSpeed: 700, speedModifier: 1.0, tags: ['electric'], effects: [{ action: 'chain', count: 3, radius: 100 }, { trigger: 'on_hit', action: 'damage' }] },

        // --- POISON ---
        'poison_sting': { id: 'poison_sting', name: 'Poison Sting', category: 'physical', power: 8, projectileSpeed: 400, speedModifier: 1.2, tags: ['poison'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'poisonChance', operation: 'add', value: 0.2 }] },
        'sludge': { id: 'sludge', name: 'Sludge', category: 'special', power: 15, projectileSpeed: 250, speedModifier: 0.6, tags: ['poison'], effects: [{ action: 'spawn_zone', duration: 5.0, radius: 30, status: 'poison' }] },
        'sludge_bomb': { id: 'sludge_bomb', name: 'Sludge Bomb', category: 'special', power: 25, projectileSpeed: 300, speedModifier: 0.9, tags: ['poison'], effects: [{ action: 'spawn_zone', duration: 6.0, radius: 50, status: 'poison' }] },
        'poison_jab': { id: 'poison_jab', name: 'Poison Jab', category: 'physical', power: 32, projectileSpeed: 600, speedModifier: 1.1, tags: ['poison'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'poisonChance', operation: 'add', value: 0.3 }] },

        // --- ROCK / GROUND ---
        'rock_throw': { id: 'rock_throw', name: 'Rock Throw', category: 'physical', power: 15, projectileSpeed: 350, speedModifier: 0.9, tags: ['rock'], effects: [{ action: 'splash', radius: 40 }, { trigger: 'on_hit', action: 'damage' }] },
        'rock_slide': { id: 'rock_slide', name: 'Rock Slide', category: 'physical', power: 25, projectileSpeed: 350, speedModifier: 0.8, tags: ['rock'], effects: [{ action: 'splash', radius: 60 }, { trigger: 'on_hit', action: 'damage' }] },
        'earthquake': { id: 'earthquake', name: 'Earthquake', category: 'physical', power: 45, projectileSpeed: 600, speedModifier: 0.5, tags: ['ground'], effects: [{ action: 'splash', radius: 100 }, { trigger: 'on_hit', action: 'damage' }] },

        // --- PSYCHIC ---
        'confusion': { id: 'confusion', name: 'Confusion', category: 'special', power: 15, projectileSpeed: 500, speedModifier: 1.0, tags: ['psychic'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'psybeam': { id: 'psybeam', name: 'Psybeam', category: 'special', power: 45, projectileSpeed: 600, speedModifier: 1.0, tags: ['psychic'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'psychic_atk': { id: 'psychic_atk', name: 'Psychic', category: 'special', power: 75, projectileSpeed: 800, speedModifier: 0.8, tags: ['psychic'], effects: [{ action: 'splash', radius: 60 }, { trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.15 }] },

        // --- FLYING ---
        'gust': { id: 'gust', name: 'Gust', category: 'special', power: 17, projectileSpeed: 400, speedModifier: 0.9, tags: ['flying'], effects: [{ action: 'splash', radius: 55 }, { trigger: 'on_hit', action: 'damage' }] },
        'air_slash': { id: 'air_slash', name: 'Air Slash', category: 'special', power: 30, projectileSpeed: 650, speedModifier: 1.1, tags: ['flying'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'dual_wingbeat': { id: 'dual_wingbeat', name: 'Dual Wingbeat', category: 'physical', power: 20, projectileSpeed: 1100, speedModifier: 2.1, tags: ['flying'], effects: [{ trigger: 'on_hit', action: 'damage' }] },

        // --- OTHERS ---
        'fury_cutter': { id: 'fury_cutter', name: 'Fury Cutter', category: 'physical', power: 10, projectileSpeed: 1000, speedModifier: 1.5, tags: ['bug'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'bullet_punch': { id: 'bullet_punch', name: 'Bullet Punch', category: 'physical', power: 30, projectileSpeed: 2000, speedModifier: 1.2, extraRange: 25, tags: ['steel'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'dragon_breath': { id: 'dragon_breath', name: 'Dragon Breath', category: 'special', power: 35, projectileSpeed: 500, speedModifier: 0.9, tags: ['dragon'], effects: [{ trigger: 'on_hit', action: 'damage' }, { trigger: 'passive', action: 'modify_stat', stat: 'paralyzeChance', operation: 'add', value: 0.2 }] },
        'outrage': { id: 'outrage', name: 'Outrage', category: 'physical', power: 100, projectileSpeed: 700, speedModifier: 0.5, tags: ['dragon'], effects: [{ action: 'splash', radius: 80 }, { trigger: 'on_hit', action: 'damage' }] },
        'dragon_pulse': { id: 'dragon_pulse', name: 'Dragon Pulse', category: 'special', power: 45, projectileSpeed: 550, speedModifier: 0.9, tags: ['dragon'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'shadow_ball': { id: 'shadow_ball', name: 'Shadow Ball', category: 'special', power: 35, projectileSpeed: 450, speedModifier: 1.0, tags: ['ghost'], effects: [{ action: 'splash', radius: 50 }, { trigger: 'on_hit', action: 'damage' }] },
        'mach_punch': { id: 'mach_punch', name: 'Mach Punch', category: 'physical', power: 16, projectileSpeed: 1600, speedModifier: 2.2, extraRange: 25, tags: ['fighting'], effects: [{ trigger: 'on_hit', action: 'damage' }] },
        'helping_hand': { 
            id: 'helping_hand', name: 'Helping Hand', category: 'special', attackType: 'aura', power: 0, projectileSpeed: 0, speedModifier: 1.0, tags: ['normal'], 
            effects: [{ trigger: 'aura', target: 'tower', action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 1.3 }] 
        },
        'lift_up': { 
            id: 'lift_up', name: 'Lift Up', description: 'Gains +10% Damage for each other Pokémon within range.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 0.10, perAlly: true }] 
        },
    },

     // Towers (Pokémon) Config
    towers: {
        'bulbasaur': {
            id: 'bulbasaur', name: 'Bulbasaur', cost: 75, iconPath: 'pokemon/icon/001.png', walkingSprite: 'pokemon/walking/001.png', placeholderColor: '#22c55e',
            baseStats: { atk: 49, spatk: 65, range: 125, spd: 1.05, critChance: 0.1, critMultiplier: 1.75, armorPenetration: 1 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 3, moveId: 'vine_whip' }, { level: 8, moveId: 'bullet_seed'}],
            tmList: ['solar_beam', 'sludge_bomb', 'swift', 'giga_drain', 'poison_jab', 'bullet_seed'],
            possibleAbilities: ['overgrow', 'chlorophyll'],
            evolution: { targetLevel: 16, nextTowerId: 'ivysaur' }, placementTags: ['land', 'grass'], tags: ['grass', 'poison']
        },
        'ivysaur': {
            id: 'ivysaur', name: 'Ivysaur', cost: 250, iconPath: 'pokemon/icon/002.png', walkingSprite: 'pokemon/walking/002.png', placeholderColor: '#16a34a',
            baseStats: { atk: 62, spatk: 80, range: 140, spd: 1.3, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'vine_whip' }, { level: 7, moveId: 'razor_leaf' }],
            tmList: ['solar_beam', 'sludge_bomb', 'giga_drain', 'poison_jab'],
            possibleAbilities: ['overgrow', 'chlorophyll'],
            evolution: { targetLevel: 32, nextTowerId: 'venusaur' }, placementTags: ['land', 'grass'], tags: ['grass', 'poison']
        },
        'venusaur': {
            id: 'venusaur', name: 'Venusaur', cost: 950, iconPath: 'pokemon/icon/003.png', walkingSprite: 'pokemon/walking/003.png', placeholderColor: '#15803d',
            baseStats: { atk: 82, spatk: 100, range: 160, spd: 1.1, critChance: 0.15, critMultiplier: 2.0, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'razor_leaf' }, { level: 15, moveId: 'petal_blizzard' }, { level: 40, moveId: 'poison_jab' }, { level: 45, moveId: 'leaf_blade' }],
            tmList: ['solar_beam', 'sludge_bomb', 'giga_drain', 'poison_jab'],
            possibleAbilities: ['overgrow', 'chlorophyll', 'thick_fat'],
            evolution: null, placementTags: ['land', 'grass'], tags: ['grass', 'poison']
        },
        'charmander': {
            id: 'charmander', name: 'Charmander', cost: 100, iconPath: 'pokemon/icon/004.png', walkingSprite: 'pokemon/walking/004.png', placeholderColor: '#f97316',
            baseStats: { atk: 52, spatk: 60, range: 110, spd: 1.1, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'scratch' }, { level: 4, moveId: 'ember' }],
            tmList: ['fire_blast', 'solar_beam', 'swift', 'fury_swipes', ,'fury_cutter'],
            possibleAbilities: ['blaze', 'moxie'],
            evolution: { targetLevel: 16, nextTowerId: 'charmeleon' }, placementTags: ['land', 'mountain'], tags: ['fire']
        },
        'charmeleon': {
            id: 'charmeleon', name: 'Charmeleon', cost: 300, iconPath: 'pokemon/icon/005.png', walkingSprite: 'pokemon/walking/005.png', placeholderColor: '#ea580c',
            baseStats: { atk: 64, spatk: 80, range: 120, spd: 1.2, critChance: 0.15, critMultiplier: 1.8, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'ember' }, { level: 8, moveId: 'flamethrower' }],
            tmList: ['fire_blast', 'solar_beam'],
            possibleAbilities: ['blaze', 'moxie'],
            evolution: { targetLevel: 36, nextTowerId: 'charizard' }, placementTags: ['land', 'mountain'], tags: ['fire']
        },
        'charizard': {
            id: 'charizard', name: 'Charizard', cost: 1100, iconPath: 'pokemon/icon/006.png', walkingSprite: 'pokemon/walking/006.png', placeholderColor: '#b91c1c',
            baseStats: { atk: 84, spatk: 109, range: 150, spd: 1.1, critChance: 0.2, critMultiplier: 2.0, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'flamethrower' }, { level: 12, moveId: 'fire_blast' }],
            tmList: ['fire_blast', 'solar_beam'],
            possibleAbilities: ['blaze', 'moxie', 'solar_power'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['fire', 'flying']
        },
        'squirtle': {
            id: 'squirtle', name: 'Squirtle', cost: 85, iconPath: 'pokemon/icon/007.png', walkingSprite: 'pokemon/walking/007.png', placeholderColor: '#0ea5e9',
            baseStats: { atk: 48, spatk: 50, range: 130, spd: 1.1, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 2 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 4, moveId: 'water_gun' }, { level: 8, moveId: 'water_shuriken' }, { level: 10, moveId: 'aqua_jet' }],
            tmList: ['surf', 'hydro_pump', 'swift', 'bubble', 'water_shuriken'],
            possibleAbilities: ['torrent', 'rain_dish'],
            evolution: { targetLevel: 16, nextTowerId: 'wartortle' }, placementTags: ['land', 'water'], tags: ['water']
        },
        'wartortle': {
            id: 'wartortle', name: 'Wartortle', cost: 275, iconPath: 'pokemon/icon/008.png', walkingSprite: 'pokemon/walking/008.png', placeholderColor: '#0284c7',
            baseStats: { atk: 63, spatk: 65, range: 140, spd: 1.2, critChance: 0.1, critMultiplier: 1.6, armorPenetration: 6 },
            learnset: [{ level: 1, moveId: 'water_gun' }, { level: 7, moveId: 'water_pulse' }],
            tmList: ['surf', 'hydro_pump'],
            possibleAbilities: ['torrent', 'rain_dish'],
            evolution: { targetLevel: 36, nextTowerId: 'blastoise' }, placementTags: ['land', 'water'], tags: ['water']
        },
        'blastoise': {
            id: 'blastoise', name: 'Blastoise', cost: 1050, iconPath: 'pokemon/icon/009.png', walkingSprite: 'pokemon/walking/009.png', placeholderColor: '#0369a1',
            baseStats: { atk: 83, spatk: 85, range: 180, spd: 1.0, critChance: 0.2, critMultiplier: 2.2, armorPenetration: 25 },
            learnset: [{ level: 1, moveId: 'water_pulse' }, { level: 14, moveId: 'hydro_pump' }],
            tmList: ['surf', 'hydro_pump'],
            possibleAbilities: ['torrent', 'rain_dish'],
            evolution: null, placementTags: ['land', 'water'], tags: ['water']
        },
        'pikachu': {
            id: 'pikachu', name: 'Pikachu', buyable: true, cost: 150, iconPath: 'pokemon/icon/025.png', walkingSprite: 'pokemon/walking/025.png', placeholderColor: '#facc15',
            baseStats: { atk: 55, spatk: 50, range: 110, spd: 1.2, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'thunder_shock' }, { level: 6, moveId: 'thunderbolt' }, { level: 12, moveId: 'shock_wave' }],
            tmList: ['thunder', 'surf', 'swift', 'thunder_wave'],
            possibleAbilities: ['static', 'super_luck', 'lightning_rod'],
            evolution: null, placementTags: ['land'], tags: ['electric']
        },
        'grimer': {
            id: 'grimer', name: 'Grimer', buyable: true, cost: 200, iconPath: 'pokemon/icon/088.png', walkingSprite: 'pokemon/walking/088.png', placeholderColor: '#a855f7',
            baseStats: { atk: 80, spatk: 40, range: 90, spd: 0.9, critChance: 0.0, critMultiplier: 1.0, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'sludge' }, { level: 5, moveId: 'sludge_bomb' }],
            tmList: ['sludge_bomb', 'fire_blast', 'bubble'],
            possibleAbilities: ['poison_point'],
            evolution: null, placementTags: ['land', 'water'], tags: ['poison']
        },
        'clefairy': {
            id: 'clefairy', name: 'Clefairy', cost: 250, iconPath: 'pokemon/icon/035.png', walkingSprite: 'pokemon/walking/035.png', placeholderColor: '#f472b6',
            baseStats: { atk: 45, spatk: 60, range: 100, spd: 1.0, critChance: 0, critMultiplier: 1, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'helping_hand' }],
            tmList: ['solar_beam', 'fire_blast', 'thunder', 'surf', 'sludge_bomb'],
            possibleAbilities: ['magic_guard', 'friend_guard', 'unaware', 'pickup'],
            evolution: null, placementTags: ['land'], tags: ['fairy', 'normal']
        },
        // --- CATERPIE LINE (Early Game Support/Special) ---
        'caterpie': {
            id: 'caterpie', name: 'Caterpie', buyable: true, cost: 40, iconPath: 'pokemon/icon/010.png', walkingSprite: 'pokemon/walking/010.png', placeholderColor: '#4ade80',
            baseStats: { atk: 30, spatk: 20, range: 80, spd: 1.0, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'tackle' }],
            tmList: ['gust'],
            possibleAbilities: ['shield_dust', 'swarm'],
            evolution: { targetLevel: 7, nextTowerId: 'metapod' }, placementTags: ['land', 'grass'], tags: ['bug']
        },
        'metapod': {
            id: 'metapod', name: 'Metapod', cost: 50, iconPath: 'pokemon/icon/011.png', walkingSprite: 'pokemon/walking/011.png', placeholderColor: '#4ade80',
            baseStats: { atk: 20, spatk: 25, range: 80, spd: 0.9, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'tackle' }],
            tmList: ['gust'],
            possibleAbilities: ['shield_dust', 'swarm'],
            evolution: { targetLevel: 10, nextTowerId: 'butterfree' }, placementTags: ['land', 'grass'], tags: ['bug']
        },
        'butterfree': {
            id: 'butterfree', name: 'Butterfree', cost: 400, iconPath: 'pokemon/icon/012.png', walkingSprite: 'pokemon/walking/012.png', placeholderColor: '#a78bfa',
            baseStats: { atk: 45, spatk: 90, range: 160, spd: 1.2, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'razor_leaf' }, { level: 10, moveId: 'sludge_bomb' }],
            tmList: ['solar_beam', 'fire_blast', 'thunder', 'gust'],
            possibleAbilities: ['compound_eyes', 'serene_grace'],
            evolution: null, placementTags: ['land', 'grass'], tags: ['bug', 'flying']
        },
        // --- WEEDLE LINE (Early Game Physical Crit) ---
        'weedle': {
            id: 'weedle', name: 'Weedle', buyable: true, cost: 40, iconPath: 'pokemon/icon/013.png', walkingSprite: 'pokemon/walking/013.png', placeholderColor: '#facc15',
            baseStats: { atk: 35, spatk: 20, range: 80, spd: 1.1, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'poison_sting' }],
            tmList: ['gust'],
            possibleAbilities: ['shield_dust', 'swarm'],
            evolution: { targetLevel: 7, nextTowerId: 'kakuna' }, placementTags: ['land', 'grass'], tags: ['bug', 'poison']
        },
        'kakuna': {
            id: 'kakuna', name: 'Kakuna', cost: 50, iconPath: 'pokemon/icon/014.png', walkingSprite: 'pokemon/walking/014.png', placeholderColor: '#eab308',
            baseStats: { atk: 25, spatk: 25, range: 80, spd: 0.8, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'poison_sting' }],
            tmList: ['gust'],
            possibleAbilities: ['shield_dust', 'swarm'],
            evolution: { targetLevel: 10, nextTowerId: 'beedrill' }, placementTags: ['land', 'grass'], tags: ['bug', 'poison']
        },
        'beedrill': {
            id: 'beedrill', name: 'Beedrill', cost: 400, iconPath: 'pokemon/icon/015.png', walkingSprite: 'pokemon/walking/015.png', placeholderColor: '#ca8a04',
            baseStats: { atk: 90, spatk: 45, range: 130, spd: 1.5, critChance: 0.25, critMultiplier: 2.0, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'poison_sting' }, { level: 10, moveId: 'scratch' }, { level: 25, moveId: 'poison_jab' }],
            tmList: ['sludge_bomb', 'gust', 'fury_cutter'],
            possibleAbilities: ['sniper', 'swarm'],
            evolution: null, placementTags: ['land', 'grass'], tags: ['bug', 'poison']
        },
        'pidgey': {
            id: 'pidgey', name: 'Pidgey', buyable: true, cost: 50, iconPath: 'pokemon/icon/016.png', walkingSprite: 'pokemon/walking/016.png', placeholderColor: '#d6d3d1',
            baseStats: { atk: 45, spatk: 35, range: 110, spd: 1.15, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 5, moveId: 'gust' }, { level: 5, moveId: 'quick_attack' }],
            tmList: ['swift', 'gust', 'fire_blast', 'air_slash'],
            possibleAbilities: ['intimidate', 'compound_eyes', 'pickup'],
            evolution: { targetLevel: 18, nextTowerId: 'pidgeotto' }, placementTags: ['land', 'grass', 'mountain'], tags: ['flying', 'normal']
        },
        'pidgeotto': {
            id: 'pidgeotto', name: 'Pidgeotto', cost: 300, iconPath: 'pokemon/icon/017.png', walkingSprite: 'pokemon/walking/017.png', placeholderColor: '#d6d3d1',
            baseStats: { atk: 60, spatk: 50, range: 130, spd: 1.3, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'gust' }, { level: 20, moveId: 'swift' }, { level: 25, moveId: 'dual_wingbeat' }],
            tmList: ['swift', 'gust', 'fire_blast', 'hyper_beam', 'air_slash'],
            possibleAbilities: ['intimidate', 'compound_eyes'],
            evolution: { targetLevel: 36, nextTowerId: 'pidgeot' }, placementTags: ['land', 'grass', 'mountain'], tags: ['flying', 'normal']
        },
        'pidgeot': {
            id: 'pidgeot', name: 'Pidgeot', cost: 1000, iconPath: 'pokemon/icon/018.png', walkingSprite: 'pokemon/walking/018.png', placeholderColor: '#a8a29e',
            baseStats: { atk: 80, spatk: 70, range: 160, spd: 1.5, critChance: 0.15, critMultiplier: 2.0, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'swift' }, { level: 30, moveId: 'air_slash' }, { level: 40, moveId: 'hyper_beam' }],
            tmList: ['swift', 'gust', 'fire_blast', 'hyper_beam', 'air_slash'],
            possibleAbilities: ['intimidate', 'compound_eyes', 'no_guard'],
            evolution: null, placementTags: ['land', 'grass', 'mountain'], tags: ['flying', 'normal']
        },
        'spearow': {
            id: 'spearow', name: 'Spearow', buyable: true, cost: 60, iconPath: 'pokemon/icon/021.png', walkingSprite: 'pokemon/walking/021.png', placeholderColor: '#a8a29e',
            baseStats: { atk: 60, spatk: 31, range: 100, spd: 1.25, critChance: 0.1, critMultiplier: 1.8, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'scratch' }, { level: 5, moveId: 'fury_swipes' }, { level: 9, moveId: 'gust' }],
            tmList: ['swift', 'gust'],
            possibleAbilities: ['sniper', 'super_luck', 'pickup'],
            evolution: { targetLevel: 20, nextTowerId: 'fearow' }, placementTags: ['land', 'grass', 'mountain'], tags: ['flying', 'normal']
        },
        'fearow': {
            id: 'fearow', name: 'Fearow', cost: 600, iconPath: 'pokemon/icon/022.png', walkingSprite: 'pokemon/walking/022.png', placeholderColor: '#78716c',
            baseStats: { atk: 90, spatk: 61, range: 140, spd: 1.6, critChance: 0.2, critMultiplier: 2.2, armorPenetration: 20 },
            learnset: [{ level: 1, moveId: 'gust' }, { level: 22, moveId: 'dual_wingbeat' }, { level: 25, moveId: 'swift' }],
            tmList: ['swift', 'gust', 'hyper_beam'],
            possibleAbilities: ['sniper', 'super_luck'],
            evolution: null, placementTags: ['land', 'grass', 'mountain'], tags: ['flying', 'normal']
        },
        // --- GASTLY LINE (Special Sweeper) ---
        'gastly': {
            id: 'gastly', name: 'Gastly', buyable: true, cost: 200, iconPath: 'pokemon/icon/092.png', walkingSprite: 'pokemon/walking/092.png', placeholderColor: '#c084fc',
            baseStats: { atk: 35, spatk: 100, range: 120, spd: 1.1, critChance: 0.1, critMultiplier: 1.8, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'sludge' }, { level: 5, moveId: 'water_pulse' }],
            tmList: ['thunderbolt', 'fire_blast', 'sludge_bomb', 'shadow_ball'],
            possibleAbilities: ['levitate', 'static'],
            evolution: { targetLevel: 25, nextTowerId: 'haunter' }, placementTags: ['land'], tags: ['ghost', 'poison']
        },
        'haunter': {
            id: 'haunter', name: 'Haunter', cost: 200, iconPath: 'pokemon/icon/093.png', walkingSprite: 'pokemon/walking/093.png', placeholderColor: '#c084fc',
            baseStats: { atk: 50, spatk: 115, range: 125, spd: 1.2, critChance: 0.1, critMultiplier: 1.8, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'sludge' }, { level: 5, moveId: 'water_pulse' }, { level: 28, moveId: 'shadow_ball' }],
            tmList: ['thunderbolt', 'fire_blast', 'sludge_bomb', 'shadow_ball'],
            possibleAbilities: ['levitate', 'static'],
            evolution: { targetLevel: 36, nextTowerId: 'gengar' }, placementTags: ['land'], tags: ['ghost', 'poison']
        },
        'gengar': {
            id: 'gengar', name: 'Gengar', cost: 1200, iconPath: 'pokemon/icon/094.png', walkingSprite: 'pokemon/walking/094.png', placeholderColor: '#7e22ce',
            baseStats: { atk: 65, spatk: 130, range: 140, spd: 1.6, critChance: 0.2, critMultiplier: 2.0, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'sludge_bomb' }, { level: 15, moveId: 'thunder' }],
            tmList: ['thunder', 'fire_blast', 'hydro_pump', 'shadow_ball'],
            possibleAbilities: ['levitate', 'merciless'],
            evolution: null, placementTags: ['land'], tags: ['ghost', 'poison']
        },

        // --- GEODUDE LINE (Physical Splash Defenders) ---
        'geodude': {
            id: 'geodude', name: 'Geodude', buyable: true, cost: 120, iconPath: 'pokemon/icon/074.png', walkingSprite: 'pokemon/walking/074.png', placeholderColor: '#a8a29e',
            baseStats: { atk: 80, spatk: 30, range: 90, spd: 0.7, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'rock_throw' }],
            tmList: ['earthquake', 'fire_blast'],
            possibleAbilities: ['sturdy', 'sand_veil'],
            evolution: { targetLevel: 25, nextTowerId: 'graveler' }, placementTags: ['land', 'mountain'], tags: ['rock', 'ground']
        },
        'graveler': {
            id: 'graveler', name: 'Graveler', cost: 350, iconPath: 'pokemon/icon/075.png', walkingSprite: 'pokemon/walking/075.png', placeholderColor: '#78716c',
            baseStats: { atk: 95, spatk: 45, range: 100, spd: 0.7, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'rock_throw' }, { level: 12, moveId: 'rock_slide' }],
            tmList: ['earthquake', 'fire_blast'],
            possibleAbilities: ['sturdy', 'sand_veil'],
            evolution: { targetLevel: 40, nextTowerId: 'golem' }, placementTags: ['land', 'mountain'], tags: ['rock', 'ground']
        },
        'golem': {
            id: 'golem', name: 'Golem', cost: 1000, iconPath: 'pokemon/icon/076.png', walkingSprite: 'pokemon/walking/076.png', placeholderColor: '#44403c',
            baseStats: { atk: 120, spatk: 55, range: 120, spd: 0.8, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 30 },
            learnset: [{ level: 1, moveId: 'rock_slide' }, { level: 20, moveId: 'earthquake' }],
            tmList: ['earthquake', 'fire_blast'],
            possibleAbilities: ['sturdy', 'sand_veil'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['rock', 'ground']
        },

        // --- GROWLITHE LINE (Fast Fire Physical/Special Mix) ---
        'growlithe': {
            id: 'growlithe', name: 'Growlithe', buyable: true, cost: 180, iconPath: 'pokemon/icon/058.png', walkingSprite: 'pokemon/walking/058.png', placeholderColor: '#fb923c',
            baseStats: { atk: 70, spatk: 70, range: 100, spd: 1.2, critChance: 0.075, critMultiplier: 1.5, armorPenetration: 0 },
            learnset: [{ level: 1, moveId: 'scratch' }, { level: 6, moveId: 'ember' }],
            tmList: ['flamethrower', 'fire_blast'],
            possibleAbilities: ['intimidate', 'flame_body'],
            evolution: { targetLevel: 30, nextTowerId: 'arcanine' }, placementTags: ['land', 'mountain'], tags: ['fire']
        },
        'arcanine': {
            id: 'arcanine', name: 'Arcanine', cost: 1300, iconPath: 'pokemon/icon/059.png', walkingSprite: 'pokemon/walking/059.png', placeholderColor: '#ea580c',
            baseStats: { atk: 110, spatk: 100, range: 130, spd: 1.4, critChance: 0.15, critMultiplier: 1.5, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'flamethrower' }, { level: 20, moveId: 'fire_blast' }, { level: 35, moveId: 'extreme_speed' }],
            tmList: ['solar_beam', 'thunderbolt'],
            possibleAbilities: ['intimidate', 'flame_body'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['fire']
        },

        // --- MACHOP LINE (Pure Physical Powerhouse) ---
        'machop': {
            id: 'machop', name: 'Machop', buyable: true, cost: 150, iconPath: 'pokemon/icon/066.png', walkingSprite: 'pokemon/walking/066.png', placeholderColor: '#94a3b8',
            baseStats: { atk: 80, spatk: 35, range: 90, spd: 0.8, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 5, moveId: 'scratch' }, { level: 5, moveId: 'mach_punch' }],
            tmList: ['fire_blast', 'earthquake'], 
            possibleAbilities: ['guts', 'no_guard'],
            evolution: { targetLevel: 28, nextTowerId: 'machoke' }, placementTags: ['land', 'mountain'], tags: ['fighting']
        },
        'machoke': {
            id: 'machoke', name: 'Machoke', cost: 350, iconPath: 'pokemon/icon/067.png', walkingSprite: 'pokemon/walking/067.png', placeholderColor: '#94a3b8',
            baseStats: { atk: 100, spatk: 50, range: 90, spd: 0.9, critChance: 0.15, critMultiplier: 2.0, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'tackle' }, { level: 5, moveId: 'scratch' }],
            tmList: ['fire_blast', 'earthquake'], 
            possibleAbilities: ['guts', 'no_guard'],
            evolution: { targetLevel: 45, nextTowerId: 'machamp' }, placementTags: ['land', 'mountain'], tags: ['fighting']
        },
        'machamp': {
            id: 'machamp', name: 'Machamp', cost: 1150, iconPath: 'pokemon/icon/068.png', walkingSprite: 'pokemon/walking/068.png', placeholderColor: '#475569',
            baseStats: { atk: 130, spatk: 65, range: 110, spd: 1.0, critChance: 0.25, critMultiplier: 2.5, armorPenetration: 25 },
            learnset: [{ level: 1, moveId: 'razor_leaf' }, { level: 15, moveId: 'earthquake' }],
            tmList: ['fire_blast', 'hydro_pump'],
            possibleAbilities: ['guts', 'no_guard'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['fighting']
        },

        // --- MAGNEMITE LINE (Anti-Armor Utility) ---
        'magnemite': {
            id: 'magnemite', name: 'Magnemite', buyable: true, cost: 220, iconPath: 'pokemon/icon/081.png', walkingSprite: 'pokemon/walking/081.png', placeholderColor: '#cbd5e1',
            baseStats: { atk: 35, spatk: 95, range: 110, spd: 1.0, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'thunder_shock' }],
            tmList: ['thunderbolt', 'thunder'],
            possibleAbilities: ['sturdy', 'lightning_rod'],
            evolution: { targetLevel: 30, nextTowerId: 'magneton' }, placementTags: ['land', 'mountain'], tags: ['electric', 'steel']
        },
        'magneton': {
            id: 'magneton', name: 'Magneton', cost: 850, iconPath: 'pokemon/icon/082.png', walkingSprite: 'pokemon/walking/082.png', placeholderColor: '#94a3b8',
            baseStats: { atk: 60, spatk: 120, range: 130, spd: 1.2, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'thunder_shock' }, { level: 5, moveId: 'thunderbolt' }],
            tmList: ['thunder', 'sludge_bomb'],
            possibleAbilities: ['sturdy', 'lightning_rod'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['electric', 'steel']
        },

        // --- ENDGAME INDIVIDUALS ---
        'lapras': {
            id: 'lapras', name: 'Lapras', buyable: true, cost: 600, iconPath: 'pokemon/icon/131.png', walkingSprite: 'pokemon/walking/131.png', placeholderColor: '#38bdf8',
            baseStats: { atk: 85, spatk: 85, range: 140, spd: 0.9, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'water_pulse' }, { level: 15, moveId: 'ice_beam' }, { level: 30, moveId: 'hydro_pump' }],
            tmList: ['surf', 'thunderbolt', 'bubble'],
            possibleAbilities: ['thick_fat', 'rain_dish'],
            evolution: null, placementTags: ['water'], tags: ['water', 'ice']
        },
        'snorlax': {
            id: 'snorlax', name: 'Snorlax', buyable: true, cost: 900, iconPath: 'pokemon/icon/143.png', walkingSprite: 'pokemon/walking/143.png', placeholderColor: '#0f766e',
            baseStats: { atk: 110, spatk: 65, range: 150, spd: 0.6, critChance: 0.15, critMultiplier: 2.5, armorPenetration: 20 },
            learnset: [{ level: 1, moveId: 'body_slam' }, { level: 25, moveId: 'hyper_beam' }],
            tmList: ['earthquake', 'fire_blast', 'surf', 'thunder'],
            possibleAbilities: ['thick_fat', 'immunity'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['normal']
        },
        'abra': {
            id: 'abra', name: 'Abra', buyable: true, cost: 200, iconPath: 'pokemon/icon/063.png', walkingSprite: 'pokemon/walking/063.png', placeholderColor: '#fde047',
            baseStats: { atk: 20, spatk: 105, range: 130, spd: 1.0, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'confusion' }], tmList: ['sludge_bomb'],
            possibleAbilities: ['magic_guard'], evolution: { targetLevel: 16, nextTowerId: 'kadabra' }, placementTags: ['land'], tags: ['psychic']
        },
        'kadabra': {
            id: 'kadabra', name: 'Kadabra', cost: 650, iconPath: 'pokemon/icon/064.png', walkingSprite: 'pokemon/walking/064.png', placeholderColor: '#eab308',
            baseStats: { atk: 35, spatk: 120, range: 150, spd: 1.1, critChance: 0.15, critMultiplier: 1.5, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'confusion' }, { level: 8, moveId: 'psybeam' }], tmList: ['sludge_bomb', 'thunder'],
            possibleAbilities: ['magic_guard', 'technician'], evolution: { targetLevel: 36, nextTowerId: 'alakazam' }, placementTags: ['land'], tags: ['psychic']
        },
        'alakazam': {
            id: 'alakazam', name: 'Alakazam', cost: 1600, iconPath: 'pokemon/icon/065.png', walkingSprite: 'pokemon/walking/065.png', placeholderColor: '#ca8a04',
            baseStats: { atk: 50, spatk: 135, range: 180, spd: 1.3, critChance: 0.2, critMultiplier: 2.0, armorPenetration: 35 },
            learnset: [{ level: 1, moveId: 'psybeam' }, { level: 20, moveId: 'psychic_atk' }], tmList: ['sludge_bomb', 'thunder', 'fire_blast'],
            possibleAbilities: ['magic_guard', 'technician', 'serene_grace'], evolution: null, placementTags: ['land'], tags: ['psychic']
        },
        'scyther': {
            id: 'scyther', name: 'Scyther', buyable: true, cost: 600, iconPath: 'pokemon/icon/123.png', walkingSprite: 'pokemon/walking/123.png', placeholderColor: '#4ade80',
            baseStats: { atk: 110, spatk: 55, range: 115, spd: 1.2, critChance: 0.05, critMultiplier: 1.5, armorPenetration: 10 },
            learnset: [{ level: 1, moveId: 'fury_cutter' }], tmList: ['leaf_blade','dual_wingbeat'],
            possibleAbilities: ['technician', 'swarm'], placementTags: ['land', 'grass'], tags: ['bug', 'flying']
        },
        'pinsir': {
            id: 'pinsir', name: 'Pinsir', cost: 1400, iconPath: 'pokemon/icon/127.png', walkingSprite: 'pokemon/walking/127.png', placeholderColor: '#a16207',
            baseStats: { atk: 125, spatk: 55, range: 140, spd: 1.25, critChance: 0.25, critMultiplier: 2.0, armorPenetration: 45 },
            learnset: [{ level: 1, moveId: 'fury_cutter' }, { level: 18, moveId: 'tackle' }, { level: 30, moveId: 'mach_punch' }],
            tmList: ['earthquake', 'fury_cutter', 'fury_swipes', 'mach_punch', 'rock_slide'],
            possibleAbilities: ['mold_breaker', 'technician', 'huge_power'],
            evolution: null, placementTags: ['land', 'mountain'], tags: ['bug']
        },
        'dratini': {
            id: 'dratini', name: 'Dratini', buyable: true, cost: 800, iconPath: 'pokemon/icon/147.png', walkingSprite: 'pokemon/walking/147.png', placeholderColor: '#60a5fa',
            baseStats: { atk: 64, spatk: 50, range: 110, spd: 1.1, critChance: 0.1, critMultiplier: 1.5, armorPenetration: 5 },
            learnset: [{ level: 1, moveId: 'dragon_breath' }], tmList: ['surf', 'thunderbolt', 'fire_blast', 'bubble', 'dragon_pulse'],
            possibleAbilities: ['moxie'], evolution: { targetLevel: 30, nextTowerId: 'dragonair' }, placementTags: ['water', 'land'], tags: ['dragon']
        },
        'dragonair': {
            id: 'dragonair', name: 'Dragonair', cost: 1200, iconPath: 'pokemon/icon/148.png', walkingSprite: 'pokemon/walking/148.png', placeholderColor: '#3b82f6',
            baseStats: { atk: 84, spatk: 70, range: 140, spd: 1.1, critChance: 0.15, critMultiplier: 1.8, armorPenetration: 15 },
            learnset: [{ level: 1, moveId: 'dragon_breath' }], tmList: ['surf', 'thunderbolt', 'fire_blast', 'hydro_pump', 'dragon_pulse'],
            possibleAbilities: ['moxie', 'serene_grace'], evolution: { targetLevel: 55, nextTowerId: 'dragonite' }, placementTags: ['water', 'land'], tags: ['dragon']
        },
        'dragonite': {
            id: 'dragonite', name: 'Dragonite', cost: 3000, iconPath: 'pokemon/icon/149.png', walkingSprite: 'pokemon/walking/149.png', placeholderColor: '#ca8a04',
            baseStats: { atk: 134, spatk: 100, range: 180, spd: 1.2, critChance: 0.25, critMultiplier: 2.2, armorPenetration: 40 },
            learnset: [{ level: 1, moveId: 'dragon_breath' }, { level: 25, moveId: 'outrage' }], tmList: ['surf', 'thunder', 'fire_blast', 'hydro_pump', 'earthquake', 'dragon_pulse'],
            possibleAbilities: ['moxie', 'huge_power'], evolution: null, placementTags: ['land', 'mountain'], tags: ['dragon', 'flying']
        }
    },

    // Enemies Config
    enemies: {
        'caterpie': {
            id: 'caterpie', name: 'Caterpie', iconPath: 'pokemon/icon/010.png', walkingSprite: 'pokemon/walking/010.png', placeholderColor: '#4ade80',
            hp: 30, spd: 65, def: 35, spDef: 20, immunities: [], possibleAbilities: ['shield_dust'], abilityChance: 0.1, bounty: 3
        },
        'butterfree': {
            id: 'butterfree', name: 'Butterfree', iconPath: 'pokemon/icon/012.png', walkingSprite: 'pokemon/walking/012.png', placeholderColor: '#fef3c7',
            hp: 250, spd: 110, def: 50, spDef: 80, bounty: 65, possibleAbilities: ['speed_boost','shield_dust'], abilityChance: 0.6
        },
        'weedle': {
            id: 'weedle', name: 'Weedle', iconPath: 'pokemon/icon/013.png', walkingSprite: 'pokemon/walking/013.png', placeholderColor: '#facc15',
            hp: 35, spd: 65, def: 30, spDef: 20, immunities: [], possibleAbilities: ['shield_dust'], abilityChance: 0.1, bounty: 3
        },
        'beedrill': {
            id: 'beedrill', name: 'Beedrill', iconPath: 'pokemon/icon/015.png', walkingSprite: 'pokemon/walking/015.png', placeholderColor: '#fef3c7',
            hp: 250, spd: 110, def: 40, spDef: 80, bounty: 65, possibleAbilities: ['speed_boost', 'shield_dust'], abilityChance: 0.6
        },
        'rattata': {
            id: 'rattata', name: 'Rattata', iconPath: 'pokemon/icon/019.png', walkingSprite: 'pokemon/walking/019.png', placeholderColor: '#94a3b8',
            hp: 50, spd: 80, def: 35, spDef: 35, immunities: [], possibleAbilities: ['technician', 'guts'], abilityChance: 0.2, bounty: 5
        },
        'pidgey': {
            id: 'pidgey', name: 'Pidgey', iconPath: 'pokemon/icon/016.png', walkingSprite: 'pokemon/walking/016.png', placeholderColor: '#d6d3d1',
            hp: 40, spd: 85, def: 40, spDef: 35, immunities: [], possibleAbilities: ['guts', 'speed_boost', 'levitate'], abilityChance: 0.3, bounty: 6
        },
        'ekans': {
            id: 'ekans', name: 'Ekans', iconPath: 'pokemon/icon/023.png', walkingSprite: 'pokemon/walking/023.png', placeholderColor: '#a855f7',
            hp: 70, spd: 75, def: 44, spDef: 54, immunities: ['poison'], possibleAbilities: [], abilityChance: 0.2, bounty: 7
        },
        'geodude': {
            id: 'geodude', name: 'Geodude', iconPath: 'pokemon/icon/074.png', walkingSprite: 'pokemon/walking/074.png', placeholderColor: '#78716c',
            hp: 150, spd: 35, def: 100, spDef: 30, immunities: ['paralyze'], possibleAbilities: ['iron_barbs', 'sturdy'], abilityChance: 0.4, bounty: 12
        },
        'gastly': {
            id: 'gastly', name: 'Gastly', iconPath: 'pokemon/icon/092.png', walkingSprite: 'pokemon/walking/092.png', placeholderColor: '#c084fc',
            hp: 70, spd: 70, def: 30, spDef: 35, immunities: ['paralyze'], possibleAbilities: ['magic_guard', 'levitate', 'aftermath'], abilityChance: 0.5, bounty: 8
        },
        'koffing': {
            id: 'koffing', name: 'Koffing', iconPath: 'pokemon/icon/109.png', walkingSprite: 'pokemon/walking/109.png', placeholderColor: '#8b5cf6',
            hp: 120, spd: 55, def: 95, spDef: 45, immunities: ['poison'], possibleAbilities: ['levitate', 'aftermath'], abilityChance: 1.0, bounty: 15
        },
        'raticate': {
            id: 'raticate', name: 'Raticate', iconPath: 'pokemon/icon/020.png', walkingSprite: 'pokemon/walking/020.png', placeholderColor: '#92400e',
            hp: 200, spd: 95, def: 60, spDef: 70, bounty: 25, possibleAbilities: ['guts'], abilityChance: 0.5
        },
        'pidgeotto': {
            id: 'pidgeotto', name: 'Pidgeotto', iconPath: 'pokemon/icon/017.png', walkingSprite: 'pokemon/walking/017.png', placeholderColor: '#d6d3d1',
            hp: 220, spd: 100, def: 55, spDef: 50, bounty: 30, possibleAbilities: ['speed_boost', 'levitate'], abilityChance: 0.4
        },
        'graveler': {
            id: 'graveler', name: 'Graveler', iconPath: 'pokemon/icon/075.png', walkingSprite: 'pokemon/walking/075.png', placeholderColor: '#57534e',
            hp: 400, spd: 30, def: 115, spDef: 45, bounty: 45, possibleAbilities: ['sturdy', 'iron_barbs', 'aftermath'], abilityChance: 1.0
        },
        'slowpoke': {
            id: 'slowpoke', name: 'Slowpoke', iconPath: 'pokemon/icon/079.png', walkingSprite: 'pokemon/walking/079.png', placeholderColor: '#f472b6',
            hp: 350, spd: 25, def: 65, spDef: 40, bounty: 35, possibleAbilities: ['regenerator', 'unaware'], abilityChance: 0.8
        },
        'zubat': {
            id: 'zubat', name: 'Zubat', iconPath: 'pokemon/icon/041.png', walkingSprite: 'pokemon/walking/041.png', placeholderColor: '#a855f7',
            hp: 95, spd: 100, def: 35, spDef: 40, bounty: 20, possibleAbilities: ['levitate'], abilityChance: 1.0
        },
        'abra': {
            id: 'abra', name: 'Abra', iconPath: 'pokemon/icon/063.png', walkingSprite: 'pokemon/walking/063.png', placeholderColor: '#fde047',
            hp: 60, spd: 105, def: 15, spDef: 55, bounty: 40, possibleAbilities: ['emergency_exit'], abilityChance: 1.0
        },
        'voltorb': {
            id: 'voltorb', name: 'Voltorb', iconPath: 'pokemon/icon/100.png', walkingSprite: 'pokemon/walking/100.png', placeholderColor: '#ef4444',
            hp: 100, spd: 125, def: 50, spDef: 55, bounty: 30, possibleAbilities: ['aftermath', 'speed_boost'], abilityChance: 0.8
        },
        'chansey': {
            id: 'chansey', name: 'Chansey', iconPath: 'pokemon/icon/113.png', walkingSprite: 'pokemon/walking/113.png', placeholderColor: '#fbcfe8',
            hp: 1200, spd: 45, def: 5, spDef: 105, bounty: 150, possibleAbilities: ['regenerator'], abilityChance: 1.0
        },
        'onix': {
            id: 'onix', name: 'Onix', iconPath: 'pokemon/icon/095.png', walkingSprite: 'pokemon/walking/095.png', placeholderColor: '#78716c',
            hp: 650, spd: 40, def: 160, spDef: 45, bounty: 85, possibleAbilities: ['sturdy', 'aftermath'], abilityChance: 1.0
        },
        'sandshrew': {
            id: 'sandshrew', name: 'Sandshrew', iconPath: 'pokemon/icon/027.png', walkingSprite: 'pokemon/walking/027.png', placeholderColor: '#d97706',
            hp: 160, spd: 60, def: 85, spDef: 30, bounty: 25, possibleAbilities: ['sand_hide'], abilityChance: 1.0
        },
        'kingler': {
            id: 'kingler', name: 'Kingler', iconPath: 'pokemon/icon/099.png', walkingSprite: 'pokemon/walking/099.png', placeholderColor: '#dc2626',
            hp: 400, spd: 55, def: 115, spDef: 50, bounty: 75, possibleAbilities: ['aftermath'], abilityChance: 0.5
        },
        'magikarp': {
            id: 'magikarp', name: 'Magikarp', iconPath: 'pokemon/icon/129.png', walkingSprite: 'pokemon/walking/129.png', placeholderColor: '#f87171',
            hp: 1, spd: 15, def: 55, spDef: 20, bounty: 100, possibleAbilities: [], abilityChance: 0.1
        },
        'meowth': {
            id: 'meowth', name: 'Meowth', iconPath: 'pokemon/icon/052.png', walkingSprite: 'pokemon/walking/052.png', placeholderColor: '#fef3c7',
            hp: 80, spd: 95, def: 35, spDef: 40, bounty: 15, possibleAbilities: ['pay_day'], abilityChance: 1.0
        },
        'gyarados': {
            id: 'gyarados', name: 'Gyarados', iconPath: 'pokemon/icon/130.png', walkingSprite: 'pokemon/walking/130.png', placeholderColor: '#0284c7',
            hp: 1000, spd: 65, def: 79, spDef: 100, bounty: 300, possibleAbilities: ['aftermath'], abilityChance: 1.0
        },
        'snorlax': {
            id: 'snorlax', name: 'Snorlax', iconPath: 'pokemon/icon/143.png', walkingSprite: 'pokemon/walking/143.png', placeholderColor: '#0f766e',
            hp: 1200, spd: 20, def: 65, spDef: 110, bounty: 400, possibleAbilities: ['thick_fat','aftermath'], abilityChance: 1.0
        },
        'dragonite': {
            id: 'dragonite', name: 'Dragonite', iconPath: 'pokemon/icon/149.png', walkingSprite: 'pokemon/walking/149.png', placeholderColor: '#ea580c',
            hp: 2000, spd: 60, def: 95, spDef: 100, bounty: 1000, possibleAbilities: ['inner_focus', 'levitate'], abilityChance: 1.0
        },
        'arcanine_boss': {
            id: 'arcanine_boss', name: 'Arcanine', iconPath: 'pokemon/icon/059.png', walkingSprite: 'pokemon/walking/059.png', placeholderColor: '#ea580c',
            hp: 800, spd: 80, def: 80, spDef: 80, bounty: 100, possibleAbilities: ['sprint'], abilityChance: 1.0
        },
        'tentacool': {
            id: 'tentacool', name: 'Tentacool', iconPath: 'pokemon/icon/072.png', walkingSprite: 'pokemon/walking/072.png', placeholderColor: '#0ea5e9',
            hp: 75, spd: 50, def: 35, spDef: 100, bounty: 120, possibleAbilities: ['shield_dust'], abilityChance: 1.0
        },
        'tentacruel': {
            id: 'tentacruel', name: 'Tentacruel', iconPath: 'pokemon/icon/073.png', walkingSprite: 'pokemon/walking/073.png', placeholderColor: '#0ea5e9',
            hp: 800, spd: 50, def: 65, spDef: 120, bounty: 120, possibleAbilities: ['shield_dust'], abilityChance: 1.0
        },
        'electrode': {
            id: 'electrode', name: 'Electrode', iconPath: 'pokemon/icon/101.png', walkingSprite: 'pokemon/walking/101.png', placeholderColor: '#ef4444',
            hp: 600, spd: 120, def: 70, spDef: 80, bounty: 80, possibleAbilities: ['aftermath_elite'], abilityChance: 1.0
        },
        'slowbro': {
            id: 'slowbro', name: 'Slowbro', iconPath: 'pokemon/icon/080.png', walkingSprite: 'pokemon/walking/080.png', placeholderColor: '#f472b6',
            hp: 1400, spd: 30, def: 110, spDef: 80, bounty: 150, possibleAbilities: ['regenerator_elite'], abilityChance: 1.0
        },
        'gengar_boss': {
            id: 'gengar_boss', name: 'Gengar', iconPath: 'pokemon/icon/094.png', walkingSprite: 'pokemon/walking/094.png', placeholderColor: '#7e22ce',
            hp: 1200, spd: 70, def: 60, spDef: 75, bounty: 200, possibleAbilities: ['shadow_tag_global'], abilityChance: 1.0
        },
        'rhyhorn': { 
            id: 'rhyhorn', name: 'Rhyhorn', iconPath: 'pokemon/icon/111.png', walkingSprite: 'pokemon/walking/111.png', placeholderColor: '#78716c', hp: 600, spd: 45, def: 95, spDef: 30, immunities: ['paralyze'], possibleAbilities: ['sturdy'], abilityChance: 0.3, bounty: 18 
        },
        'golbat': { 
            id: 'golbat', name: 'Golbat', iconPath: 'pokemon/icon/042.png', walkingSprite: 'pokemon/walking/042.png', placeholderColor: '#a855f7', hp: 350, spd: 96, def: 70, spDef: 75, immunities: ['poison'], possibleAbilities: ['levitate'], abilityChance: 1.0, bounty: 18 
        },
        'magneton': { 
            id: 'magneton', name: 'Magneton', iconPath: 'pokemon/icon/082.png', walkingSprite: 'pokemon/walking/082.png', placeholderColor: '#94a3b8', hp: 500, spd: 90, def: 95, spDef: 70, immunities: ['poison', 'paralyze'], possibleAbilities: ['sturdy', 'levitate'], abilityChance: 1.0, bounty: 22 
        },
        'scyther': { 
            id: 'scyther', name: 'Scyther', iconPath: 'pokemon/icon/123.png', walkingSprite: 'pokemon/walking/123.png', placeholderColor: '#4ade80', hp: 450, spd: 115, def: 80, spDef: 80, immunities: [], possibleAbilities: ['technician', 'speed_boost'], abilityChance: 0.6, bounty: 25 
        },
        'venomoth': {
            id: 'venomoth', name: 'Venomoth', iconPath: 'pokemon/icon/049.png', walkingSprite: 'pokemon/walking/049.png', placeholderColor: '#c084fc', 
            hp: 900, spd: 90, def: 60, spDef: 75, immunities: ['poison'], 
            possibleAbilities: ['sprint', 'shield_dust'], abilityChance: 1.0, bounty: 40
        },      
        'rhydon': { 
            id: 'rhydon', name: 'Rhydon', iconPath: 'pokemon/icon/112.png', walkingSprite: 'pokemon/walking/112.png', placeholderColor: '#57534e', hp: 1100, spd: 45, def: 120, spDef: 45, immunities: ['paralyze'], possibleAbilities: ['sturdy'], abilityChance: 0.6, bounty: 35 
        },
        'muk': { 
            id: 'muk', name: 'Muk', iconPath: 'pokemon/icon/089.png', walkingSprite: 'pokemon/walking/089.png', placeholderColor: '#a855f7', hp: 1350, spd: 50, def: 75, spDef: 100, immunities: ['poison'], possibleAbilities: ['corrosion'], abilityChance: 1.0, bounty: 45 
        },
        'gengar': { 
            id: 'gengar', name: 'Gengar', iconPath: 'pokemon/icon/094.png', walkingSprite: 'pokemon/walking/094.png', placeholderColor: '#7e22ce', hp: 1000, spd: 100, def: 60, spDef: 75, immunities: ['paralyze'], possibleAbilities: ['levitate', 'shadow_tag'], abilityChance: 0.8, bounty: 45 
        },
        'alakazam': { 
            id: 'alakazam', name: 'Alakazam', iconPath: 'pokemon/icon/065.png', walkingSprite: 'pokemon/walking/065.png', placeholderColor: '#ca8a04', hp: 700, spd: 105, def: 45, spDef: 95, immunities: [], possibleAbilities: ['magic_guard', 'levitate'], abilityChance: 0.5, bounty: 50 
        },
        'cloyster': { 
            id: 'cloyster', name: 'Cloyster', iconPath: 'pokemon/icon/091.png', walkingSprite: 'pokemon/walking/091.png', placeholderColor: '#c084fc', hp: 1800, spd: 35, def: 180, spDef: 45, immunities: ['freeze'], possibleAbilities: ['iron_barbs'], abilityChance: 1.0, bounty: 100 
        },
        'aerodactyl': { 
            id: 'aerodactyl', name: 'Aerodactyl', iconPath: 'pokemon/icon/142.png', walkingSprite: 'pokemon/walking/142.png', placeholderColor: '#94a3b8', hp: 1100, spd: 110, def: 65, spDef: 75, immunities: [], possibleAbilities: ['levitate'], abilityChance: 1.0, bounty: 55 
        },
        'machamp': { 
            id: 'machamp', name: 'Machamp', iconPath: 'pokemon/icon/068.png', walkingSprite: 'pokemon/walking/068.png', placeholderColor: '#475569', hp: 1750, spd: 55, def: 80, spDef: 85, immunities: [], possibleAbilities: ['guts'], abilityChance: 0.7, bounty: 60 
        },
        'dragonair': { 
            id: 'dragonair', name: 'Dragonair', iconPath: 'pokemon/icon/148.png', walkingSprite: 'pokemon/walking/148.png', placeholderColor: '#3b82f6', hp: 2000, spd: 100, def: 65, spDef: 70, immunities: [], possibleAbilities: ['shield_dust'], abilityChance: 0.5, bounty: 65 
        },
        'kangaskhan': { 
            id: 'kangaskhan', name: 'Kangaskhan', iconPath: 'pokemon/icon/115.png', walkingSprite: 'pokemon/walking/115.png', placeholderColor: '#fbcfe8', 
            hp: 3500, spd: 90, def: 80, spDef: 80, immunities: [], 
            possibleAbilities: ['magic_guard', 'guts'], abilityChance: 1.0, bounty: 150 
        },
        'nidoking': { 
            id: 'nidoking', name: 'Nidoking', iconPath: 'pokemon/icon/034.png', walkingSprite: 'pokemon/walking/034.png', placeholderColor: '#4ade80', 
            hp: 2500, spd: 85, def: 77, spDef: 75, immunities: ['poison'], 
            possibleAbilities: ['pack_hunter', 'poison_point', 'sturdy'], abilityChance: 0.8, bounty: 180 
        },
        'dragonite': { 
            id: 'dragonite', name: 'Dragonite', iconPath: 'pokemon/icon/149.png', walkingSprite: 'pokemon/walking/149.png', placeholderColor: '#ea580c', hp: 2000, spd: 65, def: 100, spDef: 100, immunities: [], possibleAbilities: ['levitate'], abilityChance: 1.0, bounty: 200 
        },
        'mewtwo': { 
            id: 'mewtwo', name: 'Mewtwo', iconPath: 'pokemon/icon/150.png', walkingSprite: 'pokemon/walking/150.png', placeholderColor: '#c084fc', hp: 3000, spd: 120, def: 90, spDef: 90, immunities: ['paralyze', 'freeze', 'burn', 'poison'], possibleAbilities: ['shadow_tag_global', 'regenerator_elite'], abilityChance: 1.0, bounty: 500 
        }
    },

    items: {
        // --- HELD ITEMS (Combat) ---
        'quick_claw': { 
            id: 'quick_claw', name: 'Quick Claw', type: 'equip', cost: 200, description: 'Increases Attack Speed by 25%.', 
            effects: [{ trigger: 'passive', action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 1.25 }] 
        },
        'scope_lens': { 
            id: 'scope_lens', name: 'Scope Lens', type: 'equip', cost: 300, description: 'Adds +20% Crit Chance and +1.0x Crit Damage.', 
            effects: [
                { trigger: 'passive', action: 'modify_stat', stat: 'critChance', operation: 'add', value: 0.20 },
                { trigger: 'passive', action: 'modify_stat', stat: 'critMultiplier', operation: 'add', value: 1.0 }
            ] 
        },
        'macho_brace': { 
            id: 'macho_brace', name: 'Macho Brace', type: 'equip', cost: 250, description: 'Increases Damage 2x but decreases Attack Speed by 35%.', 
            effects: [
                { trigger: 'passive', action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 2.0 },
                { trigger: 'passive', action: 'modify_stat', stat: 'spd', operation: 'multiply', value: 0.65 }
            ] 
        },
        'magnet': { 
            id: 'magnet', name: 'Magnet', type: 'equip', cost: 250, 
            description: 'Attacks chain to 2 extra targets, but deals 55% less damage.', 
            effects: [
                { trigger: 'passive', action: 'modify_stat', stat: 'chainCount', operation: 'add', value: 2 },
                { trigger: 'passive', action: 'modify_stat', stat: 'chainRadius', operation: 'add', value: 100 },
                { trigger: 'passive', action: 'modify_stat', stat: 'damage', operation: 'multiply', value: 0.45 }
            ] 
        },

        // --- TECHNICAL MACHINES (Utility - Logic handled by Teaching Engine) ---
        'tm_solar_beam': { id: 'tm_solar_beam', name: 'TM: Solar Beam', type: 'tm', moveId: 'solar_beam', cost: 500, description: 'Teaches Solar Beam.' },
        'tm_fire_blast': { id: 'tm_fire_blast', name: 'TM: Fire Blast', type: 'tm', moveId: 'fire_blast', cost: 500, description: 'Teaches Fire Blast.' },
        'tm_surf': { id: 'tm_surf', name: 'TM: Surf', type: 'tm', moveId: 'surf', cost: 500, description: 'Teaches Surf.' },
        'tm_thunder': { id: 'tm_thunder', name: 'TM: Thunder', type: 'tm', moveId: 'thunder', cost: 500, description: 'Teaches Thunder.' },
        'tm_earthquake': { id: 'tm_earthquake', name: 'TM: Earthquake', type: 'tm', moveId: 'earthquake', cost: 600, description: 'Teaches Earthquake.' },
        'tm_swift': { id: 'tm_swift', name: 'TM: Swift', type: 'tm', moveId: 'swift', cost: 175, description: 'Teaches Swift.' },
        'tm_gust': { id: 'tm_gust', name: 'TM: Gust', type: 'tm', moveId: 'gust', cost: 150, description: 'Teaches Gust.' },
        'tm_bubble': { id: 'tm_bubble', name: 'TM: Bubble', type: 'tm', moveId: 'bubble', cost: 180, description: 'Teaches Bubble.' },
        'tm_sludge_bomb': { id: 'tm_sludge_bomb', name: 'TM: Sludge Bomb', type: 'tm', moveId: 'sludge_bomb', cost: 400, description: 'Teaches Sludge Bomb.' },
        'tm_air_slash': { id: 'tm_air_slash', name: 'TM: Air Slash', type: 'tm', moveId: 'air_slash', cost: 450, description: 'Teaches Air Slash.' },
        'tm_shock_wave': { id: 'tm_shock_wave', name: 'TM: Shock Wave', type: 'tm', moveId: 'shock_wave', cost: 400, description: 'Teaches Shock Wave.' },
        'tm_shadow_ball': { id: 'tm_shadow_ball', name: 'TM: Shadow Ball', type: 'tm', moveId: 'shadow_ball', cost: 550, description: 'Teaches Shadow Ball.' },
        'tm_giga_drain': { id: 'tm_giga_drain', name: 'TM: Giga Drain', type: 'tm', moveId: 'giga_drain', cost: 500, description: 'Teaches Giga Drain.' },
        'tm_thunder_wave': { id: 'tm_thunder_wave', name: 'TM: Thunder Wave', type: 'tm', moveId: 'thunder_wave', cost: 150, description: 'Teaches Thunder Wave.' },
        'tm_dragon_pulse': { id: 'tm_dragon_pulse', name: 'TM: Dragon Pulse', type: 'tm', moveId: 'dragon_pulse', cost: 600, description: 'Teaches Dragon Pulse.' },
        'tm_poison_jab': { id: 'tm_poison_jab', name: 'TM: Poison Jab', type: 'tm', moveId: 'poison_jab', cost: 450, description: 'Teaches Poison Jab.' },
        'tm_fury_swipes': { id: 'tm_fury_swipes', name: 'TM: Fury Swipes', type: 'tm', moveId: 'fury_swipes', cost: 200, description: 'Teaches Fury Swipes.' },
        'tm_quick_attack': { id: 'tm_quick_attack', name: 'TM: Quick Attack', type: 'tm', moveId: 'quick_attack', cost: 250, description: 'Teaches Quick Attack.' },
        'tm_extreme_speed': { id: 'tm_extreme_speed', name: 'TM: Extreme Speed', type: 'tm', moveId: 'extreme_speed', cost: 800, description: 'Teaches Extreme Speed.' },
        'tm_aqua_jet': { id: 'tm_aqua_jet', name: 'TM: Aqua Jet', type: 'tm', moveId: 'aqua_jet', cost: 350, description: 'Teaches Aqua Jet.' },
        'tm_mach_punch': { id: 'tm_mach_punch', name: 'TM: Mach Punch', type: 'tm', moveId: 'mach_punch', cost: 380, description: 'Teaches Mach Punch.' },
        'tm_leaf_blade': { id: 'tm_leaf_blade', name: 'TM: Leaf Blade', type: 'tm', moveId: 'leaf_blade', cost: 550, description: 'Teaches Leaf Blade.' },
        'tm_dual_wingbeat': { id: 'tm_dual_wingbeat', name: 'TM: Dual Wingbeat', type: 'tm', moveId: 'dual_wingbeat', cost: 450, description: 'Teaches Dual Wingbeat.' },
        'tm_bullet_seed': { id: 'tm_bullet_seed', name: 'TM: Bullet Seed', type: 'tm', moveId: 'bullet_seed', cost: 220, description: 'Teaches Bullet Seed.' },
        'tm_water_shuriken': { id: 'tm_water_shuriken', name: 'TM: Water Shuriken', type: 'tm', moveId: 'water_shuriken', cost: 280, description: 'Teaches Water Shuriken.' },
    },

    waves: [
        // Intro
        { id: 1, reward: 25, groups: [{ enemyId: 'caterpie', count: 5,  interval: 1.3, abilityChance: 0.0 }] },
        { id: 2, reward: 35, groups: [{ enemyId: 'weedle', count: 6, interval: 1.0, abilityChance: 0.0 }, { enemyId: 'caterpie', count: 4, interval: 1.5, abilityChance: 0.0 }] },
        { id: 3, reward: 50, groups: [{ enemyId: 'rattata', count: 8, interval: 0.8, abilityChance: 0.0 }, { enemyId: 'weedle', count: 4, interval: 1.2, abilityChance: 0.0 }] },
        { id: 4, reward: 70, groups: [{ enemyId: 'pidgey', count: 12, interval: 0.7, abilityChance: 0.2 }, { enemyId: 'ekans', count: 3, interval: 1.0, abilityChance: 0.2 }] },
        { id: 5, reward: 100, groups: [
            { enemyId: 'rattata', count: 6, interval: 0.5, abilityChance: 0.3 },
            { enemyId: 'tentacool', count: 1, interval: 1.5, abilityChance: 0.0 },
            { enemyId: 'ekans', count: 3, interval: 1.0, abilityChance: 0.2 }, 
            { enemyId: 'tentacool', count: 1, interval: 1.5, abilityChance: 0.0 }
        ]},
        // Early Ramp
        { id: 6, reward: 130, groups: [
            { enemyId: 'pidgey', count: 12, interval: 0.5, abilityChance: 0.3 },
            { enemyId: 'gastly', count: 4, interval: 1.0, abilityChance: 0.2 }
        ]},
        { id: 7, reward: 150, groups: [
            { enemyId: 'rattata', count: 10, interval: 0.4, abilityChance: 0.5 },
            { enemyId: 'gastly', count: 5, interval: 1.25, abilityChance: 0.2 },
            { enemyId: 'pidgey', count: 10, interval: 0.4, abilityChance: 0.5 }
        ]},
        { id: 8, reward: 180, groups: [
            { enemyId: 'geodude', count: 5, interval: 1.5, abilityChance: 0.1 },
            { enemyId: 'rattata', count: 15, interval: 0.4, abilityChance: 0.2 },
            { enemyId: 'tentacool', count: 3, interval: 1.5, abilityChance: 0.0 }
        ]},
        { id: 9, reward: 200, groups: [
            { enemyId: 'ekans', count: 10, interval: 0.75, abilityChance: 0.2 },
            { enemyId: 'geodude', count: 3, interval: 1.0, abilityChance: 0.3 },
            { enemyId: 'zubat', count: 8, interval: 0.8, abilityChance: 0.5 },
            { enemyId: 'geodude', count: 6, interval: 1.25, abilityChance: 0.3 }
        ]},
        { id: 10, reward: 200, groups: [ // Mini-boss 1
            { enemyId: 'tentacool', count: 3, interval: 1.5, abilityChance: 0.0 },
            { enemyId: 'raticate', count: 2, interval: 3.0, abilityChance: 1.0 },
            { enemyId: 'pidgeotto', count: 3, interval: 2.0, abilityChance: 0.5 }
        ]},
        // Mid-game Intro
        { id: 11, reward: 160, groups: [
            { enemyId: 'pidgey', count: 20, level: 5, interval: 0.4, abilityChance: 0.2 },
            { enemyId: 'gastly', count: 10, interval: 0.8, abilityChance: 0.4 },
            { enemyId: 'butterfree', count: 3, interval: 1.8, abilityChance: 0.4 },
            { enemyId: 'geodude', count: 5, interval: 1.0, abilityChance: 0.8 }
        ]},
        { id: 12, reward: 160, groups: [
            { enemyId: 'sandshrew', count: 12, interval: 1.0, abilityChance: 0.5 },
            { enemyId: 'graveler', count: 1, interval: 1.5, abilityChance: 0.4 },
            { enemyId: 'koffing', count: 4, interval: 2.0, abilityChance: 1.0 }
        ]},
        { id: 13, reward: 180, groups: [
            { enemyId: 'slowpoke', count: 5, interval: 2.5, abilityChance: 0.5 },
            { enemyId: 'graveler', count: 2, interval: 1.0, abilityChance: 0.4 },
            { enemyId: 'zubat', count: 12, interval: 0.5, abilityChance: 0.5 }
        ]},
        { id: 14, reward: 180, groups: [
            { enemyId: 'pidgeotto', count: 8, interval: 1.5, abilityChance: 0.5 },
            { enemyId: 'voltorb', count: 5, interval: 0.8, abilityChance: 0.8 },
            { enemyId: 'abra', count: 2, interval: 3.0, abilityChance: 1.0 }
        ]},
        { id: 15, reward: 250, groups: [ // Def/SpDef Check
            { enemyId: 'chansey', count: 1, interval: 5.0, abilityChance: 1.0 },
            { enemyId: 'graveler', count: 3, interval: 1.5, abilityChance: 0.8 },
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
        { id: 21, reward: 320, groups: [
            { enemyId: 'pidgeotto', count: 10, interval: 0.7, abilityChance: 0.6 },
            { enemyId: 'raticate', count: 10, interval: 1.0, abilityChance: 0.6 }
        ]},
        { id: 22, reward: 300, groups: [
            { enemyId: 'onix', count: 5, interval: 1.5, abilityChance: 1.0 },
            { enemyId: 'graveler', count: 10, interval: 1.0, abilityChance: 0.8 }
        ]},
        { id: 23, reward: 320, groups: [
            { enemyId: 'chansey', count: 3, interval: 3.0, abilityChance: 1.0 },
            { enemyId: 'gastly', count: 10, level: 5, interval: 0.8, abilityChance: 0.5 },
            { enemyId: 'abra', count: 6, level: 5, interval: 2.0, abilityChance: 1.0 }
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
        { id: 30, reward: 1000, groups: [ 
            { enemyId: 'dragonite', count: 1, interval: 10.0, abilityChance: 1.0 },
            { enemyId: 'gyarados', count: 1, interval: 3.0, abilityChance: 1.0 },
            { enemyId: 'snorlax', count: 1, interval: 3.0, abilityChance: 1.0 }
        ]},
        { id: 31, reward: 300, groups: [{ enemyId: 'rhyhorn', count: 15, interval: 1.5, abilityChance: 0.2 }] },
        { id: 32, reward: 320, groups: [{ enemyId: 'golbat', count: 25, interval: 0.6, abilityChance: 0.5 }] },
        { id: 33, reward: 350, groups: [{ enemyId: 'rhyhorn', count: 12, interval: 1.2, abilityChance: 0.3 }, { enemyId: 'magneton', count: 8, interval: 1.5, abilityChance: 0.8 }] },
        { id: 34, reward: 380, groups: [{ enemyId: 'scyther', count: 10, interval: 1.0, abilityChance: 0.4 }, { enemyId: 'golbat', count: 15, interval: 0.8, abilityChance: 0.5 }] },
        { id: 35, reward: 600, groups: [{ enemyId: 'venomoth', count: 5, interval: 2.0, abilityChance: 1.0 }, { enemyId: 'rhyhorn', count: 10, interval: 1.0, abilityChance: 0.5 }] },
        { id: 36, reward: 400, groups: [{ enemyId: 'magneton', count: 15, interval: 1.0, abilityChance: 1.0 }, { enemyId: 'scyther', count: 12, interval: 1.2, abilityChance: 0.5 }] },
        { id: 37, reward: 420, groups: [{ enemyId: 'rhydon', count: 5, interval: 3.0, abilityChance: 0.6 }, { enemyId: 'golbat', count: 20, interval: 0.5, abilityChance: 1.0 }] },
        { id: 38, reward: 450, groups: [{ enemyId: 'muk', count: 8, interval: 2.0, abilityChance: 1.0 }, { enemyId: 'magneton', count: 12, interval: 1.2, abilityChance: 1.0 }] },
        { id: 39, reward: 480, groups: [{ enemyId: 'scyther', count: 20, interval: 0.8, abilityChance: 0.6 }, { enemyId: 'rhydon', count: 5, interval: 2.5, abilityChance: 0.8 }] },
        { id: 40, reward: 800, groups: [{ enemyId: 'cloyster', count: 2, interval: 6.0, abilityChance: 1.0 }, { enemyId: 'golbat', count: 15, interval: 0.5, abilityChance: 1.0 }] },

        // --- LATE-GAME TECHNICALS (41-50) ---
        { id: 41, reward: 500, groups: [{ enemyId: 'gengar', count: 15, interval: 1.5, abilityChance: 0.3 }] },
        { id: 42, reward: 520, groups: [{ enemyId: 'alakazam', count: 12, interval: 1.5, abilityChance: 0.5 }, { enemyId: 'gengar', count: 15, interval: 1.0, abilityChance: 0.8 }] },
        { id: 43, reward: 550, groups: [{ enemyId: 'machamp', count: 10, interval: 2.0, abilityChance: 0.7 }, { enemyId: 'muk', count: 8, interval: 1.75, abilityChance: 1.0 }] },
        { id: 44, reward: 580, groups: [{ enemyId: 'aerodactyl', count: 15, interval: 0.8, abilityChance: 1.0 }, { enemyId: 'alakazam', count: 10, interval: 1.2, abilityChance: 0.5 }] },
        { id: 45, reward: 900, groups: [{ enemyId: 'slowbro', count: 4, interval: 4.0, abilityChance: 1.0 }, { enemyId: 'machamp', count: 12, interval: 1.5, abilityChance: 0.7 }] },
        { id: 46, reward: 600, groups: [{ enemyId: 'dragonair', count: 12, interval: 1.5, abilityChance: 0.5 }, { enemyId: 'aerodactyl', count: 15, interval: 1.0, abilityChance: 1.0 }] },
        { id: 47, reward: 650, groups: [{ enemyId: 'nidoking', count: 6, interval: 3.5, abilityChance: 0.8 }, { enemyId: 'dragonair', count: 12, interval: 1.2, abilityChance: 0.5 }] },
        { id: 48, reward: 700, groups: [{ enemyId: 'snorlax', count: 3, interval: 5.0, abilityChance: 1.0 }, { enemyId: 'nidoking', count: 8, interval: 2.0, abilityChance: 0.8 }] },
        { id: 49, reward: 750, groups: [{ enemyId: 'dragonite', count: 5, interval: 4.0, abilityChance: 1.0 }, { enemyId: 'aerodactyl', count: 20, interval: 0.6, abilityChance: 1.0 }] },
        { id: 50, reward: 1200, groups: [{ enemyId: 'arcanine_boss', count: 3, interval: 4.0, abilityChance: 1.0 }, { enemyId: 'venomoth', count: 10, interval: 1.0, abilityChance: 1.0 }] },

        // --- ENDGAME GAUNTLET (51-60) ---
        { id: 51, reward: 800, groups: [{ enemyId: 'machamp', count: 20, interval: 1.2, abilityChance: 0.8 }] },
        { id: 52, reward: 850, groups: [{ enemyId: 'alakazam', count: 20, interval: 1.0, abilityChance: 0.6 }, { enemyId: 'machamp', count: 10, interval: 1.5, abilityChance: 0.8 }] },
        { id: 53, reward: 900, groups: [{ enemyId: 'dragonite', count: 10, interval: 3.0, abilityChance: 1.0 }, { enemyId: 'muk', count: 15, interval: 1.2, abilityChance: 1.0 }] },
        { id: 54, reward: 950, groups: [{ enemyId: 'nidoking', count: 15, interval: 2.0, abilityChance: 0.9 }, { enemyId: 'dragonite', count: 8, interval: 2.5, abilityChance: 1.0 }] },
        { id: 55, reward: 2000, groups: [{ enemyId: 'kangaskhan', count: 1, interval: 10.0, abilityChance: 1.0 }, { enemyId: 'chansey', count: 5, interval: 3.0, abilityChance: 1.0 }] },
        { id: 56, reward: 1100, groups: [{ enemyId: 'gyarados', count: 5, interval: 4.0, abilityChance: 1.0 }, { enemyId: 'dragonite', count: 10, interval: 2.0, abilityChance: 1.0 }] },
        { id: 57, reward: 1200, groups: [{ enemyId: 'snorlax', count: 6, interval: 4.0, abilityChance: 1.0 }, { enemyId: 'slowbro', count: 8, interval: 3.0, abilityChance: 1.0 }] },
        { id: 58, reward: 1300, groups: [{ enemyId: 'cloyster', count: 5, interval: 5.0, abilityChance: 1.0 }, { enemyId: 'nidoking', count: 12, interval: 1.8, abilityChance: 1.0 }] },
        { id: 59, reward: 1500, groups: [{ enemyId: 'dragonite', count: 15, interval: 2.0, abilityChance: 1.0 }, { enemyId: 'gengar_boss', count: 2, interval: 10.0, abilityChance: 1.0 }] },
        { id: 60, reward: 5000, groups: [{ enemyId: 'mewtwo', count: 1, interval: 10.0, abilityChance: 1.0 }, { enemyId: 'dragonite', count: 5, interval: 4.0, abilityChance: 1.0 }] }
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
};