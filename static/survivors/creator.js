/**
 * Gothic Survivors - Data Generator Engine
 */

const GAME_GRAPHICS = {};
const WEAPON_LEVEL_UP_SCALING = { flatDmg: 2, cooldown: 0.03, speed: 0.1, area: 0.15, amountInterval: 2, pierceInterval: 3 };
const SOUL_CONDUCTOR_RATES = { killsPerStack: 100, damagePerStack: [0.005, 0.008, 0.010, 0.0115, 0.0125] };
const GAME_DATA = {
    weapons: {
        'wand': {
            name: 'Magic Wand', type: 'projectile',
            svg: `<svg viewBox="0 0 24 24"><path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM21 3l-1.5.8L18 2l.8 1.5L18 5l1.5-.8L21 5l-.8-1.5zm-8 9.5L5 20.5 3.5 19 11.5 11 13 12.5z" fill="#4da6ff"/></svg>`,
            description: "Fires magic missiles at the nearest enemies.",
            attacks: [{
                id: 'main_shot',
                stats: { baseDmg: 1, baseCd: 1.0, baseSpd: 500, baseRange: 1600, basePierce: 0, kb: 150 },
                targeting: 'nearest',
                actions: [{
                    type: 'fireProjectile', sound: 'wand', delayBetweenShots: 100,
                    projectile: {
                        r: 8,
                        visual: { type: 'procedural', key: 'wand_missile' },
                        movement: { type: 'linear' },
                        destroyOnHit: true,
                        handlers: [{
                            trigger: { conditions: [{ type: 'onHit' }] },
                            effects: [
                                { type: 'dealDamage', damages: 'enemy' },
                                { type: 'applyStatus', status: 'bleed' },
                            ]
                        }, {
                            trigger: { conditions: [{ type: 'onTargetKill' }] },
                            effects: [
                                {
                                    type: 'spawnEffect',
                                    position: 'target',
                                    visual: { key: 'electric_nova_draw', duration: 0.6, animation: { type: 'scaleIn', duration: 0.15 } },
                                    behavior: { type: 'instantArea', excludeInitialTarget: true, radius: 60, onHitEffects: [{ type: 'dealDamage', damages: 'enemy' }] }
                                }
                            ]
                        }]
                    }
                }]
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
                actions: [{
                    type: 'lobProjectile', sound: 'axe', lobType: 'directional', spreadVelocity: 200,
                    projectile: {
                        r: 15,
                        clearHitListPeriodically: 0.1,
                        visual: { type: 'procedural', key: 'axe' },
                        movement: { type: 'arc', gravity: 1400 },
                        components: [{ type: 'rotation', speed: 10 }],
                        handlers: [{ trigger: { conditions: [{ type: 'onHit' }] }, effects: [{ type: 'dealDamage', damages: 'enemy' }, { type: 'applyStatus', status: 'bleed' }] }]
                    }
                }]
            }]
        }
    },
    passives: [
        { id: 'might', name: 'Gauntlet', desc: '+10% Damage', mods: [{ stat: 'might', op: 'add', value: 0.1 }], svg: `<svg/>` },
        { id: 'cd', name: 'Empty Tome', desc: '-8% Cooldown', mods: [{ stat: 'cooldown', op: 'mul', value: 0.92 }], svg: `<svg/>` }
    ],
    enemies: {
        'bat': { r: 10, hp: 5, speed: 120, dmg: 5, xp: 1, visual: { key: 'bat_draw' }, handlers: [ { trigger: { conditions: [{ type: 'onDeath' }] }, effects: [{ type: 'spawnEffect', behavior: { type: 'particleEmitter' } }] } ] },
        'zombie': { r: 12, hp: 15, speed: 80, dmg: 8, xp: 2, visual: { key: 'zombie_draw' } }
    },
};

// 1. UI SCHEMAS
const UI_SCHEMAS = {
    effects: {
        dealDamage: [ { key: 'damages', label: 'Target Faction', type: 'select', options: ['enemy', 'player'] }, { key: 'multiplier', label: 'Damage Multiplier', type: 'number', placeholder: '1.0', step: 0.1 } ],
        applyStatus: [ { key: 'status', label: 'Status to Apply', type: 'select', options: ['bleed', 'chill', 'curse'] }, { key: 'amount', label: 'Amount (for Chill)', type: 'number', placeholder: '0.1', step: 0.1 }, { key: 'duration', label: 'Duration (s)', type: 'number', placeholder: '3', step: 0.1 } ],
        spawnEffect: [ { key: 'position', label: 'Position', type: 'select', options: ['target', 'source', 'player'] } ],
        spawnEnemy: [ { key: 'key', label: 'Enemy Key', type: 'text', placeholder: 'miniSlime' }, { key: 'count', label: 'Count', type: 'number', placeholder: '2' }, { key: 'spread', label: 'Spread Radius', type: 'number', placeholder: '5' } ],
        pullTarget: [ { key: 'force', label: 'Force', type: 'number', placeholder: '500', tooltip: "Strength of the pull. Negative numbers push away." } ],
        heal: [ { key: 'on', label: 'Heal Target', type: 'select', options: ['player', 'source', 'target'] }, { key: 'amount', label: 'Flat Heal Amount', type: 'number', placeholder: '10' }, { key: 'percent', label: 'Percent Heal Amount', type: 'number', placeholder: '0.3', step: 0.1 } ],
        costPlayerHealth: [ { key: 'amount', label: 'HP Cost', type: 'number', placeholder: '1' } ],
        setFlag: [ { key: 'key', label: 'Flag Key', type: 'text', placeholder: 'isInvulnerable' }, { key: 'value', label: 'Flag Value', type: 'select', options: [true, false] }, { key: 'duration', label: 'Duration (s)', type: 'number', placeholder: '0.35', step: 0.1 } ],
        dash: [ { key: 'speed', label: 'Dash Speed', type: 'number', placeholder: '500' }, { key: 'duration', label: 'Dash Duration (s)', type: 'number', placeholder: '0.35', step: 0.1 } ],
        shieldAlliesInRange: [ { key: 'range', label: 'Range', type: 'number', placeholder: '200' }, { key: 'duration', label: 'Shield Duration (s)', type: 'number', placeholder: '5', step: 0.1 } ],
        fireProjectiles: [ { key: 'pattern', label: 'Pattern', type: 'select', options: ['radial'] }, { key: 'count', label: 'Count', type: 'number', placeholder: '12' }, { key: 'projectileStats', label: 'Projectile Stats (JSON)', type: 'textarea', placeholder: `{ "speed": 150, "duration": 8 }` }, { key: 'projectile', label: 'Projectile Definition (JSON)', type: 'textarea', placeholder: `{ "r": 8, ... }` } ]
    },
    effectBehaviors: {
        instantArea: [ { key: 'radius', label: 'Radius', type: 'number', placeholder: '60' }, { key: 'excludeInitialTarget', label: 'Exclude Initial Target', type: 'boolean' } ],
        chain: [ { key: 'damageFalloff', label: 'Damage Falloff', type: 'number', placeholder: '0.3', step: 0.1 }, { key: 'searchRadius', label: 'Search Radius', type: 'number', placeholder: '250' } ],
        groundEffect: [ { key: 'radius', label: 'Radius', type: 'number', placeholder: '60' }, { key: 'duration', label: 'Duration (s)', type: 'number', placeholder: '3.0', step: 0.1 }, { key: 'tickRate', label: 'Tick Rate (s)', type: 'number', placeholder: '0.5', step: 0.1 } ],
        particleEmitter: [ { key: 'particle', label: 'Particle Config (JSON)', type: 'textarea', placeholder: `{ "count": 8, "color": "#555", ... }` } ],
        visualOnly: [ { key: 'radius', label: 'Radius', type: 'number', placeholder: '80' }, { key: 'duration', label: 'Duration (s)', type: 'number', placeholder: '0.4', step: 0.1 } ]
    },
    effectVisuals: {
        animation: [ { key: 'type', label: 'Animation Type', type: 'select', options: ['scaleIn'] }, { key: 'duration', label: 'Animation Duration (s)', type: 'number', placeholder: '0.15', step: 0.1 } ],
        lightning: [ { key: 'duration', label: 'Duration (s)', type: 'number', placeholder: '0.3', step: 0.1 } ]
    },
    components: {
        rotation: [ { key: 'speed', label: 'Rotation Speed', type: 'number', placeholder: '10' } ],
        movement: [ { key: 'pattern', label: 'Pattern', type: 'select', options: ['weave'] }, { key: 'strength', label: 'Weave Strength', type: 'number', placeholder: '80' }, { key: 'frequency', label: 'Weave Frequency', type: 'number', placeholder: '20' } ]
    },
    conditions: {
        onHit: [], onExpire: [], onDeath: [], onUpdate: [], onPlayerHit: [], onKill: [], onFire: [], onTargetKill: [], onDealtDamage: [], onShieldBreak: [], onHeal: [],
        cooldown: [ { key: 'id', label: 'Cooldown ID', type: 'text', placeholder: 'shield_ability' }, { key: 'time', label: 'Time (s)', type: 'text', placeholder: '10 or [5, 8]' } ],
        distanceToPlayer: [ { key: 'lessThan', label: 'Less Than', type: 'number', placeholder: '250' }, { key: 'greaterThan', label: 'Greater Than', type: 'number' } ],
        checkFlag: [ { key: 'key', label: 'Flag Key', type: 'text', placeholder: 'isInvisible' }, { key: 'value', label: 'Required Value', type: 'select', options: [true, false, ''] } ],
        contextualCheck: [ { key: 'on', label: 'Check On', type: 'select', options: ['target', 'source'] }, { key: 'property', label: 'Property Name', type: 'text', placeholder: 'faction' }, { key: 'value', label: 'Required Value', type: 'text', placeholder: 'player' } ]
    }
};

// 2. Core UI & Helper Functions
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tabName}-generator`).classList.add('active');
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
}
function showModal(code) {
    document.getElementById('generatedCode').textContent = code;
    document.getElementById('code-modal').style.display = 'flex';
}
function closeModal() {
    document.getElementById('code-modal').style.display = 'none';
}
function copyCode() {
    navigator.clipboard.writeText(document.getElementById('generatedCode').textContent).then(
        () => alert('Code copied!'),
        () => alert('Copy failed.')
    );
}
function tryParseJSON(str) {
    try { return JSON.parse(str); } catch (e) {
        if (!isNaN(parseFloat(str)) && isFinite(str)) return parseFloat(str);
        if (str === 'true') return true;
        if (str === 'false') return false;
        return str;
    }
}

let attackCounter = 0, actionCounter = 0, handlerCounter = 0, effectCounter = 0;
let conditionCounter = 0, modCounter = 0, componentCounter = 0, flagCounter = 0;

// 3. Schema-Driven UI Generation
function generateFieldsFromSchema(container, schema, data) {
    container.innerHTML = '';
    if (!schema) return;
    const grid = document.createElement('div');
    grid.className = 'form-grid';
    schema.forEach(field => {
        const group = document.createElement('div');
        group.className = 'form-group';
        let inputHtml = '';
        const value = data && data[field.key] !== undefined ? data[field.key] : (field.default || '');
        switch (field.type) {
            case 'select':
                const options = field.options.map(opt => `<option value="${opt}" ${String(opt) === String(value) ? 'selected' : ''}>${String(opt)}</option>`).join('');
                inputHtml = `<select class="param-prop" data-key="${field.key}">${options}</select>`;
                break;
            case 'boolean':
                inputHtml = `<select class="param-prop" data-key="${field.key}"><option value="true" ${value === true ? 'selected' : ''}>True</option><option value="false" ${value === false || value === '' ? 'selected' : ''}>False</option></select>`;
                break;
            case 'textarea':
                const textValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
                inputHtml = `<textarea class="param-prop" data-key="${field.key}" placeholder="${field.placeholder || ''}">${textValue}</textarea>`;
                break;
            default:
                inputHtml = `<input type="${field.type}" class="param-prop" data-key="${field.key}" value="${value}" placeholder="${field.placeholder || ''}" ${field.step ? `step="${field.step}"` : ''}>`;
        }
        group.innerHTML = `<label>${field.label}</label>${inputHtml}${field.tooltip ? `<div class="tooltip">?<span class="tooltiptext">${field.tooltip}</span></div>` : ''}`;
        grid.appendChild(group);
    });
    container.appendChild(grid);
}

function showDetails(selectElement, schemaType, detailsContainerClass) {
    const type = selectElement.value;
    const schema = UI_SCHEMAS[schemaType][type];
    const parent = selectElement.closest('.dynamic-item');
    const detailsContainer = parent.querySelector(detailsContainerClass);
    generateFieldsFromSchema(detailsContainer, schema);

    if (schemaType === 'effectBehaviors') {
        const nestedEffectsContainer = parent.querySelector('.nested-effects-container');
        nestedEffectsContainer.innerHTML = ''; 
        
        const effectsKeyMap = { instantArea: 'onHitEffects', chain: 'onChainEffects', groundEffect: 'onTickEffects' };
        const effectsKey = effectsKeyMap[type];
        if (effectsKey) {
            const newContainerId = `nested-effects-${effectCounter}-${Math.random().toString(36).substr(2, 5)}`;
            nestedEffectsContainer.innerHTML = `<h4>${effectsKey.replace(/([A-Z])/g, ' $1').replace('on ', 'On ')}</h4><div class="dynamic-container" id="${newContainerId}"></div><button type="button" class="btn btn-add" onclick="addEffect('${newContainerId}')">+ Add Effect</button>`;
        }
    }
}

// 4. Dynamic Element Creation
function addEffect(containerId) {
    effectCounter++;
    const container = document.getElementById(containerId);
    const effectTypes = Object.keys(UI_SCHEMAS.effects);
    const behaviorTypes = Object.keys(UI_SCHEMAS.effectBehaviors);
    const visualAnimationTypes = Object.keys(UI_SCHEMAS.effectVisuals);
    const effectHTML = `<div class="dynamic-item" id="effect-${effectCounter}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button><div class="form-group"><label>Effect Type</label><select class="effect-type-select" onchange="showDetails(this, 'effects', '.effect-details'); this.closest('.dynamic-item').querySelector('.spawn-effect-container').style.display = this.value === 'spawnEffect' ? 'block' : 'none';">${effectTypes.map(k => `<option>${k}</option>`).join('')}</select></div><div class="effect-details"></div><div class="spawn-effect-container" style="display: none;"><hr style="border-color: var(--border-color); margin: 15px 0;"><h4>SpawnEffect Details</h4><div class="form-group"><label>Behavior Type</label><select class="behavior-type-select" onchange="showDetails(this, 'effectBehaviors', '.behavior-details')"><option value="">None</option>${behaviorTypes.map(k => `<option>${k}</option>`).join('')}</select></div><div class="behavior-details"></div><div class="nested-effects-container"></div><div class="form-group"><label>Visual Key</label><input type="text" class="visual-prop" data-key="key" placeholder="electric_nova_draw"></div><div class="form-group"><label>Visual Duration (s)</label><input type="number" step="0.1" class="visual-prop" data-key="duration" placeholder="0.6"></div><div class="form-group"><label>Animation Type</label><select class="animation-type-select" onchange="showDetails(this, 'effectVisuals', '.animation-details')"><option value="">None</option>${visualAnimationTypes.map(k => `<option>${k}</option>`).join('')}</select></div><div class="animation-details"></div></div></div>`;
    container.insertAdjacentHTML('beforeend', effectHTML);
}
function addCondition(handlerId) {
    conditionCounter++;
    document.getElementById(`conditions-${handlerId}`).insertAdjacentHTML('beforeend', `<div class="dynamic-item" id="condition-${conditionCounter}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button><div class="form-group"><label>Condition Type</label><select class="condition-type-select" onchange="showDetails(this, 'conditions', '.condition-details')">${Object.keys(UI_SCHEMAS.conditions).map(k => `<option>${k}</option>`).join('')}</select></div><div class="condition-details"></div></div>`);
}
function addHandler(containerId) {
    handlerCounter++;
    document.getElementById(containerId).insertAdjacentHTML('beforeend', `<div class="dynamic-item" id="handler-${handlerCounter}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button><h4>Trigger</h4><div class="conditions-container dynamic-container" id="conditions-${handlerCounter}"></div><button type="button" class="btn btn-add" onclick="addCondition(${handlerCounter})">+ Add Condition</button><h4>Effects</h4><div class="effects-container dynamic-container" id="effects-${handlerCounter}"></div><button type="button" class="btn btn-add" onclick="addEffect('effects-${handlerCounter}')">+ Add Effect</button></div>`);
}
function addAttack() {
    attackCounter++;
    document.getElementById('attacks-container').insertAdjacentHTML('beforeend', `<div class="dynamic-item" id="attack-${attackCounter}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button><h4>Attack #${attackCounter}</h4><div class="form-grid"><div class="form-group"><label>Attack ID</label><input type="text" class="attack-prop" data-key="id"></div><div class="form-group"><label>Targeting</label><select class="attack-prop" data-key="targeting"><option>nearest</option><option>random</option><option>moveDirection</option><option>horizontal</option><option>directional</option><option>none</option></select></div></div><h4>Stats</h4><div class="stats-container form-grid"><div class="form-group"><label>Base Dmg</label><input type="number" class="stat-prop" data-key="baseDmg" value="10"></div><div class="form-group"><label>Base Cooldown</label><input type="number" step="0.1" class="stat-prop" data-key="baseCd" value="1.0"></div><div class="form-group"><label>Base Proj Speed</label><input type="number" class="stat-prop" data-key="baseSpd" value="500"></div><div class="form-group"><label>Base Duration</label><input type="number" step="0.1" class="stat-prop" data-key="baseDur"></div><div class="form-group"><label>Base Range</label><input type="number" class="stat-prop" data-key="baseRange"></div><div class="form-group"><label>Base Area</label><input type="number" step="0.1" class="stat-prop" data-key="baseArea" value="1.0"></div><div class="form-group"><label>Base Pierce</label><input type="number" class="stat-prop" data-key="basePierce" value="0"></div><div class="form-group"><label>Base Amount</label><input type="number" class="stat-prop" data-key="baseAmount" value="1"></div><div class="form-group"><label>Knockback</label><input type="number" class="stat-prop" data-key="kb" value="100"></div></div><h4>Actions</h4><div class="actions-container dynamic-container" id="actions-container-${attackCounter}"></div><button type="button" class="btn btn-add" onclick="addAction(${attackCounter})">+ Add Action</button></div>`);
}
function addAction(attackId) {
    actionCounter++;
    document.getElementById(`actions-container-${attackId}`).insertAdjacentHTML('beforeend', `<div class="dynamic-item" id="action-${actionCounter}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button><div class="form-group"><label>Action Type</label><select class="action-prop" data-key="type" onchange="showActionDetails(this)"><option>fireProjectile</option><option>lobProjectile</option><option>spawnEffect</option><option>spawnBeam</option><option>summonAlly</option><option>leaveTrail</option></select></div><div class="action-details"></div></div>`);
}
function showActionDetails(selectElement) {
    const detailsContainer = selectElement.closest('.dynamic-item').querySelector('.action-details');
    const actionType = selectElement.value;
    let html = `<div class="form-group"><label>Sound</label><input type="text" class="action-prop" data-key="sound"></div>`;
    if (actionType === 'fireProjectile' || actionType === 'lobProjectile') {
        html += `<div class="form-group"><label>Delay Between Shots (ms)</label><input type="number" class="action-prop" data-key="delayBetweenShots"></div><h4>Projectile Definition</h4><div class="projectile-container dynamic-container"><div class="form-grid"><div class="form-group"><label>Radius (r)</label><input type="number" class="proj-prop" data-key="r" value="8"></div><div class="form-group"><label>Destroy on Hit</label><select class="proj-prop" data-key="destroyOnHit"><option value="">Default (Pierce)</option><option value="true">True</option><option value="false">False</option></select></div><div class="form-group"><label>Visual Type</label><input type="text" class="proj-prop" data-key="visual.type" placeholder="procedural"></div><div class="form-group"><label>Visual Key</label><input type="text" class="proj-prop" data-key="visual.key" placeholder="wand_missile"></div><div class="form-group"><label>Movement Type</label><select class="proj-prop" data-key="movement.type"><option>linear</option><option>arc</option><option>boomerang</option><option>homing</option></select></div></div><h4>Handlers (onHit, onExpire, etc)</h4><div class="handlers-container dynamic-container" id="proj-handlers-${actionCounter}"></div><button type="button" class="btn btn-add" onclick="addHandler('proj-handlers-${actionCounter}')">+ Add Handler</button></div>`;
    }
    detailsContainer.innerHTML = html;
}
function addMod() {
    modCounter++;
    document.getElementById('mods-container').insertAdjacentHTML('beforeend', `<div class="dynamic-item" id="mod-${modCounter}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button><div class="form-grid"><div class="form-group"><label>Stat</label><input type="text" class="mod-prop" data-key="stat" placeholder="might"></div><div class="form-group"><label>Operation</label><select class="mod-prop" data-key="op"><option value="add">Add</option><option value="mul">Multiply</option><option value="set">Set</option></select></div></div><div class="form-group"><label>Value (Can be JSON)</label><textarea class="mod-prop" data-key="value" placeholder="0.1"></textarea></div></div>`);
}
function addInitialFlag() {
    flagCounter++;
    document.getElementById('initial-flags-container').insertAdjacentHTML('beforeend', `<div class="dynamic-item" id="flag-${flagCounter}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button><div class="form-grid"><div class="form-group"><label>Flag Key</label><input type="text" class="flag-prop" data-key="key" placeholder="isInvisible"></div><div class="form-group"><label>Flag Value</label><input type="text" class="flag-prop" data-key="value" placeholder="true"></div></div></div>`);
}
function addComponent(containerId) {
    componentCounter++;
    document.getElementById(containerId).insertAdjacentHTML('beforeend', `<div class="dynamic-item" id="comp-${componentCounter}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button><div class="form-group"><label>Component Type</label><select class="component-type-select" onchange="showDetails(this, 'components', '.component-details')">${Object.keys(UI_SCHEMAS.components).map(k => `<option>${k}</option>`).join('')}</select></div><div class="component-details"></div></div>`);
}

// 5. Code Generation & Parsing
function objectToString(obj, indent = '  ', key = null) {
    if (obj === null) return 'null';
    if (typeof obj !== 'object') {
        if (typeof obj === 'string') {
            if (key === 'description') return `"${obj.replace(/"/g, '\\"')}"`;
            if (key === 'svg') return `\`${obj.replace(/`/g, "\\`")}\``;
            if (obj.startsWith('Math.') || obj.startsWith('-Math.')) return obj;
            return `'${obj.replace(/'/g, "\\'")}'`;
        }
        return obj;
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const arrItems = obj.map(item => `\n${indent}  ${objectToString(item, indent + '  ')}`).join(',');
        return `[${arrItems}\n${indent}]`;
    }
    const props = Object.keys(obj).map(k => {
        const value = obj[k];
        if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) return null;
        const keyStr = k.includes('-') || k.includes(' ') ? `'${k}'` : k;
        return `\n${indent}  ${keyStr}: ${objectToString(value, indent + '  ', k)}`;
    }).filter(Boolean);
    if (props.length === 0) return '{}';
    return `{${props.join(',')}\n${indent}}`;
}
function parseAndSet(target, input) {
    if (!input.value && input.type !== 'checkbox') return;
    const keys = input.dataset.key.split('.');
    let current = target;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]] = current[keys[i]] || {};
    let value = input.type === 'checkbox' ? input.checked : input.value;
    if (input.type === 'number' && value) value = parseFloat(value);
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    if (input.tagName === 'TEXTAREA') value = tryParseJSON(value);
    current[keys[keys.length - 1]] = value;
}
function parseEffects(container) {
    const effects = [];
    if (!container) return effects;
    container.querySelectorAll(':scope > .dynamic-item').forEach(effectEl => {
        const effect = { type: effectEl.querySelector('.effect-type-select').value };
        effectEl.querySelector(':scope > .effect-details').querySelectorAll('.param-prop').forEach(input => parseAndSet(effect, input));
        if (effect.type === 'spawnEffect') {
            const behaviorSelect = effectEl.querySelector('.behavior-type-select');
            if (behaviorSelect && behaviorSelect.value) {
                effect.behavior = { type: behaviorSelect.value };
                effectEl.querySelector('.behavior-details').querySelectorAll('.param-prop').forEach(input => parseAndSet(effect.behavior, input));
                const effectsKeyMap = { instantArea: 'onHitEffects', chain: 'onChainEffects', groundEffect: 'onTickEffects' };
                const effectsKey = effectsKeyMap[effect.behavior.type];
                if (effectsKey) {
                    const nestedContainer = effectEl.querySelector('.nested-effects-container > .dynamic-container');
                    if (nestedContainer) effect.behavior[effectsKey] = parseEffects(nestedContainer);
                }
            }
            const animationSelect = effectEl.querySelector('.animation-type-select');
            if (animationSelect && animationSelect.value) {
                effect.visual = effect.visual || {};
                effect.visual.animation = { type: animationSelect.value };
                effectEl.querySelector('.animation-details').querySelectorAll('.param-prop').forEach(input => parseAndSet(effect.visual.animation, input));
            }
            effectEl.querySelectorAll('.visual-prop').forEach(input => {
                if(input.value) {
                    effect.visual = effect.visual || {};
                    parseAndSet(effect.visual, input);
                }
            });
        }
        effects.push(effect);
    });
    return effects;
}
function parseHandlers(container) {
    const handlers = [];
    if (!container) return handlers;
    container.querySelectorAll(':scope > .dynamic-item').forEach(handlerEl => {
        const handler = { trigger: { conditions: [] } };
        handlerEl.querySelector('.conditions-container').querySelectorAll('.dynamic-item').forEach(condEl => {
            const condition = { type: condEl.querySelector('.condition-type-select').value };
            condEl.querySelectorAll('.param-prop').forEach(input => parseAndSet(condition, input));
            handler.trigger.conditions.push(condition);
        });
        handler.effects = parseEffects(handlerEl.querySelector('.effects-container'));
        handlers.push(handler);
    });
    return handlers;
}
function generateWeaponCode() {
    const form = document.getElementById('weapon-form');
    const data = {};
    data.name = form.w_name.value;
    data.type = form.w_type.value;
    data.description = form.w_description.value;
    data.svg = form.w_svg.value;
    data.attacks = [];
    document.querySelectorAll('#attacks-container > .dynamic-item').forEach(attackEl => {
        const attack = {};
        attackEl.querySelectorAll('.attack-prop').forEach(input => parseAndSet(attack, input));
        attack.stats = {};
        attackEl.querySelectorAll('.stat-prop').forEach(input => parseAndSet(attack.stats, input));
        attack.actions = [];
        attackEl.querySelectorAll('.actions-container > .dynamic-item').forEach(actionEl => {
            const action = {};
            actionEl.querySelectorAll('.action-prop').forEach(input => parseAndSet(action, input));
            const projContainer = actionEl.querySelector('.projectile-container');
            if (projContainer) {
                action.projectile = {};
                projContainer.querySelectorAll('.proj-prop').forEach(input => parseAndSet(action.projectile, input));
                action.projectile.handlers = parseHandlers(projContainer.querySelector('.handlers-container'));
            }
            attack.actions.push(action);
        });
        data.attacks.push(attack);
    });
    let codeString = `'${form.w_id.value}': ${objectToString(data)}`;
    codeString = codeString.replace(/"([^"]+)":/g, '$1:');
    showModal(codeString);
}
function generateEnemyCode() {
    const form = document.getElementById('enemy-form');
    const data = {
        r: parseInt(form.e_r.value),
        hp: parseInt(form.e_hp.value),
        speed: parseInt(form.e_speed.value),
        dmg: parseInt(form.e_dmg.value),
        xp: parseInt(form.e_xp.value)
    };
    if (form.e_kbResist.value && form.e_kbResist.value !== '0') data.kbResist = parseInt(form.e_kbResist.value);
    if (form.e_visual_key.value) data.visual = { key: form.e_visual_key.value };
    data.components = [];
    document.querySelectorAll('#enemy-components-container > .dynamic-item').forEach(compEl => {
        const component = { type: compEl.querySelector('.component-type-select').value };
        compEl.querySelectorAll('.param-prop').forEach(input => parseAndSet(component, input));
        data.components.push(component);
    });
    data.initialFlags = {};
    document.querySelectorAll('#initial-flags-container > .dynamic-item').forEach(flagEl => {
        const keyInput = flagEl.querySelector('[data-key="key"]');
        const valueInput = flagEl.querySelector('[data-key="value"]');
        if (keyInput.value) data.initialFlags[keyInput.value] = tryParseJSON(valueInput.value);
    });
    data.handlers = parseHandlers(document.getElementById('enemy-handlers-container'));
    let codeString = `'${form.e_id.value}': ${objectToString(data)}`;
    codeString = codeString.replace(/"([^"]+)":/g, '$1:');
    showModal(codeString);
}
function generatePassiveCode() {
    const form = document.getElementById('passive-form');
    const data = { id: form.p_id.value, name: form.p_name.value, desc: form.p_desc.value, svg: form.p_svg.value };
    if (form.p_maxLevel.value && form.p_maxLevel.value !== '5') data.maxLevel = parseInt(form.p_maxLevel.value);
    data.mods = [];
    document.querySelectorAll('#mods-container .dynamic-item').forEach(modEl => {
        const mod = {};
        modEl.querySelectorAll('.mod-prop').forEach(input => parseAndSet(mod, input));
        data.mods.push(mod);
    });
    data.handlers = parseHandlers(document.getElementById('passive-handlers-container'));
    let codeString = objectToString(data) + ',';
    codeString = codeString.replace(/"([^"]+)":/g, '$1:');
    showModal(codeString);
}

// 6. Example Population
function populateEffectsUI(containerId, effectsData) {
    if (!effectsData || !effectsData.length) return;
    effectsData.forEach(effectData => {
        addEffect(containerId);
        const newEffectEl = document.getElementById(`effect-${effectCounter}`);
        const typeSelect = newEffectEl.querySelector(`.effect-type-select`);
        typeSelect.value = effectData.type;
        typeSelect.dispatchEvent(new Event('change'));
        const { type, ...params } = effectData;
        generateFieldsFromSchema(newEffectEl.querySelector(':scope > .effect-details'), UI_SCHEMAS.effects[type], params);

        if (effectData.type === 'spawnEffect') {
            if (effectData.behavior) {
                const behaviorSelect = newEffectEl.querySelector('.behavior-type-select');
                behaviorSelect.value = effectData.behavior.type;
                behaviorSelect.dispatchEvent(new Event('change'));
                const { type: bType, ...bParams } = effectData.behavior;
                generateFieldsFromSchema(newEffectEl.querySelector('.behavior-details'), UI_SCHEMAS.effectBehaviors[bType], bParams);
                
                const effectsKeyMap = { instantArea: 'onHitEffects', chain: 'onChainEffects', groundEffect: 'onTickEffects' };
                const effectsKey = effectsKeyMap[bType];
                if (effectsKey && effectData.behavior[effectsKey]) {
                    const nestedContainerId = newEffectEl.querySelector('.nested-effects-container > .dynamic-container').id;
                    populateEffectsUI(nestedContainerId, effectData.behavior[effectsKey]);
                }
            }

            if (effectData.visual) {
                newEffectEl.querySelectorAll('.visual-prop').forEach(input => {
                    const key = input.dataset.key;
                    if(effectData.visual[key] !== undefined) {
                        input.value = effectData.visual[key];
                    }
                });

                if (effectData.visual.animation) {
                    const animSelect = newEffectEl.querySelector('.animation-type-select');
                    animSelect.value = effectData.visual.animation.type;
                    animSelect.dispatchEvent(new Event('change'));
                    const { type: aType, ...aParams } = effectData.visual.animation;
                    generateFieldsFromSchema(newEffectEl.querySelector('.animation-details'), UI_SCHEMAS.effectVisuals[aType], aParams);
                }
            }
        }
    });
}
function populateHandlersUI(targetContainerId, handlersData) {
    if (!handlersData || !handlersData.length) return;
    handlersData.forEach(handlerData => {
        addHandler(targetContainerId);
        const newHandlerEl = document.getElementById(`handler-${handlerCounter}`);
        if (handlerData.trigger && handlerData.trigger.conditions) {
            handlerData.trigger.conditions.forEach(conditionData => {
                addCondition(handlerCounter);
                const newConditionEl = document.getElementById(`condition-${conditionCounter}`);
                const typeSelect = newConditionEl.querySelector(`.condition-type-select`);
                typeSelect.value = conditionData.type;
                typeSelect.dispatchEvent(new Event('change'));
                const { type, ...params } = conditionData;
                generateFieldsFromSchema(newConditionEl.querySelector('.condition-details'), UI_SCHEMAS.conditions[type], params);
            });
        }
        if (handlerData.effects) {
            populateEffectsUI(`effects-${handlerCounter}`, handlerData.effects);
        }
    });
}
function populateExamples() {
    const container = document.getElementById('examples-container');
    let html = `<h3>Weapons</h3><ul class="example-list">`;
    for (const key in GAME_DATA.weapons) html += `<li onclick="loadWeaponExample('${key}')">${GAME_DATA.weapons[key].name}</li>`;
    html += `</ul><h3>Passives</h3><ul class="example-list">`;
    GAME_DATA.passives.forEach(p => html += `<li onclick="loadPassiveExample('${p.id}')">${p.name}</li>`);
    html += `</ul><h3>Enemies</h3><ul class="example-list">`;
    for (const key in GAME_DATA.enemies) html += `<li onclick="loadEnemyExample('${key}')">${key.charAt(0).toUpperCase() + key.slice(1)}</li>`;
    html += `</ul>`;
    container.innerHTML = html;
}
function loadWeaponExample(key) {
    showTab('weapon');
    const data = GAME_DATA.weapons[key];
    const form = document.getElementById('weapon-form');
    form.reset();
    document.getElementById('attacks-container').innerHTML = '';
    form.w_id.value = key;
    form.w_name.value = data.name || '';
    form.w_type.value = data.type || 'projectile';
    form.w_description.value = data.description || '';
    form.w_svg.value = data.svg || '';
    if (!data.attacks) return;
    data.attacks.forEach(attackData => {
        addAttack();
        const newAttackEl = document.getElementById(`attack-${attackCounter}`);
        for(const prop in attackData) {
            const input = newAttackEl.querySelector(`.attack-prop[data-key="${prop}"]`);
            if(input) input.value = attackData[prop];
        }
        if(attackData.stats) for(const statKey in attackData.stats) {
            const statInput = newAttackEl.querySelector(`.stat-prop[data-key="${statKey}"]`);
            if(statInput) statInput.value = attackData.stats[statKey];
        }
        if (attackData.actions) attackData.actions.forEach(actionData => {
            addAction(attackCounter);
            const newActionEl = document.getElementById(`action-${actionCounter}`);
            const typeSelect = newActionEl.querySelector(`[data-key="type"]`);
            typeSelect.value = actionData.type;
            typeSelect.dispatchEvent(new Event('change'));
            for(const prop in actionData) {
                const input = newActionEl.querySelector(`.action-prop[data-key="${prop}"]`);
                if(input) input.value = actionData[prop];
            }
            if(actionData.projectile) {
                const proj = actionData.projectile;
                const projContainer = newActionEl.querySelector('.projectile-container');
                for(const prop in proj) {
                    const input = projContainer.querySelector(`.proj-prop[data-key="${prop}"]`);
                    if(input) input.value = proj[prop];
                    else if (typeof proj[prop] === 'object') for (const subProp in proj[prop]) {
                        const subInput = projContainer.querySelector(`.proj-prop[data-key="${prop}.${subProp}"]`);
                        if(subInput) subInput.value = proj[prop][subProp];
                    }
                }
                if (proj.handlers) populateHandlersUI(projContainer.querySelector('.handlers-container').id, proj.handlers);
            }
        });
    });
}
function loadPassiveExample(id) {
    showTab('passive');
    const data = GAME_DATA.passives.find(p => p.id === id);
    const form = document.getElementById('passive-form');
    form.reset();
    document.getElementById('mods-container').innerHTML = '';
    document.getElementById('passive-handlers-container').innerHTML = '';
    form.p_id.value = data.id;
    form.p_name.value = data.name;
    form.p_maxLevel.value = data.maxLevel || 5;
    form.p_desc.value = data.desc;
    form.p_svg.value = data.svg;
    if (data.mods) data.mods.forEach(modData => {
        addMod();
        const newModEl = document.getElementById(`mod-${modCounter}`);
        newModEl.querySelector(`[data-key="stat"]`).value = modData.stat;
        newModEl.querySelector(`[data-key="op"]`).value = modData.op;
        const valueInput = newModEl.querySelector(`[data-key="value"]`);
        if(typeof modData.value === 'object') valueInput.value = JSON.stringify(modData.value, null, 2);
        else valueInput.value = modData.value;
    });
    if (data.handlers) populateHandlersUI('passive-handlers-container', data.handlers);
}
function loadEnemyExample(key) {
    showTab('enemy');
    const data = GAME_DATA.enemies[key];
    const form = document.getElementById('enemy-form');
    form.reset();
    document.getElementById('enemy-handlers-container').innerHTML = '';
    document.getElementById('enemy-components-container').innerHTML = '';
    document.getElementById('initial-flags-container').innerHTML = '';
    form.e_id.value = key;
    form.e_r.value = data.r;
    form.e_hp.value = data.hp;
    form.e_speed.value = data.speed;
    form.e_dmg.value = data.dmg;
    form.e_xp.value = data.xp;
    form.e_kbResist.value = data.kbResist || 0;
    form.e_visual_key.value = data.visual ? data.visual.key : '';
    if (data.initialFlags) for (const flagKey in data.initialFlags) {
        addInitialFlag();
        const newFlagEl = document.getElementById(`flag-${flagCounter}`);
        newFlagEl.querySelector('[data-key="key"]').value = flagKey;
        newFlagEl.querySelector('[data-key="value"]').value = data.initialFlags[flagKey];
    }
    if (data.components) data.components.forEach(compData => {
        addComponent('enemy-components-container');
        const newCompEl = document.getElementById(`comp-${componentCounter}`);
        const { type, ...params } = compData;
        const typeSelect = newCompEl.querySelector('.component-type-select');
        typeSelect.value = type;
        typeSelect.dispatchEvent(new Event('change'));
        generateFieldsFromSchema(newCompEl.querySelector('.component-details'), UI_SCHEMAS.components[type], params);
    });
    if (data.handlers) populateHandlersUI('enemy-handlers-container', data.handlers);
}

document.addEventListener('DOMContentLoaded', () => {
    const wForm = document.getElementById('weapon-form');
    if (wForm) wForm.insertAdjacentHTML('beforeend', '<div id="grants-component-container"></div>');
    const eForm = document.getElementById('enemy-form');
    if (eForm) {
        eForm.insertAdjacentHTML('beforeend', '<h4>Components (e.g., Movement)</h4><div id="enemy-components-container" class="dynamic-container"></div><button type="button" class="btn btn-add" onclick="addComponent(\'enemy-components-container\')">+ Add Component</button>');
        eForm.insertAdjacentHTML('beforeend', '<h4>Initial Flags (e.g., isInvisible)</h4><div id="initial-flags-container" class="dynamic-container"></div><button type="button" class="btn btn-add" onclick="addInitialFlag()">+ Add Initial Flag</button>');
    }
    populateExamples();
});
