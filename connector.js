let pauseTimer;
let disconnectTimer;
let settings;

const el = {
  content: () => document.getElementById("content"),
  albumImg: () => document.getElementById("albumimg"),
  title: () => document.getElementById("title"),
  artist: () => document.getElementById("artist"),
  album: () => document.getElementById("album"),
  progressBar: () => document.getElementById("progressBar"),
  bgLayer: () => document.getElementById("bg-layer"),
  timeCurrent: () => document.getElementById("timeCurrent"),
  timeRemaining: () => document.getElementById("timeRemaining"),
};

function getVarFromBody(name) {
  return window.getComputedStyle(document.body).getPropertyValue(name);
}

function getSettings() {
  return {
    fade_on_stop: getVarFromBody('--fade-on-stop') == 1,
    fade_on_disconnect: getVarFromBody('--fade-on-disconnect') == 1,
    fade_delay: getVarFromBody('--fade-delay') || 2000,
    fade_disconnect_delay:
      getVarFromBody('--fade-disconnect-delay') ||
      getVarFromBody('--fade-delay') ||
      2000,
    hide_on_idle_connect: getVarFromBody('--hide-on-idle-connect') == 1,
  };
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function setBackgroundFromCover(url) {
  const bg = el.bgLayer();
  if (!bg) return;

  if (!url) {
    bg.style.backgroundImage = "none";
    return;
  }
  bg.style.backgroundImage = `url("${url}")`;
}

function updateAccentFromCover(url) {
  const bar = el.progressBar();
  if (!bar) return;

  const fallback = () => {
    bar.style.backgroundImage = "none";
    bar.style.backgroundColor = "#d0d0d0";
    bar.style.boxShadow =
      "0 0 4px rgba(0,0,0,0.6), 0 0 8px rgba(208,208,208,1)";
    document.documentElement.style.setProperty("--accent-color", "#d0d0d0");
  };

  if (!url || typeof colorjs === "undefined" || !colorjs.prominent) {
    fallback();
    return;
  }

  const hexToRgb = (hex) => {
    if (!hex) return null;
    hex = hex.replace("#", "").trim();
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    if (hex.length !== 6) return null;
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  };

  const rgbToHsl = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
      h = 0; s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, l };
  };

  const hslToHex = ({ h, s, l }) => {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = (v) => {
      const n = Math.round(v * 255);
      return n.toString(16).padStart(2, "0");
    };
    return "#" + toHex(r) + toHex(g) + toHex(b);
  };

  colorjs
    .prominent(url, { amount: 3, format: "hex" })
    .then((result) => {
      const bases = Array.isArray(result) ? result : [result];
      const compColors = [];

      bases.forEach((hex) => {
        if (!hex) return;
        const rgb = hexToRgb(hex);
        if (!rgb) return;

        let { h, s, l } = rgbToHsl(rgb);

        h = (h + 0.5) % 1.0;

        s *= 0.3;

        if (l < 0.3) l = 0.65;
        else if (l > 0.7) l = 0.35;
        else l = 0.55;

        const compHex = hslToHex({ h, s, l });
        compColors.push(compHex);
      });

      const c1 = compColors[0] || "#d0d0d0";
      const c2 = compColors[1] || c1;
      const c3 = compColors[2] || c2;

      const gradient = `linear-gradient(90deg, ${c1}, ${c2}, ${c3})`;
      bar.style.backgroundImage = gradient;
      bar.style.backgroundColor = "transparent";
      bar.style.boxShadow =
        `0 0 4px rgba(0,0,0,0.6), 0 0 8px ${c2}`;

      document.documentElement.style.setProperty("--accent-color", c2);
    })
    .catch((err) => {
      console.debug("[Accent] prominent/complement erreur, fallback", err);
      fallback();
    });
}

function updateComponents(meta) {
  if (!meta) return;

  const title = meta.name || "-/-";
  const artist = meta.artistName || "-/-";
  const album = meta.albumName || "-/-";

  el.title().innerText = title;
  el.artist().innerText = artist;
  el.album().innerText = album;

  const aw = meta.artwork;
  if (aw && aw.url) {
    let tmp = aw.url.replace("{w}", aw.width).replace("{h}", aw.height);
    el.albumImg().src = tmp;
    setBackgroundFromCover(tmp);
    updateAccentFromCover(tmp);
  }
}

function startWebSocket() {
  try {
    setTimeout(() => {
      settings = getSettings();
      
      // Add this new block to handle initial state
      if (settings.hide_unless_playing) {
        document.getElementById("content").style.opacity = 0;
      }
    }, 100);

    const CiderApp = io("http://localhost:10767/", {
      transports: ['websocket']
    });

    CiderApp.on("connect", () => {
      el.title().innerText = "Cider4OBS Connector | Connection established!";
      el.artist().innerText = "Start playing something!";
      el.album().innerText = "-/-";

      if (settings.hide_on_idle_connect) el.content().style.opacity = 0;

      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = undefined;
        el.content().style.opacity = 1;
      }
    });

    CiderApp.on("API:Playback", ({ data, type }) => {
      const meta =
        (data && data.attributes) ||
        (data && data.nowPlayingItem) ||
        data;

      if (meta && (meta.name || meta.artistName || meta.albumName)) {
        updateComponents(meta);
      }

      if (type === "playbackStatus.playbackStateDidChange") {
        if (data.state === "paused" && !pauseTimer && settings.fade_on_stop) {
          pauseTimer = setTimeout(() => {
            el.content().style.opacity = 0;
          }, settings.fade_delay);
        } else if (
          data.state === "playing" &&
          (pauseTimer || settings.hide_on_idle_connect)
        ) {
          clearTimeout(pauseTimer);
          pauseTimer = undefined;
          el.content().style.opacity = 1;
        }
      } else if (type === "playbackStatus.playbackTimeDidChange") {
        const current = data.currentPlaybackTime || 0;
        const duration = data.currentPlaybackDuration || 0;

        if (duration > 0) {
          const percent = (current / duration) * 100;
          el.progressBar().style.width = percent + "%";
        } else {
          el.progressBar().style.width = "0%";
        }

        el.timeCurrent().innerText = formatTime(current);
        const remaining = Math.max(0, duration - current);
        el.timeRemaining().innerText = "-" + formatTime(remaining);
      }
    });

    CiderApp.on("disconnect", () => {
      el.title().innerText = "Cider4OBS Connector | Disconnected! Retrying...";
      el.artist().innerText = "-/-";
      el.album().innerText = "-/-";
      el.albumImg().src = "c4obs.png";
      setBackgroundFromCover(null);
      document.documentElement.style.setProperty("--accent-color", "#d0d0d0");
      el.progressBar().style.width = "0%";
      el.timeCurrent().innerText = "0:00";
      el.timeRemaining().innerText = "-0:00";

      if (!disconnectTimer && settings.fade_on_disconnect) {
        disconnectTimer = setTimeout(() => {
          el.content().style.opacity = 0;
        }, settings.fade_disconnect_delay);
      }
    });

    CiderApp.on("connect_error", (error) => {
      el.albumImg().src = "c4obs.png";
      setBackgroundFromCover(null);
      document.documentElement.style.setProperty("--accent-color", "#d0d0d0");
      console.debug("[Cider4OBS] Connect Error:", error);
    });
  } catch (error) {
    console.debug("[Cider4OBS] Code error:", error);
  }
}
