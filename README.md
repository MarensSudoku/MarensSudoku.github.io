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

Games and preferences stay in this browser. Achievement saving is enabled by default for new players and can be disabled or deleted. Existing saved choices are preserved. Clearing site data removes progress. The app downloads its offline files in the background; after the complete download, the same address also works offline. A ready update is offered before play with an Update button and a close cross. Closing keeps the current version selected, including after reopening the app; Settings and Help & info retain their update controls. An update that finishes downloading during play is offered there without interrupting the round. The game is saved before an update is activated. A second tab is read-only in browsers supporting Web Locks.

An existing v1 installation first needs its regular update to v2; subsequent updates use the new startup dialog.

## Instrumental music

Eleven supplied instrumental MP3 files cover six themes; “Schwebende Perlen · Variante 2” has been removed from the game. Music is enabled on every page load and starts automatically when allowed, otherwise on the first click, tap or key press. A random different track is chosen on reload and whenever a song finishes. Pause music for the current visit, select a track and adjust volume in Settings. Music pauses when the app is hidden or the screen is locked and resumes from the same position on return if still enabled and allowed by the browser. A manual pause remains in effect. Volume and the last track are saved to avoid consecutive repeats. All tracks work offline after the complete cache is ready.

The eleven music files and eight procedurally synthesised sound effects have separate [music](web/assets/music/LICENSE.md) and [sound-effect](web/assets/sounds/LICENSE.md) notices under CC BY 4.0, to the extent the project can grant the relevant rights. The music notice also retains the removed track's original licence. Attribution: “MarensSudoku-Projekt”. This does not change the code's MIT licence.

## Points

Each solved puzzle awards 1,000 / 2,000 / 3,000 base points for Easy / Medium / Hard. A time bonus of up to 50% decreases to zero over 10 / 20 / 40 active minutes. No wrong number adds 20%; no undo adds 10%. Every fifth solved puzzle adds 500 points. Notes never count as wrong numbers. Undo does not erase recorded mistakes. Points are banked once per puzzle, even after undo, restart or reload.

The clock pauses in dialogs and background tabs. Total points, personal best and solved counts are saved locally independently of optional achievement saving. Turning achievements off clears only their counters and badges. Deleting progress after confirmation also clears banked points. Existing saved totals and a known completed round result are migrated; previously discarded results cannot be reconstructed.

## Implementation

The game view fits the available viewport width and height without page scrolling, with controls beside the board in short landscape windows. Music and difficulty controls are in Settings; legal documents and updates are in Help & info. Changing sound-effect volume plays a preview on release or a keyboard adjustment, respecting mute. The reef starts loading in the background while Welcome is open. Starting play waits for any remaining 3D loading. Puzzle generation, tutorial loading and update activation use a centred modal spinner without buttons; it closes when the operation finishes. Reduced motion keeps the waiting indicator still. Full licence texts, legal notice and privacy information are embedded from their original files into expandable sections, including offline, without leaving the dialog. Long dialog contents remain scrollable with the close button always visible. Help & info shows a readable release number, date and release notes in German or English. The separate build identifier combines that number with a content fingerprint, so offline updates also distinguish builds of the same release.

The game surface suppresses accidental selection, context menus, image/link dragging and mobile long-press menus. Native touch rules avoid double-tap zoom on game buttons while preserving pinch zoom, form controls, keyboard access and copyable info text. Dialogs scroll vertically only. During active, visible play the native Screen Wake Lock API requests an awake screen; menus, completed rounds, read-only tabs and backgrounding release it. Returning to active play reacquires it; unsupported or denied requests never block play. Browser and system power policies can override the request.

Mobile play supports portrait and landscape, including the installed app. Rotating the device preserves the current game and editor state.

The fish button in the header hides Sudoku for an unobstructed aquarium view. Tap the fish button again to return to the same puzzle. Watching the reef pauses the puzzle timer while music and fish continue, respecting reduced motion. The screen remains awake where supported.

In aquarium view, the header button to the left of the fish opens Arrange my reef. The editor is no longer listed in Settings. On the first visit, a highlighted tutorial button and an explicit welcome prompt invite the player to learn the controls; its slow pulse respects reduced motion. The tutorial demonstrates Sudoku cell and number-button colours, then opens the real reef editor and walks through selection, touch, every transform, colour, fish behaviour, the catalogue, object list, undo, reset, dismissible hints, save and discard. It uses an unsaved example reef and restores the previous reef on completion or skipping. Hovering highlights the object a click would select with a golden fill over its entire surface as well as a glow. The same fill marks a touch target and remains on the locked selection, without changing its saved palette colour; clearing the selection restores its appearance. The fill pauses while the colour slider or palette is open so that actual colour changes remain visible. The editor hint and help explain holding a finger on the reef and sliding across objects before releasing to edit. The hint panel has a close button that hides tips until the next editor visit, while warnings remain visible. With touch, the initial gesture only highlights the object under the finger; dragging updates that target without transforming anything. Releasing over an object opens its editing controls, while releasing over empty water or cancelling leaves it unselected. Later gestures transform the locked selection. A ring surrounds the selected object, which stays selected until the green checkmark in the ring menu releases it. Drag anywhere on the free canvas with mouse or touch to transform it: Move along the ground, Height up or down, Rotate around X, Y or Z by dragging sideways, or Scale up to enlarge and down to shrink. Moving routes, body orientation and school formations rotate together on all three axes; rotating a moving object compensates its position within the editable bounds. Controls retain their normal actions; arrow keys also transform the selection. Duplicate, Remove and object settings remain in the ring. The palette, speedometer and dashed-circle buttons expand directly into colour, swimming-speed and swimming-radius sliders. The fish button expands into a compact native selector for swimming behaviour. Only one opens at a time, stays still while being adjusted and fits portrait or landscape screens. Native touch and keyboard input work; Escape or tapping the icon again collapses it. Speed and radius appear for fish and crabs. For crabs they control walking speed and movement radius, including leg animation; existing default movement is preserved. All object settings are now in the ring, without a separate settings panel or dimming or blurring the reef. The far-left colour setting restores its original colours. Texture detail is retained, and palette choices are saved and undoable. Fish offer swimming routes and schooling; crabs offer their existing natural walk, circles, back and forth, figure of eight and staying in place. Crab paths stay at their configured height, and staying in place also stops the leg animation. Adding or choosing another object is disabled while a selection is locked. While an object is selected, the upper editor bar is hidden and Undo moves into the ring. The green checkmark releases the selection and restores the header with Undo, My objects, Default reef, Discard and Save. Icons have tooltips and accessible names. Undo reverses an entire drag, slider gesture, addition, removal, batch deletion or reset, retaining up to 50 actions during the current editor visit. Saved reefs from before X/Z rotation load with both new angles set to zero. My objects offers thumbnail checkboxes, Select all, Edit for one checked object and Delete selected for batch deletion. All placed models, including distant reef pillars and their corals, are editable and removable. Emptying the list leaves water and sand. The default reef includes green plants and purple anemones in the foreground. Save stores the validated arrangement separately as `marenssudoku:reef:v1`, with at most 200 objects; Discard restores the previous arrangement, including after bulk deletion. Reset affects the draft until saved. Sudoku values and points remain independent, and its timer pauses while editing. Unsupported 3D disables the editor while preserving Sudoku play.

Semantic HTML and CSS render the entire board, including grid lines, glass-like backgrounds, highlights, sharp numbers and notes. Babylon.js 9.32.1 renders a real 3D aquarium behind the interface: a sandy corridor between layered reef ledges, five separate coral types, seagrass, algae, gently swaying anemones and a small walking crab. Six fish species include two coherent schools, with 24 fish on mobile and 36 on desktop. Sun shafts, surface ripples and moving caustic patterns light the sand. The composition follows the original reef illustration's colours, dense edges and open centre.

Rendering runs at up to 60 frames per second, pauses in background tabs, and becomes still with reduced motion. Fish, corals, plants and rocks cast translucent grey silhouettes onto the sand, projected along the sunlight direction from copies sharing the original model geometry and deformation. These ground shadows follow movement and editor changes; overlapping faces do not compound their opacity. Mobile devices render at native screen resolution, including high-density displays. Software rendering uses a lighter reef at 30 frames per second and reduces resolution on desktop. Resizing redraws immediately. If 3D cannot load, a plain water colour remains behind the game.

All engine code and 30 uncompressed GLB models are served locally and included in the offline cache. Embedded textures are limited to 1024 pixels. Meshy is used only during development, never contacted by players. Effects use native browser animation and Web Audio, with HTML audio as a fallback. The pure JavaScript Sudoku engine runs in a Web Worker. Difficulty uses solving techniques rather than clue counts alone. Native offline caching verifies complete asset hashes before accepting an update.

The editor adds 13 reef residents and props, loaded on demand with thumbnail previews. Each achievement is named for its reward. Seahorse discovery unlocks the seahorse after one solved round; Gliding with the manta unlocks the manta ray after ten. Six new achievements join the seven published ones, whose stored IDs and conditions remain valid. Existing achievement counters count toward the new badges when the next round is completed. Previously placed rewards remain editable if achievement saving is later turned off. Eight Smart Rig models retain their skin weights and use portable `idle` and `move` skeletal clips, cloned independently per animal. Speed controls the cycle, resting stops walking, and reduced motion, editing and backgrounding freeze the aquarium. The treasure has a subtle sparkle. Other models retain gentle vertex deformation where appropriate.

| Erfolg | Bedingung | Riffobjekt |
| --- | --- | --- |
| Seepferdchen entdeckt | 1 Runde | Seepferdchen |
| Mit dem Manta gleiten | 10 Runden | Mantarochen |
| Sternstunde | 5 Runden | Seestern |
| Riffpflegerin | 3 leichte Runden | Putzergarnele |
| Geduld wie eine Schnecke | 10 leichte Runden | Bunte Meeresschnecke |
| Ein Knall im Riff | 3 Runden ohne Rückgängig | Pistolenkrebs |
| Farben der Nacktschnecke | Jede Schwierigkeit einmal | Nacktschnecke |
| Auf den Spuren der Languste | 5 mittlere Runden | Languste |
| Tanz der Quallen | 15 Runden | Ohrenqualle |
| Acht Arme, klarer Kopf | 1 Runde ohne Rückgängig | Krake |
| Freundin der Schildkröten | 5 schwere Runden | Meeresschildkröte |
| Wracktaucherin | 50 Runden | Schiffswrack |
| Schatzjägerin | 100 Runden | Piratenschatz |

To author the bundled clips again from the original Smart Rig GLBs, keep the source files in a separate local directory and run `node scripts/animate-reef.mjs INPUT_DIRECTORY OUTPUT_DIRECTORY`. The script preserves embedded geometry, textures and skin weights and refuses to replace existing animations. Source downloads and review output remain private local files.

## Licence

Original code and documentation: MIT. See LICENSE and THIRD_PARTY_NOTICES.md.

The first release was published on 28 October 2026. Operator and privacy information are included in the app. Real-device testing remains outstanding.

## Releases

Public releases use consecutive numbers: v1, v2, v3, v4. Update `web/release.mjs` for every publication: increase the version, set the release date and describe the changes in German and English. This file is the single source for the app, build and GitHub release notes. The private Node package version is independent of the public release number.

The build keeps a separate content fingerprint for safe offline updates. After all checks and Pages deployment succeed, GitHub Actions creates the matching version tag and GitHub release. Re-running the same commit reuses its release; a version tagged to another commit is rejected before deployment. Pushes still require a current locally tested preview and explicit approval.
