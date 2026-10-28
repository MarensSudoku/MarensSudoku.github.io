# MarensSudoku

A colourful, offline-capable Sudoku game set in a bright coral reef. Crystal-clear water, white sand, tropical fish, personal achievements and gentle effects.

Local preview in development. Target repository: https://github.com/MarensSudoku/MarensSudoku.github.io. Publication requires a fresh preview and the owner's explicit approval before every push.

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

Generation prompts and the drop folder are in [web/assets/music](web/assets/music/README.md); audio rights are documented separately in [RIGHTS.md](web/assets/music/RIGHTS.md). The proposed media licence is CC BY 4.0, with attribution to “MarensSudoku-Projekt”; see the [music licence draft](web/assets/music/LICENSE.md) and [sound-effect licence template](web/assets/sounds/LICENSE.md). Both require the documented rights and release confirmation before publication. They do not change the code's MIT licence. Eight separate sound-effect prompts and their drop folder are in [web/assets/sounds](web/assets/sounds/README.md). No sound effects have been supplied or licensed yet.

## Implementation

Phaser 4.2.1 renders the board and effects. Semantic HTML provides menus, keyboard controls and a synchronised accessible grid. The pure JavaScript Sudoku engine runs in a Web Worker. Difficulty uses solving techniques rather than clue counts alone. Native offline caching verifies complete asset hashes before accepting an update.

## Licence

Original code and documentation: MIT. See LICENSE and THIRD_PARTY_NOTICES.md. Graphics provenance and rights limitations are documented in web/assets/ASSET_PROVENANCE.md.

Before public deployment: confirm operator/contact details, public-hosting privacy information, name and graphics clearance, and real-device results. No public deployment has been approved yet.
