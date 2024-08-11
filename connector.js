let pauseTimer;
let settings;

function getVarFromBody(name) { return window.getComputedStyle(document.body).getPropertyValue(name); }

function getSettings() {
  const set = {
    fade_on_stop: getVarFromBody('--fade-on-stop') == 1,
    fade_delay: getVarFromBody('--fade-delay') || 2000,
    disable_telemetry: getVarFromBody("--disable-telemetry") == 1,
  };

  if (!set.disable_telemetry) {
    
  }

  return set;
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
    const CiderApp = new WebSocket('ws://localhost:10766/ws');
    window.app = CiderApp;

    CiderApp.addEventListener("open", (event) => {
      console.debug('[DEBUG] [Init] Websocket connection established!');
      document.getElementById("title").innerText = "Cider4OBS Connector | Connection established!";
      document.getElementById("artist").innerText = "Start playing something!";
      document.getElementById("album").innerText = "-/-";
    });

    // Set up websocket artwork/information handling
    CiderApp.addEventListener("message", (event) => {
      if (event.data !== undefined || event.data !== null) {
        try {
          let playbackInfo = JSON.parse(event.data);

          if (playbackInfo.data?.status !== undefined || playbackInfo.data?.artwork?.url !== undefined || playbackInfo.data?.name !== undefined) {
            updateComponents(playbackInfo.data);
            if (pauseTimer && playbackInfo.data?.isPlaying) {
              clearTimeout(pauseTimer);
              pauseTimer = undefined;
              document.getElementById("content").style.opacity = 1;
            }

            // console.debug(playbackInfo.data);
          } else {
            if (!playbackInfo.data?.isPlaying && !pauseTimer && settings.fade_on_stop) {
              pauseTimer = setTimeout(() => {
                document.getElementById("content").style.opacity = 0;
              }, settings.fade_delay);
            }
            console.debug("[DEBUG] [WS] PlaybackInfo is undefined or null, skipping to avoid errors.")
            console.debug(event)
          }
        } catch (error) {
          console.debug('[DEBUG] [WS] Websocket parsing error:', error);
        }
      } else {
        console.log("[DEBUG] [WS] Websocket message is undefined or null, skipping.")
      }
    });
    CiderApp.addEventListener("close", (event) => {
      document.getElementById("title").innerText = "Cider4OBS Connector | Connection failed! Retrying...";
      document.getElementById("artist").innerText = "Are you sure Cider (version 2.3 and above) is running and you have WebSockets enabled? (Settings > Connectivity > WebSockets API)";
      document.getElementById("album").innerText = "-/-"
      console.debug('[DEBUG] [Init] Websocket connection closed!');
      console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
      setTimeout(startWebSocket, 5000);
    });
    CiderApp.addEventListener("error", (error) => {
      console.debug('[DEBUG] [Init] Websocket error:', error);
      console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
      setTimeout(startWebSocket, 5000);
    });
  } catch (error) {
    console.debug('[DEBUG] [Init] Code error:', error);
    console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
    setTimeout(startWebSocket, 1000);
  }
}
function updateComponents(pb) {
  document.getElementById("title").innerText = pb.name;
  document.getElementById("artist").innerText = pb.artistName;
  document.getElementById("album").innerText = pb.albumName;
  document.getElementById("progressBar").style.width = (((pb.currentPlaybackTime / pb.durationInMillis) * 100000) + "%");
  let aw = pb.artwork;
  let tmp = aw.url.replace("{w}", aw.width);
  tmp = tmp.replace("{h}", aw.height);
  // console.debug(tmp);
  document.getElementById("albumimg").src = tmp;
}