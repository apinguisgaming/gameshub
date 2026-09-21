import QrScanner from "https://unpkg.com/qr-scanner/qr-scanner.min.js";

window.staticBaseUrl = window.staticBaseUrl || "/static/songseeker/";

let player; 
let playbackTimer; 
let playbackDuration = 30; 
let qrScanner;
let csvCache = {};
let lastDecodedText = ""; 
let currentStartTime = 0;

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

document.addEventListener('DOMContentLoaded', function () {
    const video = document.getElementById('qr-video');

    if (isIOS()) {
        var autoplayCheckbox = document.getElementById('autoplay');
        if (autoplayCheckbox) {
            autoplayCheckbox.checked = false;
            autoplayCheckbox.disabled = true;
        }
    }

    qrScanner = new QrScanner(video, result => {
        if (result.data !== lastDecodedText) {
            lastDecodedText = result.data; 
            handleScannedLink(result.data);
        }
    }, { 
        highlightScanRegion: true,
        highlightCodeOutline: true,
    });
});

function setUIState(state) {
    const startBtn = document.getElementById('startScanButton');
    const videoWrapper = document.getElementById('video-wrapper');
    const cancelBtn = document.getElementById('cancelScanButton');
    const playbackUI = document.getElementById('playback-ui');
    const visualizer = document.getElementById('audio-visualizer');
    const doneBtn = document.getElementById('doneButton');
    const playBtn = document.getElementById('startstop-video');
    const statusMsg = document.getElementById('status-message');

    const localUI = document.getElementById('local-mode-ui');
    const isLocalMode = localUI && localUI.style.display !== 'none';

    if (startBtn) startBtn.style.display = 'none';
    if (videoWrapper) videoWrapper.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (playbackUI) playbackUI.style.display = 'none';
    if (visualizer) visualizer.style.display = 'none';
    if (doneBtn) doneBtn.style.display = 'none';
    if (statusMsg) {
        statusMsg.style.display = 'none';
        statusMsg.classList.remove('pulsing');
    }

    if (state === 'IDLE') {
        if (startBtn) startBtn.style.display = 'inline-flex';
        if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
    } else if (state === 'SCANNING') {
        if (videoWrapper) videoWrapper.style.display = 'block';
        if (cancelBtn) cancelBtn.style.display = 'block';
    } else if (state === 'FETCHING') {
        if (statusMsg) {
            statusMsg.textContent = '🔍 Fetching Song...';
            statusMsg.style.display = 'block';
            statusMsg.classList.add('pulsing');
        }
    } else if (state === 'LOADING') {
        if (statusMsg) {
            statusMsg.textContent = '⏳ Loading Audio...';
            statusMsg.style.display = 'block';
            statusMsg.classList.add('pulsing');
        }
    } else if (state === 'ERROR') {
        if (statusMsg) statusMsg.style.display = 'block';
        if (!isLocalMode && doneBtn) doneBtn.style.display = 'inline-flex';
    } else if (state === 'CUED' || state === 'PAUSED') {
        if (playbackUI) playbackUI.style.display = 'flex';
        if (!isLocalMode && doneBtn) doneBtn.style.display = 'inline-flex';
        if (playBtn) {
            playBtn.innerHTML = "Play";
            playBtn.disabled = false;
        }
    } else if (state === 'BUFFERING') {
        if (playbackUI) playbackUI.style.display = 'flex';
        if (!isLocalMode && doneBtn) doneBtn.style.display = 'inline-flex';
        if (playBtn) {
            playBtn.innerHTML = "Buffering...";
            playBtn.disabled = true;
        }
    } else if (state === 'PLAYING') {
        if (playbackUI) playbackUI.style.display = 'flex';
        if (visualizer) visualizer.style.display = 'block';
        if (!isLocalMode && doneBtn) doneBtn.style.display = 'inline-flex';
        if (playBtn) {
            playBtn.innerHTML = "Stop";
            playBtn.disabled = false;
        }
    }
}

async function handleScannedLink(decodedText) {
    decodedText = decodedText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const isHitster = isHitsterLink(decodedText);
    const isYT = isYoutubeLink(decodedText);
    const isRock = isRockster(decodedText);

    if (!isHitster && !isYT && !isRock) return;

    if (qrScanner) qrScanner.stop();
    setUIState('FETCHING');

    let youtubeURL = "";
    if (isYT) {
        youtubeURL = decodedText;
    } else if (isHitster) {
        const hitsterData = parseHitsterUrl(decodedText);
        if (hitsterData) {
            try {
                const csvUrl = `${window.staticBaseUrl}playlists/hitster-${hitsterData.lang}.csv`;
                const csvContent = await getCachedCsv(csvUrl);
                const youtubeLink = lookupYoutubeLink(hitsterData.id, csvContent);
                if (youtubeLink) youtubeURL = youtubeLink;
            } catch (error) {
                console.error("Failed to fetch CSV:", error);
            }
        }
    } else if (isRock) {
        try {
            const urlObj = new URL(decodedText); 
            const ytCode = urlObj.searchParams.get("yt"); 
            if (ytCode) youtubeURL = `https://www.youtube.com/watch?v=${ytCode}`;
        } catch (error) {}
    }

    if (youtubeURL !== "") {
        const youtubeLinkData = parseYoutubeLink(youtubeURL);
        if (youtubeLinkData) {
            lastDecodedText = ""; 
            const vId = document.getElementById('video-id');
            if (vId) vId.textContent = youtubeLinkData.videoId;  
            currentStartTime = youtubeLinkData.startTime || 0;
            setUIState('LOADING');
            if (player && typeof player.cueVideoById === 'function') {
                player.cueVideoById(youtubeLinkData.videoId, currentStartTime);
            }
        }
    } else {
        setUIState('ERROR');
        const sMsg = document.getElementById('status-message');
        if (sMsg) sMsg.textContent = "❌ Song not found in Pack!";
    }
}

function isHitsterLink(url) { return /^(?:https?:\/\/)?(?:www\.)?(hitstergame|app\.hitsternordics)\.com\/.+/i.test(url.trim()); }
function isYoutubeLink(url) { return url.startsWith("https://www.youtube.com") || url.startsWith("https://youtu.be") || url.startsWith("https://music.youtube.com/"); }
function isRockster(url){ return url.startsWith("https://rockster.brettspiel.digital"); }

function parseHitsterUrl(url) {
    url = url.trim();
    const regex = /^(?:https?:\/\/)?(?:www\.)?hitstergame\.com\/(.+?)\/(\d+)(?:[/?#].*)?$/i;
    const match = url.match(regex);
    if (match) {
        let pathPart = match[1].replace(/\//g, "-");
        let idStr = match[2];
        if (idStr.length === 5) {
            const packPrefix = idStr.substring(0, 2);
            const cardNum = idStr.substring(2);
            if (packPrefix === "00") return { lang: pathPart, id: parseInt(cardNum, 10).toString() };
            else {
                let letterCode = "aaaa"; 
                if (pathPart === "ca") letterCode = "aaad";
                else if (pathPart === "hu" || pathPart === "pl") letterCode = "aaae";
                return { lang: `${pathPart}-${letterCode}00${packPrefix}`, id: parseInt(cardNum, 10).toString() };
            }
        }
        return { lang: pathPart, id: idStr };
    }
    const regex_nordics = /^(?:https?:\/\/)?(?:www\.)?app\.hitster(nordics)\.com\/resources\/songs\/(\d+)(?:[/?#].*)?$/i;
    const match_nordics = url.match(regex_nordics);
    if (match_nordics) return { lang: match_nordics[1].toLowerCase(), id: match_nordics[2] };
    return null;
}

function lookupYoutubeLink(id, csvContent) {
    if (!csvContent || csvContent.length === 0) return null;
    const headers = csvContent[0].map(h => h ? h.replace(/^\uFEFF/, '').trim() : '');
    const cardIndex = headers.indexOf('Card#');
    const urlIndex = headers.indexOf('URL');
    if (cardIndex === -1 || urlIndex === -1) return null;

    const targetId = parseInt(id, 10); 
    for (let i = 1; i < csvContent.length; i++) {
        const row = csvContent[i];
        if (row && row[cardIndex] && parseInt(row[cardIndex], 10) === targetId) {
            return row[urlIndex].trim(); 
        }
    }
    return null; 
}

function parseCSV(text) {
    const lines = text.split('\n');
    return lines.map(line => {
        const result = [];
        let startValueIdx = 0;
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"' && line[i-1] !== '\\') {
                inQuotes = !inQuotes;
            } else if (line[i] === ',' && !inQuotes) {
                result.push(line.substring(startValueIdx, i).trim().replace(/^"(.*)"$/, '$1'));
                startValueIdx = i + 1;
            }
        }
        result.push(line.substring(startValueIdx).trim().replace(/^"(.*)"$/, '$1'));
        return result;
    });
}

async function getCachedCsv(url) {
    if (!csvCache[url]) { 
        const response = await fetch(url);
        const data = await response.text();
        csvCache[url] = parseCSV(data); 
    }
    return csvCache[url]; 
}

function parseYoutubeLink(url) {
    url = decodeURIComponent(url);
    const regex = /^https?:\/\/(www\.youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)(.{11})(.*)/;
    const match = url.match(regex);
    if (match) {
        const queryParams = new URLSearchParams(match[3]); 
        const videoId = match[2];
        let startTime = queryParams.get('start') || queryParams.get('t');
        const vStart = document.getElementById('video-start');
        if (vStart) vStart.textContent = startTime;
        startTime = startTime ? parseInt(startTime, 10) : 0;
        return { videoId, startTime: isNaN(startTime) ? 0 : startTime };
    }
    return null;
}

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);

window.onYouTubeIframeAPIReady = function() {
    player = new YT.Player('player', {
        height: '10',
        width: '10',
        playerVars: {
            'playsinline': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
};

function onPlayerReady(event) {
    event.target.setVolume(100);
    event.target.unMute();
}

function onPlayerError(event) {
    let errorMsg = "❌ Audio Error!";
    if (event.data == 101 || event.data == 150) errorMsg = "❌ Blocked by Copyright Owner!";
    else if (event.data == 100) errorMsg = "❌ Video not found / deleted!";
    else if (event.data == 2) errorMsg = "❌ Invalid Video ID!";

    if (window.showLocalError) window.showLocalError(errorMsg);
    setUIState('ERROR');
    const sMsg = document.getElementById('status-message');
    if (sMsg) sMsg.textContent = errorMsg;
}

const SVG_PLAY = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>`;
const SVG_PAUSE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/></svg>`;

window.setLocalPlayPauseIcon = function(isPlaying) {
    const localPlayBtn = document.getElementById('localPlayPauseBtn');
    if (localPlayBtn) {
        localPlayBtn.innerHTML = isPlaying ? SVG_PAUSE : SVG_PLAY;
    }
};

function onPlayerStateChange(event) {
    const visualizerBars = document.querySelectorAll('#audio-visualizer .bar');

    if (event.data == YT.PlayerState.CUED) {
        setUIState('CUED');
        var videoData = player.getVideoData();
        const vTitle = document.getElementById('video-title');
        if (vTitle) vTitle.textContent = videoData.title;
        const vDur = document.getElementById('video-duration');
        if (vDur) vDur.textContent = formatDuration(player.getDuration());
        
        const auto = document.getElementById('autoplay');
        if (auto && auto.checked == true && !isIOS()) {
            const rand = document.getElementById('randomplayback');
            if (rand && rand.checked == true) playVideoAtRandomStartTime();
            else player.playVideo();
        }
    }
    else if (event.data == YT.PlayerState.PLAYING) {
        setUIState('PLAYING');
        visualizerBars.forEach(b => b.classList.add('playing'));
        window.setLocalPlayPauseIcon(true);
        const localMsg = document.getElementById('local-status-message');
        if (localMsg) localMsg.style.display = 'none';
    }
    else if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.ENDED) {
        setUIState('PAUSED');
        visualizerBars.forEach(b => b.classList.remove('playing'));
        window.setLocalPlayPauseIcon(false);
    }
    else if (event.data == YT.PlayerState.BUFFERING) {
        setUIState('BUFFERING');
    }
}

function formatDuration(duration) {
    var min = Math.floor(duration / 60);
    var sec = duration % 60;
    return min + ":" + (sec < 10 ? '0' : '') + sec;
}

function playVideoAtRandomStartTime() {
    let dur = player.getDuration();
    const pbInput = document.getElementById('playback-duration');
    playbackDuration = parseInt(pbInput ? pbInput.value : 30, 10) || 30;
    let start = Math.max(currentStartTime, dur * 0.1);
    let end = dur * 0.9;
    let offset = Math.random() * Math.max(0, end - start - playbackDuration);
    let finalStart = start + offset;

    player.seekTo(finalStart, true);
    player.playVideo();

    clearTimeout(playbackTimer); 
    playbackTimer = setTimeout(() => player.pauseVideo(), playbackDuration * 1000); 
}

function listCookies() { 
    const cl = document.getElementById("cookielist");
    if (cl) cl.innerHTML = document.cookie; 
}
function getCookieValue(name) {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? match[2] : undefined;
}
function getCookies() {
    const rp = document.getElementById('randomplayback');
    const ap = document.getElementById('autoplay');
    if (getCookieValue("RandomPlaybackChecked") !== undefined && rp) rp.checked = (getCookieValue("RandomPlaybackChecked") === 'true');
    if (getCookieValue("autoplayChecked") !== undefined && ap) ap.checked = (getCookieValue("autoplayChecked") === 'true');  
    listCookies();
}

window.parseCSV = parseCSV;
window.parseYoutubeLink = parseYoutubeLink;
window.getCachedCsv = getCachedCsv;

window.playYtVideo = function(videoId, start = 0) {
    const vid = document.getElementById('video-id');
    if (vid) vid.textContent = videoId;
    currentStartTime = start || 0;
    if (player && typeof player.cueVideoById === 'function') {
        player.cueVideoById(videoId, currentStartTime);
        setTimeout(() => {
            player.playVideo();
            setUIState('PLAYING');
        }, 500);
    }
};

window.stopYtVideo = function() {
    if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
        setUIState('PAUSED');
    }
};

window.toggleYtVideo = function(videoId, start) {
    if (!player || typeof player.getPlayerState !== 'function') return false;
    const videoData = player.getVideoData();
    if (!videoData || videoData.video_id !== videoId) {
        const vid = document.getElementById('video-id');
        if (vid) vid.textContent = videoId;
        currentStartTime = start || 0;
        player.cueVideoById(videoId, currentStartTime);
        setTimeout(() => {
            player.playVideo();
            setUIState('PLAYING');
        }, 500);
        return true;
    }

    if (player.getPlayerState() === 1) {
        player.pauseVideo();
        return false;
    } else {
        player.playVideo();
        return true;
    }
};

// Bind DOM event listeners once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const startStop = document.getElementById('startstop-video');
    if (startStop) {
        startStop.addEventListener('click', function() {
            if (!player || typeof player.getPlayerState !== 'function') return;
            let state = player.getPlayerState();
            if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
                const rp = document.getElementById('randomplayback');
                if (rp && rp.checked == true) playVideoAtRandomStartTime();
                else player.playVideo();
            } else {
                player.pauseVideo();
            }
        });
    }

    const sScan = document.getElementById('startScanButton');
    if (sScan) {
        sScan.addEventListener('click', () => {
            setUIState('SCANNING');
            if (qrScanner) {
                qrScanner.start().then(() => qrScanner.setInversionMode('both')).catch(() => setUIState('IDLE'));
            }
        });
    }

    const cScan = document.getElementById('cancelScanButton');
    if (cScan) cScan.addEventListener('click', () => { if (qrScanner) qrScanner.stop(); setUIState('IDLE'); });

    const dBtn = document.getElementById('doneButton');
    if (dBtn) dBtn.addEventListener('click', () => setUIState('IDLE'));

    const dbgBtn = document.getElementById('debugButton');
    if (dbgBtn) dbgBtn.addEventListener('click', () => handleScannedLink("https://www.hitstergame.com/de-aaaa0012/237"));

    const sInfo = document.getElementById('songinfo');
    if (sInfo) {
        sInfo.addEventListener('click', function() {
            ['videoid', 'videotitle', 'videoduration', 'videostart'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = sInfo.checked ? 'block' : 'none';
            });
        });
    }

    const cbSet = document.getElementById('cb_settings');
    if (cbSet) {
        cbSet.addEventListener('change', function() {
            const sd = document.getElementById('settings_div');
            if (sd) sd.classList.toggle('hidden', !this.checked);
        });
    }

    const rp = document.getElementById('randomplayback');
    if (rp) {
        rp.addEventListener('click', function() {
            document.cookie = "RandomPlaybackChecked=" + this.checked + ";max-age=2592000"; 
            listCookies();
        });
    }

    const ap = document.getElementById('autoplay');
    if (ap) {
        ap.addEventListener('click', function() {
            document.cookie = "autoplayChecked=" + this.checked + ";max-age=2592000"; 
            listCookies();
        });
    }

    const ck = document.getElementById('cookies');
    if (ck) {
        ck.addEventListener('click', function() {
            const cl = document.getElementById('cookielist');
            if (cl) cl.style.display = this.checked ? 'block' : 'none';
        });
    }

    const tLocal = document.getElementById('toggleLocalModeButton');
    if (tLocal) {
        tLocal.addEventListener('click', function() {
            const scannerBox = document.getElementById('scanner-box');
            const doneBtn = document.getElementById('doneButton');
            const settingsToggle = document.getElementById('show_hide_settings');
            const settingsDiv = document.getElementById('settings_div');
            const localUI = document.getElementById('local-mode-ui');
            const bottomBar = document.getElementById('local-bottom-bar');
            
            if (localUI.style.display === 'none' || localUI.style.display === '') {
                if (qrScanner) qrScanner.stop();
                if (scannerBox) scannerBox.style.display = 'none';
                if (doneBtn) doneBtn.style.display = 'none';
                if (settingsToggle) settingsToggle.style.display = 'none';
                if (settingsDiv) settingsDiv.classList.add('hidden');
                localUI.style.display = 'flex';
                this.textContent = 'Exit Local Mode';
                const gameboard = document.getElementById('local-gameboard');
                if (bottomBar && gameboard && gameboard.style.display !== 'none') {
                    bottomBar.style.display = 'flex';
                }
            } else {
                if (scannerBox) scannerBox.style.display = 'flex';
                if (settingsToggle) settingsToggle.style.display = 'flex';
                localUI.style.display = 'none';
                if (bottomBar) bottomBar.style.display = 'none';
                this.textContent = 'Local Mode';
                setUIState('IDLE');
                window.stopYtVideo();
            }
        });
    }

    setUIState('IDLE');
    getCookies();
});