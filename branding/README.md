# OmniBazaar Mobile — branding source assets

Drop production artwork here, then run `node scripts/generate-placeholder-assets.js`
from `Mobile/`. Anything missing falls back to the centred-square placeholder.

| Source file                       | Target                                  | Spec |
|-----------------------------------|-----------------------------------------|------|
| `icon.png`                        | `assets/images/icon.png`                | **1024×1024 square PNG, NO alpha channel** (Apple App Store rejects icons with transparency). The full canvas should contain art — iOS auto-applies its rounded-rect mask. |
| `adaptive-icon.png`               | `assets/images/adaptive-icon.png`       | **1024×1024 square PNG with alpha**. Foreground only. The launcher applies a circular / squircle / rounded-rect mask depending on the OEM, so keep all logo pixels inside the **centre 432×432 safe area** (≈42 % of the canvas). The dark `#1a1a1a` shows through behind any transparency — that comes from `app.json → expo.android.adaptiveIcon.backgroundColor`. |
| `splash.png`                      | `assets/images/splash.png`              | **1284×2778 portrait PNG** (iPhone 14 Pro Max — Expo scales down for smaller devices). Logo centred; rest of canvas can be the brand background `#1a1a1a` or transparent. `splash.resizeMode: 'contain'` is set in app.json so any aspect ratio works. |
| `favicon.png`                     | `assets/images/favicon.png`             | **48×48 square PNG** for the web target (browser tab icon). |
| `notification-icon.png`           | `assets/images/notification-icon.png`   | **96×96 square PNG, transparent background, MONOCHROME WHITE foreground** (Android requirement — the system tints it). Don't use a colour logo here; Android will silhouette it anyway. |
| `notification.wav`                | `assets/sounds/notification.wav`        | **PCM WAV, ≤2 s, mono or stereo, 16-bit**. Plays under push notifications. |

## Quick-start with a single source logo

If you only have one master logo, you can derive everything else from it
with ImageMagick (or any image editor):

```bash
# Square crop + 1024² icon (assumes logo.png is on a transparent background)
convert logo.png -background "#1a1a1a" -alpha remove \
        -resize 1024x1024 -gravity center -extent 1024x1024 branding/icon.png

# Adaptive icon — same artwork, smaller (foreground inside safe area)
convert logo.png -resize 432x432 -background none \
        -gravity center -extent 1024x1024 branding/adaptive-icon.png

# Splash
convert logo.png -resize 600x600 -background "#1a1a1a" -alpha remove \
        -gravity center -extent 1284x2778 branding/splash.png

# Favicon
convert logo.png -resize 48x48 branding/favicon.png

# Notification icon — silhouette to white
convert logo.png -resize 96x96 -channel RGB -threshold 50% \
        -fill white -opaque black branding/notification-icon.png
```

After dropping files in, run:
```bash
cd ~/OmniBazaar/Mobile
node scripts/generate-placeholder-assets.js
```

The script prints `✓ real` next to each asset it copied from `branding/`
and `○ placeholder` for any it generated. When all six show `✓ real`,
you're ready for the next EAS build.
