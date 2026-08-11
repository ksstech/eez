# mho98 v1.0.10 vs. EEZ Studio's official scope "templates"

Measured 2026-08-11 from the actual published zips: official **Rigol
MSO1104Z-S** v1.0.3 (top of the 9-model DS/MSO1000Z family) and official
**Keysight MSOX2024A** v1.0.1 (top of the 12-model InfiniiVision 2000 X
family) — the only two scope families in the official catalog — against
our `eez-rigol-mho98` v1.0.10.

## What an official "template" extension consists of

Connection metadata (`package.json`), the SDL command reference (terminal
autocomplete + inline help pane), a `docs/` HTML manual (SDL HelpLinks
point into it), and shortcuts. Official investment is overwhelmingly in
the reference material; shortcuts are minimal.

## Measured comparison

| Component | Official Rigol MSO1104Z-S | Official Keysight MSOX2024A | Ours, mho98 v1.0.10 |
|---|---|---|---|
| SDL size | 1.0 MB | 1.3 MB | **11 KB** |
| SDL command definitions | 383 `SubsystemCommand` | 429 `SubsystemCommand` | **144 nodes (69 cmd + 75 query), 27 subsystems** |
| Per-command help text | 393 `Synopsis` | 443 `Synopsis` | **none** |
| Help links → local manual | 692 | 763 | **none** |
| `docs/` folder | 4.6 MB per-subsystem HTML | 6.7 MB — complete 2000-series programming guide + their SDL source (`docs/2000.sdl`) | **none** |
| Shortcuts | 5 | 4 | **28** (12 JavaScript incl. 6 config dialogs) |
| Instrument control surface | none — no AWG control despite -S models, no LA control despite MSO models | none — no digital-channel control despite MSOX models | Vertical/Trigger/Horizontal/Measure dialogs, 2-ch AWG dialog, Live Meas toast, Diag, toggles; LA planned |
| Waveform capture | chunked RAW BYTE (lossless on an 8-bit scope) | broken — see below | chunked RAW **WORD 12-bit, hardware-verified byte order**, truncation choice dialog, received-vs-expected diagnostics |
| Connection | Ethernet only | Ethernet only | Ethernet **+ USB-TMC (VID/PID)** |
| Multi-model handling | 9 static zips from one `.eez-project` | 12 static zips | runtime `*IDN?` detect + 12-model spec table in one package |
| Operational robustness | none | none | guarded Auto (detects `:SYSTem:AUToscale` lockout), single-toast progress, actionable errors |

## Verified finding: the official Keysight flagship script is a Rigol copy-paste

The MSOX2024A "Waveform data" script is **93.2% character-identical to
the Rigol DS1000Z script** — every difference is whitespace or a
try/finally wrapper; the Rigol preamble comment is intact. It sends
`:ACQuire:MDEPth auto` and `:WAVeform:MODE raw`, commands **absent from
Keysight's own bundled programming guide** (zero `MDEPth` hits in the
6.7 MB manual; Keysight's documented mechanism is
`WAVeform:POINts:MODE`). As written, the official Keysight extension's
only substantial script cannot work on the instrument it ships for.

Related, honestly framed: the official Rigol script takes its point
count from the preamble and leaves `STARt/STOP` persisted — the same
pattern that on real MHO98 hardware produced the stale-window fault
fixed in our Capture v2.2. Unverified whether DS1000Z hardware misbehaves
the same way, but the official template carries the latent pattern.

## Bottom line

- **Officials far ahead: reference depth.** Synopsis for every command
  in the terminal help pane + click-through to a full local manual; ours
  currently autocompletes 144 paths with an empty help pane. Biggest
  gap; the SDL-expansion plan item targets exactly this (input index
  committed in `eez-rigol-mho98/reference/`; both official SDLs provide
  the richer schema to generate into).
- **Ours far ahead: everything the user touches.** The officials ship no
  instrument control beyond run/stop/screenshot — including no AWG/LA
  support on models that have the hardware — and their one substantial
  script is 8-bit-only (fine there) or non-functional (Keysight). Ours:
  six config dialogs, live monitoring, hardware-verified 12-bit capture,
  USB-TMC, runtime model awareness, self-explaining failures.
- **Net**: v1.0.10 exceeds every official scope template in functional
  breadth/depth; it trails all of them in documentation depth. SDL
  expansion closes that; LA support then leads on every axis (no
  official extension has LA either).
