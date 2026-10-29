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

The eleven music files and eight procedurally synthesised sound effects have separate [music](web/assets/music/LICENSE.md) and [sound-effect](web/assets/sounds/LICENSE.md) notices under CC BY 4.0, to the extent the project can grant the relevant rights. The music notice also retains the removed track's original licence. Attribution: “MarensSudoku-Projekt”. This does not change the code's MIT licence.

## Points

Each solved puzzle awards 1,000 / 2,000 / 3,000 base points for Easy / Medium / Hard. A time bonus of up to 50% decreases to zero over 10 / 20 / 40 active minutes. No wrong number adds 20%; no undo adds 10%. Every fifth solved puzzle adds 500 points. Notes never count as wrong numbers. Undo does not erase recorded mistakes. Points are banked once per puzzle, even after undo, restart or reload.

The clock pauses in dialogs and background tabs. Total points, personal best and solved counts are saved locally independently of optional achievement saving. Turning achievements off clears only their counters and badges. Deleting progress after confirmation also clears banked points. Existing saved totals and a known completed round result are migrated; previously discarded results cannot be reconstructed.

## Implementation

The game view fits the available viewport width and height without page scrolling, with controls beside the board in short landscape windows. Music and difficulty controls are in Settings; legal documents and updates are in Help & info. Full licence texts, legal notice and privacy information are embedded from their original files into expandable sections, including offline, without leaving the dialog. Long dialog contents remain scrollable with the close button always visible.

The game surface suppresses accidental selection, context menus, image/link dragging and mobile long-press menus. Native touch rules avoid double-tap zoom on game buttons while preserving pinch zoom, form controls, keyboard access and copyable info text. Dialogs scroll vertically only. During active, visible play the native Screen Wake Lock API requests an awake screen; menus, completed rounds, read-only tabs and backgrounding release it. Returning to active play reacquires it; unsupported or denied requests never block play. Browser and system power policies can override the request.

Mobile play uses portrait orientation where the platform permits locking it. Otherwise, a portrait reminder pauses interaction in landscape and restores the previous screen when the device is upright; browser chrome cannot be forcibly locked. Desktop windows retain their responsive layout.

The fish button in the header hides Sudoku for an unobstructed aquarium view. Tap the fish button again to return to the same puzzle. Watching the reef pauses the puzzle timer while music and fish continue, respecting reduced motion. The screen remains awake where supported.

Settings → Arrange my reef, or the button below the aquarium view, opens the aquarium editor. The header offers an illustrated model picker. Selecting a model immediately adds one instance to the reef. A ring of controls surrounds the selected object, with an open centre for direct mouse or touch dragging. Choose Move to drag along the ground, Height to drag up or down, Rotate to turn by dragging sideways, or Scale to enlarge by dragging up and shrink by dragging down. The active mode is highlighted. Duplicate, Remove and object settings remain in the ring. The transform modes also accept arrow keys. Fish settings contain only swimming behaviour, speed and radius, including loops, patrols, figure-eight routes, stationary placement and schooling. The existing-object list also shows model thumbnails. The default reef includes swaying green plants and purple anemones in both foreground corners. Save stores the validated arrangement separately as `marenssudoku:reef:v1`, with at most 140 objects; Discard restores the previous arrangement. Reset affects the draft until saved. Sudoku values and points are independent, and its timer pauses while editing. Unsupported 3D disables the editor while preserving Sudoku play.

Semantic HTML and CSS render the entire board, including grid lines, glass-like backgrounds, highlights, sharp numbers and notes. Babylon.js 9.32.1 renders a real 3D aquarium behind the interface: a sandy corridor between layered reef ledges, five separate coral types, seagrass, algae, gently swaying anemones and a small walking crab. Six fish species include two coherent schools, with 24 fish on mobile and 36 on desktop. Sun shafts, surface ripples and moving caustic patterns light the sand. The composition follows the original reef illustration's colours, dense edges and open centre.

Rendering runs at up to 60 frames per second, pauses in background tabs, and becomes still with reduced motion. Resizing redraws immediately. If 3D cannot load, a plain water colour remains behind the game.

All engine code and 17 uncompressed GLB models are served locally and included in the offline cache. Embedded textures are limited to 1024 pixels; the models together occupy about 6 MB. Meshy is used only during development, never contacted by players. Effects use native browser animation and Web Audio, with HTML audio as a fallback. The pure JavaScript Sudoku engine runs in a Web Worker. Difficulty uses solving techniques rather than clue counts alone. Native offline caching verifies complete asset hashes before accepting an update.

## Licence

Original code and documentation: MIT. See LICENSE and THIRD_PARTY_NOTICES.md.

The first release was published on 28 October 2026. Operator and privacy information are included in the app. Real-device testing remains outstanding.
