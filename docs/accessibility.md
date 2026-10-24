# Accessibility, sound and language

Open **Settings** from the top bar (or the title screen, or press **O**). Everything applies immediately and is remembered in this browser. The settings dialog has four tabs: Controls, Sound, Accessibility and Language.

This system is adapted from the settings, synthesized-sound and language-switching approach in the **EcoQuest** project (`client/src/hooks/use-settings.ts`, `SettingsDialog.tsx`, `utils/audio.ts`, `i18n/`). EcoQuest is a React/TypeScript side-scroller; Kangs is a vanilla JavaScript management simulation, so each feature was re-implemented for how this game is actually played rather than copied. The table shows what each EcoQuest feature became.

## What came from EcoQuest

| EcoQuest | Here | Notes |
| --- | --- | --- |
| 14 synthesized Web Audio effects, no audio files | 14 basketball effects in `src/audio.js` (made basket, three, miss, block, steal, whistle, timeout, confirm, select, error, signing, victory, defeat, interface click) | Same engine design: oscillators and filtered noise, context created on first use. **Sound starts off**, as this game always did |
| Master volume, mute, per-sound toggles, test button, reset | Same, in the Sound tab | Test plays even while muted so volume can be set first. Every sound has its own toggle (EcoQuest exposed nine of fourteen) |
| Color-blind mode (deuteranopia / protanopia / tritanopia) | Same three modes, `src/a11y.js` | See "Colour-vision correction" below: these are *correction* filters, not simulation |
| High contrast | Black background, white borders and text, heavy focus rings | Also honours the OS "increase contrast" preference on first visit |
| Reduced motion | Static action poses in the arena, no interface animation | Joins the existing Motion button. Also honours the OS "reduce motion" preference on first visit |
| Screen shake toggle | Short camera shake on dunks and blocks (`Arena.shake`) | This game had no shake, so a small impact effect was added to give the setting something to control |
| Reduce screen flashes | Turns off blinking/pulsing animation and hover brightness changes | |
| Text size 70–180 % | Same range, scales every font size | Every font size in `style.css` is multiplied by `--ts` |
| Font presets (retro / modern / dyslexic) | Default / Modern / Readable | Uses system fonts so the offline build needs no extra files. Readable adds wider letter and word spacing |
| Game speed (50 / 75 / 100 %) | **Playback speed**, same three values | A slower replay of each play. It never changes results |
| Jump timing assist | **Timing assist** | Kangs has no jump timing. The equivalent is time to read: a 2.5 s pause between plays in Watch live, and messages stay on screen 12 s instead of 4 s |
| Simplified HUD | **Simplified interface** | Hides decorative labels, badges, tickets and extra notes |
| Screen-reader announcements (`use-screen-reader.ts`) | `announce()` / `interrupt()` in `src/a11y.js` | EcoQuest defined these but never called them. Here every resolved play and score, page changes, camera and speed changes and sound/motion changes are announced |
| Skip link, ARIA tabs, switches, focus styles | Same, plus focus moved to the page heading on navigation | |
| Rebindable keys with conflict detection | Twelve coaching shortcuts in `src/keys.js` | The jump/sprint keys do not exist here; shortcuts are Watch live/pause, Next play, Timeout, five cameras (wide, courtside, follow, player view, auto), speed, sound, settings and the handbook; Space also plays the next possession |
| Seven languages via i18next | Same seven (English, Spanish, Chinese, French, Japanese, Italian, Hindi) via `src/i18n/` | No library; see "Language" below |
| Motor-helper warning that blocks leaderboard scores | Not used | Kangs has no leaderboard, so there is nothing to protect and no warning to show |

## How it works

**Settings** (`src/settings.js`) validates every saved value on load, so a hand-edited or corrupt entry falls back to its default. Changes are written to `localStorage` and applied to `<html>` as classes (`a11y-high-contrast`, `a11y-reduced-motion`, `a11y-no-flash`, `a11y-simple`, `a11y-font-*`) and the `--ts` custom property. `src/a11y.css` does the visual work. A `kangs-settings-changed` event tells other modules (the arena, the top bar) to update without rebuilding the page, so dragging a slider never interrupts itself.

**Sound** (`src/audio.js`). `play(key)` returns immediately when sound is muted or that sound is switched off. The Web Audio context is only created the first time a sound is actually played, which keeps within browser autoplay rules.

**Colour-vision correction.** EcoQuest's matrices are the Machado et al. (2009) *simulation* matrices, which show how a colour-blind person sees an image. Applied to a player's own screen they make colours *harder* to tell apart. Here the same published simulation data is used to build a *daltonization* correction instead: the colour information a viewer cannot see is shifted into channels they can (`correctionMatrix()` in `src/a11y.js`). Neutral greys are left exactly unchanged. A test checks this and that confusable colour pairs end up further apart.

**Keyboard shortcuts** act by clicking the visible button, so a disabled control stays disabled and there is one code path. They are ignored while typing in a field or while a dialog is open. Space, Enter, Tab, Escape, Backspace and modifier keys are reserved. Changes in the dialog take effect immediately, and pressing Escape while choosing a key cancels the choice without closing the dialog.

**Language** (`src/i18n/index.js`). The saved language is used first, then the browser's preferred languages, then English. Any missing string falls back to English, then to the key. English ships in the main bundle; the other six load on demand, and the build precaches them for offline use. `<html lang>` and the page title follow the language. Strings are written in normal case and capitalised by language rules where the design uses capitals, so screen readers do not spell them out.

Text the simulation writes (play-by-play, decision trail, result summary) is also translated. The engine keeps writing the same English text it always did, plus a small record: which template was chosen, or which kind of event and its values. The interface rebuilds the sentence from that record. Saves from before this change still load and show their stored text. The English templates live in `src/basketball.js` (`COMMENTARY`) and `src/engine.js`, and a test confirms that, in English, the rebuilt text equals the stored text across whole simulated seasons.

## Storage keys

| Key | Holds |
| --- | --- |
| `kangs_sound` | volume, muted, per-sound switches |
| `kangs_accessibility` | all accessibility options |
| `kangs_keybindings` | shortcut keys |
| `kangs-language` | interface language |

## Extending

- **A language:** copy `src/i18n/locales/en.js`, translate the values, add the code to `LANGUAGES` and `LOADERS` in `src/i18n/index.js`. `tests/i18n.test.js` fails until the keys and `{{placeholders}}` match English exactly.
- **A sound:** add the key to `SOUND_KEYS` and a synthesizer to `SOUNDS` in `src/audio.js`, add `settings.sound.items.<key>` to every locale, and call `play('<key>')`.
- **An accessibility option:** add it to `A11Y_DEFAULTS` and `normalizeA11y` in `src/settings.js`, apply it in `applyA11y`, add a row in `src/settingsDialog.js`, and add strings to every locale.
- **A shortcut:** add the action to `ACTIONS` and `DEFAULT_KEYS` in `src/keys.js`, handle it in the keydown handler in `src/main.js`, and add `settings.controls.actions.<action>` to every locale.

## Known limits

- This has been checked with automated tests and in a browser, **not with a screen reader**, and has not had a formal WCAG audit. It follows WCAG 2.1 practices where it can; the 3D scene itself is visual, which is why every play is also written out.
- The translations were written for this project and have **not been reviewed by native speakers**. Please have someone check them before relying on them in front of judges.
- Names from the published roster and schedule (players, opponents, venues) are not translated.
- The Readable font uses whichever of Atkinson Hyperlegible, Verdana, Tahoma or DejaVu Sans is installed; it is not a bundled file.
- Orbiting the 3D gym is mouse/touch only. The camera preset buttons and shortcuts are the keyboard route.
