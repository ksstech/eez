# Rigol MHO98 / DHO924S — comparison with existing EEZ Studio scope support, and improvement plan

Written 2026-08-11 against EEZ Studio 0.29.0 and its official extensions
catalog (172 entries, `catalog.json` cached by the app). Every claim below
was verified against a primary source: the official catalog, the
`eez-open/studio-extensions` source repo, the actual published extension
zips, our two repos' own files, or vendor spec pages (linked).

## 1. The existing oscilloscope landscape in EEZ Studio

The official catalog contains exactly four scope families — nothing newer
than 2018-era hardware, all 8-bit:

| Family | Models | BW | Ch | Sample rate | Memory | LA | AWG |
|---|---|---|---|---|---|---|---|
| Rigol DS1000E/D | DS1052E/1102E, DS1052D/1102D | 50–100 MHz | 2 | — | — | D: 16 ch | — |
| Rigol DS1000B | DS1074B/1104B/1204B | 70–200 MHz | 4 | — | — | — | — |
| Rigol DS1000Z(-S) / MSO1000Z(-S) | 9 models, DS1054Z → MSO1104Z-S | 50–100 MHz | 4 | 1 GSa/s | 12 Mpts | MSO: 16 ch std | -S: 2×25 MHz |
| Keysight InfiniiVision 2000 X | 12 models, DSOX/MSOX 2002A–2024A | 70–200 MHz | 2/4 | — | 100 kpts | MSOX: 8 ch | — |

(Siglent entries are PSUs and spectrum analyzers; tinySA is a spectrum
analyzer. No other scopes exist in the catalog.)

**The top-end already-supported scope is the Rigol MSO1104Z-S**: 100 MHz,
8-bit, 1 GSa/s, 12 Mpts, 16-ch LA, 2×25 MHz AWG.

### How the official family support is built — the key precedent

The entire 9-model DS/MSO1000Z family is generated from **one shared
source file**:
`org/rigol/rigol_ds_mso_1000/rigol_ds_mso_1000.eez-project` (608 KB) in
[eez-open/studio-extensions](https://github.com/eez-open/studio-extensions).
Verified contents:

- **One shared SCPI command tree**: 21 subsystems, 692 commands — with
  variant-conditional subsystems annotated in their names
  (":LA Commands (Only for MSO1000Z/MSO1000Z-S)", ":SOURce Commands
  (Only for MSO1000Z-S/DS1000Z-S)").
- **One shared shortcut set** (5 shortcuts: Waveform data, Screenshot,
  Run, Stop, Test).
- **9 `extensionDefinitions`** — one per model, each carrying only its own
  name, description, and IDN-match string. Building the project in EEZ
  Studio's project editor emits one IEXT zip per definition.

So "a generic support module with per-model specifics" is not just
feasible — it is exactly how Envox themselves maintain multi-model scope
families, using EEZ Studio's own native tooling.

### What an official scope extension zip contains (MSO1104Z-S v1.0.3, examined)

| Component | Official | Our mho98 | Our dho924s |
|---|---|---|---|
| `.sdl` (terminal autocomplete + inline help) | **1.05 MB, 692 commands** | 11.6 KB, 151 entries | 9.9 KB, 137 entries |
| `docs/` (per-subsystem HTML command manual) | **4.6 MB, 21 pages** | none | none |
| Shortcuts | 5 (basic, but see below) | **28** (rich dialogs: Vertical/Trigger/Horizontal/Measure/AWG, Live Meas, Capture, Diag, toggles) | 7 (plain toolbar only) |
| Waveform download | chunked RAW deep-memory, up to 12 Mpts, preamble-scaled | chunked RAW deep-memory (250k chunks) — **but BYTE format: 8-bit transfers on a 12-bit scope** | none |
| AWG control | none (despite -S models) | AWG dialog | **none (despite the S model having an AWG)** |
| LA control | none (despite MSO models) | none | none |
| `image.png` | yes | yes | **missing** |

The two ecosystems have inverse strengths: official = reference-depth
(SDL/docs/deep-memory capture), ours = interaction-depth (dialogs, live
readout, diagnostics). Neither side has LA support anywhere. The target
is the union.

## 2. Our two instruments — verified real specifications

Verified via vendor pages (linked), **not** our READMEs — which turned out
to contain errors (see 2.1):

| Spec | MHO98 (MHO900 series) | DHO924S (DHO900 series) | Top existing (MSO1104Z-S) |
|---|---|---|---|
| Bandwidth | 1 GHz | **250 MHz** | 100 MHz |
| Channels | 4 | 4 | 4 |
| Resolution | **12-bit** | 12-bit | 8-bit |
| Sample rate | 4 GSa/s | **1.25 GSa/s** | 1 GSa/s |
| Memory | **500 Mpts** | **50 Mpts** | 12 Mpts |
| Logic analyzer | **16 ch, standard** | 16 ch, optional (PLA2216 probe) | 16 ch std |
| AWG | **2 ch × 100 MHz** | 1 ch × 25 MHz | 2 ch × 25 MHz |
| Capture rate | 30k wfms/s (1M fast mode) | up to 1M wfms/s (UltraAcquire) | — |
| Display | 1024×600 touch | 1024×600 touch | 800×480 |

Sources: [Rigol MHO900 product page](https://www.rigol.com/intl/products/oscilloscope/MHO900.html),
[MHO900 datasheet](https://www.rigol.com/dam/global/downloads/brochures/en/data-sheet/oscilloscopes/MHO900-DataSheet.pdf),
[Batronix MHO98](https://www.batronix.com/shop/oscilloscopes/Rigol-MHO98.html),
[Meilhaus MHO900](https://www.meilhaus.de/en/rigol-mho900.htm),
[TestEquity DHO924S](https://www.testequity.com/product/20002528-DHO924S),
[Rigol-UK DHO924S](https://www.rigol-uk.co.uk/product/rigol-dho924s-4ch-12bit-250mhz-1-25gsa-s-digital-oscilloscope-25mhz-arb-gen/),
[Batronix DHO924S](https://www.batronix.com/shop/oscilloscopes/Rigol-DHO924S.html).

Both instruments exceed every scope currently in the EEZ catalog on every
axis. Whatever we build here becomes the highest-spec scope support in
the ecosystem.

### 2.1 Spec errors in our current READMEs (fix regardless of the rest)

`eez-rigol-dho924s/README.md` states: 200 MHz (real: **250**), 2 GSa/s
(real: **1.25**), "up to 200 Mpts" (real: **50**), "DHO914S (100 MHz
12-bit), DHO924 (200 MHz 8-bit), DHO914 (100 MHz 8-bit)" (real: DHO914(S)
= **125 MHz**, DHO924 = **250 MHz**, and **all** DHO900 models are
12-bit — there are no 8-bit variants). It also never mentions the 1×25 MHz
AWG (on a model whose "S" suffix means exactly that) or the optional LA.

`eez-rigol-mho98/README.md` omits: 12-bit resolution, 500 Mpts memory,
and the standard 16-ch logic analyzer.

## 3. Are the two models one SCPI family? (the generic-module question)

Measured directly from our two extensions' `.sdl` files (both built
against the real instruments): **123 entries shared** out of 151 (mho98)
/ 137 (dho924s). The differences are almost entirely:

- mho98-only: the `:SOURce`/AWG subsystem (AMPLitude, FUNCtion, GAUSs,
  NOISe, PULSe, PHASe, OUTPut, …) — present because mho98 has AWG
  shortcuts and dho924s's extension simply never implemented AWG.
- dho924s-only: a few `:LAN`/measurement items (ADDR, DHCP, MAC, VBASe,
  VTOP, PREShoot…) — again coverage gaps, not hardware differences.

Corroborating: Rigol ships **one programming guide for DHO800+DHO900**
([DHO800/900 Programming Guide](https://download.rigol.com/en/Manual/Digital%20Oscilloscope/DHO900/DHO800900_ProgrammingGuide_EN.pdf)),
and the MHO900 series is the same platform generation (launched end-2025,
UI/firmware derived from DHO900 per contemporary coverage).

**Honest caveat**: MHO900's command set being identical to DHO800/900 is
strongly indicated (123-command measured overlap, same platform) but not
yet vendor-document-confirmed. Phase 1 below includes downloading the
MHO900 programming guide and diffing it against the DHO800/900 guide
before the merge is finalized. If MHO900 turns out to have meaningful
deltas, they become conditional subsystems — exactly like ":LA Commands
(Only for MSO1000Z)" in the official family project — not a blocker.

## 4. Plan

### Phase 0 — Correct the record (immediate, independent of the rest)
1. Fix all `eez-rigol-dho924s` README spec errors (§2.1).
2. Complete `eez-rigol-mho98` README specs (12-bit, 500 Mpts, 16-ch LA,
   2×100 MHz AWG).

### Phase 1 — Build the shared family source ("generic module")
3. Obtain the MHO900 programming guide; diff against DHO800/900 guide.
   Outcome: one confirmed command superset + per-model conditional list.
4. Create one family repo (working name `eez-rigol-dho-mho`) with a
   **models table** as the single source of variance:
   `model | idn-match | bandwidth | channels | sample-rate | memory |
   LA (std/optional/none) | AWG (2×100M / 1×25M / none) | usb-pid`.
   Two build options, decide at kickoff:
   - **(a) EEZ-native**: one `.eez-project` with one `extensionDefinition`
     per model — identical mechanism to Envox's own
     `rigol_ds_mso_1000.eez-project`; edited in Studio's IEXT project
     editor, which also gives a proper SDL/help editing UI.
   - **(b) Script-generated**: extend our existing `build-extension-zip.py`
     to emit one zip per row of the models table from shared
     `.sdl`/`.idf`/shortcut templates — keeps the plain-git,
     CI-friendly workflow we already run; no Studio dependency.
   Recommendation: **(a)** — it is the ecosystem-standard format, makes a
   future upstream contribution to `eez-open/studio-extensions` trivial
   (the official Rigol family lives there in exactly this form), and the
   project editor is the only sane way to maintain a 600+ command SDL.
   Option (b) remains the fallback if the project editor proves
   impractical.
5. Initial model coverage: MHO98, DHO924S, DHO924, DHO914S, DHO914
   (all specs already verified above). The table design must trivially
   extend to the rest of MHO900 (MHO914/924/954/984) and the DHO800
   series (same programming guide) — but don't ship models we can't
   test against real hardware or a manual-verified IDN; list them as
   "prepared, unverified" rows instead.

### Phase 2 — Close the functional gaps (the union of both ecosystems' strengths)
6. **SDL expansion**: from ~150 entries to full programming-guide
   coverage (official family ships 692). This is what powers terminal
   autocomplete and inline help — the single biggest UX gap vs official
   extensions.
7. **docs/ folder**: per-subsystem HTML command reference (official
   family ships 4.6 MB of it; source material is Rigol's own guide).
8. **Waveform capture, 12-bit correct**: keep mho98's chunked RAW
   deep-memory approach but switch `WAVeform:FORMat` from BYTE to
   **WORD** — BYTE transfers throw away 4 of the 12 bits on these
   scopes. Port to all family models (dho924s currently has no capture
   at all). Handle the memory-depth difference (500 Mpts vs 50 Mpts) via
   the models table.
9. **LA support** (new for the whole EEZ ecosystem — no existing
   extension has it): `:LA` subsystem commands + shortcuts (enable/
   configure/capture digital channels). Standard on MHO98; behind an
   "optional probe" note for DHO9x4(S).
10. **AWG parity**: parameterized AWG dialogs from the models table
    (2×100 MHz vs 1×25 MHz vs absent). dho924s gains AWG control for the
    first time.
11. `image.png` for DHO models (dho924s currently ships none).

### Phase 3 — Fold in the session's quality learnings
12. Shared toast/`qts()`/SI-formatting patterns (from
    [eez-live-toast-pattern.md](eez-live-toast-pattern.md) /
    [qts-helper.md](qts-helper.md)) applied once in the shared source so
    every model inherits them — including the Stop-button guidance
    (Scripts tab caveat) and single-toast progress reporting.
13. Release flow: one repo, one tag, N zip assets on one GitHub Release
    (build script already guarantees zip-root correctness).
14. Retire `eez-rigol-mho98` and `eez-rigol-dho924s` as standalone repos
    once the family repo ships: archive with pointer READMEs (same
    pattern as the zip→Releases migration), avoiding a split-brain of
    two sources for the same instruments.

### Explicitly out of scope for now
- Upstreaming to `eez-open/studio-extensions` — worth pursuing *after*
  the family repo is proven on real hardware; choosing build option (a)
  keeps that door open at near-zero cost.
- DHO1000/DHO4000 (different programming guide) and non-Rigol scopes.

## 5. Decisions (made 2026-08-11)

1. Build mechanism: **(a) `.eez-project`, EEZ-native** — same mechanism as
   Envox's own `rigol_ds_mso_1000.eez-project`.
2. Family repo name: **`eez-rigol-dho900`** (named for the shared DHO900
   platform; MHO900 models included as platform siblings).
3. Untested sibling models: **not shipped until verified on real hardware
   or against a manual-verified IDN** — only MHO98 and DHO924S get
   released zips initially; sibling rows sit prepared in the models
   table but unbuilt.
