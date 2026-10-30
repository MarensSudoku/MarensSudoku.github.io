# Project instructions

- Keep Caveman Ultra and Ponytail Ultra active unless the user changes them.
- Use Babylon.js for the 3D aquarium; keep the Sudoku grid in HTML/CSS. Theme: bright coral reef, white sand, crystal-clear water, colourful tropical fish and original artwork.
- Before EVERY push, show a current locally tested preview and wait for explicit user approval of that revision. Changes after approval require a new preview. Never infer push approval from an implementation request.
- Use consecutive public release numbers in `web/release.mjs` (v1, v2, ...). For each new release, update its number, date and German/English notes before the approval preview; retries of the same release keep its number.
- Do not name inspiration products or games in finished source, comments, assets, public documentation or commit messages. Preserve legally required notices for dependencies actually used.
- Keep Sudoku rules, generation and saved game state independent of rendering. Preserve givens, uniqueness, keyboard/screenreader access and optional local achievement storage.
- Keep generated output, node_modules, local test output and private operator information out of commits. Do not invent operator/contact details.
