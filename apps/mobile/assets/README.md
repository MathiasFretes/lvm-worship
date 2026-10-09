# Mobile app assets

## `icon.png` — the La Voz Misionera brand app icon

`icon.png` is generated from the original `lvm-mark.svg`: the LVM white cross
inside a gold circle on a navy field. The same source generates the
macOS Studio AppIcon, so Mobile and Studio remain one product family.

- **Requirements:** 1024×1024, **no alpha channel** (flat RGB PNG), no rounded
  corners (iOS masks them).
- **Regenerate Mobile + Studio:** from the repository root run:

  ```sh
  npm run studio:icons
  ```

  This writes the 1024×1024 RGB `icon.png` and all ten macOS AppIcon slots.

## `splash-icon*.png` — the launch-screen mark (**keeps its alpha**)

Note the opposite requirement to `icon.png` above: the splash images **must be
transparent**. Reusing `icon.png` as the splash image would show a hard-edged
navy square floating on the splash background instead of the transparent mark.

- `splash-icon.png` — mark for the **light** splash background (`#F6F7F9`).
- `splash-icon-dark.png` — mark for the **dark** splash background (`#111C28`).
- **Requirements:** 1024×1024, alpha channel intact, no background fill. Wired via
  the `expo-splash-screen` plugin in `apps/mobile/app.json`.
- `imageWidth` in that plugin config (200) and `SPLASH_IMAGE_WIDTH` in
  `src/components/SplashOverlay.tsx` describe the same mark and **must stay in
  sync** — the overlay is drawn to be pixel-identical to the native splash so the
  handoff between them is invisible.

### `lvm-mark.svg` — icon source of truth

`lvm-mark.svg` is the LVM-owned square master for launcher/store icons. Keep it
vector; do not hand-edit generated PNGs.

Regenerate after editing the SVG:

```sh
npm run studio:icons
```

## `sprites/` — the profile avatars (**WebP, via `expo-image` only**)

The 15 avatars a user picks from in "Choose your icon" / Settings → Account →
Your icon. They are the *profile* avatar, not the app icon: the persisted value
lives in `users.preferences.sprite` and is **shared with the web app**, so the
ids here and in `apps/web/src/components/ui/SpritePicker.jsx` must match
exactly, and both apps must show the same artwork for a given id.

The source of truth is the reproducible LVM generator,
`apps/mobile/scripts/generate-lvm-assets.mjs`. It writes byte-identical WebP
files to Mobile and Web, so a persisted id always resolves to the same original
LVM artwork in both clients.

**They must only ever be rendered through `expo-image`.** React Native's own
`Image` supports WebP on Android only (see the format list in
`react-native/Libraries/Image/ImageProps.js`), and on iOS a `.webp` source
decodes to nothing — which is exactly what shipped once, as blank circles in
the Settings profile card, the Home and Daily Word headers, and an avatar
picker whose unselected tiles were invisible. `expo-image` decodes WebP on both
platforms, which is what makes shipping WebP possible at all; swapping any of
these call sites back to RN's `Image` reintroduces that bug on iOS.

- **Requirements:** `<id>.webp`, 384×384, alpha intact. 384 is 3× the largest
  size any screen draws them at (the picker's tiles on the widest phone);
  everything else — the 52pt profile card, the 30pt headers, the 29pt row —
  scales down from the same file.
- Regenerate all 15, along with the Mobile identity images:

  ```sh
  node apps/mobile/scripts/generate-lvm-assets.mjs
  ```

- Adding an avatar means adding the `.webp` to `apps/web/public/sprites/`, the
  id to **both** `SPRITE_IDS` lists, a `require` line in
  `src/lib/sprites.ts` (Metro needs static literals), a new declarative spec in
  the generator, and re-running the command above.

## In-app marks — `mark.webp`, `google-g.webp`, `splash-mark*.png`

Distinct from the store/launcher assets above, and sized for what actually draws
them rather than for the store. `icon.png` and `splash-icon*.png` stay 1024×1024
because `app.json` hands them to the native icon and splash pipelines; rendering
those same files in JS meant decoding a 1024² bitmap (~4MB) for a 28pt logo.

- `mark.webp` — 192×192, the app mark for the Home header (28pt) and the Auth
  screen (64pt). Rendered with `expo-image`.
- `google-g.webp` — 64×64, the Google "G" on the sign-in button (20pt).
  Rendered with `expo-image`.
- `splash-mark.png` / `splash-mark-dark.png` — 600×600, for
  `SplashOverlay`'s 200pt mark. **PNG, not WebP**, because the overlay stays on
  RN's `Animated.Image`: the splash handoff keys off `onLoadEnd` and is timing
  sensitive, so it is deliberately not converted.

```sh
node apps/mobile/scripts/generate-lvm-assets.mjs
```

The generator derives `icon.png`, `adaptive-icon.png`, `mark.webp`, and both
splash image pairs from `lvm-mark.svg`. Generated splash/adaptive images retain
alpha; `icon.png` and `mark.webp` remain opaque.

See `PROVENANCE.md` for the 24-file reference comparison and the external
provider assets intentionally retained.
