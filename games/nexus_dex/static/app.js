(async function NexusDex() {
    'use strict';

    const TYPE_COLORS = {
        Normal: '#a8a77a', Fire: '#ee8130', Water: '#6390f0', Grass: '#7ac74c', Electric: '#f7d02c',
        Ice: '#96d9d6', Fighting: '#c22e28', Poison: '#a33ea1', Ground: '#e2bf65', Flying: '#a98ff3',
        Psychic: '#f95587', Bug: '#a6b91a', Rock: '#b6a136', Ghost: '#735797', Dragon: '#6f35fc',
        Dark: '#705746', Steel: '#b7b7ce', Fairy: '#d685ad'
    };
    const LEARN_METHOD_LABELS = { L: 'Level Up', M: 'TM/HM', T: 'Tutor', E: 'Egg Move', S: 'Special/Event', V: 'Virtual Console Transfer' };
    const MAX_STAT = 255;
    const CARDS_PER_PAGE = 60;

    const GEN_VERSIONS = {
        '1': ['Red', 'Blue', 'Yellow'], '2': ['Gold', 'Silver', 'Crystal'], '3':['Ruby', 'Sapphire', 'Emerald', 'FireRed', 'LeafGreen'],
        '4':['Diamond', 'Pearl', 'Platinum', 'HeartGold', 'SoulSilver'], '5': ['Black', 'White', 'Black 2', 'White 2'],
        '6': ['X', 'Y', 'Omega Ruby', 'Alpha Sapphire'], '7':['Sun', 'Moon', 'Ultra Sun', 'Ultra Moon', 'Let\'s Go Pikachu', 'Let\'s Go Eevee'],
        '8':['Sword', 'Shield', 'Brilliant Diamond', 'Shining Pearl', 'Legends Arceus'], '9': ['Scarlet', 'Violet']
    };
    const VERSION_TO_GEN = {};
    for (const [g, vs] of Object.entries(GEN_VERSIONS)) { for (const v of vs) VERSION_TO_GEN[v] = g; }

const VERSION_TO_WALKTHROUGH = {
    'Red': 'rb', 'Blue': 'rb', 'Yellow': 'rb', 'Gold': 'gs', 'Silver': 'gs', 'Crystal': 'c',
    'Ruby': 'rs', 'Sapphire': 'rs', 'Emerald': 'e', 'FireRed': 'frlg', 'LeafGreen': 'frlg',
    'Diamond': 'dp', 'Pearl': 'dp', 'Platinum': 'pt', 'HeartGold': 'hgss', 'SoulSilver': 'hgss',
    'Black': 'bw', 'White': 'bw', 'Black 2': 'b2w2', 'White 2': 'b2w2',
    'X': 'x_y', 'Y': 'x_y', 'Omega Ruby': 'oras', 'Alpha Sapphire': 'oras',
    'Sun': 'sm', 'Moon': 'sm', 'Ultra Sun': 'usum', 'Ultra Moon': 'usum', 'Let\'s Go Pikachu': 'lgplge', 'Let\'s Go Eevee': 'lgplge',
    'Sword': 'swsh', 'Shield': 'swsh', 'Brilliant Diamond': 'bdsp', 'Shining Pearl': 'bdsp', 'Legends Arceus': 'la',
    'Scarlet': 'sv', 'Violet': 'sv'
};

let allPokemon =[], generationMeta = {}, typeData =[], movesData = {}, encounterData = {}, translationsData = {}, locationOrderData = {};
let activeGens = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
let activeTypeChart = 'gen6+';
let selectedVersion = null, currentLang = 'en', searchQuery = '', typeFilter = null, currentPage = 'pokedex';
let displayedCount = 0, filteredPokemon =[], isLoading = false;
let team =[null, null, null, null, null, null], pcBox =[];
let cmTargetPoke = null, cmTargetSlot = -1;
let activeEncMethod = null, lastEncVersion = null;
let activeGameTab = 'encounters', walkthroughCache = {}, tabScrollY = { encounters: 0, walkthrough: 0 };


    const $ = id => document.getElementById(id);

    // Bindings
    const grid = $('pokedex-grid');
    const stageOverlay = $('the-stage');
    const loadingIndicator = $('loading-indicator');

    // ---- Utility ----
    function padNumber(n) { return String(n).padStart(3, '0'); }
    function getSpriteUrl(p) { return p.sprites && p.sprites.length ? `/static/sprites/pokemon/generation-9/${p.sprites[0]}.png` : `/static/sprites/pokemon/generation-9/${padNumber(p.number)}${getFormeSuffix(p.name)}.png`; }
    function getFormeSuffix(n) { const m = { 'mega': '-m', 'mega-x': '-mx', 'mega-y': '-my', 'gmax': '-gi', 'alola': '-a', 'galar': '-g', 'hisui': '-h', 'paldea': '-p', 'therian': '-t', 'origin': '-o' }; return n.includes('-') ? (m[n.split('-').slice(1).join('-').toLowerCase()] || '') : ''; }
    function getPokemonGeneration(n) { for (const [g, i] of Object.entries(generationMeta)) if (n >= parseInt(i.start) && n <= parseInt(i.end)) return g; return '9'; }
    function isBaseForm(p) { const n = p.name; if (n.includes('-Mega') || n.includes('-Gmax') || n.includes('-Totem')) return false; if (n.includes('-Alola') || n.includes('-Galar') || n.includes('-Hisui') || n.includes('-Paldea')) return true; if (n.includes('-') && !n.includes('-♀') && !n.includes('-♂')) { const b = allPokemon.find(x => x.number === p.number && !x.name.includes('-')); if (b && b.name !== n) return false; } return true; }

    function updateActiveTypeChart() {
        let maxGen = 9;
        if (selectedVersion) maxGen = parseInt(VERSION_TO_GEN[selectedVersion]);
        else if (activeGens.size > 0) maxGen = Math.max(...[...activeGens].map(Number));

        if (maxGen === 1) activeTypeChart = 'gen1';
        else if (maxGen <= 5) activeTypeChart = 'gen2-5';
        else activeTypeChart = 'gen6+';
    }

    function getEffectiveTypes(p) {
        let t = [...p.types];
        if (activeTypeChart === 'gen1') {
            if (p.name === 'Magnemite' || p.name === 'Magneton') t = ['Electric'];
            else t = t.map(x => (x === 'Fairy' || x === 'Dark' || x === 'Steel') ? 'Normal' : x);
        }
        else if (activeTypeChart === 'gen2-5') t = t.map(x => x === 'Fairy' ? 'Normal' : x);
        return [...new Set(t)];
    }

    function trPoke(name) { return name; }
    function getTypeBgClass(t) { return 'type-bg-' + t.toLowerCase(); }

    let translations = null;
    function trString(section, key) {
        if (!translations || !translations[section] || !translations[section].length) return key;
        const data = translations[section][0];

        // 1. Try exact match first (fastest)
        if (data[key] && data[key][currentLang]) return data[key][currentLang];

        // 2. Fallback: Case-insensitive match
        const searchKey = key.toLowerCase().replace(/\s/g, '');
        for (const [originalKey, translationObj] of Object.entries(data)) {
            if (originalKey.toLowerCase().replace(/\s/g, '') === searchKey && translationObj[currentLang]) {
                return translationObj[currentLang];
            }
        }

        return key;
    }
    function trUi(key) { return trString('ui', key); }
    function trPoke(name) { return trString('pokemon', name); }
    function trType(name) { return currentLang === 'en' ? name : trString('types', name.toLowerCase()); }
    function trMove(name) { return trString('attacks', name); }
    function trAbility(name) { return trString('abilities', name); }
    function trGame(name) { return trString('games', name); }
    function trLoc(name) { return trString('location', name); }
    function trMeth(name) { return trString('encounter_method', name); }
    function trReq(key) { return trString('evolutionreq', key); }
    function trCond(name) { return trString('conditions', name); }

    const STAT_MAP = { atk: "Attack", def: "Defense", spa: "Special Attack", spd: "Special Defense", spe: "Speed", accuracy: "Accuracy", evasion: "Evasion" };
    const STATUS_MAP = { brn: "a burn", psn: "poison", par: "paralysis", slp: "sleep", frz: "freeze", flinch: "flinch", confusion: "confusion" };

    function formatMoveEffects(x) {
        let res = [];
        const chanceStr = (c) => (c && c < 100) ? `${c}% ${trUi('Chance') || 'chance'}: ` : '';

        // 1. Handle Stat Boosts (Self and Enemy)
        if (x.boosts) {
            const b = x.boosts;
            const processBoosts = (boostMap, isSelf) => {
                for (let [statKey, value] of Object.entries(boostMap)) {
                    const statName = trUi(STAT_MAP[statKey] || statKey);
                    const templateKey = isSelf
                        ? (value > 0 ? "Raises the user's {stat} by {value}." : "Lowers the user's {stat} by {value}.")
                        : "Lowers the opponent's {stat} by {value}.";

                    const text = (trUi(templateKey) || templateKey)
                        .replace('{stat}', statName)
                        .replace('{value}', Math.abs(value));
                    res.push(`<span class="move-effect-tag effect-boost">${chanceStr(b.chance)}${text}</span>`);
                }
            };
            if (b.self) processBoosts(b.self, true);
            if (b.enemy) processBoosts(b.enemy, false);
        }

        // 2. Handle Status and Volatile Status (Primary and Secondary)
        const effectSource = x.secondary || x;

        // Status Handling (Burn, Poison, etc.)
        if (effectSource.status) {
            const sVal = effectSource.status;
            const statusLabelKey = { brn: 'a burn', psn: 'poison', par: 'paralysis', slp: 'sleep', frz: 'freeze' }[sVal] || sVal;
            const statusName = trUi(statusLabelKey);
            const template = trUi("May inflict the target with {status}.");
            const text = template.replace('{status}', statusName);
            res.push(`<span class="move-effect-tag effect-status">${chanceStr(effectSource.chance)}${text}</span>`);
        }

        // Volatile Status Handling (Leech, Yawn, Flinch, etc.)
        if (effectSource.volatileStatus) {
            const vVal = effectSource.volatileStatus;
            const specialMap = {
                'trapping': 'Traps the target for several turns.',
                'partiallytrapped': 'Traps the target for several turns.',
                'curse': "Cuts the user's HP to curse the target.",
                'leech': "Plants a seed that drains the target's HP.",
                'leechseed': "Plants a seed that drains the target's HP.",
                'saltcure': "Inflicts damage each turn; doubled on Steel/Water types.",
                'yawn': "Makes the target drowsy, causing sleep next turn."
            };

            if (specialMap[vVal]) {
                const text = trUi(specialMap[vVal]);
                res.push(`<span class="move-effect-tag effect-status">${chanceStr(effectSource.chance)}${text}</span>`);
            } else {
                // Default template for things like Flinch or Confusion
                const statusName = trUi(vVal);
                const template = trUi("May cause the target to {status}.");
                const text = template.replace('{status}', statusName);
                res.push(`<span class="move-effect-tag effect-status">${chanceStr(effectSource.chance)}${text}</span>`);
            }
        }

        return res.join(' ');
    }

    async function loadAllData() {
        loadingIndicator.classList.add('visible');
        try {
            const [p, t, m, e, tr, lo] = await Promise.all([
                fetch('/static/nexus_dex/PokemonData.json').then(r => r.json()),
                fetch('/static/nexus_dex/TypeData.json').then(r => r.json()),
                fetch('/static/nexus_dex/MovesData.json').then(r => r.json()),
                fetch('/static/nexus_dex/EncounterData.json').then(r => r.json()),
                fetch('/static/nexus_dex/Translations.json').then(r => r.json()),
                fetch('/static/nexus_dex/LocationOrder.json').then(r => r.json())
            ]);
            generationMeta = p[0].generation; allPokemon = p.slice(1).filter(x => x.name && x.number); typeData = t; translations = tr; locationOrderData = lo;
            let rm = (m.moves && m.moves.length) ? m.moves[0] : m; movesData = {};
            for (const [k, v] of Object.entries(rm)) { v.originalName = k; movesData[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = v; }
            encounterData = e;
        } catch (e) { console.error(e); }
        loadingIndicator.classList.remove('visible');
    }

    // ---- Filters ----
    function applyFilters() {
        const vGen = selectedVersion ? VERSION_TO_GEN[selectedVersion] : null;
        filteredPokemon = allPokemon.filter(p => {
            if (!isBaseForm(p)) return false;
            const gen = getPokemonGeneration(p.number);
            if (!activeGens.has(gen)) return false;
            if (vGen && parseInt(gen) > parseInt(vGen)) return false;
            if (typeFilter && !getEffectiveTypes(p).includes(typeFilter)) return false;
            if (searchQuery) { const q = searchQuery.toLowerCase(); if (!trPoke(p.name).toLowerCase().includes(q) && !p.name.toLowerCase().includes(q) && !String(p.number).includes(q)) return false; }
            return true;
        });
        const seen = new Set(); filteredPokemon = filteredPokemon.filter(p => seen.has(p.name) ? false : seen.add(p.name));
        displayedCount = 0; grid.innerHTML = ''; renderNextBatch();
    }

    function renderNextBatch() {
        if (isLoading || displayedCount >= filteredPokemon.length) return;
        isLoading = true; const end = Math.min(displayedCount + CARDS_PER_PAGE, filteredPokemon.length);
        const frag = document.createDocumentFragment();
        for (let i = displayedCount; i < end; i++) frag.appendChild(createPokemonCard(filteredPokemon[i]));
        grid.appendChild(frag); displayedCount = end; isLoading = false;
    }

    function createPokemonCard(p) {
        const c = document.createElement('div'); c.className = 'gallery-card';
        c.draggable = true;
        c.ondragstart = e => { e.dataTransfer.setData('source', 'gallery'); e.dataTransfer.setData('poke_num', p.number); c.style.opacity = '0.5'; };
        c.ondragend = () => c.style.opacity = '1';
        c.oncontextmenu = e => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, p, -1); };
        const t = getEffectiveTypes(p);
        c.style.setProperty('--card-accent', TYPE_COLORS[t[0]] || TYPE_COLORS.Normal);
        c.innerHTML = `<span class="card-number">#${padNumber(p.number)}</span>
            <div class="img-wrap"><img class="poke-img" loading="lazy" src="${getSpriteUrl(p)}" onerror="this.src='/static/sprites/pokemon/generation-9/${padNumber(p.number)}.png'"></div>
            <div class="poke-name">${trPoke(p.name)}</div>
            <div class="types">${t.map(x => `<span class="type-pill ${getTypeBgClass(x)}">${trType(x)}</span>`).join('')}</div>`;
        c.addEventListener('click', () => openStage(p));
        return c;
    }

    // ---- Dropdowns setup ----
    function buildDropdowns() {
        const vd = $('version-filter-dropdown'); vd.innerHTML = `<button class="${!selectedVersion ? 'active' : ''}">${trUi("All Versions") || "All Versions"}</button>`;
        vd.firstChild.onclick = () => { selectedVersion = null; $('version-filter-label').textContent = trUi("All Versions") || "All Versions"; saveData(); updateActiveTypeChart(); applyFilters(); buildDropdowns(); renderTypeChart(); updateGameHub(); };
        for (const [gen, vs] of Object.entries(GEN_VERSIONS)) {
            if (!activeGens.has(gen)) continue;
            const l = document.createElement('div'); l.className = 'version-group-label'; l.textContent = generationMeta[gen]?.name || `Gen ${gen}`; vd.appendChild(l);
            for (const v of vs) {
                const b = document.createElement('button'); b.textContent = trGame(v) || v; if (selectedVersion === v) b.classList.add('active');
                b.onclick = () => { selectedVersion = v; $('version-filter-label').textContent = trGame(v) || v; $('version-filter-wrap').classList.remove('open'); saveData(); updateActiveTypeChart(); applyFilters(); buildDropdowns(); renderTypeChart(); updateGameHub(); };

                vd.appendChild(b);
            }
        }
        const gd = $('gen-filter-dropdown'); gd.innerHTML = '';
        for (const [g, info] of Object.entries(generationMeta)) {
            const b = document.createElement('button'); b.textContent = `${activeGens.has(g) ? '✓' : ''} ${info.name}`;
            if (activeGens.has(g)) b.classList.add('active');
            b.onclick = () => { if (activeGens.has(g)) { if (activeGens.size > 1) activeGens.delete(g); } else activeGens.add(g); saveData(); updateActiveTypeChart(); buildDropdowns(); applyFilters(); renderTypeChart(); };
            gd.appendChild(b);
        }

        const tb = $('type-filter-bar'); tb.innerHTML = '';['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'].forEach(t => {
            const c = document.createElement('button'); c.className = `type-filter-chip ${getTypeBgClass(t)}`; c.textContent = trType(t); if (typeFilter === t) c.classList.add('active');
            c.onclick = () => { typeFilter = typeFilter === t ? null : t; buildDropdowns(); applyFilters(); };
            tb.appendChild(c);
        });
    }

    // ---- THE STAGE (Immersive Modal) ----
    function openStage(p) {
        const types = getEffectiveTypes(p);
        const pColor = TYPE_COLORS[types[0]] || TYPE_COLORS.Normal;

        document.documentElement.style.setProperty('--theme-color', pColor);
        document.documentElement.style.setProperty('--theme-glow', pColor + '4D');
        document.documentElement.style.setProperty('--theme-surface', pColor + '1A');

        $('stage-number').textContent = `#${padNumber(p.number)}`;
        $('stage-name').textContent = trPoke(p.name);
        $('stage-image').src = getSpriteUrl(p);
        $('stage-types').innerHTML = types.map(t => `<span class="type-pill ${getTypeBgClass(t)}">${trType(t)}</span>`).join('');
        $('stage-add-team').textContent = "+ " + (trUi("Add to Party") || "Add to Party");
        $('stage-add-team').onclick = () => { addToTeamSlot(p, team.indexOf(null)); showToast(trPoke(p.name) + " added to Party!"); };

        renderBentoStats(p, types); renderBentoAbilities(p); renderBentoPrep(types); renderBentoEvo(p); renderBentoMoves(p); renderBentoEncounters(p);
        stageOverlay.classList.add('active'); document.body.style.overflow = 'hidden';
    }

    function renderBentoStats(p, types) {
        const s = p.baseStats || {}; const list = [['hp', 'HP'], ['attack', 'ATK'], ['defense', 'DEF'], ['spAttack', 'SPA'],['spDefense', 'SPD'], ['speed', 'SPE']];
        let tot = 0, h = '';
        list.forEach(([k, l]) => { const v = s[k] || 0; tot += v; h += `<div class="stat-bar-huge"><span class="stat-name-label">${l}</span><div class="stat-track"><div class="stat-fill" style="width:${Math.min(v / MAX_STAT * 100, 100)}%;background:var(--theme-color)"></div></div><span class="stat-num-label">${v}</span></div>`; });
        h += `<div class="stat-total"><span>BST</span><span style="color:var(--theme-color)">${tot}</span></div>`;
        $('bento-stats').innerHTML = h;
        setTimeout(() => { document.querySelectorAll('.stat-fill').forEach(el => { const w = el.style.width; el.style.width = '0%'; setTimeout(() => el.style.width = w, 50); }); }, 100);
    }

    function renderBentoAbilities(p) {
        const ab = p.abilities || {}; let h = '';
        Object.entries(ab).forEach(([k, n]) => { h += `<div class="ability-pill ${k === 'H' ? 'hidden' : ''}">${trAbility(n)} ${k === 'H' ? `<span style="opacity:0.6;font-size:0.8rem">(${trUi("Hidden") || "Hidden"})</span>` : ''}</div>`; });
        $('bento-abilities').innerHTML = h;
    }

    function renderBentoPrep(types) {
        const cd = typeData.find(t => t.type === activeTypeChart) || typeData[typeData.length - 1];
        let mults = {}, baseTypes = Object.keys(cd.defensive);
        baseTypes.forEach(t => mults[t] = 1);
        baseTypes.forEach(atk => {
            types.forEach(def => {
                if (!cd.defensive[def]) return;
                if (cd.defensive[def]['2']?.includes(atk)) mults[atk] *= 2; else if (cd.defensive[def]['0.5']?.includes(atk)) mults[atk] /= 2; else if (cd.defensive[def]['0']?.includes(atk)) mults[atk] *= 0;
            });
        });
        const grps = { '4':[], '2': [], '0.5': [], '0.25':[], '0':[] };
        for (const [t, m] of Object.entries(mults)) { if (m === 4) grps['4'].push(t); else if (m === 2) grps['2'].push(t); else if (m === 0.5) grps['0.5'].push(t); else if (m === 0.25) grps['0.25'].push(t); else if (m === 0) grps['0'].push(t); }

        let h = `<div class="prep-grid">`;
        [['4', trUi('4× Weakness') || '4× Weakness', 'mm-4'],['2', trUi('2× Weakness') || '2× Weakness', 'mm-2'],['0.5', trUi('½× Resist') || '½× Resist', 'mm-05'],['0.25', trUi('¼× Resist') || '¼× Resist', 'mm-025'],['0', trUi('Immune') || 'Immune', 'mm-0']].forEach(([k, l, cls]) => {
            if (grps[k].length) { h += `<div class="prep-item"><div class="prep-multi ${cls}">${l}</div><div class="prep-types">${grps[k].map(t => `<span class="type-filter-chip ${getTypeBgClass(t)}" style="opacity:1">${trType(t)}</span>`).join('')}</div></div>`; }
        });
        h += '</div>'; $('bento-prep').innerHTML = h;
    }

    function renderBentoEvo(p) {
        let root = p; const vis = new Set(); while (root.prevolution && !vis.has(root.name)) { vis.add(root.name); const pr = allPokemon.find(x => x.name === root.prevolution); if (pr) root = pr; else break; }
        const chain =[]; function walk(node) { chain.push(node); if (node.evolution) node.evolution.forEach(e => { const n = allPokemon.find(x => x.name === e); if (n) walk(n); }); } walk(root);
        if (chain.length <= 1) { $('bento-evo').innerHTML = '<div style="opacity:0.5;padding:20px">No evolution chain.</div>'; return; }
        let h = `<div class="evo-flow">`;
        for (let i = 0; i < chain.length; i++) {
            const s = chain[i], curr = s.name === p.name ? 'current' : '';
            h += `<div class="evo-card ${curr}" data-name="${s.name}"><img src="${getSpriteUrl(s)}"><span>${trPoke(s.name)}</span></div>`;
            if (i < chain.length - 1) { const ns = chain[i + 1]; h += `<div class="evo-arrow">→<div class="evo-req">${ns.evolutionLevel ? `${trUi('Lv.')||'Lv.'} ${ns.evolutionLevel}` : (ns.evolutionReq ? trReq(ns.evolutionReq) : (ns.evoCondition || 'Evolves'))}</div></div>`; }
        }
        h += '</div>'; $('bento-evo').innerHTML = h;
        $('bento-evo').querySelectorAll('.evo-card').forEach(el => el.onclick = () => { const t = allPokemon.find(x => x.name === el.dataset.name); if (t) openStage(t); });
    }

    function renderBentoMoves(p) {
        const L = p.learnset || {}; const vGen = selectedVersion ? VERSION_TO_GEN[selectedVersion] : null; const mvs = [];
        for (const [mn, es] of Object.entries(L)) {
            es.forEach(e => {
                const gm = e.match(/^(\d+)/), ch = e.replace(/^\d+/, '').charAt(0), lm = e.match(/^\d+L(\d+)$/), gen = gm ? gm[1] : '9';
                if (!activeGens.has(gen) || (vGen && gen !== vGen)) return;
                const mnKey = mn.toLowerCase().replace(/[^a-z0-9]/g, '');
                const inf = movesData[mnKey] || null;
                mvs.push({ n: inf ? inf.originalName : mn.replace(/([a-z])([A-Z])/g, '$1 $2'), meth: ch, ml: LEARN_METHOD_LABELS[ch] || 'Other', lvl: lm ? parseInt(lm[1]) : 0, t: inf?.type || '?', c: inf?.category || '?', pw: inf?.basePower || '-', ac: inf?.accuracy === true ? '—' : (inf?.accuracy || '-'), pp: inf?.pp || '-', boosts: inf?.boosts, secondary: inf?.secondary });
            });
        }
        const umv =[]; const sm = new Set(); mvs.sort((a, b) => (a.meth === 'L' && b.meth !== 'L' ? -1 : (b.meth === 'L' && a.meth !== 'L' ? 1 : a.lvl - b.lvl || a.n.localeCompare(b.n)))).forEach(x => { if (!sm.has(x.n)) { umv.push(x); sm.add(x.n); } });

        let method = trUi('Level Up') || 'Level Up'; if (!umv.find(x => x.meth === 'L')) method = trUi('All') || 'All';
        function rb(m, q = '') {
            let f = (m === (trUi('All')||'All')) ? umv : umv.filter(x => (trUi(x.ml)||x.ml) === m); if (q) f = f.filter(x => trMove(x.n).toLowerCase().includes(q.toLowerCase()));
            return `<div class="moves-grid">${f.map(x => {
                let eh = formatMoveEffects(x);
                return `<div class="move-tile"><div class="move-header"><div class="move-name">${trMove(x.n)}</div><div class="move-badges"><span class="move-cat-badge type-bg-${x.t.toLowerCase()}">${trType(x.t)}</span><span class="move-cat-badge cat-${x.c.toLowerCase()}">${trUi(x.c)||x.c}</span></div></div><div class="move-stats">${trUi("PWR")||"PWR"}: ${x.pw} / ${trUi("ACC")||"ACC"}: ${x.ac} / ${trUi("PP")||"PP"}: ${x.pp} ${m === (trUi('Level Up')||'Level Up') || x.meth === 'L' ? `/ ${trUi("LV")||"LV"} ${x.lvl || '-'}` : ''}</div>${eh ? `<div class="move-effects">${eh}</div>` : ''}</div>`;
            }).join('')}</div>`;
        }
        function r(q = '') {
            const tabs = `<div class="moves-cat-tabs"><button class="m-tab ${method === (trUi('All')||'All') ? 'active' : ''}">${trUi('All')||'All'}</button>${[...new Set(umv.map(x => trUi(x.ml)||x.ml))].sort().map(x => `<button class="m-tab ${method === x ? 'active' : ''}">${x}</button>`).join('')}</div>`;
            $('bento-moves').innerHTML = `<div class="moves-toolbar"><input type="text" placeholder="${trUi('Search learned moves...')||'Search learned moves...'}" id="m-src" value="${q}">${tabs}</div>${rb(method, q)}`;
            $('bento-moves').querySelectorAll('.m-tab').forEach(b => b.onclick = () => { method = b.textContent; r($('m-src').value); });
            $('m-src').oninput = e => { const grid = $('bento-moves').querySelector('.moves-grid'); const div = document.createElement('div'); div.innerHTML = rb(method, e.target.value); grid.replaceWith(div.firstChild); };
        } r();
    }

     function renderBentoEncounters(p) {
        const sl = p.name.toLowerCase().replace(/[♀♂\s'-]/g, '');
        let locs = encounterData[sl] || encounterData[p.name.split('-')[0].toLowerCase()] || {};
        if (!Object.keys(locs).length) { $('bento-encounters').innerHTML = '<div style="opacity:0.5;padding:20px">No wild encounters documented.</div>'; return; }

        const normSelected = selectedVersion ? selectedVersion.toLowerCase().replace(/[\s'-]/g, '') : null;
        const sortedVersions = Object.keys(locs).sort((a, b) => {
            const aNorm = a.toLowerCase().replace(/[\s'-]/g, '');
            const bNorm = b.toLowerCase().replace(/[\s'-]/g, '');
            if (aNorm === normSelected) return -1;
            if (bNorm === normSelected) return 1;
            return a.localeCompare(b);
        });

        let h = `<div class="enc-grid">`;
        for (const ver of sortedVersions) {
            const list = locs[ver];
            if (!list.length) continue;

            const isSelected = normSelected === ver.toLowerCase().replace(/[\s'-]/g, '');
            const isLongList = list.length > 12; // Smart threshold

            // Styling for the card container
            let cardStyles = [];
            if (isSelected) cardStyles.push(`border: 2px solid var(--theme-color)`, `background: var(--theme-surface)`, `box-shadow: 0 0 15px var(--theme-glow)`);
            if (isLongList && isSelected) cardStyles.push(`grid-column: 1 / -1`); // Span full width if long and active

            // Styling for the body grid
            let bodyStyles = [isSelected ? 'display:block' : 'display:none'];
            if (isLongList) bodyStyles.push(`display: ${isSelected ? 'grid' : 'none'}`, `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`, `gap: 12px 24px`);

            h += `<div class="enc-postcard" style="${cardStyles.join(';')}">
                <div class="enc-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='grid'||this.nextElementSibling.style.display==='block'?'none':'${isLongList?'grid':'block'}'">
                    <span>${trGame(ver)||ver} ${isSelected ? '✦' : ''}</span><span>▾</span>
                </div>
                <div class="enc-body" style="${bodyStyles.join(';')}">`;

            list.forEach(e => {
                let condHtml = (e.condition_values && e.condition_values.length) ? `<div class="enc-conditions">${e.condition_values.map(c => `<span class="enc-cond-tag">${trCond(c)||c}</span>`).join('')}</div>` : '';
                const chanceText = e.chance ? (isNaN(e.chance) ? e.chance : e.chance + '%') : '';
                h += `<div class="enc-row" style="margin-bottom:0; padding: 10px 0;">
                    <div>
                        <div class="enc-loc">${trLoc(e.location)||e.location}</div>
                        <div style="font-size:0.8rem;opacity:0.6">${trMeth(e.method || 'Walking')}</div>
                        ${condHtml}
                    </div>
                    <div class="enc-meta">
                        <div class="enc-lvl">${e.level_range ? (e.level_range.min === e.level_range.max ? `${trUi('Lv')||'Lv'} ${e.level_range.min}` : `${trUi('Lv')||'Lv'} ${e.level_range.min}-${e.level_range.max}`) : ''}</div>
                        <div style="color:var(--theme-color);font-weight:700">${chanceText}</div>
                    </div>
                </div>`;
            });
            h += '</div></div>';
        } h += '</div>'; $('bento-encounters').innerHTML = h;
    }

    // ---- Encounters Page Logic ----
    function renderEncountersPage() {
        const container = $('encounters-container');
        if (!container) return;
        if (!selectedVersion) {
            container.innerHTML = `<div class="enc-empty-state"><h3 style="opacity:0.6; text-align:center; padding: 40px;">${trUi("Please select a Version from the top menu to view wild encounters.") || "Please select a Version from the top menu to view wild encounters."}</h3></div>`;
            return;
        }

        if (lastEncVersion !== selectedVersion) {
            activeEncMethod = null;
            lastEncVersion = selectedVersion;
        }

        const routesMap = {};
        const uniqueMethods = new Set();
        const normVersion = selectedVersion.toLowerCase().replace(/[\s'-]/g, '');

        for (const [pokeSlug, verData] of Object.entries(encounterData)) {
            for (const [vName, encounters] of Object.entries(verData)) {
                if (vName.toLowerCase().replace(/[\s'-]/g, '') === normVersion) {
                    const p = allPokemon.find(x => x.name.toLowerCase().replace(/[♀♂\s'-]/g, '') === pokeSlug || x.name.split('-')[0].toLowerCase() === pokeSlug);
                    encounters.forEach(enc => {
                        const loc = enc.location || 'Unknown Location';
                        const method = enc.method || 'Unknown';
                        if (!routesMap[loc]) routesMap[loc] =[];
                        uniqueMethods.add(method);
                        routesMap[loc].push({ pokemon: p, method: method, chance: enc.chance, min: enc.level_range?.min, max: enc.level_range?.max, slug: pokeSlug, conditions: enc.condition_values || [] });
                    });
                }
            }
        }

        if (Object.keys(routesMap).length === 0) {
            container.innerHTML = `<div class="enc-empty-state"><h3 style="opacity:0.6; text-align:center; padding: 40px;">${trUi("No encounters documented for") || "No encounters documented for"} ${trGame(selectedVersion) || selectedVersion}.</h3></div>`;
            return;
        }

        const methodsArr =[...uniqueMethods].sort();
        let html = `<div class="enc-filter-bar">
            <button class="enc-filter-chip ${!activeEncMethod ? 'active' : ''}" data-idx="-1">${trUi("All Methods") || "All Methods"}</button>`;
        methodsArr.forEach((m, idx) => {
            html += `<button class="enc-filter-chip ${activeEncMethod === m ? 'active' : ''}" data-idx="${idx}">${trMeth(m)}</button>`;
        });
        html += `</div><div class="routes-list">`;

        let routesCount = 0;
        const savedEncUIState = new Set(JSON.parse(localStorage.getItem(`nexusDex_enc_ui_${selectedVersion}`) || '[]'));

        const order = locationOrderData[selectedVersion] || [];
        const existingLocs = Object.keys(routesMap);
        const sortedLocs = [
            ...order.filter(l => existingLocs.includes(l)),
            ...existingLocs.filter(l => !order.includes(l)).sort()
        ];

        for (const loc of sortedLocs) {
            const encs = activeEncMethod ? routesMap[loc].filter(e => e.method === activeEncMethod) : routesMap[loc];
            if (encs.length === 0) continue;
            routesCount++;

            const isExpanded = savedEncUIState.has(loc);
            html += `<div class="route-card ${isExpanded ? 'expanded' : ''}" data-loc="${loc.replace(/"/g, '&quot;')}"><div class="route-header" onclick="window.toggleEncounterRoute(this)"><h3>${trLoc(loc) || loc}</h3><span class="wt-chevron">▾</span></div><div class="route-body">`;

            encs.forEach(e => {
                const pName = e.pokemon ? trPoke(e.pokemon.name) : e.slug;
                const pImg = e.pokemon ? getSpriteUrl(e.pokemon) : '';
                let condHtml = '';
                if (e.conditions && e.conditions.length > 0) {
                    condHtml = `<div class="enc-conditions">${e.conditions.map(c => `<span class="enc-cond-tag">${trCond(c) || c}</span>`).join('')}</div>`;
                }
                html += `<div class="route-enc-item" ${e.pokemon ? `onclick="window.openStageByNum(${e.pokemon.number})"` : ''}>
                    ${pImg ? `<img src="${pImg}" loading="lazy">` : ''}
                    <div class="rei-info">
                        <div class="rei-name">${pName}</div>
                        <div class="rei-method">${trMeth(e.method)}</div>
                        ${condHtml}
                    </div>
                    <div class="rei-meta"><div class="rei-lvl">${e.min ? (e.min === e.max ? `${trUi('Lv')||'Lv'} ${e.min}` : `${trUi('Lv')||'Lv'} ${e.min}-${e.max}`) : ''}</div><div class="rei-chance">${e.chance ? (isNaN(e.chance) ? e.chance : e.chance + '%') : ''}</div></div>
                </div>`;
            });
            html += `</div></div>`;
        }

        if (routesCount === 0) {
            html += `<div class="enc-empty-state"><h3 style="opacity:0.6; text-align:center; padding: 40px;">${trUi("No encounters match the selected method.") || "No encounters match the selected method."}</h3></div>`;
        }
        html += `</div>`;

        container.innerHTML = html;

        container.querySelectorAll('.enc-filter-chip').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                activeEncMethod = idx === -1 ? null : methodsArr[idx];
                renderEncountersPage();
            };
        });
    }

    window.toggleEncounterRoute = function(element) {
        if (!selectedVersion) return;
        const card = element.closest('.route-card');
        if (card) {
            card.classList.toggle('expanded');
            const expandedList = [];
            document.querySelectorAll('.route-card.expanded').forEach(el => expandedList.push(el.getAttribute('data-loc')));
            localStorage.setItem(`nexusDex_enc_ui_${selectedVersion}`, JSON.stringify(expandedList));
        }
    };


    window.openStageByNum = (num) => { const p = allPokemon.find(x => x.number === num); if (p) openStage(p); };

    function updateGameHub() {
        const title = selectedVersion ? (trGame(selectedVersion) || selectedVersion) : (trUi("Encounters") || "Encounters");
        const navBtn = $('nav-encounters');
        if (navBtn) navBtn.textContent = title;

        const hubTitle = $('game-hub-title');
        if (hubTitle) hubTitle.textContent = title;

        const tabs = $('game-hub-tabs');
        if (tabs) tabs.style.display = (selectedVersion && currentPage === 'encounters') ? 'flex' : 'none';

        if (selectedVersion) {
            if (activeGameTab === 'walkthrough') {
                loadAndRenderWalkthrough();
            } else {
                renderEncountersPage();
            }
        } else {
            renderEncountersPage();
            if ($('walkthrough-container')) $('walkthrough-container').innerHTML = '';
        }
    }

     // Helper to traverse and get data node
    function getWtNode(data, path) {
        const parts = path.split('::');
        let curr = data;
        for (const p of parts) {
            if (curr && curr[p]) curr = curr[p];
            else return null;
        }
        return curr;
    }

    // Helper to get all step IDs safely from a node
    function getAllIdsInSection(node, path) {
        let ids = [];
        function scan(n, p) {
            for (const [k, v] of Object.entries(n)) {
                const currPath = p ? `${p}::${k}` : k;
                if (k === 'Text' && Array.isArray(v)) {
                    for (let i = 0; i < v.length; i++) {
                        ids.push(`wt_${(currPath).replace(/[^a-zA-Z0-9]/g, '_')}_${i}`);
                    }
                } else {
                    scan(v, currPath);
                }
            }
        }
        scan(node, path);
        return ids;
    }

    window.saveWalkthroughUIState = function() {
        if (!selectedVersion) return;
        const expanded = [];
        document.querySelectorAll('.wt-part.expanded').forEach(el => expanded.push(el.getAttribute('data-path')));
        document.querySelectorAll('.wt-chapter.expanded').forEach(el => expanded.push(el.getAttribute('data-path')));
        localStorage.setItem(`nexusDex_wt_ui_${selectedVersion}`, JSON.stringify(expanded));
    };

    window.updateWalkthroughProgress = function() {
        if (!selectedVersion) return;
        const prefix = VERSION_TO_WALKTHROUGH[selectedVersion];
        const rootData = walkthroughCache[prefix];
        const savedState = new Set(JSON.parse(localStorage.getItem(`nexusDex_wt_${selectedVersion}`) || '[]'));

        // 1. Update individual steps
        const steps = document.querySelectorAll('.wt-step');
        steps.forEach(step => {
            const cb = step.querySelector('.wt-checkbox');
            cb.checked = savedState.has(cb.id);
            step.classList.toggle('completed', cb.checked);
            step.classList.remove('next-target');
        });

        // First unchecked step
        const firstUnchecked = document.querySelector('.wt-checkbox:not(:checked)');
        if (firstUnchecked) {
            firstUnchecked.closest('.wt-step').classList.add('next-target');
        }

        // 2. Update Sections (Parts & Chapters)
        const sections = document.querySelectorAll('.wt-part, .wt-chapter');
        sections.forEach(sec => {
            const path = sec.getAttribute('data-path');
            const node = getWtNode(rootData, path);
            if (!node) return;

            const ids = getAllIdsInSection(node, path);
            const isComplete = ids.length > 0 && ids.every(id => savedState.has(id));

            const bulkCb = sec.querySelector('.wt-bulk-checkbox');
            if (bulkCb) bulkCb.checked = isComplete;

            sec.classList.toggle('completed', isComplete);
            sec.classList.remove('next-active-part', 'next-active-chapter');
        });

        // 3. Highlight Next Active Sections
        const nextPart = document.querySelector('.wt-part:not(.completed)');
        if (nextPart) {
            nextPart.classList.add('next-active-part');
            const nextChap = nextPart.querySelector('.wt-chapter:not(.completed)');
            if (nextChap) nextChap.classList.add('next-active-chapter');
        }
    };

    window.handleStepCheck = function(checkbox) {
        const savedState = new Set(JSON.parse(localStorage.getItem(`nexusDex_wt_${selectedVersion}`) || '[]'));
        if (checkbox.checked) savedState.add(checkbox.id);
        else savedState.delete(checkbox.id);
        localStorage.setItem(`nexusDex_wt_${selectedVersion}`, JSON.stringify([...savedState]));

        window.updateWalkthroughProgress();

        if (checkbox.checked) {
            const chapter = checkbox.closest('.wt-chapter');
            if (chapter && chapter.classList.contains('completed')) {
                chapter.classList.remove('expanded');
            }

            const part = checkbox.closest('.wt-part');
            if (part && part.classList.contains('completed')) {
                part.classList.remove('expanded');
                const nextPart = part.nextElementSibling;
                if (nextPart && nextPart.classList.contains('wt-part')) {
                    const pk = nextPart.getAttribute('data-path');
                    window.toggleWalkthroughPart(pk, true);
                    setTimeout(() => {
                        const headerOffset = document.getElementById('app-header').offsetHeight + 20;
                        window.scrollTo({ top: nextPart.getBoundingClientRect().top + window.scrollY - headerOffset, behavior: 'smooth' });
                    }, 300);

                }
            }
            window.saveWalkthroughUIState();
        }
    };

    window.handleBulkCheck = function(checkbox, path, isPart) {
        const prefix = VERSION_TO_WALKTHROUGH[selectedVersion];
        const rootData = walkthroughCache[prefix];
        const node = getWtNode(rootData, path);
        const ids = getAllIdsInSection(node, path);
        const savedState = new Set(JSON.parse(localStorage.getItem(`nexusDex_wt_${selectedVersion}`) || '[]'));

        if (checkbox.checked) {
            ids.forEach(id => savedState.add(id));
        } else {
            ids.forEach(id => savedState.delete(id));
        }
        
        localStorage.setItem(`nexusDex_wt_${selectedVersion}`, JSON.stringify([...savedState]));
        window.updateWalkthroughProgress();

        if (checkbox.checked) {

            
            const container = document.querySelector(`[data-path="${path}"]`);
            if (container) {
                container.classList.remove('expanded');
                
                const partToCollapse = isPart ? container : container.closest('.wt-part');
                
                if (partToCollapse && partToCollapse.classList.contains('completed')) {
                    partToCollapse.classList.remove('expanded');
                    const nextPart = partToCollapse.nextElementSibling;

                    if (nextPart && nextPart.classList.contains('wt-part')) {
                        window.toggleWalkthroughPart(nextPart.getAttribute('data-path'), true);
                        setTimeout(() => {
                            const headerOffset = document.getElementById('app-header').offsetHeight + 20;
                            window.scrollTo({ top: nextPart.getBoundingClientRect().top + window.scrollY - headerOffset, behavior: 'smooth' });
                        }, 300);

                    }
                }
                window.saveWalkthroughUIState();
            }
        }
    };

    window.toggleWalkthroughChapter = function(e, chapterPath) {
        if (e.target.closest('.wt-section-check')) return;
        const chapter = document.querySelector(`.wt-chapter[data-path="${chapterPath}"]`);
        if (chapter) {
            chapter.classList.toggle('expanded');
            window.saveWalkthroughUIState();
        }
    };

    window.toggleWalkthroughPart = function(partPath, forceOpen = false, event = null) {
        if (event && event.target.closest('.wt-section-check')) return;
        const partEl = document.querySelector(`.wt-part[data-path="${partPath}"]`);
        if (!partEl) return;
        const bodyEl = document.getElementById(`wt-body-${partPath.replace(/[^a-zA-Z0-9]/g, '_')}`);

        const isExpanding = forceOpen || !partEl.classList.contains('expanded');

        if (isExpanding) {
            if (!bodyEl.innerHTML.trim()) {
                const data = walkthroughCache[VERSION_TO_WALKTHROUGH[selectedVersion]][partPath];
                const savedUIState = new Set(JSON.parse(localStorage.getItem(`nexusDex_wt_ui_${selectedVersion}`) || '[]'));
                const savedProgressState = new Set(JSON.parse(localStorage.getItem(`nexusDex_wt_${selectedVersion}`) || '[]'));
                const hasUIState = localStorage.getItem(`nexusDex_wt_ui_${selectedVersion}`) !== null;
                bodyEl.innerHTML = buildWalkthroughContent(data, 2, partPath, savedUIState, hasUIState, savedProgressState);
                setTimeout(window.updateWalkthroughProgress, 0);
            }
            partEl.classList.add('expanded');
        } else {
            partEl.classList.remove('expanded');
        }
        window.saveWalkthroughUIState();
    };

    function buildWalkthroughContent(node, level, path = "", savedUIState = new Set(), hasUIState = false, savedProgressState = new Set()) {
        if (!node) return '';
        let html = '';
        for (const [key, val] of Object.entries(node)) {
            const currentPath = path ? `${path}::${key}` : key;
            if (key === 'Text' && Array.isArray(val)) {
                html += '<div class="wt-text-group">';
                html += val.map((p, idx) => {
                    const stepId = `wt_${(currentPath).replace(/[^a-zA-Z0-9]/g, '_')}_${idx}`;
                    return `<label class="wt-step" for="${stepId}">
                        <input type="checkbox" id="${stepId}" class="wt-checkbox" onchange="window.handleStepCheck(this)">
                        <div class="wt-check-box"></div>
                        <div class="wt-step-text">${p}</div>
                    </label>`;
                }).join('');
                html += '</div>';
            } else {
                const formattedKey = key.replace(/_/g, ' ');
                let content = buildWalkthroughContent(val, level + 1, currentPath, savedUIState, hasUIState, savedProgressState);
                if (content) {
                    if (level === 2) {
                        const isExpanded = hasUIState ? savedUIState.has(currentPath) : true;

                        // Check if complete without relying on DOM yet
                        const ids = getAllIdsInSection(val, currentPath);
                        const isComplete = ids.length > 0 && ids.every(id => savedProgressState.has(id));

                        html += `<div class="wt-chapter ${isExpanded ? 'expanded' : ''} ${isComplete ? 'completed' : ''}" data-path="${currentPath}">
                            <div class="wt-chapter-header" onclick="window.toggleWalkthroughChapter(event, '${currentPath}')">
                                <div style="display:flex; align-items:center; gap: 12px;">
                                    <label class="wt-section-check" onclick="event.stopPropagation()">
                                        <input type="checkbox" class="wt-bulk-checkbox" onchange="window.handleBulkCheck(this, '${currentPath}', false)" ${isComplete ? 'checked' : ''}>
                                        <div class="wt-check-box"></div>
                                    </label>
                                    <h3>${formattedKey}</h3>
                                </div>
                                <span class="wt-chevron">▾</span>
                            </div>
                            <div class="wt-chapter-body">${content}</div>
                        </div>`;
                    } else {
                        const hTag = `h${Math.min(level + 1, 6)}`;
                        html += `<div class="wt-subsection"><${hTag} class="wt-heading">${formattedKey}</${hTag}>${content}</div>`;
                    }
                }
            }
        }
        return html;
    }

    async function loadAndRenderWalkthrough() {
        const container = $('walkthrough-container');
        if (!selectedVersion) return;
        const prefix = VERSION_TO_WALKTHROUGH[selectedVersion];
        if (!prefix) {
            container.innerHTML = `<div class="enc-empty-state"><h3 style="opacity:0.6; text-align:center; padding: 40px;">${trUi("No walkthrough available for") || "No walkthrough available for"} ${trGame(selectedVersion) || selectedVersion}.</h3></div>`;
            return;
        }

        container.innerHTML = `<div class="loading-indicator visible" style="display:flex;"><div class="spinner"></div></div>`;

        try {
            if (!walkthroughCache[prefix]) {
                const res = await fetch(`/static/nexus_dex/walkthrough/${prefix}_walkthrough_text_only.json`);
                if (!res.ok) throw new Error('Not found');
                walkthroughCache[prefix] = await res.json();
            }

            const data = walkthroughCache[prefix];
            const savedState = new Set(JSON.parse(localStorage.getItem(`nexusDex_wt_${selectedVersion}`) || '[]'));
            const savedUIState = new Set(JSON.parse(localStorage.getItem(`nexusDex_wt_ui_${selectedVersion}`) || '[]'));
            const hasUIState = localStorage.getItem(`nexusDex_wt_ui_${selectedVersion}`) !== null;

            let html = '';
            for (const [partKey, partData] of Object.entries(data)) {
                const formattedKey = partKey.replace(/_/g, ' ');
                const isExpanded = hasUIState ? savedUIState.has(partKey) : false;

                const ids = getAllIdsInSection(partData, partKey);
                const isComplete = ids.length > 0 && ids.every(id => savedState.has(id));

                html += `<div class="wt-part ${isExpanded ? 'expanded' : ''} ${isComplete ? 'completed' : ''}" data-path="${partKey}">
                    <div class="wt-part-header" onclick="window.toggleWalkthroughPart('${partKey}', false, event)">
                        <div style="display:flex; align-items:center; gap: 12px;">
                            <label class="wt-section-check" onclick="event.stopPropagation()">
                                <input type="checkbox" class="wt-bulk-checkbox" onchange="window.handleBulkCheck(this, '${partKey}', true)" ${isComplete ? 'checked' : ''}>
                                <div class="wt-check-box"></div>
                            </label>
                            <h2>${formattedKey}</h2>
                        </div>
                        <span class="wt-chevron">▾</span>
                    </div>
                    <div class="wt-part-body" id="wt-body-${partKey.replace(/[^a-zA-Z0-9]/g, '_')}"></div>
                </div>`;
            }
            container.innerHTML = html;

            if (hasUIState) {
                savedUIState.forEach(key => {
                    if (data[key]) window.toggleWalkthroughPart(key, true);
                });
            }
            window.updateWalkthroughProgress();

            // Auto-open active part if nothing is saved open
            if (!hasUIState) {
                const activePart = document.querySelector('.wt-part.next-active-part');
                if (activePart) window.toggleWalkthroughPart(activePart.getAttribute('data-path'), true);
            }

        } catch (e) {
            container.innerHTML = `<div class="enc-empty-state"><h3 style="opacity:0.6; text-align:center; padding: 40px;">${trUi("Walkthrough file not found.") || "Walkthrough file not found."}</h3></div>`;
        }
    }

    // ---- Team Builder Logic (Orbs) ----
    function renderTeamSlots() {
        const sc = $('team-slots'); sc.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const p = team[i], s = document.createElement('div');
            s.className = `orb-slot ${p ? 'filled' : 'empty'}`; s.draggable = !!p;
            if (p) {
                s.style.borderColor = TYPE_COLORS[getEffectiveTypes(p)[0]];
                s.innerHTML = `<img src="${getSpriteUrl(p)}"><div class="remove-btn">✕</div>`;
                s.onclick = (e) => { if (e.target.classList.contains('remove-btn')) { team[i] = null; saveData(); showToast(p.name + " removed."); renderTeamSlots(); } else openStage(p); };
                s.ondragstart = e => { e.dataTransfer.setData('text/plain', i); s.classList.add('dragging'); };
                s.ondragend = () => s.classList.remove('dragging');
                s.oncontextmenu = e => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, p, i); };
            } else {
                s.innerHTML = '<span style="font-size:1.5rem;opacity:0.3">+</span>';
                s.onclick = () => { navigateTo('pokedex'); $('search-input').focus(); showToast("Select a Pokémon from Gallery!"); };
            }
            s.ondragover = e => { e.preventDefault(); s.classList.add('drag-over'); };
            s.ondragleave = () => s.classList.remove('drag-over');
            s.ondrop = e => {
                e.preventDefault(); s.classList.remove('drag-over');
                if (e.dataTransfer.getData('source') === 'gallery') {
                    const num = parseInt(e.dataTransfer.getData('poke_num')); const pk = allPokemon.find(x => x.number === num);
                    if (pk) { addToTeamSlot(pk, i); const r = document.createElement('div'); r.className = 'ripple'; s.appendChild(r); setTimeout(() => r.remove(), 600); }
                } else {
                    const fi = parseInt(e.dataTransfer.getData('text/plain'));
                    if (!isNaN(fi) && fi !== i) {
                        const t = team[fi]; team[fi] = team[i]; team[i] = t;
                        saveData();
                        const r = document.createElement('div'); r.className = 'ripple'; s.appendChild(r); setTimeout(() => r.remove(), 600);
                        renderTeamSlots();
                    }
                }
            };
            sc.appendChild(s);
        }
        $('pc-box-count').textContent = pcBox.length;
    }

    function addToTeamSlot(p, forcedIdx = -1) {
        if (forcedIdx >= 0 && forcedIdx < 6) team[forcedIdx] = p;
        else if (team.includes(null)) team[team.indexOf(null)] = p;
        else { pcBox.push(p); showToast(p.name + " sent to PC Box!"); }
        saveData();
        renderTeamSlots(); renderPCBox();
    }

    function renderPCBox() {
        const g = $('pc-box-grid');
        g.innerHTML = pcBox.map((p, i) => {
            const t = getEffectiveTypes(p);
            return `<div class="pc-item" onclick="pcClick(${i})">
                <img src="${getSpriteUrl(p)}" loading="lazy">
                <span class="pc-item-name">${trPoke(p.name)}</span>
                <div class="pc-item-types">${t.map(x => `<span class="type-pill ${getTypeBgClass(x)}">${trType(x)}</span>`).join('')}</div>
            </div>`;
        }).join('');
    }
    window.pcClick = (i) => {
        const p = pcBox[i]; const ei = team.indexOf(null);
        if (ei !== -1) { team[ei] = p; pcBox.splice(i, 1); saveData(); renderTeamSlots(); renderPCBox(); showToast(p.name + " moved to party!"); }
        else { openStage(p); }
    };

    // ---- Type Chart Page ----
    function renderTypeChart() {
        if (!typeData || typeData.length === 0) return;
        const cd = typeData.find(t => t.type === activeTypeChart) || typeData[typeData.length - 1];
        if (!cd || !cd.defensive) return;
        const types = Object.keys(cd.defensive);

        let h = `<div class="typechart-meta">${trUi("Active Ruleset:") || "Active Ruleset:"} <span id="tc-cycle-trigger" style="cursor:pointer; user-select:none;" title="Click to cycle rulesets">${cd.name}</span></div>`;
        h += '<table class="typechart-table" id="tc-table">';
        h += '<thead><tr><th><div style="font-size:0.65rem;opacity:0.6;text-align:right;padding-right:4px;">DEF &rarr;<br>&darr; ATK</div></th>';

        // Render Column Headers (Defending Types)
        types.forEach(t => {
            h += `<th class="tc-header col-header type-bg-${t.toLowerCase()}" data-type="${t}" title="${trType(t)}">${trType(t).substring(0,3).toUpperCase()}</th>`;
        });
        h += '</tr></thead><tbody>';

        // Render Rows (Attacking Types)
        types.forEach(atk => {
            h += `<tr><th class="tc-header row-header type-bg-${atk.toLowerCase()}" data-type="${atk}">${trType(atk)}</th>`;
            types.forEach(def => {
                let m = 1;
                if (cd.defensive[def] && cd.defensive[def]['2']?.includes(atk)) m = 2;
                else if (cd.defensive[def] && cd.defensive[def]['0.5']?.includes(atk)) m = 0.5;
                else if (cd.defensive[def] && cd.defensive[def]['0']?.includes(atk)) m = 0;

                let c = m === 2 ? 'eff-2' : m === 0.5 ? 'eff-05' : m === 0 ? 'eff-0' : 'eff-1';
                let text = m === 0.5 ? '½' : m === 1 ? '' : m;

                h += `<td class="tc-cell ${c}" data-row="${atk}" data-col="${def}">${text}</td>`;
            });
            h += '</tr>';
        });
        h += '</tbody></table>';

        $('typechart-wrapper').innerHTML = h;

        // Interactive Filtering / Highlighting
        const table = $('tc-table');
        let selectedChartType = null;

        table.querySelectorAll('.tc-header').forEach(hdr => {
            hdr.addEventListener('click', () => {
                const t = hdr.getAttribute('data-type');
                if (selectedChartType === t) {
                    // Turn filter off if clicked again
                    selectedChartType = null;
                    table.classList.remove('is-filtered');
                    table.querySelectorAll('.dimmed').forEach(el => el.classList.remove('dimmed'));
                    table.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                } else {
                    // Turn filter on for 't'
                    selectedChartType = t;
                    table.classList.add('is-filtered');
                    table.querySelectorAll('th, td').forEach(el => {
                        const r = el.getAttribute('data-row');
                        const c = el.getAttribute('data-col');
                        const isType = el.getAttribute('data-type') === t;

                        if (isType || r === t || c === t) {
                            el.classList.remove('dimmed');
                            el.classList.add('highlight');
                        } else if (el.tagName !== 'TH' || el.getAttribute('data-type')) {
                            el.classList.add('dimmed');
                            el.classList.remove('highlight');
                        }
                    });
                }
            });
        });
        // Cycle Ruleset Logic
        const trigger = $('tc-cycle-trigger');
        if (trigger) {
            trigger.onclick = () => {
                const order = ['gen1', 'gen2-5', 'gen6+'];
                let idx = order.indexOf(activeTypeChart);
                activeTypeChart = order[(idx + 1) % order.length];

                // Re-render everything affected by type rules
                renderTypeChart();
                applyFilters();
                if (team.some(p => p)) renderTeamSlots();
                if (pcBox.length) renderPCBox();

                showToast(`${trUi("Ruleset changed to:") || "Ruleset:"} ${activeTypeChart.toUpperCase()}`);
            };
        }
    }

    function showToast(m) { const t = $('toast-container'), d = document.createElement('div'); d.className = 'toast'; d.textContent = m; t.prepend(d); setTimeout(() => d.classList.add('toast-out'), 2000); setTimeout(() => d.remove(), 2400); }
    function navigateTo(p) { 
        currentPage = p; 
        document.querySelectorAll('.page,.nav-btn').forEach(b => b.classList.remove('active')); 
        $(`page-${p}`).classList.add('active'); 
        $(`nav-${p}`).classList.add('active'); 
        
        const typeBar = $('type-filter-bar');
        const gameTabs = $('game-hub-tabs');
        if (typeBar) typeBar.style.display = p === 'pokedex' ? 'flex' : 'none';
        if (gameTabs) gameTabs.style.display = (p === 'encounters' && selectedVersion) ? 'flex' : 'none';
    }


    function showContextMenu(x, y, p, slotIdx) {
        cmTargetPoke = p; cmTargetSlot = slotIdx;
        const cm = $('context-menu');

        $('cm-add-team').style.display = slotIdx === -1 ? 'block' : 'none';
        $('cm-add-box').style.display = 'block';
        $('cm-remove-team').style.display = slotIdx !== -1 ? 'block' : 'none';

        const evoContainer = $('cm-evo-options');
        if (evoContainer) {
            evoContainer.innerHTML = '';
            if (slotIdx !== -1 && p.evolution && p.evolution.length > 0) {
                p.evolution.forEach(evoName => {
                    const evoPoke = allPokemon.find(e => e.name === evoName);
                    if (evoPoke) {
                        const btn = document.createElement('button');
                        btn.className = 'cm-btn cm-evo-btn';
                        btn.textContent = `Evolve to ${trPoke(evoName)}`;
                        btn.onclick = () => {
                            team[slotIdx] = evoPoke;
                            saveData();
                            renderTeamSlots();
                            showToast(`${trPoke(p.name)} evolved!`);
                            cm.classList.remove('active');
                        };
                        evoContainer.appendChild(btn);
                    }
                });
            }
        }
        


        cm.classList.add('active');
        const rect = cm.getBoundingClientRect();
        let posX = x, posY = y;
        if (posX + rect.width > window.innerWidth) posX -= rect.width;
        if (posY + rect.height > window.innerHeight) posY -= rect.height;
        cm.style.left = `${posX}px`; cm.style.top = `${posY}px`;
    }

    function getNexusSaveKey() {
        const uname = (window.GAMEHUB_USER && window.GAMEHUB_USER.username) ? window.GAMEHUB_USER.username : 'guest';
        return 'nexus_dex_save_' + uname;
    }

    function saveData() {
        const data = { lang: currentLang, gens:[...activeGens], teamNums: team.map(p => p ? p.number : null), boxNums: pcBox.map(p => p.number), selectedVersion: selectedVersion };
        const key = getNexusSaveKey();
        localStorage.setItem(key, JSON.stringify(data));
        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
        try {
            fetch('/api/save/nexus_dex', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? {'X-Auth-Token': token} : {})
                },
                body: JSON.stringify({ state: data })
            }).catch(() => {});
        } catch (e) {}
    }

    let _nexusCloudChecked = false;
    function applyNexusSaveData(d) {
        if (!d) return;
        if (d.lang) currentLang = d.lang;
        if (d.gens) activeGens = new Set(d.gens);
        if (d.teamNums) team = d.teamNums.map(n => n ? allPokemon.find(p => p.number === n) || null : null);
        if (d.boxNums) pcBox = d.boxNums.map(n => allPokemon.find(p => p.number === n)).filter(Boolean);
        if (d.selectedVersion !== undefined) selectedVersion = d.selectedVersion;
    }

    function loadSavedData() {
        try {
            const key = getNexusSaveKey();
            const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');

            if (!_nexusCloudChecked) {
                _nexusCloudChecked = true;
                fetch('/api/save/nexus_dex', {
                    headers: token ? {'X-Auth-Token': token} : {}
                }).then(r => r.json()).then(cloud => {
                    if (cloud && cloud.state && Object.keys(cloud.state).length > 0) {
                        localStorage.setItem(key, JSON.stringify(cloud.state));
                        applyNexusSaveData(cloud.state);
                    } else {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            try { applyNexusSaveData(JSON.parse(raw)); } catch(e) {}
                        }
                    }
                }).catch(() => {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        try { applyNexusSaveData(JSON.parse(raw)); } catch(e) {}
                    }
                });
                return;
            }

            const raw = localStorage.getItem(key);
            if (raw) {
                applyNexusSaveData(JSON.parse(raw));
            }
        } catch (e) { console.error('Save load failed', e); }
    }

     function updateStaticTexts() {
        if ($('search-input')) $('search-input').placeholder = trUi("Search Pokémon...") || "Search Pokémon...";
        if ($('nav-pokedex')) $('nav-pokedex').textContent = trUi("Pokédex") || "Gallery";
        if ($('cm-add-team')) $('cm-add-team').textContent = trUi("Add to Party") || "Add to Party";
        if ($('cm-add-box')) $('cm-add-box').textContent = trUi("Send to PC Box") || "Send to PC Box";
        if ($('cm-remove-team')) $('cm-remove-team').textContent = trUi("Remove") || "Remove";
        if ($('version-filter-label')) $('version-filter-label').textContent = selectedVersion ? (trGame(selectedVersion) || selectedVersion) : (trUi("All Versions") || "All Versions");

        const bentoStats = document.querySelector('.stats-box h3'); if (bentoStats) bentoStats.textContent = trUi("Combat Stats") || "Combat Stats";
        const bentoAbs = document.querySelector('.abilities-box h3'); if (bentoAbs) bentoAbs.textContent = trUi("Abilities") || "Abilities";
        const bentoPrep = document.querySelector('.prep-box h3'); if (bentoPrep) bentoPrep.textContent = trUi("Battle Prep") || "Battle Prep";
        const bentoEvo = document.querySelector('.evo-box h3'); if (bentoEvo) bentoEvo.textContent = trUi("Evolution") || "Evolution Journey";
        const bentoEnc = document.querySelector('.encounters-box h3'); if (bentoEnc) bentoEnc.textContent = trUi("Travel Guide") || "Travel Guide";
        const bentoMoves = document.querySelector('.moves-box h3'); if (bentoMoves) bentoMoves.textContent = trUi("Movesets") || "Move Library";
    }

    async function init() {
        await loadAllData();
        loadSavedData();
        updateActiveTypeChart();
        buildDropdowns();
        applyFilters();
        renderTeamSlots();
        renderPCBox();
        renderTypeChart();
        updateGameHub();
        updateStaticTexts();
        navigateTo(currentPage);


        document.querySelectorAll('.gh-tab').forEach(btn => {
            btn.onclick = async () => {
                tabScrollY[activeGameTab] = window.scrollY;
                document.querySelectorAll('.gh-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeGameTab = btn.dataset.tab;
                document.querySelectorAll('.gh-content').forEach(c => c.classList.remove('active'));
                $(`${activeGameTab}-container`).classList.add('active');
                if (activeGameTab === 'walkthrough') await loadAndRenderWalkthrough();
                else renderEncountersPage();          

                setTimeout(() => window.scrollTo(0, tabScrollY[activeGameTab] || 0), 50);
            };
        });

        $('lang-select').value = currentLang;
        $('lang-select').onchange = e => {
            currentLang = e.target.value;
            saveData();
            applyFilters();
            renderTeamSlots();
            renderPCBox();
            renderTypeChart();
            buildDropdowns();
            updateGameHub();
            updateStaticTexts();
            showToast("Language updated!");
        };
        $('btn-settings').onclick = () => $('settings-overlay').classList.add('active');
        $('settings-close').onclick = () => $('settings-overlay').classList.remove('active');

        $('search-input').oninput = e => {
    searchQuery = e.target.value;
    $('search-container').classList.toggle('has-value', searchQuery.length > 0);
    if (currentPage !== 'pokedex' && searchQuery.length > 0) navigateTo('pokedex');
    applyFilters();
};
        $('search-clear').onclick = () => { $('search-input').value = ''; searchQuery = ''; $('search-container').classList.remove('has-value'); applyFilters(); };

        $('version-filter-btn').onclick = e => { e.stopPropagation(); $('version-filter-wrap').classList.toggle('open'); $('gen-filter-wrap').classList.remove('open'); };
        $('gen-filter-btn').onclick = e => { e.stopPropagation(); $('gen-filter-wrap').classList.toggle('open'); $('version-filter-wrap').classList.remove('open'); };

        document.onclick = e => {
            if (!$('version-filter-wrap').contains(e.target)) $('version-filter-wrap').classList.remove('open');
            if (!$('gen-filter-wrap').contains(e.target)) $('gen-filter-wrap').classList.remove('open');
            $('context-menu').classList.remove('active');
        };

        document.addEventListener('contextmenu', e => {
            if (!e.target.closest('.gallery-card') && !e.target.closest('.orb-slot')) {
                $('context-menu').classList.remove('active');
            }
        });

        $('cm-add-team').onclick = () => { if (cmTargetPoke) { addToTeamSlot(cmTargetPoke, team.indexOf(null)); showToast(cmTargetPoke.name + " added to Party!"); } $('context-menu').classList.remove('active'); };
        $('cm-add-box').onclick = () => {
            if (cmTargetPoke) {
                if (cmTargetSlot !== -1) { team[cmTargetSlot] = null; }
                pcBox.push(cmTargetPoke); saveData(); renderTeamSlots(); renderPCBox(); $('pc-box-count').textContent = pcBox.length; showToast(cmTargetPoke.name + " sent to PC Box!");
            }
            $('context-menu').classList.remove('active');
        };
        $('cm-remove-team').onclick = () => {
            if (cmTargetSlot !== -1) { team[cmTargetSlot] = null; saveData(); renderTeamSlots(); showToast("Removed from Party."); }
            $('context-menu').classList.remove('active');
        };

        document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => navigateTo(b.dataset.page));
        $('logo').onclick = () => { navigateTo('pokedex'); $('search-input').value = ''; searchQuery = ''; applyFilters(); };

        $('stage-close').onclick = () => { stageOverlay.classList.remove('active'); document.body.style.overflow = ''; };

        $('btn-pc-box').onclick = () => $('pc-drawer-overlay').classList.add('active');
        $('drawer-close').onclick = () => $('pc-drawer-overlay').classList.remove('active');

        window.onscroll = () => { if (currentPage === 'pokedex' && grid.getBoundingClientRect().bottom < window.innerHeight + 400) renderNextBatch(); };
    }

    init();
})();

