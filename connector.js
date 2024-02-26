function startWebSocket() {
  try {
    // Connect to the websocket server
    console.debug('[DEBUG] [Init] Configuring websocket connection...');
    const CiderApp = new WebSocket('ws://localhost:10766/ws');
    console.debug('[DEBUG] [Init] Websocket connection established!');
    document.getElementById("title").innerText = "Cider4OBS Connector | Connection established!";
    document.getElementById("artist").innerText = "Start playing something!";
    document.getElementById("album").innerText = "-/-"

    // Set up websocket artwork/information handling
    CiderApp.addEventListener("message", (event) => {
      if (event.data !== undefined || event.data !== null) {
        try {
          let playbackInfo = JSON.parse(event.data);

          if (playbackInfo.data?.status !== undefined || playbackInfo.data?.artwork?.url !== undefined || playbackInfo.data?.name !== undefined) {
            updateComponents(playbackInfo.data);
            console.debug(playbackInfo.data);
          } else {
            console.debug("[DEBUG] [Init] PlaybackInfo is undefined or null, skipping to avoid errors.")
          }
        } catch (error) {
          console.debug('[DEBUG] [Init] Websocket parsing error:', error);
        }
      } else {
        console.log("[DEBUG] [Init] Websocket message is undefined or null, skipping.")
      }
    });
    CiderApp.addEventListener("close", (event) => {
      document.getElementById("title").innerText = "Cider4OBS Connector | Connection closed! Retrying...";
      document.getElementById("artist").innerText = "Are you sure Cider (version 2.3 and above) is running and you have WebSockets enabled? (Settings > Connectivity > WebSockets API)";
      document.getElementById("album").innerText = "-/-"
      console.debug('[DEBUG] [Init] Websocket connection closed!');
      console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
      setTimeout(startWebSocket, 5000);
    });
    CiderApp.addEventListener("error", (event) => {
      console.debug('[DEBUG] [Init] Websocket error:', error);
      console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
      setTimeout(startWebSocket, 5000);
    });
  } catch (error) {
    console.debug('[DEBUG] [Init] Websocket error:', error);
    console.debug("[DEBUG] [Init] Retrying in 5 seconds...")
    setTimeout(startWebSocket, 5000);
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
  console.debug(tmp);
  document.getElementById("albumimg").src = tmp;
}