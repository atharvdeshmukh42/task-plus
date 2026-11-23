# Task Plus logo

![Task Plus](logo.png)

A check with a superscript plus, so the mark reads as "Task+". The long stroke of the check rises toward the plus. White strokes sit on a cobalt squircle (`#2953BC`, the SWAAR UI accent). The wordmark is Inter SemiBold with −2% tracking.

## Files

| File | Use |
| --- | --- |
| `logo.svg` / `logo.png` | Horizontal lockup on light backgrounds (wordmark converted to outlines) |
| `logo-reversed.svg` | Lockup on dark backgrounds |
| `logo-mark.svg` | The mark on its own: favicons, avatars, headers |
| `logo-glyph.svg` | Strokes only, in `currentColor`, for one-colour use |
| `app-icon.svg` | Full-bleed square with a subtle gradient, for app stores (the OS applies its own mask) |

`npm run build` also writes the files the apps use:

- **Web:** `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-512.png`, and `src/components/logo.generated.ts`
- **Mobile:** `icon.png` (opaque, as Apple requires), the Android adaptive layers (foreground, background, monochrome), `splash-icon.png`, `favicon.png`, and `src/components/logo.generated.ts`

## Using it

- Leave clear space of at least a quarter of the mark's height on every side.
- Don't show the mark smaller than 16 px. Below 24 px, use the mark without the wordmark.
- In the web workspace the tile follows the SWAAR accent, so a client theme (`data-sw-theme`) recolours it. Everywhere else it stays cobalt.
- Don't rotate the mark, outline it, add effects to it, or change its colours.

## Changing it

The geometry, on a 48-unit grid, and the colours live at the top of `generate.mjs`.

```bash
cd brand
npm install
npm run build
```

Inter is used under the SIL Open Font License (`fonts/Inter-LICENSE.txt`).
