// Constants
const CIDER_SOCKET_URL = "http://localhost:10767/";
const SETTINGS_LOAD_DELAY = 100;
const DEFAULT_FADE_DELAY = 2000;

// Element IDs
const ELEMENTS = {
  content: 'content',
  title: 'title',
  artist: 'artist',
  album: 'album',
  albumImg: 'albumimg',
  progressBar: 'progressBar',
  currentTime: 'currentTime',
  duration: 'duration'
};

// State
let pauseTimer;
let disconnectTimer;
let settings;
let elements = {};

/**
 * Cache DOM elements for better performance
 */
function cacheElements() {
  Object.keys(ELEMENTS).forEach(key => {
    elements[key] = document.getElementById(ELEMENTS[key]);
  });
}

/**
 * Get CSS variable value from body
 */
function getCSSVariable(name) {
  return window.getComputedStyle(document.body).getPropertyValue(name);
}

/**
 * Parse settings from CSS variables
 */
function getSettings() {
  return {
    fade_on_stop: getCSSVariable('--fade-on-stop') === '1',
    fade_on_disconnect: getCSSVariable('--fade-on-disconnect') === '1',
    fade_delay: parseInt(getCSSVariable('--fade-delay')) || DEFAULT_FADE_DELAY,
    fade_disconnect_delay: parseInt(getCSSVariable('--fade-disconnect-delay')) || 
                          parseInt(getCSSVariable('--fade-delay')) || DEFAULT_FADE_DELAY,
    hide_on_idle_connect: getCSSVariable('--hide-on-idle-connect') === '1',
    hide_unless_playing: getCSSVariable('--hide-unless-playing') === '1',
    show_time_labels: getCSSVariable('--show-time-labels') === '1'
  };
}

/**
 * Format seconds to M:SS or H:MM:SS format
 */
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Set element opacity with optional delay
 */
function setOpacity(element, value, delay = 0) {
  if (delay > 0) {
    return setTimeout(() => {
      element.style.opacity = value;
    }, delay);
  }
  element.style.opacity = value;
  return null;
}

/**
 * Clear and reset timer
 */
function clearTimer(timer) {
  if (timer) {
    clearTimeout(timer);
  }
  return undefined;
}

/**
 * Update display components with track data
 */
function updateComponents(data) {
  elements.title.innerText = data.name;
  elements.artist.innerText = data.artistName;
  elements.album.innerText = data.albumName;
  
  const artworkUrl = data.artwork.url
    .replace("{w}", data.artwork.width)
    .replace("{h}", data.artwork.height);
  elements.albumImg.src = artworkUrl;
}

/**
 * Fetch current now playing information from API
 */
async function fetchNowPlaying() {
  try {
    const response = await fetch(`${CIDER_SOCKET_URL}api/v1/playback/now-playing`);
    const data = await response.json();
    
    if (data.status === 'ok' && data.info) {
      updateComponents(data.info);
      return true;
    }
    return false;
  } catch (error) {
    console.debug('[DEBUG] [API] Failed to fetch now playing:', error);
    return false;
  }
}

/**
 * Handle playback state changes
 */
function handlePlaybackStateChange(state) {
  if (state === "paused" && !pauseTimer && (settings.fade_on_stop || settings.hide_unless_playing)) {
    pauseTimer = setOpacity(elements.content, 0, settings.fade_delay);
  } else if (state === "playing") {
    pauseTimer = clearTimer(pauseTimer);
    elements.content.style.opacity = 1;
  }
}

/**
 * Handle connection state
 */
async function handleConnect() {
  console.debug('[DEBUG] [Init] Socket.io connection established!');
  
  // Try to fetch current track information
  const hasTrack = await fetchNowPlaying();
  
  if (!hasTrack) {
    elements.title.innerText = "Cider4OBS Connector | Connection established!";
    elements.artist.innerText = "Start playing something!";
    elements.album.innerText = "-/-";
  }

  if (settings.hide_on_idle_connect || settings.hide_unless_playing) {
    elements.content.style.opacity = 0;
  } else {
    elements.content.style.opacity = 1;
  }

  if (disconnectTimer) {
    disconnectTimer = clearTimer(disconnectTimer);
    if (!settings.hide_unless_playing) {
      elements.content.style.opacity = 1;
    }
  }
}

/**
 * Handle disconnection state
 */
function handleDisconnect() {
  elements.title.innerText = "Cider4OBS Connector | Disconnected! Retrying...";
  elements.artist.innerText = "-/-";
  elements.album.innerText = "-/-";
  elements.albumImg.src = "c4obs.png";
  console.debug('[DEBUG] [Init] Socket.io connection closed!');
  console.debug("[DEBUG] [Init] Retrying automatically...");

  if (settings.hide_unless_playing) {
    elements.content.style.opacity = 0;
  } else if (!disconnectTimer && settings.fade_on_disconnect) {
    disconnectTimer = setOpacity(elements.content, 0, settings.fade_disconnect_delay);
  }
}

/**
 * Handle playback API events
 */
function handlePlaybackEvent({ data, type }) {
  switch (type) {
    case "playbackStatus.playbackStateDidChange":
      handlePlaybackStateChange(data.state);
      updateComponents(data.attributes);
      break;
      
    case "playbackStatus.nowPlayingItemDidChange":
      updateComponents(data);
      break;
      
    case "playbackStatus.playbackTimeDidChange":
      elements.progressBar.style.width = 
        `${(data.currentPlaybackTime / data.currentPlaybackDuration) * 100}%`;
      
      if (settings.show_time_labels) {
        elements.currentTime.innerText = formatTime(data.currentPlaybackTime);
        elements.duration.innerText = formatTime(data.currentPlaybackDuration);
      }
      break;
      
    default:
      console.debug(type, data);
  }
}

/**
 * Initialize WebSocket connection
 */
function startWebSocket() {
  try {
    // Pause to allow OBS to inject CSS
    setTimeout(() => {
      cacheElements();
      settings = getSettings();
      
      // Set initial state
      if (settings.hide_unless_playing) {
        elements.content.style.opacity = 0;
      }
    }, SETTINGS_LOAD_DELAY);

    console.debug('[DEBUG] [Init] Configuring websocket connection...');
    const CiderApp = io(CIDER_SOCKET_URL, {
      transports: ['websocket']
    });

    CiderApp.on("connect", handleConnect);
    CiderApp.on("API:Playback", handlePlaybackEvent);
    CiderApp.on("disconnect", handleDisconnect);
    CiderApp.on("connect_error", (error) => {
      elements.albumImg.src = "c4obs.png";
      console.debug("[DEBUG] [Init] Connect Error: " + error);
      console.debug("[DEBUG] [Init] Retrying automatically...");
    });

  } catch (error) {
    console.debug('[DEBUG] [Init] Code error:', error);
    console.debug("[DEBUG] [Init] Retrying automatically...");
  }
}