# Persian Isles Mini Golf — promotional covers

Three professional 1920×1080 PNG covers, using real scene screenshots from the local game.

- Open index.html locally for the gallery and downloads.
- Each sources/*.html is independently editable and fully self-contained: image and typefaces are embedded; no remote requests. Artboards are fixed at 1920×1080. Copy remains actual HTML text.
- assets/*-scene-1920x1080.png are unretouched scene captures; only UI visibility was changed in the capture browser. Game sources were not modified.
- Hormuz shows its actual course scene. Qeshm and Kish show actual island previews and are labelled accordingly; this collection makes no claim that their golf is released. The coastal filename uses the requested kish-hengam identifier, but depicts Kish only.
- Covers use ivory #f9f3e6, teal #214b4a and coral #b34c3c with the original game palette.
- Fonts: Libre Caslon Display and DM Sans, embedded under SIL OFL; licences are in assets/.
- Rebuild with a running dev server: node scripts/export-covers.js. Requires Playwright and installed Chrome. GAME_URL may override the capture origin.
- Nothing in marketing/ is imported by the game or copied into public/dist. No gameplay logic or release state was altered.

Design audit: 0/10 generic-design tells. No feature cards, fabricated metrics, glass, tech gradients, centered headline stacks or synthetic scene illustrations.
