# Reviewer instructions

No extension account, paid service or test credentials are required for the core effect.

1. Open a public ordinary Bilibili video page, for example https://www.bilibili.com/video/BV1euaq6CEKR/ . Availability and playback resolution are controlled by Bilibili.
2. Start playback if the site does not autoplay. A screen-and-rays icon appears immediately before the native settings gear.
3. Open that icon to access the Chinese settings panel. The toolbar popup is also available.
4. Toggle 启用氛围光 (enable), adjust 亮度 (brightness) and 扩散范围 (spread), then close the panel. Settings persist after refresh.
5. Enter the player's web fullscreen mode to see the effect around the scaled video. By default the video is 88% of the fullscreen area.
6. Return to normal mode and scroll down through comments. Ambient colors continue across the viewport.
7. Disable the effect and refresh to confirm ordinary playback remains available.

The floating comment input belongs to Bilibili and normally appears only to logged-in users. Core ambilight does not require login; no test account is supplied and the extension does not post comments. The frosted floating composer is additionally covered by a matching nested Shadow DOM fixture in the repository.

Unsupported `bwp-video`, protected video, or video pixels blocked by browser security may produce a clear unsupported status instead of an effect. The extension does not bypass security, modify media URLs, or stop native playback. Ordinary public video and web fullscreen were tested on the live site; not every live, course, series or embedded-player flow has been verified.
