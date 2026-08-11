# EEZ Studio — version notes & upstream issue tracking

What version of EEZ Studio this instrument family is baselined against, which
upstream quirks still need workarounds, and the status of issues filed
against `eez-open/studio` as a result of building these extensions. Update
this doc whenever a new Studio version ships — check the delta against the
"Known quirks" list below before touching any workaround code.

## Current baseline

**0.29.0** (released 2026-08-02). Previously 0.28.0.

## Changes relevant to this family, 0.28.0 → 0.29.0

0.29.0 shipped 5 fixes total; 4 are LVGL/dashboard-flow or Studio's own
build-tooling fixes (Electron/lz4/better-sqlite3) — not applicable, this
family has no LVGL/dashboard usage and consumes Studio as a packaged app,
not built from source. One is relevant:

- **[eez-open/studio#1024](https://github.com/eez-open/studio/issues/1024) —
  "Timeout for the timeout popup"** (closed, shipped 0.29.0). SCPI query
  timeout notifications now name which query timed out and auto-close after
  10s, instead of sitting there until manually dismissed. No code changes
  needed on our side — upgrading Studio alone reduces UI friction any time a
  query times out. Matters most for
  [eez-ea-ps2k](../eez-ea-ps2k), which has a documented history of serial
  reliability issues that can trigger timeouts (see
  [bridge-reliability-patterns.md](bridge-reliability-patterns.md)) — those
  now self-clear instead of piling up un-dismissable popups.

## Known quirks / active workarounds (still required as of 0.29.0)

- **`\n` doesn't render as a line break in toast notifications** —
  [eez-open/studio#1022](https://github.com/eez-open/studio/issues/1022),
  open. Workaround: CSS injection, see
  [eez-live-toast-pattern.md](eez-live-toast-pattern.md). Keep the
  workaround until this ships.
- **Toast obscures the Stop button; dialogs are single-column only; toast
  data isn't structured/tabular** —
  [eez-open/studio#1013](https://github.com/eez-open/studio/issues/1013),
  open, milestone 0.30.0. Filed against this repo's own experience building
  the Rigol MHO98 / Keysight 34465A / EA-PS2342-06B extensions. If/when it
  ships: the "close toast to reveal Stop button" instruction in shortcut
  scripts becomes unnecessary, and manual `line1 + "\n" + line2` toast
  formatting can be replaced with structured rows.
- **`console.log()` produces no output in the script sandbox** — searched
  eez-open/studio's issue tracker (title/body search for `console.log`,
  `scripting sandbox`) and found no matching filed issue as of 2026-08-11.
  Not yet reported upstream. Workaround remains `notify.info()` for
  debugging during development.
- **`WaveformFormat.RIGOL_WORD` chart rendering is broken** —
  [eez-open/studio#1037](https://github.com/eez-open/studio/issues/1037),
  open, filed 2026-08-11. The value accessor in
  `eez-studio-ui/chart/value-accesor.ts` computes length as bytes/2 but
  reads single bytes (`values[index]`) instead of assembling 16-bit
  words — any WORD-format waveform renders garbage. Matters because the
  12-bit Rigol DHO/MHO scopes only deliver full resolution via
  `:WAVeform:FORMat WORD`. Workaround (in eez-rigol-mho98's Capture v2):
  convert WORD data to volts in-script and chart as `FLOATS_32BIT`
  (format 1); switch back to `RIGOL_WORD` (format 3) when fixed
  upstream to halve chart memory.
- **Shortcuts panel crashes for any shortcut with no keybinding** —
  [eez-open/studio#1036](https://github.com/eez-open/studio/issues/1036),
  open, filed 2026-08-11. `Keybinding.render()` in `shortcuts.tsx` calls
  `this.props.keybinding.split("+")` with no null-check; any shortcut
  without a keybinding (completely normal — most toolbar-only shortcuts
  have none) blanks the whole panel with `TypeError: Cannot read
  properties of null (reading 'split')`. Not fixable on the extension
  side — a shortcut needing no keybinding isn't a defect to work around.
- **Stop button isn't where the toast implies** — running a toolbar
  shortcut does not switch you to the Scripts tab (verified in
  `script.ts`: `doExecuteShortcut()` only calls `navigateToScripts()` on a
  script *error*, never on the normal running path), and the Stop button
  only renders in the Scripts tab's own toolbar (`toolbarButtonsRender()`
  in `instrument/window/scripts.tsx`, wired per-nav-item in
  `navigation-store.tsx`). If you weren't already on the Scripts tab when
  you launched a live-toast shortcut, closing the toast reveals nothing —
  you have to manually click **Scripts** in the left nav first, then Stop
  appears in its toolbar. Not a bug, just non-obvious; documented in
  [eez-live-toast-pattern.md](eez-live-toast-pattern.md) too.

## Updating this doc

When a new Studio version ships: check its
[release notes](https://github.com/eez-open/studio/releases) for the delta,
filter out LVGL/dashboard and Studio-build-tooling items (not applicable
here), and check whether #1022 / #1013 (or whatever they've become) have
shipped — if so, remove the corresponding workaround from the affected
extension(s) and this doc.
