# Ambient light for Bilibili

[简体中文](README.md)

I loved how [Ambient light for YouTube](https://github.com/WesselKroos/youtube-ambilight) looks, so I brought that ambient lighting experience to Bilibili. **Ambient light for Bilibili** adapts its open-source projection and fade algorithms to Bilibili's player and page layout.

A Chrome Manifest V3 extension that projects video colors around the player and keeps full-page ambient lighting visible while you browse comments.

![Bilibili web fullscreen effect](docs/bilibili-web-fullscreen.png)

## Features

- Real-time WebGL projection with multiple layers and fading; falls back to Canvas 2D when WebGL is unavailable.
- Adjustable brightness, blur, saturation, transitions and flicker reduction, plus optional black-bar detection and video sizing.
- Full-page ambient colors while scrolling comments; paused playback keeps the last frame's lighting.
- Independent background blending for the header, sidebar, danmaku bar and comment composer, with a frosted floating comment input.
- A screen icon before the player's settings gear opens a compact Chinese menu. Supports normal, wide, web fullscreen, fullscreen, mini-player and mirrored layouts.
- Local preferences, JSON import/export and an `Alt + Shift + A` toggle shortcut.

## Install and update

Requires Chrome 111 or later. The extension is under review in the Chrome Web Store.

1. Download this repository, or download `ambient-light-for-bilibili-1.0.0.zip` from a release and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Choose **Load unpacked** and select the **`extension/`** directory containing `manifest.json`.
4. Refresh Bilibili and click the screen icon before the settings gear, or open the extension from the browser toolbar.

Keep the loaded directory in place. To update, replace its files, reload the extension on `chrome://extensions/`, then refresh Bilibili. Existing settings are retained.

See the [Privacy Policy](PRIVACY.md) for details about local data processing.

## Credits and license

[MIT](LICENSE).

Thanks to [WesselKroos/youtube-ambilight](https://github.com/WesselKroos/youtube-ambilight) for its projection, fading and WebGL color algorithms, and [iceorange-dev/bilibili-ambilight](https://github.com/iceorange-dev/bilibili-ambilight) for its Bilibili player-state, page-blending and toolbar adaptation references.
