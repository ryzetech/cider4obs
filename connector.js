let pauseTimer;
let disconnectTimer;
let settings;

function getVarFromBody(name) { return window.getComputedStyle(document.body).getPropertyValue(name); }

function getSettings() {
  return {
    fade_on_stop: getVarFromBody('--fade-on-stop') == 1,
    fade_on_disconnect: getVarFromBody('--fade-on-disconnect') == 1,
    fade_delay: getVarFromBody('--fade-delay') || 2000,
    fade_disconnect_delay: getVarFromBody('--fade-disconnect-delay') || getVarFromBody('--fade-delay') || 2000,
    hide_on_idle_connect: getVarFromBody('--hide-on-idle-connect') == 1
  }
}

function startWebSocket() {
  try {
    // pausing so obs has time to inject the css
    // why does this work lmao
    setTimeout(() => {
      settings = getSettings();
    }, 100);

    // Connect to the websocket server
    console.debug('[DEBUG] [Init] Configuring websocket connection...');
    const CiderApp = io("http://localhost:10767/", {
      transports: ['websocket']
    });

    CiderApp.on("connect", (event) => {
      console.debug('[DEBUG] [Init] Socket.io connection established!');
      document.getElementById("title").innerText = "Cider4OBS Connector | Connection established!";
      document.getElementById("artist").innerText = "Start playing something!";
      document.getElementById("album").innerText = "-/-";

      if (settings.hide_on_idle_connect) document.getElementById("content").style.opacity = 0;

      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = undefined;
        document.getElementById("content").style.opacity = 1;
      }
    });

    /* itsy bitsy teeny weeny debuggy webuggy
    CiderApp.onAny((event, ...args) => {
      console.debug(Date.now().toString().substring(10) + ' [DEBUG] [Init] Event:', event, args);
    });
    */

    // Set up websocket artwork/information handling
    CiderApp.on("API:Playback", ({ data, type }) => {
      // data update on play/pause
      if (type == "playbackStatus.playbackStateDidChange") {
        // fade handler
        if (data.state == "paused" && !pauseTimer && settings.fade_on_stop) {
          pauseTimer = setTimeout(() => {
            document.getElementById("content").style.opacity = 0;
          }, settings.fade_delay);
        }
        else if (data.state == "playing" && (pauseTimer || settings.hide_on_idle_connect)) {
          clearTimeout(pauseTimer);
          pauseTimer = undefined;
          document.getElementById("content").style.opacity = 1;
        }

        updateComponents(data.attributes);
      }
      // data update on "track rollover"
      else if (type == "playbackStatus.nowPlayingItemDidChange") {
        updateComponents(data);
      }
      // playback updates
      else if (type == "playbackStatus.playbackTimeDidChange") {
        if (document.getElementById("artist").innerText == "Start playing something!") {
          document.getElementById("artist").innerText = "Please pause and unpause the track to update track info!";
          document.getElementById("title").innerText = "Cider4OBS Connector | Connection established, but incomplete data!";
          document.getElementById("content").style.opacity = 1;
        }
        // progress bar handler
        document.getElementById("progressBar").style.width = (
          ((data.currentPlaybackTime / data.currentPlaybackDuration) * 100) + "%"
        );
      }
      else {
        // just in case
        console.debug(type, data);
      }
    });

    CiderApp.on("disconnect", (event) => {
      document.getElementById("title").innerText = "Cider4OBS Connector | Disconnected! Retrying...";
      document.getElementById("artist").innerText = "-/-";
      document.getElementById("album").innerText = "-/-";
      document.getElementById("albumimg").src = "c4obs.png";
      console.debug('[DEBUG] [Init] Socket.io connection closed!');
      console.debug("[DEBUG] [Init] Retrying automatically...");

      if (!disconnectTimer && settings.fade_on_disconnect) {
        disconnectTimer = setTimeout(() => {
          document.getElementById("content").style.opacity = 0;
        }, settings.fade_disconnect_delay);
      }
    });

    CiderApp.on("connect_error", (error) => {
      document.getElementById("albumimg").src = "c4obs.png";
      console.debug("[DEBUG] [Init] Connect Error: " + error);
      console.debug("[DEBUG] [Init] Retrying automatically...")
    });

  } catch (error) {
    console.debug('[DEBUG] [Init] Code error:', error);
    console.debug("[DEBUG] [Init] Retrying automatically...")
  }
}
function updateComponents(data) {
  document.getElementById("title").innerText = data.name;
  document.getElementById("artist").innerText = data.artistName;
  document.getElementById("album").innerText = data.albumName;
  let aw = data.artwork;
  let tmp = aw.url.replace("{w}", aw.width);
  tmp = tmp.replace("{h}", aw.height);
  // console.debug(tmp);
  document.getElementById("albumimg").src = tmp;
}