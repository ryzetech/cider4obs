// Constants
const CIDER_SOCKET_URL = "http://localhost:10767/";
const API_V1_BASE = "api/v1/";
const API_V2_BASE = "api/v2/";
const SETTINGS_LOAD_DELAY = 100;
const DEFAULT_FADE_DELAY = 2000;
const DEFAULT_QUEUE_REVEAL_TIME = 10;
const TOKEN_QUERY_PARAM = "apptoken";
const TOKEN_STORAGE_KEY = "cider_apptoken";
const AUTH_REQUEST_APP_NAME = "Cider4OBS Connector";
const AUTH_REQUEST_SCOPES = "playback,queue";
const ENABLE_V1_FALLBACK = true;

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
let appToken = "";
let authPrompted = false;

/**
 * Get query parameter value from current URL
 */
function getQueryParam(name) {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get(name) || "").trim();
  } catch (error) {
    console.debug('[DEBUG] [Auth] Failed to parse URL query params:', error);
    return "";
  }
}

/**
 * Persist token for subsequent overlay reloads
 */
function persistToken(token) {
  if (!token) return;

  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (error) {
    console.debug('[DEBUG] [Auth] Failed to persist token:', error);
  }
}

/**
 * Resolve token from URL query parameter first, then local storage
 */
function resolveToken() {
  const queryToken = getQueryParam(TOKEN_QUERY_PARAM);

  if (queryToken) {
    persistToken(queryToken);
    return queryToken;
  }

  try {
    return (localStorage.getItem(TOKEN_STORAGE_KEY) || "").trim();
  } catch (error) {
    console.debug('[DEBUG] [Auth] Failed to read token from localStorage:', error);
    return "";
  }
}

/**
 * Build Option B deep-link for token consent request
 */
function buildAuthDeepLinkUrl() {
  const appName = encodeURIComponent(AUTH_REQUEST_APP_NAME);
  const scopes = encodeURIComponent(AUTH_REQUEST_SCOPES);
  return `cider://request-auth?app-name=${appName}&scopes=${scopes}`;
}

/**
 * Launch Cider token consent flow via protocol handler
 */
function requestTokenViaDeepLink() {
  const deepLink = buildAuthDeepLinkUrl();
  console.debug('[DEBUG] [Auth] Launching deep link:', deepLink);
  window.location.href = deepLink;
}

/**
 * Extract error code from both legacy and structured API errors
 */
function getErrorCode(payload) {
  if (!payload || !payload.error) return null;
  if (typeof payload.error === 'string') return payload.error;
  return payload.error.code || null;
}

/**
 * Build request headers for authenticated API calls
 */
function getAuthHeaders() {
  return appToken ? { apptoken: appToken } : {};
}

/**
 * Fetch and parse JSON from API endpoints
 */
async function fetchJson(path, headers = {}) {
  const response = await fetch(`${CIDER_SOCKET_URL}${path}`, { headers });
  const payload = await response.json();
  return { ok: response.ok, status: response.status, payload };
}

/**
 * Try v2 first and fall back to v1 for one migration release
 */
async function fetchWithFallback(v2Path, v1Path) {
  if (appToken) {
    const v2Result = await fetchJson(v2Path, getAuthHeaders());
    if (v2Result.ok) {
      return { version: 'v2', ...v2Result };
    }

    const code = getErrorCode(v2Result.payload);
    if (
      ENABLE_V1_FALLBACK &&
      v1Path &&
      (code === 'UNAUTHORIZED_APP_TOKEN' || code === 'INSUFFICIENT_SCOPE')
    ) {
      console.debug('[DEBUG] [API] Falling back to v1 endpoint due to v2 auth/scope error:', code);
      const v1Result = await fetchJson(v1Path);
      return { version: 'v1', ...v1Result };
    }

    return { version: 'v2', ...v2Result };
  }

  if (ENABLE_V1_FALLBACK && v1Path) {
    const v1Result = await fetchJson(v1Path);
    return { version: 'v1', ...v1Result };
  }

  return { ok: false, status: 403, payload: { error: { code: 'UNAUTHORIZED_APP_TOKEN' } }, version: 'v2' };
}

/**
 * Resolve artwork URLs for both v1 placeholder and v2 pre-resolved formats
 */
function resolveArtworkUrl(artwork) {
  if (!artwork || !artwork.url) return '';

  if (artwork.url.includes('{w}') || artwork.url.includes('{h}') || artwork.url.includes('{f}')) {
    return artwork.url
      .replace('{w}', artwork.width || 512)
      .replace('{h}', artwork.height || 512)
      .replace('{f}', 'jpg');
  }

  return artwork.url;
}

/**
 * Show token setup guidance once per session when token is missing
 */
function promptForTokenIfMissing() {
  if (appToken || authPrompted) return;

  authPrompted = true;
  if (elements.title) {
    elements.title.innerText = "Cider4OBS Connector | Token required for v2";
    elements.artist.innerText = "Opening Cider auth request (Option B)...";
    elements.album.innerText = "Approve and provide ?apptoken=... in URL";
  }

  requestTokenViaDeepLink();
}

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
    fade_on_stop: getCSSVariable('--fade-on-stop') == '1',
    fade_on_disconnect: getCSSVariable('--fade-on-disconnect') == '1',
    fade_delay: parseInt(getCSSVariable('--fade-delay')) || DEFAULT_FADE_DELAY,
    fade_disconnect_delay: parseInt(getCSSVariable('--fade-disconnect-delay')) ||
      parseInt(getCSSVariable('--fade-delay')) || DEFAULT_FADE_DELAY,
    hide_on_idle_connect: getCSSVariable('--hide-on-idle-connect') == '1',
    hide_unless_playing: getCSSVariable('--hide-unless-playing') == '1',
    show_time_labels: getCSSVariable('--show-time-labels') == '1',
    show_next_in_queue: getCSSVariable('--show-next-in-queue') == 'block',
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
  if (!data) return;
  elements.title.innerText = data.name || 'No data yet.';
  elements.artist.innerText = data.artistName || '';
  elements.album.innerText = data.albumName || '';

  // Store current track name for queue matching
  currentTrackName = data.name || null;

  if (!data.artwork || !data.artwork.url) {
    elements.albumImg.src = "c4obs.png";
    return;
  } else {
    const artworkUrl = resolveArtworkUrl(data.artwork);
    elements.albumImg.src = artworkUrl || "c4obs.png";
  }
}

/**
 * Fetch current now playing information from API
 */
async function fetchNowPlaying() {
  try {
    const result = await fetchWithFallback(
      `${API_V2_BASE}playback/now-playing`,
      `${API_V1_BASE}playback/now-playing`
    );

    if (result.version === 'v2' && result.ok && result.payload && result.payload.data) {
      updateComponents(result.payload.data);
      return true;
    }

    if (result.version === 'v1' && result.ok && result.payload.status === 'ok' && result.payload.info) {
      updateComponents(result.payload.info);
      return true;
    }

    const code = getErrorCode(result.payload);
    if (code === 'UNAUTHORIZED_APP_TOKEN' || code === 'INSUFFICIENT_SCOPE') {
      console.debug('[DEBUG] [API] Auth/scope issue while fetching now-playing:', code);
      promptForTokenIfMissing();
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
    const result = await fetchWithFallback(
      `${API_V2_BASE}queue`,
      `${API_V1_BASE}playback/queue`
    );

    if (result.version === 'v2' && result.ok && result.payload && result.payload.data) {
      const items = Array.isArray(result.payload.data.items) ? result.payload.data.items : [];
      const position = Number.isInteger(result.payload.data.position) ? result.payload.data.position : -1;

      if (items.length > 0) {
        let nextTrackAttributes = null;

        // Primary strategy: use queue position from v2 payload
        if (position >= 0 && position < items.length - 1) {
          const nextItem = items[position + 1];
          nextTrackAttributes = nextItem && nextItem.track ? nextItem.track.attributes : null;
        }

        // Fallback strategy: match current track by name
        if (!nextTrackAttributes && currentTrackName) {
          const currentIndex = items.findIndex(item =>
            item.track && item.track.attributes && item.track.attributes.name === currentTrackName
          );
          if (currentIndex >= 0 && currentIndex < items.length - 1) {
            const nextItem = items[currentIndex + 1];
            nextTrackAttributes = nextItem && nextItem.track ? nextItem.track.attributes : null;
          }
        }

        if (nextTrackAttributes) {
          updateNextInQueue(nextTrackAttributes);
          return;
        }
      }

      hideNextInQueue();
      return;
    }

    if (result.version === 'v1' && result.ok) {
      const queue = result.payload;
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
            return;
          }
        }
      }

      hideNextInQueue();
      return;
    }

    const code = getErrorCode(result.payload);
    if (code === 'UNAUTHORIZED_APP_TOKEN' || code === 'INSUFFICIENT_SCOPE') {
      console.debug('[DEBUG] [API] Auth/scope issue while fetching queue:', code);
      promptForTokenIfMissing();
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
  console.debug('[DEBUG] [API] Updating next in queue:', data);
  if (!data) return;
  elements.nextTitle.innerText = data.name || '';
  elements.nextArtist.innerText = data.artistName || '';

  const artworkUrl = resolveArtworkUrl(data.artwork);
  elements.nextAlbumImg.src = artworkUrl || "c4obs.png";
}

/**
 * Hide next in queue display
 */
function hideNextInQueue() {
  if (elements.nextInQueue) elements.nextInQueue.classList.remove('visible');
}

/**
 * Check if next in queue should be revealed based on time remaining
 */
function checkQueueReveal(currentTime, duration) {
  if (!settings.show_next_in_queue) return;

  if (!duration || isNaN(duration) || duration <= 0) {
    elements.nextInQueue.classList.remove('visible');
    return;
  }

  const timeRemaining = duration - currentTime;

  console.debug(`[DEBUG] [Queue Reveal] Time Remaining: ${timeRemaining.toFixed(2)}s, Reveal Time: ${settings.next_in_queue_reveal_time}s`);

  const shouldReveal = timeRemaining <= settings.next_in_queue_reveal_time && timeRemaining > 0.5;

  if (shouldReveal && elements.nextTitle.innerText !== '') {
    console.debug('[DEBUG] [Queue Reveal] Revealing next in queue');
    elements.nextInQueue.classList.add('visible');
  } else {
    console.debug('[DEBUG] [Queue Reveal] Hiding next in queue');
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
    if (elements.content) elements.content.style.opacity = 1;
  }
}

/**
 * Handle connection state
 */
async function handleConnect() {
  console.debug('[DEBUG] [Init] Socket.io connection established!');
  appToken = resolveToken();

  if (!appToken) {
    promptForTokenIfMissing();
  } else {
    console.debug('[DEBUG] [Auth] Token loaded; using v2 API where available.');
  }

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
      {
        const currentTime = Number(data.currentPlaybackTime) || 0;
        const duration = Number(data.currentPlaybackDuration) || 0;
        const progressPercent = duration > 0
          ? Math.max(0, Math.min(100, (currentTime / duration) * 100))
          : 0;

        elements.progressBar.style.width = `${progressPercent}%`;

        if (settings.show_time_labels) {
          elements.currentTime.innerText = formatTime(currentTime);
          elements.duration.innerText = formatTime(duration);
        }

        // Check if next in queue should be revealed
        checkQueueReveal(currentTime, duration);
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
    appToken = resolveToken();

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
    const socketOptions = {
      transports: ['websocket']
    };

    if (appToken) {
      socketOptions.query = { apptoken: appToken };
      socketOptions.auth = { apptoken: appToken };
    }

    const CiderApp = io(CIDER_SOCKET_URL, socketOptions);

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