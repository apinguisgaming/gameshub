import QrScanner from "https://unpkg.com/qr-scanner/qr-scanner.min.js";

let player; // Define player globally
let playbackTimer; // hold the timer reference
let playbackDuration = 30; // Default playback duration
let qrScanner;
let csvCache = {};
let lastDecodedText = ""; // Store the last decoded text
let currentStartTime = 0;

// Function to detect iOS devices
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

document.addEventListener('DOMContentLoaded', function () {

    const video = document.getElementById('qr-video');
    const resultContainer = document.getElementById("qr-reader-results");

    // If the user is on an iOS device, uncheck and disable the autoplay checkbox
    if (isIOS()) {
        var autoplayCheckbox = document.getElementById('autoplay');
        autoplayCheckbox.checked = false;
        autoplayCheckbox.disabled = true;
    }

    qrScanner = new QrScanner(video, result => {
        console.log('decoded qr code:', result);
        if (result.data !== lastDecodedText) {
            lastDecodedText = result.data; // Update the last decoded text
            handleScannedLink(result.data);
        }
    }, {
        highlightScanRegion: true,
        highlightCodeOutline: true,
    }
    );

    }
);

// Function to determine the type of link and act accordingly
async function handleScannedLink(decodedText) {
    // 1. Sanitize input: Remove hidden zero-width characters sometimes added by QR scanners
    decodedText = decodedText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    
    console.log("=== NEW SCAN DETECTED ===");
    console.log(`Raw Scanned URL: "${decodedText}"`);

    let youtubeURL = "";

    if (isYoutubeLink(decodedText)) {
        console.log("✅ Identified as direct YouTube link.");
        youtubeURL = decodedText;
    } else if (isHitsterLink(decodedText)) {
        console.log("✅ Identified as Hitster link.");
        
        const hitsterData = parseHitsterUrl(decodedText);
        
        if (hitsterData) {
            console.log(`✅ Hitster Data Parsed -> File Language: ${hitsterData.lang}, Song ID: ${hitsterData.id}`);
            
            // Safe check for staticBaseUrl
            const baseUrl = window.staticBaseUrl ? window.staticBaseUrl : "";
            const csvUrl = `${baseUrl}playlists/hitster-${hitsterData.lang}.csv`;
            
            console.log(`📥 Fetching CSV from: ${csvUrl}`);
            
            try {
                const csvContent = await getCachedCsv(csvUrl);
                console.log(`✅ CSV Loaded. Total rows: ${csvContent.length}`);
                
                const youtubeLink = lookupYoutubeLink(hitsterData.id, csvContent);
                
                if (youtubeLink) {
                    console.log(`🎯 SUCCESS! Found YouTube Link: ${youtubeLink}`);
                    youtubeURL = youtubeLink;
                } else {
                    console.error(`❌ ERROR: Song ID '${hitsterData.id}' was NOT FOUND inside ${csvUrl}`);
                }
            } catch (error) {
              console.error(`❌ CRITICAL ERROR: Failed to fetch the CSV file at ${csvUrl}. Check if the file exists and is named exactly right!`, error);
            }
        } else {
            console.error("❌ ERROR: parseHitsterUrl returned null! Regex could not extract ID.");
        }
    } else if (isRockster(decodedText)){
        // Rockster logic...
        console.log("✅ Identified as Rockster link.");
        try {
            const urlObj = new URL(decodedText); 
            const ytCode = urlObj.searchParams.get("yt"); 
            if (ytCode) {
                youtubeURL = `https://www.youtube.com/watch?v=${ytCode}`;
            }
        } catch (e) {
            console.error("Invalid Rockster URL.");
        }
    } else {
        console.error("❌ ERROR: Link did not match ANY known formats.");
    }

    if (youtubeURL !== "") {
        console.log(`▶️ Proceeding to play: ${youtubeURL}`);
        const youtubeLinkData = parseYoutubeLink(youtubeURL);
        if (youtubeLinkData) {
            qrScanner.stop(); 
            document.getElementById('qr-reader').style.display = 'none'; 
            document.getElementById('cancelScanButton').style.display = 'none'; 
            lastDecodedText = ""; 

            document.getElementById('video-id').textContent = youtubeLinkData.videoId;
            currentStartTime = youtubeLinkData.startTime || 0;
            player.cueVideoById(youtubeLinkData.videoId, currentStartTime);
        }
    }
}

    function isHitsterLink(url) {
    url = url.trim();
    const regex = /^(?:https?:\/\/)?(?:www\.)?(hitstergame|app\.hitsternordics)\.com\/.+/i;
    const result = regex.test(url);
    console.log(`🔍 Checking isHitsterLink: ${result}`);
    return result;
}

    // Example implementation for isYoutubeLink
    function isYoutubeLink(url) {
        return url.startsWith("https://www.youtube.com") || url.startsWith("https://youtu.be") || url.startsWith("https://music.youtube.com/");
    }
    function isRockster(url){
        return url.startsWith("https://rockster.brettspiel.digital")
    }
    // Example implementation for parseHitsterUrl
    function parseHitsterUrl(url) {
    url = url.trim();
    const regex = /^(?:https?:\/\/)?(?:www\.)?hitstergame\.com\/(.+?)\/(\d+)(?:[/?#].*)?$/i;
    const match = url.match(regex);
    
    if (match) {
        let processedLang = match[1].replace(/\//g, "-");
        let idStr = match[2];

        // Condensed format detection (e.g., 00264)
        if (idStr.startsWith("00") && idStr.length >= 5) {
            const packPrefix = idStr.substring(0, 4); 
            const cardId = idStr.substring(4);        
            
            let letterCode = "aaaa"; 
            if (processedLang === "ca") {
                letterCode = "aaad";
            } else if (processedLang === "hu" || processedLang === "pl") {
                letterCode = "aaae";
            }
            
            processedLang = `${processedLang}-${letterCode}${packPrefix}`;
            idStr = cardId; 
            console.log(`🛠️ Converted to expansion pack! Using file: ${processedLang}, Card ID: ${idStr}`);
        }

        return { lang: processedLang, id: idStr };
    }

    const regex_nordics = /^(?:https?:\/\/)?(?:www\.)?app\.hitster(nordics)\.com\/resources\/songs\/(\d+)(?:[/?#].*)?$/i;
    const match_nordics = url.match(regex_nordics);
    if (match_nordics) {
        return { lang: match_nordics[1].toLowerCase(), id: match_nordics[2] };
    }
    
    return null;
}

    // Looks up the YouTube link in the CSV content based on the ID
    function lookupYoutubeLink(id, csvContent) {
    if (!csvContent || csvContent.length === 0) return null;

    // Remove BOM and hidden spaces from headers to ensure strict matching
    const headers = csvContent[0].map(h => h ? h.replace(/^\uFEFF/, '').trim() : '');
    console.log(`📊 CSV Headers Detected: [${headers.join(', ')}]`);
    
    const cardIndex = headers.indexOf('Card#');
    const urlIndex = headers.indexOf('URL');

    if (cardIndex === -1 || urlIndex === -1) {
        console.error("❌ CRITICAL: 'Card#' or 'URL' column NOT FOUND in the CSV file!");
        return null;
    }

    const targetId = parseInt(id, 10);
    const lines = csvContent.slice(1);

    for (let i = 0; i < lines.length; i++) {
        const row = lines[i];
        if (!row || row.length <= Math.max(cardIndex, urlIndex)) continue; 
        
        const rowIdStr = row[cardIndex] ? row[cardIndex].trim() : "";
        const csvId = parseInt(rowIdStr, 10);
        
        if (csvId === targetId) {
            return row[urlIndex].trim(); 
        }
    }
    return null; 
}

    // Could also use external library, but for simplicity, we'll define it here
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
            result.push(line.substring(startValueIdx).trim().replace(/^"(.*)"$/, '$1')); // Push the last value
            return result;
        });
    }

    async function getCachedCsv(url) {
        if (!csvCache[url]) { // Check if the URL is not in the cache
            console.log(`URL not cached, fetching CSV from URL: ${url}`);
            const response = await fetch(url);
            const data = await response.text();
            csvCache[url] = parseCSV(data); // Cache the parsed CSV data using the URL as a key
        }
        return csvCache[url]; // Return the cached data for the URL
    }

    function parseYoutubeLink(url) {
        // First, ensure that the URL is decoded (handles encoded URLs)
        url = decodeURIComponent(url);

        const regex = /^https?:\/\/(www\.youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)(.{11})(.*)/;
        const match = url.match(regex);
        if (match) {
            const queryParams = new URLSearchParams(match[3]); // Correctly capture and parse the query string part of the URL
            const videoId = match[2];
            let startTime = queryParams.get('start') || queryParams.get('t');
            const endTime = queryParams.get('end');

            document.getElementById('video-start').textContent = startTime;
            // Normalize and parse 't' and 'start' parameters
            startTime = normalizeTimeParameter(startTime);
            const parsedEndTime = normalizeTimeParameter(endTime);

            return { videoId, startTime, endTime: parsedEndTime };
        }
        return null;
    }

    function normalizeTimeParameter(timeValue) {
        if (!timeValue) return null; // Return null if timeValue is falsy

        // Handle time formats (e.g., 't=1m15s' or '75s')
        let seconds = 0;
        if (timeValue.endsWith('s')) {
            seconds = parseInt(timeValue, 10);
        } else {
            // Additional parsing can be added here for 'm', 'h' formats if needed
            seconds = parseInt(timeValue, 10);
        }

        return isNaN(seconds) ? null : seconds;
    }

// This function creates an <iframe> (and YouTube player) after the API code downloads.
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0',
        width: '0',
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

// Load the YouTube IFrame API script
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// The API will call this function when the video player is ready.
function onPlayerReady(event) {
    // Cue a video using the videoId from the QR code (example videoId used here)
    // player.cueVideoById('dQw4w9WgXcQ');
    event.target.setVolume(100);
    event.target.unMute();
}

// Display video information when it's cued
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.CUED) {
        document.getElementById('startstop-video').style.background = "green";
        // Display title and duration
        var videoData = player.getVideoData();
        document.getElementById('video-title').textContent = videoData.title;
        var duration = player.getDuration();
        document.getElementById('video-duration').textContent = formatDuration(duration);
        // We do need this on iOS devices otherwise one would need to press play twice
        if (isIOS()) {
            player.playVideo();
        }
        // Check for Autoplay, there is not autoplay on iOS
        else if (document.getElementById('autoplay').checked == true) {
            document.getElementById('startstop-video').innerHTML = "Stop";
            if (document.getElementById('randomplayback').checked == true) {
                playVideoAtRandomStartTime();
            }
            else {
                player.playVideo();
            }
        }
    }
    else if (event.data == YT.PlayerState.PLAYING) {
        document.getElementById('startstop-video').style.background = "red";
    }
    else if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.ENDED) {
        document.getElementById('startstop-video').innerHTML = "Play";
        document.getElementById('startstop-video').style.background = "green";
    }
    else if (event.data == YT.PlayerState.BUFFERING) {
        document.getElementById('startstop-video').style.background = "orange";
    }
}

// Helper function to format duration from seconds to a more readable format
function formatDuration(duration) {
    var minutes = Math.floor(duration / 60);
    var seconds = duration % 60;
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}

// Add event listeners to Play and Stop buttons
document.getElementById('startstop-video').addEventListener('click', function() {
    if (this.innerHTML == "Play") {
        this.innerHTML = "Stop";
        if (document.getElementById('randomplayback').checked == true) {
            playVideoAtRandomStartTime();
        }
        else {
            player.playVideo();
        }
    }
    else {
        this.innerHTML = "Play";
        player.pauseVideo();
    }
});

function playVideoAtRandomStartTime() {
    const minStartPercentage = 0.10;
    const maxEndPercentage = 0.90;
    let videoDuration = player.getDuration()
    playbackDuration = parseInt(document.getElementById('playback-duration').value, 10) || 30;
    let startTime = currentStartTime;
    let endTime = playbackDuration;

    // Adjust start and end time based on video duration
    const minStartTime = Math.max(currentStartTime, videoDuration * minStartPercentage);
    const maxEndTime = videoDuration * maxEndPercentage;

    // Ensure the video ends by 90% of its total duration
    if (endTime > maxEndTime) {
        endTime = maxEndTime;
        startTime = Math.max(minStartTime, endTime - playbackDuration);
    }

    // If custom start time is 0 or very close to the beginning, pick a random start time within the range
    if (startTime <= minStartTime) {
        const range = maxEndTime - minStartTime - playbackDuration;
        const randomOffset = Math.random() * range;
        startTime = minStartTime + randomOffset;
        endTime = startTime + playbackDuration;
    }

    // Cue video at calculated start time and play
    console.log("play random", startTime, endTime)
    player.seekTo(startTime, true);
    player.playVideo();

    clearTimeout(playbackTimer); // Clear any existing timer
    // Schedule video stop after the specified duration
    playbackTimer = setTimeout(() => {
        player.pauseVideo();
        document.getElementById('startstop-video').innerHTML = "Play";
    }, (endTime - startTime) * 1000); // Convert to milliseconds
}

// Assuming you have an element with the ID 'qr-reader' for the QR scanner
document.getElementById('qr-reader').style.display = 'none'; // Initially hide the QR Scanner

document.getElementById('startScanButton').addEventListener('click', function() {
    document.getElementById('cancelScanButton').style.display = 'block';
    document.getElementById('qr-reader').style.display = 'block'; // Show the scanner
    qrScanner.start().catch(err => {
        console.error('Unable to start QR Scanner', err);
        qrResult.textContent = "QR Scanner failed to start.";
    });

    qrScanner.start().then(() => {
        qrScanner.setInversionMode('both'); // we want to scan also for Hitster QR codes which use inverted colors
    });
});

document.getElementById('debugButton').addEventListener('click', function() {
    handleScannedLink("https://www.hitstergame.com/de-aaaa0012/237");
    // handleScannedLink("https://rockster.brettspiel.digital/?yt=1bP-fFxAMOI");
});

document.getElementById('songinfo').addEventListener('click', function() {
    var cb = document.getElementById('songinfo');
    var videoid = document.getElementById('videoid');
    var videotitle = document.getElementById('videotitle');
    var videoduration = document.getElementById('videoduration');
    var videostart = document.getElementById('videostart');
    if(cb.checked == true){
        videoid.style.display = 'block';
        videotitle.style.display = 'block';
        videoduration.style.display = 'block';
        videostart.style.display = 'block';
    } else {
        videoid.style.display = 'none';
        videotitle.style.display = 'none';
        videoduration.style.display = 'none';
        videostart.style.display = 'none';
    }
});

document.getElementById('cancelScanButton').addEventListener('click', function() {
    qrScanner.stop(); // Stop scanning after a result is found
    document.getElementById('qr-reader').style.display = 'none'; // Hide the scanner after successful scan
    document.getElementById('cancelScanButton').style.display = 'none'; // Hide the cancel-button
});

document.getElementById('cb_settings').addEventListener('click', function() {
    var cb = document.getElementById('cb_settings');
    if (cb.checked == true) {
        document.getElementById('settings_div').style.display = 'block';
    }
    else {
        document.getElementById('settings_div').style.display = 'none';
    }
});

document.getElementById('randomplayback').addEventListener('click', function() {
    document.cookie = "RandomPlaybackChecked=" + this.checked + ";max-age=2592000"; //30 Tage
    listCookies();
});

document.getElementById('autoplay').addEventListener('click', function() {
    document.cookie = "autoplayChecked=" + this.checked + ";max-age=2592000"; //30 Tage
    listCookies();
});

document.getElementById('cookies').addEventListener('click', function() {
    var cb = document.getElementById('cookies');
    if (cb.checked == true) {
        document.getElementById('cookielist').style.display = 'block';
    }
    else {
        document.getElementById('cookielist').style.display = 'none';
    }
});

function listCookies() {
    var result = document.cookie;
    document.getElementById("cookielist").innerHTML=result;
 }

function getCookieValue(name) {
    const regex = new RegExp(`(^| )${name}=([^;]+)`);
    const match = document.cookie.match(regex);
    if (match) {
        return match[2];
    }
}

function getCookies() {
    var isTrueSet;
    if (getCookieValue("RandomPlaybackChecked") != "") {
        isTrueSet = (getCookieValue("RandomPlaybackChecked") === 'true');
        document.getElementById('randomplayback').checked = isTrueSet;
    }
    if (getCookieValue("autoplayChecked") != "") {
        isTrueSet = (getCookieValue("autoplayChecked") === 'true');
        document.getElementById('autoplay').checked = isTrueSet;
    }
    listCookies();
}

window.addEventListener("DOMContentLoaded", getCookies());