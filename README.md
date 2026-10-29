# MarensSudoku

A colourful, offline-capable Sudoku game set in a bright coral reef. Crystal-clear water, white sand, tropical fish, personal achievements and gentle effects.

Play at [marenssudoku.github.io](https://marenssudoku.github.io/). Source: [MarensSudoku.github.io](https://github.com/MarensSudoku/MarensSudoku.github.io). Publication requires a fresh preview and the owner's explicit approval before every push.

## Run locally

Node.js 22 or newer:

```sh
npm ci
npm test
npm run build
npm start
```

Open http://127.0.0.1:4175/. Run `npm run test:browser` and `npm run test:aquarium` while the local server is running. Browser tests need Playwright's Chromium and WebKit installations. In PowerShell use `npm.cmd` if script execution is blocked.

## Play

Select a square and enter a number with the on-screen pad or keyboard. Arrow keys navigate; N toggles notes. Undo restores a complete move. Restart clears the current attempt after confirmation, keeping the same puzzle and banked points. Choose Easy, Medium or Hard in Settings to generate a new uniquely solvable puzzle locally. Time and total points appear in the header; New Sudoku sits beside undo, notes, erase and restart.

Games and preferences stay in this browser. Achievement saving is optional and can be disabled or deleted. Clearing site data removes progress. The app downloads its offline files in the background; after the complete download, the same address also works offline. A second tab is read-only in browsers supporting Web Locks.

## Instrumental music

Eleven supplied instrumental MP3 files cover six themes; “Schwebende Perlen · Variante 2” has been removed from the game. Music is enabled on every page load and starts automatically when allowed, otherwise on the first click, tap or key press. A random different track is chosen on reload and whenever a song finishes. Pause music for the current visit, select a track and adjust volume in Settings. Music keeps playing across tab changes. Volume and the last track are saved to avoid consecutive repeats. All tracks work offline after the complete cache is ready.

Generation prompts and the drop folder are in [web/assets/music](web/assets/music/README.md); audio rights are documented separately in [RIGHTS.md](web/assets/music/RIGHTS.md). The eleven music files and eight procedurally synthesised sound effects have separate [music](web/assets/music/LICENSE.md) and [sound-effect](web/assets/sounds/LICENSE.md) notices under CC BY 4.0, to the extent the project can grant the relevant rights. The music notice also retains the removed track's original licence. Attribution: “MarensSudoku-Projekt”. This does not change the code's MIT licence. Sound sources and reproduction are documented in [PROVENANCE.md](web/assets/sounds/PROVENANCE.md).

## Points

Each solved puzzle awards 1,000 / 2,000 / 3,000 base points for Easy / Medium / Hard. A time bonus of up to 50% decreases to zero over 10 / 20 / 40 active minutes. No wrong number adds 20%; no undo adds 10%. Every fifth solved puzzle adds 500 points. Notes never count as wrong numbers. Undo does not erase recorded mistakes. Points are banked once per puzzle, even after undo, restart or reload.

The clock pauses in dialogs and background tabs. Total points, personal best and solved counts are saved locally independently of optional achievement saving. Turning achievements off clears only their counters and badges. Deleting progress after confirmation also clears banked points. Existing saved totals and a known completed round result are migrated; previously discarded results cannot be reconstructed.

## Implementation

The game view fits the available viewport width and height without page scrolling, with controls beside the board in short landscape windows. Music and difficulty controls are in Settings; legal links and updates are in Help & info. Long dialog contents remain scrollable.

Semantic HTML and CSS render the entire board, including grid lines, glass-like backgrounds, highlights, sharp numbers and notes. Babylon.js 9.32.1 renders a real 3D aquarium behind the interface: a sandy corridor between layered reef ledges, five separate coral types, seagrass, algae, gently swaying anemones and a small walking crab. Six fish species include two coherent schools, with 24 fish on mobile and 36 on desktop. Sun shafts, surface ripples and moving caustic patterns light the sand. The composition follows the original reef illustration's colours, dense edges and open centre.

Rendering is capped at 30 frames per second, pauses in background tabs, and becomes still with reduced motion. Resizing redraws immediately; an opaque canvas background prevents the fallback image flashing through. A muted background video remains as a fallback if 3D cannot load; only the separate music and sound cues produce audio.

All engine code and 17 uncompressed GLB models are served locally and included in the offline cache. Embedded textures are limited to 1024 pixels; the models together occupy about 6 MB. Meshy is used only during development, never contacted by players. Models and their generation trail are documented in [web/assets/models/PROVENANCE.md](web/assets/models/PROVENANCE.md). Effects use native browser animation and Web Audio, with HTML audio as a fallback. The pure JavaScript Sudoku engine runs in a Web Worker. Difficulty uses solving techniques rather than clue counts alone. Native offline caching verifies complete asset hashes before accepting an update.

## Licence

Original code and documentation: MIT. See LICENSE and THIRD_PARTY_NOTICES.md. Graphics provenance and rights limitations are documented in web/assets/ASSET_PROVENANCE.md.

The first release was published on 28 October 2026. Operator and privacy information are included in the app. Real-device testing remains outstanding.
