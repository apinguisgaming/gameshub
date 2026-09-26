/**
 * Game Admin, Pro Simulation Suite, & AI Auto-Bot
 */

function calculateTrueTowerCost(t) {
    if (!window._reverseEvoMap) {
        window._reverseEvoMap = {};
        for (const [id, data] of Object.entries(GameData.towers)) {
            if (data.evolution) window._reverseEvoMap[data.evolution.nextTowerId] = id;
        }
    }
    let baseId = t.dataId;
    while (window._reverseEvoMap[baseId]) baseId = window._reverseEvoMap[baseId];
    
    let simId = baseId; 
    let cost = GameData.towers[simId].cost;
    for (let i = 1; i < t.level; i++) { 
        cost += Math.floor(GameData.towers[simId].cost * 0.25 * i); 
        let evo = GameData.towers[simId].evolution; 
        if (evo && (i + 1) >= evo.targetLevel) simId = evo.nextTowerId; 
    }
    if (t.rerollCount) for (let r = 0; r < t.rerollCount; r++) cost += 50 * Math.pow(2, r);
    if (t.heldItem && GameData.items[t.heldItem]) cost += GameData.items[t.heldItem].cost;
    return Math.max(1, cost);
}

class HeadlessGame {
    constructor(realGame, waveIndex, useFixed = false) {
        this.realGame = realGame; this.waveIndex = waveIndex;
        this.towers = []; this.enemies = []; this.projectiles = []; this.zones = [];
        this.money = 0; this.lives = 20; this.terrainLookup = realGame.terrainLookup;
        
        this.waveActive = true; this.currentGroupIndex = 0; this.spawnedInGroup = 0; this.spawnTimer = 0;
        this.simTime = 0; this.towerStats = [];
        this.leakedEnemies = 0; this.leakedLives = 0; this.leakedHp = 0; this.totalSpawned = 0;
        this.leakedEnemyDetails = {};

        realGame.towers.forEach((t, index) => {
            let nat = useFixed ? t.nature : Object.keys(GameData.natures)[Math.floor(Math.random() * Object.keys(GameData.natures).length)];
            let abs = GameData.towers[t.dataId].possibleAbilities || [];
            let slot = useFixed ? t.abilitySlot : (abs.length > 0 ? Math.floor(Math.random() * abs.length) : 0);
            
            const clone = new Tower(this, t.dataId, t.x, t.y, slot, [...t.unlockedMoves], t.currentMoveId, nat);
            clone.level = t.level; clone.heldItem = t.heldItem; clone.targetingPriority = t.targetingPriority;
            clone.calculateStats(); clone.simId = index;
            
            let cost = calculateTrueTowerCost(t);
            
            this.towers.push(clone);
            this.towerStats.push({ name: clone.data.name, level: clone.level, damage: 0, overkill: 0, kills: 0, nature: nat, ability: abs[slot] || 'None', totalCost: cost });
        });
    }

    addFloatingText() {} 
    recalcAllStats() { this.towers.forEach(t => t.calculateStats()); } 
    loseLives(amt) { this.lives -= amt; }
    enemyKilled(enemy, sourceTower) { if (sourceTower && sourceTower.simId !== undefined) this.towerStats[sourceTower.simId].kills++; }
    
    trackDamage(sourceTower, actualHit, overkill) {
        if (sourceTower) {
            if (sourceTower.simId !== undefined) {
                this.towerStats[sourceTower.simId].damage += actualHit;
                this.towerStats[sourceTower.simId].overkill += overkill;
            }
            sourceTower.totalDmgTracked = (sourceTower.totalDmgTracked || 0) + actualHit;
        }
    }

    run() {
        const dt = 0.1; let ticks = 0;
        while (this.waveActive && this.lives > 0 && ticks < 10000) {
            ticks++; this.simTime += dt;
            const wave = GameData.waves[this.waveIndex]; 
            if (!wave) { this.waveActive = false; break; }
            const group = wave.groups[this.currentGroupIndex];
            if (group) {
                this.spawnTimer -= dt; 
                if (this.spawnTimer <= 0 && this.spawnedInGroup < group.count) { 
                    this.enemies.push(new Enemy(this, group.enemyId, group.abilityChance, 0)); 
                    this.spawnedInGroup++; this.totalSpawned++; this.spawnTimer = group.interval; 
                } 
                if (this.spawnedInGroup >= group.count) { this.currentGroupIndex++; this.spawnedInGroup = 0; this.spawnTimer = 0.5; }
            }
            if (this.currentGroupIndex >= wave.groups.length && this.enemies.length === 0) this.waveActive = false;

            this.towers.forEach(t => t.update(dt)); 
            this.enemies.forEach(e => {
                e.update(dt);
                if (!e.alive && e.health > 0) {
                    this.leakedEnemies++; this.leakedLives += 1; this.leakedHp += e.health;
                    this.leakedEnemyDetails[e.dataId] = (this.leakedEnemyDetails[e.dataId] || 0) + 1;
                }
            });
            this.projectiles.forEach(p => p.update(dt)); this.zones.forEach(z => z.update(dt));
            this.enemies = this.enemies.filter(e => e.alive); this.projectiles = this.projectiles.filter(p => p.alive); this.zones = this.zones.filter(z => z.duration > 0);
        }
        return { win: this.lives > 0 && !this.waveActive, lives: this.lives, time: this.simTime, towerStats: this.towerStats, leakedEnemies: this.leakedEnemies, leakedLives: this.leakedLives, leakedHp: this.leakedHp, leakedEnemyDetails: this.leakedEnemyDetails, totalSpawned: this.totalSpawned };
    }
}

const GameAdmin = {
    active: false,
    hyperMode: false,
    mode: 'waypoints',
    waypoints: GameData.mapConfig || [],
    terrainMap: {},
    currentTag: 'land',
    tags: ['water', 'grass', 'land', 'mountain', 'path', 'no_placement'],
    tagColors: { 'land': 'rgba(255, 255, 255, 0.1)', 'water': 'rgba(0, 0, 255, 0.4)', 'grass': 'rgba(0, 255, 0, 0.4)', 'mountain': 'rgba(100, 100, 100, 0.6)', 'path': 'rgba(255, 255, 0, 0.4)', 'no_placement': 'rgba(255, 0, 0, 0.4)' },
    
    killCoords: [], heatmapData: [],
    overlays: { aggro: true, auras: true, kills: true, heatmap: false },
    dummyTimer: 0, densePath: null,

   init(engine) {
        this.engine = engine;
        this.decompressTerrain();
        this.leakHistory = [];
        this.buyHistory = [];
        this.waveDamageHistory = {};
        this.wasWaveActive = false;

        // Hook to track damage strictly per wave
        const origTrackDamage = engine.trackDamage.bind(engine);
        engine.trackDamage = (sourceTower, actualHit, overkill) => {
            if (sourceTower) sourceTower.currentWaveDmg = (sourceTower.currentWaveDmg || 0) + actualHit;
            origTrackDamage(sourceTower, actualHit, overkill);
        };

        // Track specific enemy leaks for balance reporting
        const origEnemyKilled = engine.enemyKilled.bind(engine);
        engine.enemyKilled = (enemy, tower) => {
            if (this.active) this.killCoords.push({ x: enemy.x, y: enemy.y, life: 10.0 });
            origEnemyKilled(enemy, tower);
        };

        const origLoseLives = engine.loseLives.bind(engine);
        engine.loseLives = (amt) => {
            const leaker = engine.enemies.find(e => e.waypointIndex >= e.waypoints.length);
            if (leaker) {
                this.leakHistory.push({
                    name: leaker.data.name, wave: engine.waveIndex + 1,
                    hp: Math.round(leaker.health), maxHp: Math.round(leaker.maxHealth),
                    hpPerc: Math.round((leaker.health / leaker.maxHealth) * 100),
                    ability: leaker.ability || 'None',
                    speed: Math.round(leaker.currentSpeed || leaker.data.spd)
                });
            }
            origLoseLives(amt);
            if (engine.lives <= 0) this.stopAllSimulation("DEFEAT");
        };

        const origUpdate = engine.update.bind(engine);
        engine.update = (dt) => {
            engine.towers.forEach(t => { if (t.placedOnWave === undefined) t.placedOnWave = engine.waveIndex + 1; });
            if (engine.waveIndex >= GameData.waves.length && !engine.waveActive && engine.towers.length > 0) {
                this.stopAllSimulation("VICTORY");
                return;
            }

            const doUpdateStep = (delta) => {
                const wasActive = engine.waveActive;
                const prevWave = engine.waveIndex;
                origUpdate(delta);
                
                // Track Damage summary right on the frame the wave ends
                if (wasActive && !engine.waveActive) {
                    let totalWaveDmg = 0;
                    const dmgByName = {};
                    engine.towers.forEach(t => {
                        const d = t.currentWaveDmg || 0;
                        totalWaveDmg += d;
                        dmgByName[t.data.name] = (dmgByName[t.data.name] || 0) + d;
                        t.currentWaveDmg = 0; // Reset for next wave
                    });

                    const waveRecord = {};
                    if (totalWaveDmg > 0) {
                        Object.keys(dmgByName).forEach(name => {
                            waveRecord[name] = parseFloat(((dmgByName[name] / totalWaveDmg) * 100).toFixed(1));
                        });
                    }
                    this.waveDamageHistory[prevWave + 1] = waveRecord;
                }

                if (this.active) this.update(delta);
                if (this.AutoBot.enabled) this.AutoBot.update(delta, engine);
            };

            if (this.hyperMode && !engine.isPaused) {
                for (let i = 0; i < 10; i++) {
                    doUpdateStep(0.1);
                }
            } else {
                doUpdateStep(dt);
            }
        };

        SimulationMode.init(engine);
        this.injectAdminUI();

        // --- FIXED: CORRECT CALL PATH ---
        if (localStorage.getItem('autoSimActive') === 'true') {
            localStorage.removeItem('autoSimActive'); // Consume the flag
            const botCheck = document.getElementById('admin-autobot-toggle');
            if (botCheck) botCheck.checked = true;
            SimulationMode.runHyperAutoBot(); 
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === '0') {
                this.active = !this.active;
                const dash = document.getElementById('admin-dashboard');
                if (dash) dash.style.display = this.active ? 'block' : 'none';
            }
        });
    },

    update(dt) {
        this.killCoords.forEach(k => k.life -= dt);
        this.killCoords = this.killCoords.filter(k => k.life > 0);
        const dummies = this.engine.enemies.filter(e => e.isDummy);
        if (dummies.length > 0) {
            this.dummyTimer += dt;
            const dps = (dummies[0].maxHealth - dummies[0].health) / Math.max(0.1, this.dummyTimer);
            document.getElementById('admin-dps').innerText = `DPS: ${Math.round(dps)}`;
        }
    },

    stopAllSimulation() {
        this.AutoBot.enabled = false;
        this.hyperMode = false;
        this.engine.timeScale = 1.0;
        const canvas = document.getElementById('game-canvas');
        if (canvas) canvas.style.opacity = '1.0';
        const toggle = document.getElementById('admin-autobot-toggle');
        if (toggle) toggle.checked = false;
    },

    injectStatsIntoUI() {
        const container = document.getElementById('extra-stats-container');
        if (!container) return;

        const btnContainer = container.parentElement.querySelector('div[style*="display:flex"]');
        if (btnContainer && !document.getElementById('copy-json-btn')) {
            // Add NEW AUTOPLAY Button
            const autoBtn = document.createElement('button');
            autoBtn.id = 'new-auto-btn';
            autoBtn.innerText = "NEW AUTOPLAY";
            autoBtn.style.cssText = "flex:1; padding:15px; background:#10b981; color:#fff; border:none; cursor:pointer; font-size:8px; font-family:inherit;";
            autoBtn.onclick = () => { localStorage.setItem('autoSimActive', 'true'); localStorage.setItem('simModePersistent', 'true'); window.game.hardReset(); };
            btnContainer.appendChild(autoBtn);

            // ADD COPY JSON BUTTON
            const copyBtn = document.createElement('button');
            copyBtn.id = 'copy-json-btn';
            copyBtn.innerText = "COPY JSON";
            copyBtn.style.cssText = "flex:1; padding:15px; background:#3b82f6; color:#fff; border:none; cursor:pointer; font-size:8px; font-family:inherit; margin-left:5px;";
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(this.lastReportJSON).then(() => {
                    copyBtn.innerText = "COPIED!";
                    copyBtn.style.background = "#secondary";
                    setTimeout(() => { copyBtn.innerText = "COPY JSON"; copyBtn.style.background = "#3b82f6"; }, 2000);
                });
            };
            btnContainer.appendChild(copyBtn);
        }

        const history = this.leakHistory || [];
        const towerData = this.engine.towers.map(t => {
            let cost = calculateTrueTowerCost(t);
            return { name: t.data.name, lv: t.level, dmg: t.totalDmgTracked || 0, kills: t.totalKillsTracked || 0, eff: ((t.totalDmgTracked || 0) / Math.max(1, cost)).toFixed(2) };
        }).sort((a,b) => b.dmg - a.dmg);

        let leakTimelineHtml = history.length > 0 ? history.map(l => `
            <div style="border-left: 2px solid #ef4444; padding-left: 8px; margin-bottom: 6px; background: rgba(255,0,0,0.1); text-align: left;">
                <span style="color:#f87171;">[WAVE ${l.wave}]</span> <strong>${l.name}</strong><br>
                Leaked: <span style="color:#fbbf24;">${l.hp} HP</span> (${l.hpPerc}%)
            </div>
        `).join('') : '<p style="color:#94a3b8; padding: 10px;">No leaks recorded.</p>';

        container.innerHTML = `
            <div style="text-align:left; font-family: inherit; font-size:7px; line-height:1.4;">
                <h3 style="color:#f87171; border-bottom:1px solid #444; margin: 10px 0 5px 0; font-size:8px; text-align:center;">LEAK TIMELINE</h3>
                <div style="max-height:80px; overflow-y:auto; background:#1a1a1a; border:1px solid #333;">${leakTimelineHtml}</div>
                <h3 style="color:#38bdf8; border-bottom:1px solid #444; margin: 15px 0 5px 0; font-size:8px; text-align:center;">TOWER PERFORMANCE</h3>
                <div style="max-height:100px; overflow-y:auto; background:#1a1a1a; border:1px solid #333; padding: 5px;">
                    ${towerData.map(t => `<div style="border-bottom:1px solid #333; margin-bottom:4px; padding-bottom:2px;"><span style="color:#fbbf24;">${t.name} (Lv.${t.lv})</span><br>Dmg: ${Math.round(t.dmg)} | Kills: ${t.kills}<br>Value: <span style="color:#10b981;">${t.eff} DPD</span></div>`).join('')}
                </div>
            </div>
        `;
    },

    getDensePath() {
        if (this.densePath) return this.densePath;
        this.densePath = [];
        for (let i = 0; i < GameData.mapConfig.length - 1; i++) {
            const start = GameData.mapConfig[i]; const end = GameData.mapConfig[i+1];
            const dist = Math.hypot(end.x - start.x, end.y - start.y);
            for (let d = 0; d < dist; d += 8) {
                this.densePath.push({ x: start.x + (end.x - start.x) * (d / dist), y: start.y + (end.y - start.y) * (d / dist) });
            }
        }
        return this.densePath;
    },

    evaluateTile(tower, px, py) {
        if (!this.engine.checkPlacement(tower.dataId, px, py)) return -1;
        const origTerrain = tower.terrain; 
        const origStats = Object.assign({}, tower.computedStats); // Lightweight shallow clone
        
        tower.terrain = this.engine.getTerrainAt(px, py);
        tower.calculateStats();
        
        const path = this.getDensePath();
        let coverage = 0;
        const rangeSq = tower.computedStats.range * tower.computedStats.range;
        for(let p of path) if (((p.x - px)**2 + (p.y - py)**2) <= rangeSq) coverage++;
        
        const move = GameData.moves[tower.currentMoveId] || { power: 10, category: 'physical' };
        const L = tower.level, P = move.power || 10;
        const A = move.category === 'special' ? tower.computedStats.spatk : tower.computedStats.atk;
        const damage = tower.computedStats.damage || 1;
        const spd = tower.computedStats.spd || 1;

        // 1. Calculate Standard Power
        const basePowerPerHit = ((2 * L / 5 + 2) * P * (A / 50)) / 2;
        
        // 2. Account for CRIT (Average Damage Multiplier)
        // Formula: 1 + (Chance * (Multiplier - 1))
        const avgCritMult = 1 + (tower.computedStats.critChance * (tower.computedStats.critMultiplier - 1));
        
        // 3. Account for AOE (Multi-target potential)
        // We assume AOE hits ~2.5 targets on average for splash/chaining
        let aoeMult = 1.0;
        if (tower.computedStats.chainCount > 0) aoeMult += (tower.computedStats.chainCount * 0.8); // 80% efficiency per extra chain
        if (tower.computedStats.splashRadius > 0) aoeMult += (tower.computedStats.splashRadius / 40); // Scaling splash value

        const score = coverage * basePowerPerHit * spd * damage * avgCritMult * aoeMult;
        
        tower.terrain = origTerrain; tower.computedStats = origStats;
        return score;
    },

    getBestTile(tower) {
        const gridSize = GameData.config.gridSize;
        const cols = Math.floor(GameData.config.mapWidth / gridSize); const rows = Math.floor(GameData.config.mapHeight / gridSize);
        let bestScore = -1, bestTile = null;

        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                const px = x * gridSize + (gridSize / 2); const py = y * gridSize + (gridSize / 2);
                const score = this.evaluateTile(tower, px, py);
                if (score > bestScore) {
                    bestScore = score;
                    bestTile = { x: px, y: py, terrain: this.engine.getTerrainAt(px, py), score: score };
                }
            }
        }
        return bestTile;
    },

    logAutoPlayData(status) {
        const teamData = this.engine.towers.map(t => {
            let cost = calculateTrueTowerCost(t);
            
            let pathProgress = 0;
            const path = this.getDensePath();
            let minD = Infinity;
            path.forEach((p, idx) => {
                let d = Math.hypot(p.x - t.x, p.y - t.y);
                if (d < minD) { minD = d; pathProgress = (idx / path.length * 100).toFixed(1); }
            });

            let roundsOnField = Math.max(1, (this.engine.waveIndex + 1) - (t.placedOnWave || 1) + 1);
            let dmgPerRound = Math.round((t.totalDmgTracked || 0) / roundsOnField);

            return {
                pokemon: t.data.name, level: t.level, nature: t.nature,
                ability: t.abilities[0], item: t.heldItem || 'none',
                move: t.currentMoveId, totalDamage: Math.round(t.totalDmgTracked || 0),
                damagePerRound: dmgPerRound, roundsOnField: roundsOnField,
                pathPlacementPercent: parseFloat(pathProgress),
                totalKills: t.totalKillsTracked || 0,
                efficiencyDPD: parseFloat(((t.totalDmgTracked || 0) / Math.max(1, cost)).toFixed(2))
            };
        });

        const categorizedPurchases = { hired: [], upgrades: [], items: [], rerolls: [] };
        this.buyHistory.forEach(b => {
            if (b.type === 'starter_choice' || b.type === 'buy') {
                categorizedPurchases.hired.push({ wave: b.wave, unit: b.target, cost: b.cost });
            } else if (b.type === 'upgrade') {
                categorizedPurchases.upgrades.push({ wave: b.wave, unit: b.target, cost: b.cost });
            } else if (b.type === 'item') {
                categorizedPurchases.items.push({ wave: b.wave, owner: b.owner, item: b.target, cost: b.cost });
            } else if (b.type.startsWith('reroll')) {
                categorizedPurchases.rerolls.push({ wave: b.wave, unit: b.target, cost: b.cost, rerollType: b.type });
            }
        });

        const leakTable = {
            columns: ["name", "wave", "hp", "maxHp", "hpPerc", "ability", "speed"],
            data: this.leakHistory.map(l => [l.name, l.wave, l.hp, l.maxHp, l.hpPerc, l.ability, l.speed])
        };

        const report = {
            timestamp: new Date().toISOString(),
            result: status,
            finalWave: this.engine.waveIndex + 1,
            remainingMoney: Math.floor(this.engine.money),
            teamRoster: teamData,
            leaks: leakTable,
            purchases: categorizedPurchases,
            waveDamageSummary: this.waveDamageHistory
        };

        this.lastReportJSON = JSON.stringify(report);
        console.log("AUTOPLAY_REPORT_DATA:" + this.lastReportJSON);
    },

    // --- AUTO-BOT WITH SMART ECONOMY ---
    AutoBot: {
        enabled: false, timer: 0,
        
        update(dt, engine) {
            if (!this.enabled) return;
            this.timer -= dt;
            
            // 1. MODAL HANDLING (Always check this regardless of timer for instant picking)
            const starterModal = document.getElementById('starter-modal');
            if (starterModal && !starterModal.classList.contains('hidden')) {
                const cards = document.querySelectorAll('.starter-card');
                if (cards.length > 0) {
                    const rnd = Math.floor(Math.random() * cards.length);
                    const starterName = GameData.towers[GameData.config.starterIds[rnd]].name;
                    GameAdmin.buyHistory.push({ wave: 0, type: 'starter_choice', target: starterName, cost: 0 }); // <--- ADD THIS
                    cards[rnd].click(); 
                    engine.updateTeamList();
                }
                return;
            }

            if (this.timer > 0) return;
            this.timer = 0.5;

            // 2. Tactical Move Optimization
            GameAdmin.AutoBot.optimizeMoves(engine);

            // 3. Placement (Check Bench -> Place on Best Tile)
            if (engine.bench.length > 0 && engine.towers.length < 6) {
                const t = engine.bench[0];
                const best = GameAdmin.getBestTile(t);
                if (best) {
                    t.x = best.x; t.y = best.y; t.terrain = best.terrain;
                    t.calculateStats(); 
                    engine.towers.push(t); 
                    engine.bench.shift(); 
                    engine.recalcAllStats();
                    engine.updateTeamList();
                } else { 
                    engine.bench.shift(); 
                }
                return;
            }

            // 4. Economy & Upgrades
            let actionTaken = false;
            if (!actionTaken) actionTaken = GameAdmin.AutoBot.trySmartEconomy(engine);
            if (!actionTaken && engine.money > 2000) actionTaken = GameAdmin.AutoBot.tryRerolls(engine);

            // 5. Start Wave
            if (!engine.waveActive && engine.towers.length > 0) {
                const startBtn = document.getElementById('start-wave-btn');
                if (startBtn) startBtn.click();
            }
        },


         // FILE: game-admin.js
// ACTION: REPLACE
// TARGET: The entire trySmartEconomy function inside GameAdmin.AutoBot

        trySmartEconomy(engine) {
            const towers = engine.towers;
            const buyCost = engine.getRandomBuyPrice();
            const curWaveIdx = engine.waveIndex;
            const wave = GameData.waves[curWaveIdx];
            if (!wave) return false;

            // --- 1. WAVE THREAT ANALYSIS ---
            let totalEnemyCount = 0;
            let maxEnemyHp = 0;
            let waveStats = { avgSpeed: 0, avgDef: 0, avgSpDef: 0 };
            
            wave.groups.forEach(g => {
                const e = GameData.enemies[g.enemyId];
                if (!e) return;
                totalEnemyCount += g.count;
                if (e.hp > maxEnemyHp) maxEnemyHp = e.hp;
                waveStats.avgSpeed += (e.spd || 50) * g.count;
                waveStats.avgDef += (e.def || 10) * g.count;
                waveStats.avgSpDef += (e.spDef || 10) * g.count;
            });
            waveStats.avgSpeed /= Math.max(1, totalEnemyCount);
            waveStats.avgDef /= Math.max(1, totalEnemyCount);
            waveStats.avgSpDef /= Math.max(1, totalEnemyCount);

            // --- 2. TEAM CAPABILITY ANALYSIS ---
            let team = { aoeScore: 0, bossDps: 0 };
            towers.forEach(t => {
                const stats = t.computedStats;
                team.aoeScore += (stats.chainCount || 0) + (stats.splashRadius / 32);
                team.bossDps += (stats.atk + stats.spatk) * stats.spd * (1 + stats.critChance * (stats.critMultiplier - 1));
            });

            let actionsTaken = 0;
            while (actionsTaken < 5 && engine.money > 0) {
                let potentialActions = [];

                // --- 3. EVALUATE BUYING NEW TOWER (ROI = Power / Cost) ---
                if (towers.length < 6) {
                    const dummy = new Tower(engine, 'pikachu', 0, 0); 
                    const bestTile = GameAdmin.getBestTile(dummy);
                    if (bestTile) {
                        let buySynergy = (towers.length < 3) ? 3.0 : 1.0;
                        potentialActions.push({ type: 'buy', cost: buyCost, roi: (bestTile.score * buySynergy) / buyCost });
                    }
                }

                // --- 4. EVALUATE UPGRADES & ITEMS ---
                for (let t of towers) {
                    const upgradeCost = t.getUpgradeCost();
                    const stats = t.computedStats;
                    const currentPower = GameAdmin.evaluateTile(t, t.x, t.y);

                    // A. Upgrade Evaluation (ROI = PowerGain / Cost)
                    t.level++; t.calculateStats();
                    const nextPower = GameAdmin.evaluateTile(t, t.x, t.y);
                    t.level--; t.calculateStats(); // Reset
                    potentialActions.push({ type: 'upgrade', target: t, cost: upgradeCost, roi: (nextPower - currentPower) / upgradeCost });

                    // B. Item Evaluation
                    if (!t.heldItem) {
                        for (const [itemId, itemData] of Object.entries(GameData.items)) {
                            if (itemData.type !== 'equip') continue;

                            t.heldItem = itemId; t.calculateStats();
                            const itemPower = GameAdmin.evaluateTile(t, t.x, t.y);
                            t.heldItem = null; t.calculateStats(); // Reset

                            // --- STRATEGIC SYNERGY ---
                            let synergy = 1.0;
                            const effs = itemData.effects || [];
                            const isAoeItem = effs.some(e => e.stat === 'chainCount' || e.stat === 'splashRadius');
                            const isCritItem = effs.some(e => e.stat === 'critChance');
                            const isSpeedItem = effs.some(e => e.stat === 'spd');
                            const isHugePower = effs.some(e => e.stat === 'damage' && e.value >= 1.5);

                            // AOE Utility: Need splash for swarms?
                            if (isAoeItem) {
                                const neededAoe = totalEnemyCount / 12;
                                synergy *= (team.aoeScore < neededAoe) ? 4.0 : 0.3;
                            }

                            // Speed Utility: Procs & Catching Fast Targets
                            if (isSpeedItem) {
                                // If unit has Status Effects (Burn/Poison/Para), Quick Claw is 3x more valuable
                                if (stats.burnChance > 0 || stats.paralyzeChance > 0 || stats.poisonChance > 0) synergy *= 3.0;
                                // If wave is fast, we need high fire rate
                                if (waveStats.avgSpeed > 90) synergy *= 1.8;
                                // Don't put speed items on already very fast units (diminishing returns)
                                if (stats.spd > 2.0) synergy *= 0.5;
                            }

                            // Boss Killing Utility
                            if (isCritItem || isHugePower) {
                                if (maxEnemyHp > 400) synergy *= 2.0;
                                // If unit is slow, raw damage is better than more speed
                                if (stats.spd < 1.0) synergy *= 1.5;
                            }

                            // Calculate FINAL ROI: (Power Gained * Strategy) / Price
                            const powerGain = itemPower - currentPower;
                            const finalRoi = (powerGain * synergy) / itemData.cost;

                            potentialActions.push({ type: 'item', target: t, itemId, cost: itemData.cost, roi: finalRoi });
                        }
                    }
                }

                potentialActions.sort((a, b) => b.roi - a.roi);
                const best = potentialActions[0];

                if (best && best.roi > 0 && engine.money >= best.cost) {
                    if (best.type === 'upgrade') {
                        engine.money -= best.cost; best.target.levelUp();
                        GameAdmin.buyHistory.push({ wave: curWaveIdx+1, type: 'upgrade', target: best.target.data.name, cost: best.cost });
                    } else if (best.type === 'item') {
                        engine.money -= best.cost;
                        engine.inventory[best.itemId] = (engine.inventory[best.itemId] || 0) + 1;
                        engine.inventory[best.itemId]--;
                        best.target.equipItem(best.itemId);
                        GameAdmin.buyHistory.push({ wave: curWaveIdx+1, type: 'item', target: best.itemId, owner: best.target.data.name, cost: best.cost });
                    } else if (best.type === 'buy') {
                        engine.buyPokemon(null, true);
                        const newUnit = engine.bench[engine.bench.length-1];
                        GameAdmin.buyHistory.push({ wave: curWaveIdx+1, type: 'buy', target: newUnit.data.name, cost: best.cost });
                    }
                    actionsTaken++;
                    // Recalculate team stats after an action to influence next choice in the same "while" loop
                    team.aoeScore = 0; team.bossDps = 0;
                    towers.forEach(t => {
                        const s = t.computedStats;
                        team.aoeScore += (s.chainCount || 0) + (s.splashRadius / 32);
                        team.bossDps += (s.atk + s.spatk) * s.spd * (1 + s.critChance * (s.critMultiplier - 1));
                    });
                } else break;
            }
            return actionsTaken > 0;
        },

        tryRerolls(engine) {
            const carries = engine.towers.filter(t => t.level >= 5);
            const curWave = engine.waveIndex + 1;
            for (let t of carries) {
                const cost = 50 * Math.pow(2, t.rerollCount || 0);
                if (engine.money < cost || cost > engine.money * 0.15) continue;
                const analysis = GameAdmin.AutoBot.isConfigurationBad(t);
                if (analysis.badNature) { 
                    engine.rerollTower('nature'); 
                    GameAdmin.buyHistory.push({ wave: curWave, type: 'reroll_nature', target: t.data.name, cost });
                    return true; 
                }
                if (analysis.badAbility) { 
                    engine.rerollTower('ability'); 
                    GameAdmin.buyHistory.push({ wave: curWave, type: 'reroll_ability', target: t.data.name, cost });
                    return true; 
                }
            }
            return false;
        },

        optimizeMoves(engine) {
            const wave = GameData.waves[engine.waveIndex];
            if (!wave) return;
            let avgDef = 0, avgSpDef = 0, totalEnemies = 0, waveImmunities = new Set();
            wave.groups.forEach(g => {
                const e = GameData.enemies[g.enemyId]; if (!e) return;
                avgDef += (e.def || 10) * g.count; avgSpDef += (e.spDef || 10) * g.count; totalEnemies += g.count;
                if (e.immunities) e.immunities.forEach(imm => waveImmunities.add(imm));
            });
            if (totalEnemies > 0) { avgDef /= totalEnemies; avgSpDef /= totalEnemies; }
            
            engine.towers.forEach(t => {
                let bestMoveId = t.currentMoveId, bestScore = -1;
                t.unlockedMoves.forEach(mId => {
                    const m = GameData.moves[mId]; if (!m) return;
                    if (m.tags && m.tags.some(tag => waveImmunities.has(tag))) return;
                    const isSpec = m.category === 'special';
                    const relAtk = isSpec ? t.computedStats.spatk : t.computedStats.atk;
                    const relDef = isSpec ? avgSpDef : avgDef;
                    const stab = t.data.tags && t.data.tags.some(tag => m.tags && m.tags.includes(tag)) ? 1.5 : 1.0;
                    const score = (m.power * relAtk * stab / Math.max(1, relDef)) * (m.speedModifier || 1.0) * (m.attackType !== 'single' ? 1.3 : 1.0);
                    if (score > bestScore) { bestScore = score; bestMoveId = mId; }
                });
                if (t.currentMoveId !== bestMoveId) { 
                    t.currentMoveId = bestMoveId; t.calculateStats(); 
                    engine.addFloatingText(t.x, t.y - 10, `MOVE: ${GameData.moves[bestMoveId].name}`, "#38bdf8", 0.5);
                }
            });
        },

        tryRerolls(engine) {
            const carries = engine.towers.filter(t => t.level >= 5);
            for (let t of carries) {
                const cost = 50 * Math.pow(2, t.rerollCount || 0);
                if (engine.money < cost || cost > engine.money * 0.15) continue;
                const analysis = this.isConfigurationBad(t);
                if (analysis.badNature) { engine.rerollTower('nature'); return true; }
                if (analysis.badAbility) { engine.rerollTower('ability'); return true; }
            }
            return false;
        },

        isConfigurationBad(t) {
            const nData = GameData.natures[t.nature];
            const isPhys = t.data.baseStats.atk > t.data.baseStats.spatk;
            const isSpec = t.data.baseStats.spatk > t.data.baseStats.atk;
            let badNature = (isPhys && nData.atk < 1.0) || (isSpec && nData.spatk < 1.0);
           let badAbility = false;
            const possible = t.data.possibleAbilities || [];
            if (possible.length > 1) {
                const terrainAb = possible.find(aId => {
                    const ab = GameData.towerAbilities[aId];
                    if (!ab || !ab.effects) return false;
                    return ab.effects.some(eff => eff.condition?.type === 'terrain' && eff.condition?.value === t.terrain);
                });
                if (terrainAb && t.abilities[0] !== terrainAb) badAbility = true;
            }
            return { badNature, badAbility };
        }
    },
    
    stopAllSimulation(reason) {
        this.engine.isPaused = true; 
        this.AutoBot.enabled = false;
        this.hyperMode = false;
        this.engine.timeScale = 1.0;
        
        const canvas = document.getElementById('game-canvas');
        if (canvas) canvas.style.opacity = '1.0';
        
        const toggle = document.getElementById('admin-autobot-toggle');
        if (toggle) toggle.checked = false;

        // --- NEW: LOG DATA TO CONSOLE ---
        this.logAutoPlayData(reason);

        if (!document.getElementById('game-over-overlay')) {
            this.engine.showGameOverUI(reason);
        }
    },

    // Update showGameOverSummary to support Victory
    showGameOverSummary(reason = "DEFEAT") {
        const engine = this.engine;
        const isWin = reason === "VICTORY";
        
        const towerData = engine.towers.map(t => {
            let cost = calculateTrueTowerCost(t);
            return {
                name: t.data.name, level: t.level, item: t.heldItem ? GameData.items[t.heldItem].name : 'None',
                move: GameData.moves[t.currentMoveId]?.name || 'Unknown',
                dmg: t.totalDmgTracked || 0, kills: t.totalKillsTracked || 0,
                efficiency: ((t.totalDmgTracked || 0) / cost).toFixed(2)
            };
        });

        const topLeaks = Object.entries(this.leakStats)
            .sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([id, count]) => `${GameData.enemies[id]?.name || id} (${count})`).join(', ');

        const summary = document.createElement('div');
        summary.id = 'end-game-summary-overlay';
        summary.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:500px; background:#111; border:4px solid ${isWin ? '#10b981' : '#ef4444'}; padding:20px; color:#fff; z-index:20000; box-shadow:0 0 50px #000; font-size:8px; line-height:1.6;`;
        
        let towerListHtml = towerData.sort((a,b) => b.dmg - a.dmg).map(t => 
            `<div style="margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">
                <strong style="color:#fbbf24;">${t.name} (Lv.${t.level})</strong> - ${t.move}<br>
                <span>Damage: ${Math.round(t.dmg)} | Kills: ${t.kills} | Efficiency: ${t.efficiency} DPD</span><br>
                <span style="color:#94a3b8; font-size:6px;">Item: ${t.item}</span>
            </div>`
        ).join('');

        summary.innerHTML = `
            <h2 style="color:${isWin ? '#10b981' : '#ef4444'}; text-align:center; font-size:14px; margin-bottom:15px;">${reason} SUMMARY</h2>
            <div style="background:#222; padding:10px; border:1px solid #444; margin-bottom:15px;">
                <strong style="color:${isWin ? '#34d399' : '#f87171'};">${isWin ? 'CHAMPION RESULTS:' : 'WHY YOU LOST:'}</strong><br>
                <span>${isWin ? 'Total Money Farmed: <span style="color:#facc15">$' + Math.floor(engine.money) + '</span>' : 'The biggest threats were: <span style="color:#fff;">' + (topLeaks || "None") + '</span>'}</span>
            </div>
            <div style="max-height:250px; overflow-y:auto;">${towerListHtml}</div>
            <div style="display:flex; gap:10px;">
                <button onclick="location.reload()" class="big-btn" style="margin-top:20px; background:#444; flex:1;">EXIT TO MENU</button>
                <button onclick="this.parentElement.parentElement.remove(); window.game.isPaused = false;" class="big-btn" style="margin-top:20px; background:${isWin ? '#10b981' : '#ef4444'}; flex:2;">RE-EXAMINE BOARD</button>
            </div>
        `;
        document.body.appendChild(summary);
    },

    showGameOverSummary() {
        const engine = this.engine;
        const towerData = engine.towers.map(t => {
            let cost = calculateTrueTowerCost(t);
            return {
                name: t.data.name, level: t.level, item: t.heldItem ? GameData.items[t.heldItem].name : 'None',
                move: GameData.moves[t.currentMoveId]?.name || 'Unknown',
                dmg: t.totalDmgTracked || 0, kills: t.totalKillsTracked || 0,
                efficiency: ((t.totalDmgTracked || 0) / cost).toFixed(2)
            };
        });

        const topLeaks = Object.entries(this.leakStats)
            .sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([id, count]) => `${GameData.enemies[id]?.name || id} (${count})`).join(', ');

        const summary = document.createElement('div');
        summary.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:500px; background:#111; border:4px solid #ef4444; padding:20px; color:#fff; z-index:20000; box-shadow:0 0 50px #000; font-size:8px; line-height:1.6;';
        
        let towerListHtml = towerData.sort((a,b) => b.dmg - a.dmg).map(t => 
            `<div style="margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">
                <strong style="color:#fbbf24;">${t.name} (Lv.${t.level})</strong> - ${t.move}<br>
                <span>Damage: ${Math.round(t.dmg)} | Kills: ${t.kills} | Efficiency: ${t.efficiency} DPD</span><br>
                <span style="color:#94a3b8; font-size:6px;">Item: ${t.item}</span>
            </div>`
        ).join('');

        summary.innerHTML = `
            <h2 style="color:#ef4444; text-align:center; font-size:14px; margin-bottom:15px;">DEFEAT SUMMARY</h2>
            <div style="background:#222; padding:10px; border:1px solid #444; margin-bottom:15px;">
                <strong style="color:#f87171;">WHY YOU LOST:</strong><br>
                <span>The biggest threats were: <span style="color:#fff;">${topLeaks || "Unknown"}</span></span><br>
                <p style="margin-top:5px; font-size:7px; color:#94a3b8;">Tip: If efficiency is low, consider different items or move categories (Physical vs Special).</p>
            </div>
            <div style="max-height:250px; overflow-y:auto;">${towerListHtml}</div>
            <button onclick="location.reload()" class="big-btn" style="margin-top:20px; background:#ef4444; border-color:#991b1b;">RESTART MISSION</button>
        `;
        document.body.appendChild(summary);
    },

    injectAdminUI() {
        const ui = document.createElement('div'); ui.id = 'admin-dashboard';
        ui.style.cssText = 'position:fixed; top:10px; right:320px; width:340px; background:#111; border:2px solid #facc15; z-index:10000; color:#fff; padding:10px; font-size:8px; display:none; max-height: 95vh; overflow-y:auto; box-shadow: 4px 4px 0 #000;';
        ui.innerHTML = `
            <h2 style="color:#facc15; margin-bottom:10px; font-size:10px;">🛠 ADMIN DASHBOARD</h2>
            <div style="margin-bottom:10px; border:1px solid #333; padding:6px; background:#1e1b4b;">
                <h3 style="color:#a78bfa; margin-bottom:6px;">🤖 AUTO-BOT AI</h3>
                <label style="font-size:8px; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="admin-autobot-toggle"> ENABLE AI PLAYER
                </label>
                <p style="font-size:6px; margin-top:4px; color:#c4b5fd;">Bot will intelligently place towers on ideal tiles, farm waves, buy randoms, level up, and equip items automatically.</p>
            </div>
            <div style="margin-bottom:10px; border:1px solid #333; padding:6px;">
                <h3 style="color:#38bdf8; margin-bottom:6px;">Visual Overlays</h3>
                <label><input type="checkbox" checked onchange="GameAdmin.overlays.aggro = this.checked"> Aggro Lines</label><br>
                <label><input type="checkbox" checked onchange="GameAdmin.overlays.auras = this.checked"> Aura Ranges</label><br>
                <label><input type="checkbox" checked onchange="GameAdmin.overlays.kills = this.checked"> Kill Heatmap</label>
            </div>
            <div style="margin-bottom:10px; border:1px solid #333; padding:6px;">
                <h3 style="color:#22c55e; margin-bottom:6px;">Sandbox Tools</h3>
                <button class="small-btn" onclick="GameAdmin.spawnDummy()">Spawn Dummy (Infinite HP)</button>
                <button class="small-btn" onclick="GameAdmin.clearEnemies()">Clear Enemies</button>
                <div id="admin-dps" style="margin-top:4px; color:#facc15;">DPS: 0</div>
            </div>
        `;
        document.body.appendChild(ui);
        document.getElementById('admin-autobot-toggle').addEventListener('change', (e) => { GameAdmin.AutoBot.enabled = e.target.checked; });
    },
    spawnDummy() {
        let e = new Enemy(this.engine, 'snorlax', 0, 0, 100);
        e.isDummy = true; e.maxHealth = 9999999; e.health = 9999999; e.data.spd = 0; e.speedScale = 0;
        e.x = this.engine.mousePos.x || this.waypoints[0].x; e.y = this.engine.mousePos.y || this.waypoints[0].y;
        this.engine.enemies.push(e); this.dummyTimer = 0;
    },
    clearEnemies() { this.engine.enemies = []; this.killCoords = []; },
    decompressTerrain() {
        const raw = GameData.terrainMap; if (!raw) return;
        if (typeof Object.values(raw)[0] === 'string') { this.terrainMap = { ...raw }; return; }
        this.terrainMap = {};
        for (const [tag, rects] of Object.entries(raw)) {
            for (const [tx, ty, tw, th] of rects) {
                for (let x = tx; x < tx + tw; x++) {
                    for (let y = ty; y < ty + th; y++) { this.terrainMap[`${x},${y}`] = tag; }
                }
            }
        }
    },
    handleInput(e, isClick) {
        if (!this.active) return;
        const rect = this.engine.canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
        if (this.mode === 'waypoints' && isClick && e.ctrlKey) this.waypoints.push({ x: Math.round(x), y: Math.round(y) });
        if (this.mode === 'grid' && (isClick || e.shiftKey)) {
            const gridSize = GameData.config.gridSize;
            const key = `${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`;
            if (this.currentTag) this.terrainMap[key] = this.currentTag; else delete this.terrainMap[key];
        }
    },
    exportData() { alert("Use console to view exported compact map data."); },
    
    draw(ctx) {
        if (!this.active) return;
        const gridSize = GameData.config.gridSize; ctx.save();
        
        if (this.overlays.heatmap && this.heatmapData.length > 0) {
            this.heatmapData.forEach(h => {
                if (h.val < 0) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // Unplaceable
                } else {
                    let r = h.val < 0.5 ? 255 : Math.floor(255 * (1 - h.val) * 2);
                    let g = h.val > 0.5 ? 255 : Math.floor(255 * h.val * 2);
                    ctx.fillStyle = h.val > 0.95 ? `rgba(255, 255, 255, 0.8)` : `rgba(${r}, ${g}, 0, 0.5)`;
                }
                ctx.fillRect(h.x, h.y, gridSize, gridSize);
            });
        } else {
            for (const [key, tag] of Object.entries(this.terrainMap)) {
                const [col, row] = key.split(',').map(Number);
                ctx.fillStyle = this.tagColors[tag]; ctx.fillRect(col * gridSize, row * gridSize, gridSize, gridSize);
            }
        }

        if (this.overlays.auras) {
            this.engine.towers.forEach(t => {
                if(t.abilities && (t.abilities.includes('intimidate') || t.abilities.includes('battery'))) {
                    ctx.beginPath(); ctx.arc(t.x, t.y, t.computedStats.range, 0, Math.PI*2);
                    ctx.fillStyle = t.abilities.includes('intimidate') ? 'rgba(255,0,0,0.1)' : 'rgba(0,255,0,0.1)';
                    ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
                }
            });
        }

        if (this.overlays.aggro) {
            ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
            this.engine.towers.forEach(t => {
                const target = t.findTarget();
                if (target) { ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(target.x, target.y); ctx.stroke(); }
            });
            ctx.setLineDash([]);
        }

        if (this.overlays.kills) {
            this.killCoords.forEach(k => {
                ctx.beginPath(); ctx.arc(k.x, k.y, 8, 0, Math.PI*2);
                ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.8, k.life / 10)})`;
                ctx.fill();
            });
        }

        ctx.restore();
    }
};

const SimulationMode = {
    enabled: false,
    init(engine) {
        this.engine = engine;
        const settingsTab = document.getElementById('tab-settings');
        if (settingsTab) {
            const isEnabled = localStorage.getItem('simModePersistent') === 'true';
            this.enabled = isEnabled;

            const toggleDiv = document.createElement('div');
            toggleDiv.innerHTML = `<label style="font-size:8px; color:#fbbf24; display:flex; align-items:center; gap:4px; margin-top:15px; border-top:1px solid #333; padding-top:10px; cursor:pointer;"><input type="checkbox" id="sim-mode-toggle" ${isEnabled ? 'checked' : ''}> ENABLE PRO SIMULATION</label>`;
            settingsTab.appendChild(toggleDiv);

            document.getElementById('sim-mode-toggle').addEventListener('change', (e) => { 
                this.enabled = e.target.checked; 
                localStorage.setItem('simModePersistent', this.enabled);
                this.toggleUI(); 
            });
            
            // Apply UI state immediately on load
            if (this.enabled) this.toggleUI();
        }
    },

    generateHeuristicHeatmap() {
        const t = this.engine.selectedTower; if (!t) return;
        GameAdmin.heatmapData = []; GameAdmin.overlays.heatmap = true; GameAdmin.active = true;
        
        const resultsDiv = document.getElementById('sim-results');
        if (!resultsDiv) return;
        resultsDiv.innerHTML = `<div style="color:#fbbf24;">Running Terrain-Aware Heuristic...</div>`;
        
        setTimeout(() => {
            const gridSize = GameData.config.gridSize;
            const cols = GameData.config.mapWidth / gridSize; const rows = GameData.config.mapHeight / gridSize;
            let bestScore = 0; let topSpot = null;

            for(let x = 0; x < cols; x++) {
                for(let y = 0; y < rows; y++) {
                    const px = x * gridSize + (gridSize/2); const py = y * gridSize + (gridSize/2);
                    const score = GameAdmin.evaluateTile(t, px, py);
                    if (score > bestScore) { bestScore = score; topSpot = { x: px, y: py }; }
                    GameAdmin.heatmapData.push({ x: px - (gridSize/2), y: py - (gridSize/2), val: score });
                }
            }
            GameAdmin.heatmapData.forEach(h => {
                if (h.val >= 0) h.val = h.val / Math.max(1, bestScore);
            });
            
            if (topSpot) {
                resultsDiv.innerHTML = `
                    <h3 style="color:#10b981">HEATMAP COMPLETE (Instant)</h3>
                    <div style="background:#111; padding:8px; border:1px solid #333; margin-bottom:8px;">
                        <span style="color:#10b981;">BEST TILE:</span> ${Math.round(topSpot.x)}, ${Math.round(topSpot.y)}<br>
                        <p style="font-size:6px; margin-top:4px; color:#94a3b8;">Accounts for Terrain Abilities (Swift Swim, etc.) and Path Coverage.</p>
                    </div>
                    <button class="small-btn" style="background:#ef4444; width:100%;" onclick="GameAdmin.overlays.heatmap = false; document.getElementById('sim-results').innerHTML = '';">Clear Heatmap</button>
                `;
            }
        }, 10);
    },

    // UI-Linked Hyper Speed Auto-Bot
    runHyperAutoBot() {
        GameAdmin.buyHistory = []; 
        GameAdmin.leakHistory = [];
        GameAdmin.waveDamageHistory = {};
        
        // 1. Only reset if the game is at the very beginning and no pokemon are owned
        if (this.engine.towers.length === 0 && this.engine.bench.length === 0) {
            this.engine.money = GameData.config.startingMoney;
            this.engine.lives = GameData.config.startingLives;
            this.engine.waveIndex = 0;
            this.engine.inventory = {};
            this.engine.buyCount = 0;
            this.engine.showStarterSelection();
        }

        this.engine.waveActive = false;
        this.engine.isPaused = false;
        this.leakStats = {};

        // 2. Refresh UI to reflect current state
        this.engine.updateHUD();
        this.engine.updateTeamList();
        this.engine.updateInventoryView();

        // 3. Enable AI Logic and Hyper-Speed
        const canvas = document.getElementById('game-canvas');
        if (canvas) canvas.style.opacity = '0.1';
        GameAdmin.AutoBot.enabled = true;
        GameAdmin.hyperMode = true; 

        document.getElementById('sim-results').innerHTML = `<h3 style="color:#10b981">HYPER-AI RUNNING...</h3><p style="color:#94a3b8">The AI is now managing your existing team at high speed.</p>`;
    },

    toggleUI() {
        const shopBtn = document.querySelector('[data-tab="tab-shop"]');
        const shopTab = document.getElementById('tab-shop');
        
        if (!document.getElementById('sim-section')) {
            const waveOptions = GameData.waves.map((w, i) => `<option value="${i}">Wave ${i+1}</option>`).join('');
            
            const simSec = document.createElement('div');
            simSec.id = 'sim-section';
            simSec.className = 'hidden';
            simSec.innerHTML = `
                <h2>Simulation Analytics</h2>
                <div class="form-group" style="margin-bottom: 12px;">
                    <label style="font-size:8px;">Target Wave:</label>
                    <select id="sim-wave" style="width:100%; padding:6px; background:#000; color:#fff; border: 2px solid #333;">${waveOptions}</select>
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                    <label style="font-size:8px;">Iterations:</label>
                    <select id="sim-iters" style="width:100%; padding:6px; background:#000; color:#fff; border: 2px solid #333;">
                        <option value="1">1 Run</option>
                        <option value="10" selected>10 Runs</option>
                        <option value="100">100 Runs</option>
                    </select>
                </div>
                <button id="run-sim-btn" class="big-btn" style="background: #8b5cf6; border-color: #6d28d9; margin-bottom:6px;">Run Headless Sim</button>
                <button id="run-ai-btn" class="big-btn" style="background: #10b981; border-color: #047857; margin-bottom:6px;">UI-Linked Hyper Auto-Play (Visual)</button>
                <button id="run-heatmap-btn" class="big-btn" style="background: #059669; border-color: #047857;">Generate Pro Heatmap</button>
                <div id="sim-results" style="margin-top: 20px; font-size: 8px; line-height: 1.5; color: #cbd5e1;"></div>
            `;
            shopTab.appendChild(simSec);
            document.getElementById('run-sim-btn').addEventListener('click', () => this.runSimulations());
            document.getElementById('run-ai-btn').addEventListener('click', () => this.runHyperAutoBot());
            document.getElementById('run-heatmap-btn').addEventListener('click', () => {
                if (!this.engine.selectedTower) return alert("Select a placed Pokémon first!");
                this.generateHeuristicHeatmap();
            });
        }

        if (this.enabled) {
            shopBtn.innerText = 'SIMULATE';
            shopBtn.style.color = '#fbbf24';
            Array.from(shopTab.children).forEach(c => {
                if (c.id !== 'sim-section') c.classList.add('hidden');
            });
            document.getElementById('sim-section').classList.remove('hidden');
        } else {
            shopBtn.innerText = 'Shop';
            shopBtn.style.color = '';
            Array.from(shopTab.children).forEach(c => {
                if (c.id !== 'sim-section') c.classList.remove('hidden');
            });
            document.getElementById('sim-section').classList.add('hidden');
        }
    },

    runSimulations() {
        if (this.engine.towers.length === 0) return alert("Place a Pokémon.");
        const btn = document.getElementById('run-sim-btn'); const resultsDiv = document.getElementById('sim-results');
        btn.innerText = "Simulating..."; resultsDiv.innerHTML = "";
        
        setTimeout(() => {
            const waveIdx = parseInt(document.getElementById('sim-wave').value);
            const iters = parseInt(document.getElementById('sim-iters').value);
            
            let wins = 0; let totalLives = 0; let totalTime = 0; let totalLeakedEnemies = 0; 
            let totalLivesLost = 0; let totalLeakedHp = 0; let totalEnemiesSpawned = 0;
            let enemyLeakAgg = {};
            
            let aggregatedStats = this.engine.towers.map(t => ({ 
                name: t.data.name, level: t.level, dmg: 0, overkill: 0, kills: 0, totalCost: 0, natureLeaks: {}, abilityLeaks: {} 
            }));

            const startTime = performance.now();
             for (let i = 0; i < iters; i++) {
                const sim = new HeadlessGame(this.engine, waveIdx, true);
                const result = sim.run();
                if (result.win) wins++;
                totalLives += result.lives; totalTime += result.time; totalLeakedEnemies += result.leakedEnemies; 
                totalLivesLost += result.leakedLives; totalLeakedHp += result.leakedHp; totalEnemiesSpawned += result.totalSpawned;
                
                Object.entries(result.leakedEnemyDetails).forEach(([id, count]) => { enemyLeakAgg[id] = (enemyLeakAgg[id] || 0) + count; });
                
                result.towerStats.forEach((ts, idx) => {
                    let agg = aggregatedStats[idx];
                    agg.dmg += ts.damage; agg.overkill += ts.overkill; agg.kills += ts.kills; agg.totalCost = ts.totalCost;
                });
            }

            const winRate = ((wins / iters) * 100).toFixed(1);
            let enemyLeakStr = Object.entries(enemyLeakAgg).sort((a, b) => b[1] - a[1]).map(([id, count]) => `${GameData.enemies[id]?.name || id} (${count})`).join(', ') || 'None';

            let towerBlocksHtml = aggregatedStats.map((ast, i) => {
                const avgDmg = ast.dmg / iters; const avgOverkill = ast.overkill / iters;
                const dpd = (avgDmg / ast.totalCost).toFixed(2);
                const overkillPerc = avgDmg > 0 ? ((avgOverkill / (avgDmg + avgOverkill)) * 100).toFixed(1) : 0;
                return `
                    <div style="background:#1e1e28; border:1px solid #333; padding: 6px; margin-bottom: 6px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                            <strong style="color:#fff;">${i+1}. ${ast.name}</strong>
                            <span style="color:#10b981;">Dmg: ${Math.round(avgDmg)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:#94a3b8;">
                            <span>DPD (Value): ${dpd}</span>
                            <span style="color:#f43f5e;">Overkill: ${Math.round(avgOverkill)} (${overkillPerc}%)</span>
                        </div>
                    </div>
                `;
            }).join('');

            resultsDiv.innerHTML = `
                <h3 style="color:#3b82f6; margin-bottom:8px;">RESULTS (${iters} runs in ${Math.round(performance.now() - startTime)}ms)</h3>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 7px;">
                    <div style="background:#1e1e28; padding:8px; border:1px solid #333;">
                        <div style="color:#94a3b8; margin-bottom: 2px;">Win Rate</div><div style="font-size:10px; color:${winRate >= 80 ? '#10b981' : '#ef4444'}">${winRate}%</div>
                    </div>
                    <div style="background:#1e1e28; padding:8px; border:1px solid #333;">
                        <div style="color:#94a3b8; margin-bottom: 2px;">Avg Lives Left</div><div style="font-size:10px; color:#f43f5e">${(totalLives / iters).toFixed(1)}</div>
                    </div>
                </div>
                <div style="background:#3f1414; border:1px solid #ef4444; padding: 8px; margin-bottom: 12px; font-size: 7px;">
                    <strong style="color:#ef4444; display:block; margin-bottom:4px;">LEAK PROFILER</strong>
                    <span style="color:#f8fafc;">Total Leaked: <span style="color:#fbbf24;">${totalLeakedEnemies}</span> / ${totalEnemiesSpawned}</span><br>
                    <span style="color:#94a3b8; font-style: italic;">Problematic Targets:</span> <span style="color:#fca5a5;">${enemyLeakStr}</span>
                </div>
                <h3 style="color:#94a3b8; margin-bottom:4px; font-size:7px;">TOWER DIAGNOSTICS</h3>
                ${towerBlocksHtml}
            `;
            btn.innerText = "Run Headless Sim";
        }, 10);
    }
};