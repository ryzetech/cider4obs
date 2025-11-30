// Constants
const CIDER_SOCKET_URL = "http://localhost:10767/";
const SETTINGS_LOAD_DELAY = 100;
const DEFAULT_FADE_DELAY = 2000;
const DEFAULT_QUEUE_REVEAL_TIME = 10;

// Element IDs
const ELEMENTS = {
  content: 'content',
  title: 'title',
  artist: 'artist',
  album: 'album',
  albumImg: 'albumimg',
  progressBar: 'progressBar',
  currentTime: 'currentTime',
  duration: 'duration',
  nextInQueue: 'nextInQueue',
  nextQueueBox: 'nextQueueBox',
  nextTitle: 'nextTitle',
  nextArtist: 'nextArtist',
  nextAlbumImg: 'nextAlbumImg'
};

// State
let pauseTimer;
let disconnectTimer;
let settings;
let elements = {};
let currentTrackName = null;

/**
 * Cache DOM elements for better performance
 */
function cacheElements() {
  Object.keys(ELEMENTS).forEach(key => {
    elements[key] = document.getElementById(ELEMENTS[key]);
  });
  
  // Set slide direction attribute on nextQueueBox element
  if (elements.nextQueueBox && settings) {
    const direction = settings.next_in_queue_slide_direction;
    if (['top', 'bottom', 'left', 'right'].includes(direction)) {
      elements.nextQueueBox.setAttribute('data-slide', direction);
    }
  }
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
    show_time_labels: getCSSVariable('--show-time-labels') === '1',
    show_next_in_queue: getCSSVariable('--show-next-in-queue') === '1',
    next_in_queue_reveal_time: parseInt(getCSSVariable('--next-in-queue-reveal-time')) || DEFAULT_QUEUE_REVEAL_TIME,
    next_in_queue_slide_direction: getCSSVariable('--next-in-queue-slide-direction').trim() || 'top'
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
  
  // Store current track name for queue matching
  currentTrackName = data.name;
  
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
 * Fetch queue and update next in queue display
 */
async function fetchQueue() {
  if (!settings.show_next_in_queue) return;
  
  try {
    const response = await fetch(`${CIDER_SOCKET_URL}api/v1/playback/queue`);
    const queue = await response.json();
    
    if (Array.isArray(queue) && queue.length > 0 && currentTrackName) {
      // Find the currently playing track by matching the track name
      const currentIndex = queue.findIndex(track => 
        track.attributes && track.attributes.name === currentTrackName
      );
      
      // Get the next track after the currently playing one
      if (currentIndex >= 0 && currentIndex < queue.length - 1) {
        const nextTrack = queue[currentIndex + 1];
        if (nextTrack.attributes) {
          updateNextInQueue(nextTrack.attributes);
          // Don't show immediately, wait for time-based reveal
          return;
        }
      }
    }
    
    hideNextInQueue();
  } catch (error) {
    console.debug('[DEBUG] [API] Failed to fetch queue:', error);
    hideNextInQueue();
  }
}

/**
 * Update next in queue display
 */
function updateNextInQueue(data) {
  elements.nextTitle.innerText = data.name;
  elements.nextArtist.innerText = data.artistName;
  
  const artworkUrl = data.artwork.url
    .replace("{w}", data.artwork.width)
    .replace("{h}", data.artwork.height);
  elements.nextAlbumImg.src = artworkUrl;
}

/**
 * Hide next in queue display
 */
function hideNextInQueue() {
  elements.nextInQueue.classList.remove('visible');
}

/**
 * Check if next in queue should be revealed based on time remaining
 */
function checkQueueReveal(currentTime, duration) {
  if (!settings.show_next_in_queue) return;
  
  const timeRemaining = duration - currentTime;
  const shouldReveal = timeRemaining <= settings.next_in_queue_reveal_time && timeRemaining > 0.5;
  
  if (shouldReveal && elements.nextTitle.innerText !== '-') {
    elements.nextInQueue.classList.add('visible');
  } else {
    elements.nextInQueue.classList.remove('visible');
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
  
  // Fetch queue if enabled
  if (settings.show_next_in_queue) {
    await fetchQueue();
  }
  
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
      if (settings.show_next_in_queue) {
        fetchQueue();
      }
      break;
      
    case "playbackStatus.playbackTimeDidChange":
      elements.progressBar.style.width = 
        `${(data.currentPlaybackTime / data.currentPlaybackDuration) * 100}%`;
      
      if (settings.show_time_labels) {
        elements.currentTime.innerText = formatTime(data.currentPlaybackTime);
        elements.duration.innerText = formatTime(data.currentPlaybackDuration);
      }
      
      // Check if next in queue should be revealed
      checkQueueReveal(data.currentPlaybackTime, data.currentPlaybackDuration);
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
      settings = getSettings();
      cacheElements();
      
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