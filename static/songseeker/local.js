const LOCAL_STORAGE_KEY = 'hitster_local_state';

let gameState = {
    deck: [],
    team1: [],
    team2: [],
    currentCard: null,
    currentTurn: 1
};

// Drag and Drop State
let dragEl = null;
let isDragging = false;
let currentDropzone = null;
let placedIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startLocalGameBtn').addEventListener('click', initializeGame);
    document.getElementById('resetLocalBtn').addEventListener('click', resetGame);
    document.getElementById('drawCardBtn').addEventListener('click', drawCard);
    document.getElementById('revealCardBtn').addEventListener('click', revealCard);
    
    const skipBtn = document.getElementById('skipCardBtn');
    if (skipBtn) skipBtn.addEventListener('click', skipCard);

    const dismissBtn = document.getElementById('dismissBtn');
    if (dismissBtn) dismissBtn.addEventListener('click', dismissWrongCard);
    
    document.getElementById('localPlayPauseBtn').addEventListener('click', function() {
        if (!gameState.currentCard) return;
        const isPlaying = window.toggleYtVideo(gameState.currentCard.videoId, gameState.currentCard.startTime);
        if (window.setLocalPlayPauseIcon) window.setLocalPlayPauseIcon(isPlaying);
    });

    initDragAndDrop();
    loadState();
});

// Hook for YouTube Player Errors
window.showLocalError = function(msg) {
    const banner = document.getElementById('local-status-message');
    if (banner) {
        banner.textContent = `${msg} (Bitte Song überspringen)`;
        banner.style.display = 'block';
        banner.classList.add('pulsing');
    }
    const skipBtn = document.getElementById('skipCardBtn');
    if (skipBtn) {
        skipBtn.style.display = 'inline-flex';
        skipBtn.classList.add('flash-error-btn');
    }
    const drawBtn = document.getElementById('drawCardBtn');
    if (drawBtn) drawBtn.style.display = 'none';
    const revBtn = document.getElementById('revealCardBtn');
    if (revBtn) revBtn.style.display = 'none';
};

function loadState() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            gameState = JSON.parse(saved);
            if (!gameState.currentTurn) gameState.currentTurn = 1;
            
            if (gameState.deck.length > 0 || gameState.team1.length > 0 || gameState.team2.length > 0) {
                showGameBoard();
                renderTimelines();
                
                if (gameState.currentCard) {
                    restoreDrawnCardState(true);
                } else {
                    const cardArea = document.getElementById('current-card-area');
                    cardArea.style.visibility = 'hidden';
                    cardArea.style.display = 'flex';
                }
            }
        } catch (e) {
            console.error("Failed to load local state", e);
        }
    } else {
        fetch('/api/save/songseeker').then(r => r.json()).then(cloud => {
            if (cloud && cloud.state) {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloud.state));
                loadState();
            } else {
                showSetup();
            }
        }).catch(() => showSetup());
    }
}

function saveState() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
    try {
        fetch('/api/save/songseeker', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ state: gameState })
        }).catch(() => {});
    } catch(e) {}
}

function showSetup() {
    const setupDiv = document.getElementById('local-setup');
    setupDiv.classList.remove('hidden');
    setupDiv.style.display = 'flex';
    document.getElementById('local-gameboard').style.display = 'none';
    const bottomBar = document.getElementById('local-bottom-bar');
    if (bottomBar) bottomBar.style.display = 'none';
    const settings = document.getElementById('settings_div');
    if (settings) settings.classList.add('hidden'); 
}

function showGameBoard() {
    const setupDiv = document.getElementById('local-setup');
    setupDiv.classList.add('hidden'); 
    setupDiv.style.display = 'none';
    document.getElementById('local-gameboard').style.display = 'flex';
    const bottomBar = document.getElementById('local-bottom-bar');
    if (bottomBar) bottomBar.style.display = 'flex';
    const settings = document.getElementById('settings_div');
    if (settings) settings.classList.add('hidden'); 
    
    if (!gameState.currentCard) {
        document.getElementById('current-card-area').style.visibility = 'hidden';
    }
}

async function initializeGame() {
    const startBtn = document.getElementById('startLocalGameBtn');
    const checkboxes = document.querySelectorAll('#pack-selection input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert("Please select at least one pack!");
        return;
    }

    const urls = Array.from(checkboxes).map(cb => window.staticBaseUrl + cb.value);
    let combinedDeck = [];

    startBtn.textContent = "Loading packs...";
    startBtn.disabled = true;

    for (const url of urls) {
        try {
            const csv = await window.getCachedCsv(url);
            const parsedCards = extractCardsFromCSV(csv);
            combinedDeck = combinedDeck.concat(parsedCards);
        } catch (e) {
            console.error("Failed to load " + url, e);
        }
    }

    startBtn.textContent = "Start Local Game";
    startBtn.disabled = false;

    if (combinedDeck.length < 2) {
        alert("Not enough valid songs found in selected packs!");
        return;
    }

    // Shuffle deck
    for (let i = combinedDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinedDeck[i], combinedDeck[j]] = [combinedDeck[j], combinedDeck[i]];
    }

    gameState.deck = combinedDeck;
    gameState.team1 = [gameState.deck.pop()];
    gameState.team2 = [gameState.deck.pop()];
    gameState.currentCard = null;
    gameState.currentTurn = Math.random() < 0.5 ? 1 : 2;

    saveState();
    showGameBoard();
    renderTimelines();
    document.getElementById('current-card-area').style.visibility = 'hidden';
}

function extractCardsFromCSV(csvContent) {
    if (!csvContent || csvContent.length < 2) return [];
    
    const headers = csvContent[0].map(h => h ? h.replace(/^\uFEFF/, '').replace(/"/g, '').trim().toLowerCase() : '');
    
    const colArtist = headers.findIndex(h => h === 'artist' || h === 'interpret');
    const colTitle = headers.findIndex(h => h === 'title' || h === 'song' || h === 'titel');
    const colYear = headers.findIndex(h => h === 'year' || h === 'jahr');
    const colUrl = headers.findIndex(h => h === 'url' || h === 'link');

    const cards = [];
    for (let i = 1; i < csvContent.length; i++) {
        const row = csvContent[i];
        if (row.length <= Math.max(colArtist, colTitle, colYear, colUrl)) continue;

        let url = colUrl !== -1 ? row[colUrl] : '';
        if (!url) continue;

        const ytData = window.parseYoutubeLink(url);
        if (!ytData) continue;

        cards.push({
            artist: colArtist !== -1 ? row[colArtist] : 'Unknown',
            title: colTitle !== -1 ? row[colTitle] : 'Unknown',
            year: colYear !== -1 ? parseInt(row[colYear], 10) : 0,
            videoId: ytData.videoId,
            startTime: ytData.startTime || 0
        });
    }
    return cards;
}

function resetGame() {
    if (confirm("Are you sure you want to clear the game board and start over?")) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        gameState = { deck: [], team1: [], team2: [], currentCard: null, currentTurn: 1 };
        window.stopYtVideo();
        resetDraggableCard();
        
        const banner = document.getElementById('local-status-message');
        if (banner) banner.style.display = 'none';
        
        showSetup();
    }
}

function renderTimelines() {
    const t1Container = document.getElementById('team1-timeline');
    const t2Container = document.getElementById('team2-timeline');
    
    t1Container.innerHTML = '';
    t2Container.innerHTML = '';

    gameState.team1.sort((a, b) => a.year - b.year);
    gameState.team2.sort((a, b) => b.year - a.year);

    buildTimelineDOM(t1Container, gameState.team1, 1);
    buildTimelineDOM(t2Container, gameState.team2, 2);
    
    const turnIndicator = document.getElementById('turn-indicator');
    turnIndicator.textContent = `Team ${gameState.currentTurn}'s Turn`;
    turnIndicator.style.color = gameState.currentTurn === 1 ? '#cc0055' : '#0044cc';
}

function getSmartTextStyles(text) {
    if (!text) return '0.7rem';
    const len = text.length;
    if (len < 10) return '0.85rem';
    if (len < 16) return '0.75rem';
    if (len < 24) return '0.65rem';
    if (len < 32) return '0.58rem';
    return '0.52rem';
}

function buildTimelineDOM(container, teamDeck, teamNum) {
    container.appendChild(createDropzone(0, teamNum));
    
    teamDeck.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = `hitster-card team${teamNum}-card`;
        
        const titleSize = getSmartTextStyles(card.title);
        const artistSize = getSmartTextStyles(card.artist);
        
        cardEl.innerHTML = `
            <div class="side-text" style="font-size: ${titleSize};">${card.title}</div>
            <div class="year">${card.year}</div>
            <div class="side-text" style="font-size: ${artistSize};">${card.artist}</div>
        `;
        container.appendChild(cardEl);
        container.appendChild(createDropzone(index + 1, teamNum));
    });
}

function createDropzone(index, teamNum) {
    const dz = document.createElement('div');
    dz.className = 'dropzone';
    
    // Only the active team gets dashed lines!
    if (gameState.currentTurn === teamNum && gameState.currentCard) {
        dz.classList.add('available-dz');
    }
    dz.dataset.index = index;
    dz.dataset.team = teamNum;
    return dz;
}

function drawCard() {
    if (gameState.deck.length === 0) {
        alert("Deck is empty! Please reset the game.");
        return;
    }

    const banner = document.getElementById('local-status-message');
    if (banner) banner.style.display = 'none';
    const skipBtn = document.getElementById('skipCardBtn');
    if (skipBtn) skipBtn.classList.remove('flash-error-btn');

    gameState.currentCard = gameState.deck.pop();
    saveState();
    
    restoreDrawnCardState(false);
    window.playYtVideo(gameState.currentCard.videoId, gameState.currentCard.startTime);
}

function skipCard() {
    window.stopYtVideo();
    const banner = document.getElementById('local-status-message');
    if (banner) banner.style.display = 'none';
    const skipBtn = document.getElementById('skipCardBtn');
    if (skipBtn) skipBtn.classList.remove('flash-error-btn');
    
    drawCard();
}

function restoreDrawnCardState(isReload = false) {
    const cardArea = document.getElementById('current-card-area');
    cardArea.style.visibility = 'visible';
    cardArea.style.display = 'flex';
    
    resetDraggableCardVisibilityOnly();
    
    dragEl.dataset.draggable = 'true';
    dragEl.classList.remove('team1-card', 'team2-card');
    dragEl.classList.add(gameState.currentTurn === 1 ? 'team1-card' : 'team2-card');
    
    const titleEl = document.getElementById('cc-title');
    const artistEl = document.getElementById('cc-artist');
    
    artistEl.textContent = "Listen...";
    artistEl.style.fontSize = getSmartTextStyles("Listen...");
    
    titleEl.textContent = "...to Song";
    titleEl.style.fontSize = getSmartTextStyles("...to Song");
    
    document.getElementById('cc-year').textContent = "?";
    
    document.getElementById('drawCardBtn').style.display = 'none';
    
    const skipBtn = document.getElementById('skipCardBtn');
    if (skipBtn) skipBtn.style.display = 'inline-flex';
    
    const playBtn = document.getElementById('localPlayPauseBtn');
    playBtn.style.display = 'inline-flex';
    if (window.setLocalPlayPauseIcon) window.setLocalPlayPauseIcon(true);
    
    renderTimelines();
}

function resetDraggableCard() {
    resetDraggableCardVisibilityOnly();
    dragEl.dataset.draggable = 'false';
    const cardArea = document.getElementById('current-card-area');
    cardArea.style.visibility = 'hidden';
    cardArea.style.display = 'flex';
    document.getElementById('drawCardBtn').style.display = 'inline-flex';
    
    const skipBtn = document.getElementById('skipCardBtn');
    if (skipBtn) skipBtn.style.display = 'none';
    
    const dismissBtn = document.getElementById('dismissBtn');
    if (dismissBtn) dismissBtn.style.display = 'none';
    
    document.getElementById('localPlayPauseBtn').style.display = 'none';
}

function revealCard() {
    if (placedIndex === -1) return;
    
    const card = gameState.currentCard;
    const teamDeck = gameState.currentTurn === 1 ? gameState.team1 : gameState.team2;
    const isAscending = gameState.currentTurn === 1;
    
    const titleEl = document.getElementById('cc-title');
    const artistEl = document.getElementById('cc-artist');
    
    titleEl.textContent = card.title;
    titleEl.style.fontSize = getSmartTextStyles(card.title);
    
    artistEl.textContent = card.artist;
    artistEl.style.fontSize = getSmartTextStyles(card.artist);
    
    document.getElementById('cc-year').textContent = card.year;
    
    let correct = true;
    
    if (placedIndex > 0) {
        if (isAscending && card.year < teamDeck[placedIndex - 1].year) correct = false;
        if (!isAscending && card.year > teamDeck[placedIndex - 1].year) correct = false;
    }
    if (placedIndex < teamDeck.length) {
        if (isAscending && card.year > teamDeck[placedIndex].year) correct = false;
        if (!isAscending && card.year < teamDeck[placedIndex].year) correct = false;
    }
    
    const dragCard = document.getElementById('cc-card');
    const revealBtn = document.getElementById('revealCardBtn');
    revealBtn.disabled = true;
    document.getElementById('localPlayPauseBtn').style.display = 'none';
    
    const skipBtn = document.getElementById('skipCardBtn');
    if (skipBtn) skipBtn.style.display = 'none';

    if (correct) {
        playCorrectSound();
        dragCard.style.transition = 'none';
        dragCard.style.backgroundColor = '#22c55e';
        
        setTimeout(() => {
            dragCard.style.transition = 'background-color 1.2s ease-in-out';
            dragCard.style.backgroundColor = gameState.currentTurn === 1 ? '#ff8fbd' : '#84bbee';
        }, 500);

        setTimeout(() => {
            dragCard.style.transition = '';
            dragCard.style.backgroundColor = '';
            revealBtn.disabled = false;
            revealBtn.style.display = 'none';

            teamDeck.push(card);
            
            gameState.currentTurn = gameState.currentTurn === 1 ? 2 : 1;
            gameState.currentCard = null;
            placedIndex = -1;
            
            window.stopYtVideo();
            resetDraggableCard();
            saveState();
            renderTimelines();
        }, 1800);
    } else {
        playWrongSound();
        dragCard.style.transition = 'none';
        dragCard.style.backgroundColor = '#ef4444'; // Stays solid red until user clicks DISMISS!
        
        revealBtn.style.display = 'none';
        revealBtn.disabled = false;
        
        const disBtn = document.getElementById('dismissBtn');
        if (disBtn) disBtn.style.display = 'inline-flex';
    }
}

function dismissWrongCard() {
    const disBtn = document.getElementById('dismissBtn');
    if (disBtn) disBtn.style.display = 'none';
    
    const dragCard = document.getElementById('cc-card');
    const parentDz = dragCard ? dragCard.closest('.dropzone') : null;
    
    if (parentDz) {
        parentDz.classList.add('card-dismissing');
    } else if (dragCard) {
        dragCard.classList.add('card-dismissing');
    }
    
    setTimeout(() => {
        if (dragCard) {
            dragCard.classList.remove('card-dismissing');
            dragCard.style.transition = '';
            dragCard.style.backgroundColor = '';
        }
        if (parentDz) {
            parentDz.classList.remove('card-dismissing');
        }
        
        gameState.currentTurn = gameState.currentTurn === 1 ? 2 : 1;
        gameState.currentCard = null;
        placedIndex = -1;
        
        window.stopYtVideo();
        resetDraggableCard();
        saveState();
        renderTimelines();
    }, 410);
}

// Audio Synthesizer
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playCorrectSound() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime + 0.3);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

function playWrongSound() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime + 0.3);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

// Drag & Drop Engine
function initDragAndDrop() {
    dragEl = document.getElementById('cc-card');
    let ghostEl = null;
    
    const startDrag = (e) => {
        if (e.type.includes('mouse') && e.button !== 0) return;
        if (dragEl.dataset.draggable !== 'true') return;
        
        document.querySelectorAll('.timeline').forEach(tl => tl.classList.remove('has-placed-card'));
        document.querySelectorAll('.dropzone').forEach(dz => dz.classList.remove('placed-dz'));
        document.body.classList.add('is-card-dragging');

        isDragging = true;
        let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        ghostEl = dragEl.cloneNode(true);
        ghostEl.id = 'drag-ghost-clone';
        ghostEl.className = dragEl.className + ' drag-ghost';
        ghostEl.style.left = clientX + 'px';
        ghostEl.style.top = clientY + 'px';
        document.body.appendChild(ghostEl);
        
        dragEl.style.opacity = '0.3';
    };

    const moveDrag = (e) => {
        if (!isDragging || !ghostEl) return;
        if (e.cancelable) e.preventDefault(); 
        
        let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        ghostEl.style.left = clientX + 'px';
        ghostEl.style.top = clientY + 'px';
        
        const originArea = document.getElementById('current-card-area');
        const originRect = originArea.getBoundingClientRect();
        const originCenterX = originRect.left + originRect.width / 2;
        const originCenterY = originRect.top + originRect.height / 2;
        
        let minDistance = Math.hypot(clientX - originCenterX, clientY - originCenterY);
        let closestDz = null;
        
        const dropzones = document.querySelectorAll('.available-dz');
        dropzones.forEach(dz => {
            dz.classList.remove('active-dz');
            const rect = dz.getBoundingClientRect();
            const dzCenterX = rect.left + rect.width / 2;
            const dzCenterY = rect.top + rect.height / 2;
            
            const dist = Math.hypot(clientX - dzCenterX, clientY - dzCenterY);
            if (dist < minDistance) { 
                minDistance = dist;
                closestDz = dz;
            }
        });
        
        if (closestDz) {
            closestDz.classList.add('active-dz');
            currentDropzone = closestDz;
        } else {
            currentDropzone = null;
        }
    };

    const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        document.body.classList.remove('is-card-dragging');
        
        if (ghostEl) {
            ghostEl.remove();
            ghostEl = null;
        }
        dragEl.style.opacity = '1';
        
        document.querySelectorAll('.available-dz').forEach(dz => dz.classList.remove('active-dz'));
        
        if (currentDropzone) {
            currentDropzone.appendChild(dragEl);
            placedIndex = parseInt(currentDropzone.dataset.index);
            
            dragEl.classList.remove('team1-card', 'team2-card');
            dragEl.classList.add(gameState.currentTurn === 1 ? 'team1-card' : 'team2-card');
            
            currentDropzone.classList.add('placed-dz');
            const parentTimeline = currentDropzone.closest('.timeline');
            if (parentTimeline) parentTimeline.classList.add('has-placed-card');
            
            const skipBtn = document.getElementById('skipCardBtn');
            if (skipBtn) skipBtn.style.display = 'none';
            document.getElementById('revealCardBtn').style.display = 'inline-flex';
        } else {
            resetDraggableCardVisibilityOnly();
        }
        
        currentDropzone = null;
    };

    dragEl.addEventListener('mousedown', startDrag);
    dragEl.addEventListener('touchstart', startDrag, {passive: false});
    dragEl.addEventListener('contextmenu', e => e.preventDefault());
    
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag, {passive: false});
    
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
}

function resetDraggableCardVisibilityOnly() {
    document.body.classList.remove('is-card-dragging');
    const area = document.getElementById('current-card-area');
    if (area && dragEl) {
        area.appendChild(dragEl);
        dragEl.style.opacity = '1';
        dragEl.style.position = '';
        dragEl.style.left = '';
        dragEl.style.top = '';
        dragEl.style.width = '';
        dragEl.style.height = '';
        dragEl.style.transition = '';
        dragEl.style.backgroundColor = '';
        dragEl.classList.remove('team1-card', 'team2-card');
        if (gameState.currentCard) {
            dragEl.classList.add(gameState.currentTurn === 1 ? 'team1-card' : 'team2-card');
        }
    }
    document.querySelectorAll('.timeline').forEach(tl => tl.classList.remove('has-placed-card'));
    document.querySelectorAll('.dropzone').forEach(dz => dz.classList.remove('placed-dz'));
    placedIndex = -1;
    const revBtn = document.getElementById('revealCardBtn');
    if (revBtn) revBtn.style.display = 'none';
    const disBtn = document.getElementById('dismissBtn');
    if (disBtn) disBtn.style.display = 'none';
    const skipBtn = document.getElementById('skipCardBtn');
    if (skipBtn && gameState.currentCard) skipBtn.style.display = 'inline-flex';
    renderTimelines();
}