<div align="center">
<img src="c4obs.png" width="275px" style="border-radius: 5%;">

# 🎵 Cider 4 OBS 🔴
### Connect your Cider Client to OBS and show what you're listening to!

![Apple Music](https://img.shields.io/badge/Apple_Music-9933CC?style=for-the-badge&logo=apple-music&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![GitHub Pages](https://img.shields.io/badge/github%20pages-121013?style=for-the-badge&logo=github&logoColor=white)


#### <ins>This project is NOT dormant, I'm always open for suggestions and issues! :)</ins>

</div>

## ❗ Requirements
* [Open Broadcaster Software](https://obsproject.com/)
* [Cider 2.5+](https://cider.sh)
* An Apple Music subscription (duh)

## 🛠 Setup
1. Setup Cider if you haven't done so already and open the settings. Go to **Connectivity** and scroll down all the way. Enable the **WebSockets API** switch. This isn't technically needed anymore, but it's good to have it enabled nevertheless.
2. Create a new **Browser Source** in OBS and set the URL to [`https://ryzetech.github.io/cider4obs/`](https://ryzetech.github.io/cider4obs/).
3. The source will spawn with a default width of `800`. Resize it if necessary (recommended: `400` width) and set the height to approximately `170`.
4. The browser will automatically attempt to connect to Cider and reestablish the connection if needed!
5. To customize appearance and behavior, see the customization section below. Add your custom CSS to the **Custom CSS** box in the OBS browser source settings!

## 🎨 Customization & Settings
Not happy with the default appearance and behavior? You can customize everything using the **Custom CSS** box in the OBS browser source settings. Here are some examples to copy and modify:

To pick colors, I recommend https://rgbacolorpicker.com/.

### Box Customization
```css
#content {
  /* change the background color with this: */
  background-color: rgba(69, 69, 69, 42);
  /* rgba($RED, $GREEN, $BLUE, $ALPHA)
      alpha = how transparent it is
  */
}
```

### Text Customization
Customizable elements are `span, .track-title, .track-artist, .track-album`
```css
/* to change the text color, do */
span {
  color: white;
  /* or: #ffffff; */
}

/* to make the title look neutral instead of bold, do: */
.track-title {
  font-weight: normal;
}

/* similar with the album name (pay attention to the attribute!) */
.track-album {
  font-style: normal;
}

/* you can even hide elements: */
.track-album {
  display: none;
}

/* or target by ID if you prefer: */
#title, #artist, #album {
  /* your styles here */
}
```


### Progress Bar
Customizable elements are `#progressBg, #progressBar`.
```css
/* change the progress bar background like this: */
#progressBg {
  background-color: rgba(97, 97, 97, 0.45);
}

/* same goes with the bar itself: */
#progressBar {
  background-color: rgba(255, 0, 132, 1);
}

/* you can also make the progress bar thicker or thinner: */
#progressBar {
  height: 15px;
}
```

## ⚙️ Configuration Options

You can control the behavior of the Cider4OBS overlay using CSS custom properties. Add these to the `body` selector in the OBS browser source's Custom CSS box:

```css
body {
  /* Fade the box in/out when music is paused or stopped */
  --fade-on-stop: 1; /* 1 = enabled, 0 = disabled */

  /* Fade the box in/out when Cider disconnects */
  --fade-on-disconnect: 1; /* 1 = enabled, 0 = disabled */

  /* Delay (ms) before fading out after pausing/stopping */
  --fade-delay: 2000; /* Default: 2000ms */

  /* Delay (ms) before fading out after disconnecting */
  --fade-disconnect-delay: 2000; /* Default: 2000ms, falls back to --fade-delay if not set */

  /* Hide the box when connected but Cider is idle */
  --hide-on-idle-connect: 1; /* 1 = enabled, 0 = disabled */

  /* Hide the box unless music is playing */
  --hide-unless-playing: 1; /* 1 = enabled, 0 = disabled */
}
```

**Tip:** You can combine these options to customize exactly when the overlay appears or fades out. For example, to only show the overlay when music is playing and fade out quickly when paused:

```css
body {
  --fade-on-stop: 1;
  --fade-delay: 1000;
  --hide-unless-playing: 1;
}
```

## 💜 Trusted by streamers
Thank you for supporting this project by using and spreading it! You are my heroes!

<div align="center">

| [ 🥇 iamtheratio](https://www.twitch.tv/amtheratio) |
|:-:|
| [![iamtheratio](https://zip.finnley.dev/r/DErk2u.png)](https://www.twitch.tv/iamtheratio) |

</div>

Do you want to appear here? Open a new issue and outline your involvement. I'll be happy to add you here!

## ❤ Special Thanks
A list of entities I want to thank for supporting me in different ways!

<div align="center">

| [![logo](https://avatars.githubusercontent.com/u/87914859?s=70)<br>Cider Collective](https://github.com/ciderapp/) |
| :-: |
| Thank you so much for giving me access to early builds,<br>making change response much faster! |

| [![logo](https://static-cdn.jtvnw.net/jtv_user_pictures/245fe4a9-fc34-411f-8db8-c27728ca6e7e-profile_image-70x70.png)<br>Aquasius](https://www.twitch.tv/aquasius) |
| :-: |
| Thanks for the original idea, initial feedback,<br>and the driving force to make this open source! |
</div>

## Issues, Ideas, Comments?
Tell me in the issues tab! <3
Don't have a GitHub account? Feel free to contact me on [Discord](https://discord.com/users/373135347791560706), [Telegram](https://t.me/finnleyfox), or via [Mail](mailto:cider4obs@finnley.dev)
