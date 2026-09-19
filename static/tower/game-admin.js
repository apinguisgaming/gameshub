/**
 * Game Admin Mode - Grid & Waypoint Editor
 */

const GameAdmin = {
    active: false, 
    mode: 'waypoints', 
    waypoints: GameData.mapConfig || [],
    terrainMap: {}, 
    
    currentTag: 'land',
    tags: ['water', 'grass', 'land', 'mountain', 'path', 'no_placement'],
    tagColors: {
        'land': 'rgba(255, 255, 255, 0.1)',
        'water': 'rgba(0, 0, 255, 0.4)',
        'grass': 'rgba(0, 255, 0, 0.4)',
        'mountain': 'rgba(100, 100, 100, 0.6)',
        'path': 'rgba(255, 255, 0, 0.4)',
        'no_placement': 'rgba(255, 0, 0, 0.4)'
    },

    init(engine) {
        this.engine = engine;
        this.decompressTerrain();
        SimulationMode.init(engine);

        window.addEventListener('keydown', (e) => {
            const key = e.key;
            if (key === '0') {
                this.active = !this.active;
                console.log("Admin Mode:", this.active ? "ON" : "OFF");
                return;
            }
            if (!this.active) return;
            const lKey = key.toLowerCase();
            if (lKey === '1') { this.mode = 'waypoints'; console.log("Mode: Waypoints"); }
            if (lKey === '2') { this.mode = 'grid'; console.log("Mode: Grid"); }
            if (lKey === 'w') this.currentTag = 'water';
            if (lKey === 'g') this.currentTag = 'grass';
            if (lKey === 'l') this.currentTag = 'land';
            if (lKey === 'm') this.currentTag = 'mountain';
            if (lKey === 'p') this.currentTag = 'path';
            if (lKey === 'n') this.currentTag = 'no_placement';
            if (lKey === 'x') this.currentTag = null;
            if (lKey === 'c' && this.mode === 'waypoints') { this.waypoints = []; console.log("Waypoints cleared."); }
            if (lKey === 'e') this.exportData();
        });
        
        this.engine.canvas.addEventListener('mousedown', (e) => this.handleInput(e, true));
        this.engine.canvas.addEventListener('mousemove', (e) => this.handleInput(e, false));
    },

    decompressTerrain() {
        const raw = GameData.terrainMap;
        if (!raw) return;
        if (typeof Object.values(raw)[0] === 'string') {
            this.terrainMap = { ...raw }; return;
        }
        this.terrainMap = {};
        for (const [tag, rects] of Object.entries(raw)) {
            for (const [tx, ty, tw, th] of rects) {
                for (let x = tx; x < tx + tw; x++) {
                    for (let y = ty; y < ty + th; y++) {
                        this.terrainMap[`${x},${y}`] = tag;
                    }
                }
            }
        }
    },

    handleInput(e, isClick) {
        if (!this.active) return;
        const rect = this.engine.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (this.mode === 'waypoints' && isClick && e.ctrlKey) {
            this.waypoints.push({ x: Math.round(x), y: Math.round(y) });
        }
        if (this.mode === 'grid' && (isClick || e.shiftKey)) {
            const gridSize = GameData.config.gridSize;
            const col = Math.floor(x / gridSize);
            const row = Math.floor(y / gridSize);
            const key = `${col},${row}`;
            if (this.currentTag) this.terrainMap[key] = this.currentTag;
            else delete this.terrainMap[key];
        }
    },

    exportData() {
        const compact = this.compressTerrain();
        console.log("--- COMPACT EXPORT ---");
        console.log("Waypoints:", JSON.stringify(this.waypoints, null, 2));
        
        // Custom stringify for terrainMap to keep [x,y,w,h] on one line
        let output = "{\n";
        const tags = Object.keys(compact);
        tags.forEach((tag, idx) => {
            output += `  "${tag}": [\n`;
            compact[tag].forEach((rect, ridx) => {
                output += `    ${JSON.stringify(rect)}${ridx < compact[tag].length - 1 ? "," : ""}\n`;
            });
            output += `  ]${idx < tags.length - 1 ? "," : ""}\n`;
        });
        output += "}";
        
        console.log("Terrain (Compact):", output);
        alert("Compact data exported to console!");
    },

    compressTerrain() {
        const compact = {};
        const visited = new Set();
        const cols = Math.ceil(this.engine.canvas.width / GameData.config.gridSize);
        const rows = Math.ceil(this.engine.canvas.height / GameData.config.gridSize);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const key = `${x},${y}`;
                const tag = this.terrainMap[key];
                if (tag && !visited.has(key)) {
                    let width = 0;
                    while (x + width < cols && this.terrainMap[`${x + width},${y}`] === tag && !visited.has(`${x + width},${y}`)) { width++; }
                    let height = 1;
                    while (y + height < rows) {
                        let rowMatch = true;
                        for (let k = 0; k < width; k++) {
                            if (this.terrainMap[`${x + k},${y + height}`] !== tag || visited.has(`${x + k},${y + height}`)) { rowMatch = false; break; }
                        }
                        if (rowMatch) height++; else break;
                    }
                    for (let h = 0; h < height; h++) { for (let w = 0; w < width; w++) { visited.add(`${x + w},${y + h}`); } }
                    if (!compact[tag]) compact[tag] = [];
                    compact[tag].push([x, y, width, height]);
                }
            }
        }
        return compact;
    },

    draw(ctx) {
        if (!this.active) return;
        const gridSize = GameData.config.gridSize;
        ctx.save();
        for (const [key, tag] of Object.entries(this.terrainMap)) {
            const [col, row] = key.split(',').map(Number);
            ctx.fillStyle = this.tagColors[tag];
            ctx.fillRect(col * gridSize, row * gridSize, gridSize, gridSize);
        }
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, 0, 200, 80);
        ctx.fillStyle = "white";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(`Mode: ${this.mode.toUpperCase()}`, 10, 25);
        ctx.fillText(`Brush: ${this.currentTag || 'Eraser'}`, 10, 45);
        ctx.fillText(`Press 'E' to Export`, 10, 65);
        ctx.restore();
    }
};

/**
 * High-Performance Headless Engine for Monte Carlo simulations.
 * Strips all UI/Rendering logic to run combat calculations instantly.
 */
class HeadlessGame {
    constructor(realGame, waveIndex, useFixed = false) {
        this.realGame = realGame;
        this.waveIndex = waveIndex;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.zones = [];
        this.money = 0;
        this.lives = 20;
        this.terrainLookup = realGame.terrainLookup;
        
        this.waveActive = true;
        this.currentGroupIndex = 0;
        this.spawnedInGroup = 0;
        this.spawnTimer = 0;
        this.simTime = 0;
        this.towerStats = [];
         this.leakedEnemies = 0;
        this.leakedLives = 0; // The actual game-over metric
        this.leakedHp = 0;    // Remaining health (for balance tuning)
        this.totalSpawned = 0;

        // Clone active towers with randomized variables
        realGame.towers.forEach((t, index) => {
            let natureToUse, abilitySlotToUse, abilityNameToUse;

            if (useFixed) {
                natureToUse = t.nature;
                // AbilitySlot was stored on the tower, or we find it in possibleAbilities
                abilitySlotToUse = t.abilitySlot || 0;
                abilityNameToUse = t.abilities[0] || 'None';
            } else {
                const natureKeys = Object.keys(GameData.natures);
                natureToUse = natureKeys[Math.floor(Math.random() * natureKeys.length)];
                const possibleAbs = GameData.towers[t.dataId].possibleAbilities || [];
                abilitySlotToUse = possibleAbs.length > 0 ? Math.floor(Math.random() * possibleAbs.length) : 0;
                abilityNameToUse = possibleAbs.length > 0 ? possibleAbs[abilitySlotToUse] : 'None';
            }

            const clone = new Tower(this, t.dataId, t.x, t.y, abilitySlotToUse, [...t.unlockedMoves], t.currentMoveId, natureToUse);
            clone.level = t.level;
            clone.heldItem = t.heldItem;
            clone.targetingPriority = t.targetingPriority;
            clone.calculateStats();
            clone.simId = index;
            
            this.towers.push(clone);
            this.towerStats.push({ 
                name: clone.data.name, level: clone.level, 
                damage: 0, overkill: 0, kills: 0, 
                nature: natureToUse, ability: abilityNameToUse 
            });
        });
        
        this.leakedEnemyDetails = {}; // Tracks which specific enemies leaked
    }

    // Duck-typed Engine Methods
    addFloatingText() {} 
    recalcAllStats() { this.towers.forEach(t => t.calculateStats()); }
    loseLives(amt) { this.lives -= amt; }
    
    enemyKilled(enemy, sourceTower) {
        if (sourceTower && sourceTower.simId !== undefined) {
            this.towerStats[sourceTower.simId].kills++;
        }
    }
    
    trackDamage(sourceTower, actualHit, overkill) {
        if (sourceTower && sourceTower.simId !== undefined) {
            this.towerStats[sourceTower.simId].damage += actualHit;
            this.towerStats[sourceTower.simId].overkill += overkill;
        }
    }

    run() {
        const dt = 0.1; // 100ms per simulated tick
        let ticks = 0;
        
        while (this.waveActive && this.lives > 0 && ticks < 5000) { // Max 500 seconds simulation limit
            ticks++;
            this.simTime += dt;
            
            // Spawning Logic
            const wave = GameData.waves[this.waveIndex];
            const group = wave.groups[this.currentGroupIndex];
            if (group) {
                this.spawnTimer -= dt; 
                if (this.spawnTimer <= 0 && this.spawnedInGroup < group.count) { 
                    // Simulator doesn't need real bounties, pass 0
                    this.enemies.push(new Enemy(this, group.enemyId, group.abilityChance, 0)); 
                    this.spawnedInGroup++;
                    this.totalSpawned++;
                    this.spawnTimer = group.interval; 
                } 
                if (this.spawnedInGroup >= group.count) {
                    this.currentGroupIndex++;
                    this.spawnedInGroup = 0;
                    this.spawnTimer = 0.5;
                }
            }
            if (this.currentGroupIndex >= wave.groups.length && this.enemies.length === 0) { 
                this.waveActive = false;
            }

            // Entity Updates
            // Entity Updates
            this.towers.forEach(t => t.update(dt)); 
            
            // Track leaks before cleaning
            this.enemies.forEach(e => {
                e.update(dt);
                if (!e.alive && e.health > 0) {
                    this.leakedEnemies++;
                    this.leakedLives += 1; // 1 leak = 1 life lost
                    this.leakedHp += e.health;
                    this.leakedEnemyDetails[e.dataId] = (this.leakedEnemyDetails[e.dataId] || 0) + 1;
                }
            });
            
            this.projectiles.forEach(p => p.update(dt)); 
            this.zones.forEach(z => z.update(dt));
            
            // Clean dead entities
            this.enemies = this.enemies.filter(e => e.alive); 
            this.projectiles = this.projectiles.filter(p => p.alive); 
            this.zones = this.zones.filter(z => z.duration > 0);
        }

        return {
            win: this.lives > 0 && !this.waveActive,
            lives: this.lives,
            time: this.simTime,
            towerStats: this.towerStats,
             leakedEnemies: this.leakedEnemies,
            leakedLives: this.leakedLives,
            leakedHp: this.leakedHp,
            leakedEnemyDetails: this.leakedEnemyDetails,
            totalSpawned: this.totalSpawned
        };
    }
}

const SimulationMode = {
    enabled: false,
    
    init(engine) {
        this.engine = engine;
        
        // Inject toggle into Settings tab dynamically
        const settingsTab = document.getElementById('tab-settings');
        if (settingsTab) {
            const toggleDiv = document.createElement('div');
            toggleDiv.innerHTML = `
                <label style="font-size: 8px; color: #fbbf24; display: flex; align-items: center; gap: 4px; margin-top: 15px; border-top: 1px solid #333; padding-top: 10px; cursor: pointer;">
                    <input type="checkbox" id="sim-mode-toggle"> ENABLE PRO SIMULATION
                </label>
                <p style="font-size: 6px; color: #94a3b8; margin-top: 4px;">Replaces the Shop with a High-Speed Analytics Simulator.</p>
            `;
            settingsTab.appendChild(toggleDiv);

            document.getElementById('sim-mode-toggle').addEventListener('change', (e) => {
                this.enabled = e.target.checked;
                this.toggleUI();
            });
        }
    },

    injectEditorTools() {
        const abContainer = document.getElementById('inspect-abilities-container');
        if (!abContainer || !window.game.selectedTower) return;
        
        const t = window.game.selectedTower;
        const possibleAbs = t.data.possibleAbilities || [];

        let editorHtml = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #64748b;">
            <strong style="color: #fbbf24; font-size: 8px;">SIM EDITOR OVERRIDES</strong>
            <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 6px; color: #94a3b8;">Nature:</label>
                <select id="sim-edit-nature" style="background: #000; color: #fff; border: 1px solid #333; font-size: 7px; padding: 2px;">
                    ${Object.keys(GameData.natures).map(n => `<option value="${n}" ${t.nature === n ? 'selected' : ''}>${n.toUpperCase()}</option>`).join('')}
                </select>
                <label style="font-size: 6px; color: #94a3b8; margin-top: 4px;">Ability:</label>
                <select id="sim-edit-ability" style="background: #000; color: #fff; border: 1px solid #333; font-size: 7px; padding: 2px;">
                    ${possibleAbs.map((a, idx) => `<option value="${idx}" ${t.abilitySlot === idx ? 'selected' : ''}>${GameData.towerAbilities[a]?.name || a}</option>`).join('')}
                </select>
            </div>
        </div>`;

        abContainer.innerHTML += editorHtml;

        document.getElementById('sim-edit-nature').addEventListener('change', (e) => {
            t.nature = e.target.value;
            t.calculateStats();
            window.game.updateInspector();
        });

        document.getElementById('sim-edit-ability').addEventListener('change', (e) => {
            t.abilitySlot = parseInt(e.target.value);
            t.setData(t.dataId); // Rebuilds the `t.abilities` array
            window.game.updateInspector();
        });
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
                        <option value="1">1 Run (Quick Sanity Check)</option>
                        <option value="10" selected>10 Runs (Standard Variance)</option>
                        <option value="100">100 Runs (Deep Monte Carlo)</option>
                        <option value="1000">1000 Runs (Extreme Stress Test)</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="font-size: 7px; color: #fbbf24; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                        <input type="checkbox" id="sim-use-fixed"> USE LIVE NATURES/ABILITIES
                    </label>
                    <p style="font-size: 5px; color: #64748b; margin-top: 2px;">(Uncheck to randomize per run to find build vulnerabilities)</p>
                </div>
                <button id="run-sim-btn" class="big-btn" style="background: #8b5cf6; border-color: #6d28d9;">Run Simulation</button>
                <div id="sim-results" style="margin-top: 20px; font-size: 8px; line-height: 1.5; color: #cbd5e1;"></div>
            `;
            shopTab.appendChild(simSec);
            document.getElementById('run-sim-btn').addEventListener('click', () => this.runSimulations());
        }

        if (this.enabled) {
            shopBtn.innerText = 'SIMULATE';
            shopBtn.style.color = '#fbbf24';
            Array.from(shopTab.children).forEach(c => { if (c.id !== 'sim-section') c.classList.add('hidden'); });
            document.getElementById('sim-section').classList.remove('hidden');
        } else {
            shopBtn.innerText = 'Shop';
            shopBtn.style.color = '';
            Array.from(shopTab.children).forEach(c => { if (c.id !== 'sim-section') c.classList.remove('hidden'); });
            document.getElementById('sim-section').classList.add('hidden');
        }
    },

    runSimulations() {
        if (window.game.towers.length === 0) {
            alert("Place at least one Pokémon on the map to run a simulation.");
            return;
        }

        const btn = document.getElementById('run-sim-btn');
        const resultsDiv = document.getElementById('sim-results');
        btn.innerText = "Simulating...";
        resultsDiv.innerHTML = "";
        
        // Small timeout to allow the UI to update to "Simulating..." before blocking the main thread
        setTimeout(() => {
            const waveIdx = parseInt(document.getElementById('sim-wave').value);
            const iters = parseInt(document.getElementById('sim-iters').value);
            const useFixed = document.getElementById('sim-use-fixed').checked;
            
            let wins = 0;  let totalLives = 0; let totalTime = 0;
            let totalLeakedEnemies = 0; 
            let totalLivesLost = 0; 
            let totalLeakedHp = 0;
            let totalEnemiesSpawned = 0;
            
            let enemyLeakAgg = {}; // Which enemies escaped the most
            
            // Advanced Tower Aggregation
            let aggregatedStats = window.game.towers.map(t => ({ 
                name: t.data.name, level: t.level, 
                dmg: 0, overkill: 0, kills: 0,
                natureLeaks: {}, abilityLeaks: {} 
            }));

            const startTime = performance.now();

             for (let i = 0; i < iters; i++) {
                const sim = new HeadlessGame(window.game, waveIdx, useFixed);
                const result = sim.run();
                
                if (result.win) wins++;
                totalLives += result.lives; totalTime += result.time;
                totalLeakedEnemies += result.leakedEnemies; 
                totalLivesLost += result.leakedLives;
                totalLeakedHp += result.leakedHp;
                totalEnemiesSpawned += result.totalSpawned;
                
                // Aggregate leaked enemy types
                Object.entries(result.leakedEnemyDetails).forEach(([id, count]) => {
                    enemyLeakAgg[id] = (enemyLeakAgg[id] || 0) + count;
                });
                
                // Aggregate tower performance and configuration blame
                result.towerStats.forEach((ts, idx) => {
                    let agg = aggregatedStats[idx];
                    agg.dmg += ts.damage;
                    agg.overkill += ts.overkill;
                    agg.kills += ts.kills;
                    
                    // Correlate leaked HP with the rolled Nature
                    if (!agg.natureLeaks[ts.nature]) agg.natureLeaks[ts.nature] = { runs: 0, leakHp: 0 };
                    agg.natureLeaks[ts.nature].runs++;
                    agg.natureLeaks[ts.nature].leakHp += result.leakedHp;

                    // Correlate leaked HP with the rolled Ability
                    if (!agg.abilityLeaks[ts.ability]) agg.abilityLeaks[ts.ability] = { runs: 0, leakHp: 0 };
                    agg.abilityLeaks[ts.ability].runs++;
                    agg.abilityLeaks[ts.ability].leakHp += result.leakedHp;
                });
            }

            const elapsedMs = performance.now() - startTime;
            const winRate = ((wins / iters) * 100).toFixed(1);
            
            // Formatting Enemy Leaks
            let enemyLeakStr = Object.entries(enemyLeakAgg)
                .sort((a, b) => b[1] - a[1])
                .map(([id, count]) => `${GameData.enemies[id]?.name || id} (${count})`)
                .join(', ') || 'None';

            // Find MVP (Most Dmg) and LVP (Least Dmg)
            let sortedByDmg = [...aggregatedStats].sort((a, b) => b.dmg - a.dmg);
            const mvp = sortedByDmg[0];
            const lvp = sortedByDmg[sortedByDmg.length - 1];

            // Build detailed tower blocks
            let towerBlocksHtml = aggregatedStats.map((ast, i) => {
                // Find worst nature (highest avg leak)
                let worstNature = Object.entries(ast.natureLeaks)
                    .map(([nat, data]) => ({ name: nat, avg: data.runs > 0 ? data.leakHp / data.runs : 0 }))
                    .sort((a, b) => b.avg - a.avg)[0];
                
                // Find worst ability (highest avg leak)
                let worstAbility = Object.entries(ast.abilityLeaks)
                    .map(([ab, data]) => ({ name: ab, avg: data.runs > 0 ? data.leakHp / data.runs : 0 }))
                    .sort((a, b) => b.avg - a.avg)[0];

                const avgDmg = ast.dmg / iters;
                const avgOverkill = ast.overkill / iters;
                const overkillPerc = avgDmg > 0 ? ((avgOverkill / (avgDmg + avgOverkill)) * 100).toFixed(1) : 0;

                return `
                    <div style="background:#1e1e28; border:1px solid #333; padding: 6px; margin-bottom: 6px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                            <strong style="color:#fff;">${i+1}. ${ast.name} <span style="color:#64748b">(Lv.${ast.level})</span></strong>
                            <span style="color:#10b981;">Dmg: ${Math.round(avgDmg)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:#94a3b8;">
                            <span>Kills: ${(ast.kills/iters).toFixed(1)}</span>
                            <span style="color:#f43f5e;" title="Damage wasted on dying enemies">Overkill: ${Math.round(avgOverkill)} (${overkillPerc}%)</span>
                        </div>
                        <div style="margin-top:4px; padding-top:4px; border-top:1px dashed #333; color:#a1a1aa;">
                            <span style="color:#fbbf24">Worst Nature:</span> ${worstNature ? worstNature.name.toUpperCase() : 'N/A'} <span style="color:#64748b">(Avg Leak: ${Math.round(worstNature?.avg||0)} HP)</span><br>
                            <span style="color:#c084fc">Worst Ability:</span> ${worstAbility ? worstAbility.name : 'N/A'} <span style="color:#64748b">(Avg Leak: ${Math.round(worstAbility?.avg||0)} HP)</span>
                        </div>
                    </div>
                `;
            }).join('');

            resultsDiv.innerHTML = `
                <h3 style="color:#3b82f6; margin-bottom:8px;">RESULTS (${iters} runs in ${Math.round(elapsedMs)}ms)</h3>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 7px;">
                    <div style="background:#1e1e28; padding:8px; border:1px solid #333;">
                        <div style="color:#94a3b8; margin-bottom: 2px;">Win Rate</div>
                        <div style="font-size:10px; color:${winRate >= 80 ? '#10b981' : (winRate >= 50 ? '#facc15' : '#ef4444')}">${winRate}%</div>
                    </div>
                    <div style="background:#1e1e28; padding:8px; border:1px solid #333;">
                        <div style="color:#94a3b8; margin-bottom: 2px;">Avg Lives Left</div>
                        <div style="font-size:10px; color:#f43f5e">${(totalLives / iters).toFixed(1)}</div>
                    </div>
                    <div style="background:#1e1e28; padding:8px; border:1px solid #333;">
                        <div style="color:#94a3b8; margin-bottom: 2px;">MVP (Highest Dmg)</div>
                        <div style="font-size:10px; color:#facc15">${mvp.name}</div>
                    </div>
                    <div style="background:#1e1e28; padding:8px; border:1px solid #333;">
                        <div style="color:#94a3b8; margin-bottom: 2px;">LVP (Lowest Dmg)</div>
                        <div style="font-size:10px; color:#ef4444">${lvp.name}</div>
                    </div>
                </div>

                <div style="background:#3f1414; border:1px solid #ef4444; padding: 8px; margin-bottom: 12px; font-size: 7px;">
                    <strong style="color:#ef4444; display:block; margin-bottom:4px;">LEAK PROFILER (Simulation Totals)</strong>
                    <span style="color:#f8fafc; display:block; margin-bottom:2px;">Total Leaked: <span style="color:#fbbf24;">${totalLeakedEnemies}</span> / ${totalEnemiesSpawned} enemies</span>
                    <span style="color:#f8fafc; display:block; margin-bottom:6px;">Player Lives Lost: <span style="color:#fbbf24;">${totalLivesLost}</span> <span style="color:#64748b;">(1 per leak)</span></span>
                    
                    <strong style="color:#10b981; display:block; margin-bottom:4px; border-top: 1px solid #631c1c; padding-top: 6px;">AVERAGE PER WAVE (Individual Run)</strong>
                    <span style="color:#f8fafc; display:block; margin-bottom:2px;">Avg Leaks: <span style="color:#fbbf24;">${(totalLeakedEnemies / iters).toFixed(2)}</span> per run</span>
                    <span style="color:#f8fafc; display:block; margin-bottom:2px;">Avg HP Remaining: <span style="color:#fbbf24;">${(totalLeakedHp / totalLeakedEnemies || 0).toFixed(1)} HP</span> per leak</span>

                    <span style="color:#94a3b8; display:block; margin-top:6px; font-style: italic;">Problematic Targets:</span>
                    <span style="color:#fca5a5;">${enemyLeakStr}</span>
                </div>

                <h3 style="color:#94a3b8; margin-bottom:4px; font-size:7px;">TOWER PERFORMANCE DIAGNOSTICS</h3>
                ${towerBlocksHtml}
            `;
            
            btn.innerText = "Run Simulation";
        }, 10);
    }
};
