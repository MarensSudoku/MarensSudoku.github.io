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

Open http://127.0.0.1:4175/. Run `npm run test:browser` while the local server is running. Browser tests need Playwright's Chromium and WebKit installations. In PowerShell use `npm.cmd` if script execution is blocked.

## Play

Select a square and enter a number with the on-screen pad or keyboard. Arrow keys navigate; N toggles notes. Undo restores a complete move. Choose Easy, Medium or Hard to generate a new uniquely solvable puzzle locally.

Games and preferences stay in this browser. Achievement saving is optional and can be disabled or deleted. Clearing site data removes progress. Once “Ready offline” appears, the same address also works offline. A second tab is read-only in browsers supporting Web Locks.

## Instrumental music

Twelve supplied instrumental MP3 files are available as two variants of six themes. Music is enabled on every page load and starts automatically when allowed, otherwise on the first click, tap or key press. A random different track is chosen on reload and whenever a song finishes. Pause music in the footer for the current visit; select a track and adjust volume in Settings. Music keeps playing across tab changes. Volume and the last track are saved to avoid consecutive repeats. All tracks work offline after the complete cache is ready.

Generation prompts and the drop folder are in [web/assets/music](web/assets/music/README.md); audio rights are documented separately in [RIGHTS.md](web/assets/music/RIGHTS.md). The twelve music files and eight procedurally synthesised sound effects have separate [music](web/assets/music/LICENSE.md) and [sound-effect](web/assets/sounds/LICENSE.md) notices under CC BY 4.0, to the extent the project can grant the relevant rights. Attribution: “MarensSudoku-Projekt”. This does not change the code's MIT licence. Sound sources and reproduction are documented in [PROVENANCE.md](web/assets/sounds/PROVENANCE.md).

## Points

Each solved puzzle awards 1,000 / 2,000 / 3,000 base points for Easy / Medium / Hard. A time bonus of up to 50% decreases to zero over 10 / 20 / 40 active minutes. No wrong number adds 20%; no undo adds 10%. Every fifth puzzle recorded in the optional collection adds 500 points. Notes never count as wrong numbers. Undo does not erase recorded mistakes. Points are awarded once per puzzle, even after undo or reload.

The clock pauses in dialogs and background tabs. Existing puzzles begin timing from this update; previous rounds receive no invented scores. Total points, personal best, solved counts and badges are saved only when achievement saving is enabled. Turning it off or deleting the collection clears these totals after confirmation. A round's own result stays with its saved puzzle.

## Implementation

Phaser 4.2.1 renders the board and effects. Semantic HTML provides menus, keyboard controls and a synchronised accessible grid. The pure JavaScript Sudoku engine runs in a Web Worker. Difficulty uses solving techniques rather than clue counts alone. Native offline caching verifies complete asset hashes before accepting an update.

## Licence

Original code and documentation: MIT. See LICENSE and THIRD_PARTY_NOTICES.md. Graphics provenance and rights limitations are documented in web/assets/ASSET_PROVENANCE.md.

The first release was published on 28 October 2026. Operator and privacy information are included in the app. Real-device testing remains outstanding.
