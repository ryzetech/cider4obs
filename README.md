# 🎵 Cider 4 OBS 🔴
### Connect your Cider Client to OBS and show what you're listening to!

## ❗ Requirements
* [Open Broadcaster Software](https://obsproject.com/)
* [Cider 2.5+](https://cider.sh)
* An Apple Music subscription (duh)

## 🛠 Setup
1. Setup Cider if you haven't done so already and open the settings. Go to "Connectivity" and scroll down all the way. Enable the Switch "WebSockets API". This isn't technically needed anymore, but it's good to have it enabled nevertheless.
2. Create a new Browser Source in OBS and set the URL to [`https://ryzetech.github.io/cider4obs/`](https://ryzetech.github.io/cider4obs/).
3. The source will spawn with a width of `800` by default. Resize it if necessary (my personal sweet spot is `400`) and change the height to `170` or something like that.
4. The browser in OBS will now attempt to connect to Cider every five seconds and reestablish the connection if necessary!
5. If you want to customize how the app is looking, read below. Add the options into the Custom CSS box of OBS!

## 🎨 Customization & Settings
Unhappy with the way the app looks and behaves by default? You can change the settings with the "Custom CSS" box in the OBS browser source. I have compiled some **examples** below to just copy and change to your liking.

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
Customizable elements are `span, #title, #artist, #album`
```css
/* to change the text color, do */
span {
  color: white;
  /* or: #ffffff; */
}

/* to make the title look neutral instead of bold, do: */
#title {
  font-weight: normal;
}

/* similar with the album name (pay attention to the attribute!) */
#album {
  font-style: normal;
}

/* you can even hide elements: */
#album {
  display: none;
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

### Settings
Some settings adjusting the behavior of certain elements.
```css
body {
  /* general key: 1=on, 0=off */
  
  /* fade the box in and out depending on whether music is playing or not */
  --fade-on-stop: 1;

  /* how long playback must be paused until the box fades (if enabled) */
  --fade-delay: 1000;
}
```

## 💜 Trusted by streamers
Thank you for supporting this project with links and by word-of-mouth! You are my heroes!

| [ 🥇 iamtheratio](https://www.twitch.tv/iamtheratio)                                          |
|:-----------------------------------------------------------------------------------------:|
| [![iamtheratio](https://zip.finnley.dev/r/DErk2u.png)](https://www.twitch.tv/iamtheratio) |

Do you want to appear here? Open a new issue and outline your involvement. I'll be happy to add you here!

## Issues, Ideas, Comments?
Tell me in the issues tab! <3