# Privacy Policy

**Ambient light for Bilibili**
Last updated: September 30, 2026

This policy describes how Ambient light for Bilibili processes data to generate ambient lighting on Bilibili. It applies to version 1.0.0.

## Data processed locally

The extension processes video pixels, playback state, and relevant page structure and layout in your browser to render lighting and position its controls. It reads the current Bilibili page URL to determine whether the page supports the effect. It does not access your browser's browsing history database or create a record of visited pages.

Video pixels and rendering buffers are processed in memory during the page session. They are not saved as recordings or screenshots, or transmitted to the developer or third parties. The extension does not extract comment text, read login cookies or passwords, or collect personal, financial, health or location information. It responds to scrolling and control interactions to operate the interface, without recording interaction logs.

## Preferences and retention

The extension uses `chrome.storage.local` to save your lighting settings, such as brightness, blur, color adjustments and layout preferences. Settings stay in your browser until changed or removed; they are not synchronized through `chrome.storage.sync` or uploaded.

You can change settings in the extension's settings panel. Disabling the extension and refreshing the page stops its processing. Closing the page ends its in-memory video processing session. Uninstalling the extension removes its local settings.

If you choose to export settings, a JSON file containing your preferences is saved to the location you select. Imported JSON settings are read locally. Exported files remain on your device until you delete them separately.

## Sharing and limited use

The extension has no developer server, telemetry, analytics, advertising or account system. It does not transmit, sell or share video pixels, page URLs, preferences or usage data with the developer or third parties.

Its use of data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used solely for the extension's ambient lighting and related controls, never for advertising, profiling, creditworthiness or lending decisions. The developer does not receive or inspect this locally processed data.

## Third-party services

Bilibili, Chrome and GitHub operate under their own privacy policies. If you choose to contact the maintainer through GitHub Issues, any information you submit is handled by GitHub and is visible according to the issue's visibility. Do not include private information in public issues.

## Changes and contact

Changes to this policy will be published here with an updated date. For privacy questions, contact the maintainer through [GitHub Issues](https://github.com/pengchzn/Ambient-for-bilibili/issues).
