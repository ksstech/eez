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
| Memory | **500 Mpts** | **50 Mpts** (series max) | 12 Mpts |
| Logic analyzer | **16 ch, standard** | 16 ch, standard (via PLA2216 probe; DHO800 series has no LA) | 16 ch std |
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

## 4. The complete DHO800 / DHO900 / MHO900 model matrix (vendor-verified)

The single source of per-model variance for everything below. Verified
against vendor pages on 2026-08-11 (sources under the table). "Owned"
rows are the two instruments this plan actually targets.

| Series | Model | BW | Ch | ADC | Sample rate | Memory (std/max) | LA (16 ch) | AWG | Notes |
|---|---|---|---|---|---|---|---|---|---|
| DHO800 | DHO802 | 70 MHz | **2** | 12-bit | 1.25 GSa/s | 25 Mpts | — | — | hack target |
| DHO800 | DHO804 | 70 MHz | 4 | 12-bit | 1.25 GSa/s | 25 Mpts | — | — | hack target |
| DHO800 | DHO812 | 100 MHz | **2** | 12-bit | 1.25 GSa/s | 25 Mpts | — | — | hack target |
| DHO800 | DHO814 | 100 MHz | 4 | 12-bit | 1.25 GSa/s | 25 Mpts | — | — | hack target |
| DHO900 | DHO914 | 125 MHz | 4 | 12-bit | 1.25 GSa/s | 50 Mpts | std (PLA2216 probe) | — | |
| DHO900 | DHO914S | 125 MHz | 4 | 12-bit | 1.25 GSa/s | 50 Mpts | std (PLA2216 probe) | 1×25 MHz | |
| DHO900 | DHO924 | 250 MHz | 4 | 12-bit | 1.25 GSa/s | 50 Mpts | std (PLA2216 probe) | — | |
| DHO900 | **DHO924S** | 250 MHz | 4 | 12-bit | 1.25 GSa/s | 50 Mpts | std (PLA2216 probe) | 1×25 MHz | **owned** |
| MHO900 | MHO934 | 350 MHz | 4 | 12-bit | 4 GSa/s | 100/500 Mpts (opt) | 16 ch (probe) | opt 2-ch 50/100 MHz (+Bode) | Wi-Fi/BT, USB-C |
| MHO900 | MHO954 | 500 MHz | 4 | 12-bit | 4 GSa/s | 100/500 Mpts (opt) | 16 ch (probe) | opt 2-ch 50/100 MHz (+Bode) | |
| MHO900 | MHO984 | 800 MHz | 4 | 12-bit | 4 GSa/s | 100/500 Mpts (opt) | 16 ch (probe) | opt 2-ch 50/100 MHz (+Bode) | |
| MHO900 | **MHO98** | **1 GHz** | 4 | 12-bit | 4 GSa/s | **500 Mpts std** | std | **2×100 MHz std** | **owned**, limited edition, all options std |

Notes, all verified: the MHO900 lineup is **MHO934/954/984 + MHO98
only** (an earlier revision of this document listed "MHO914/MHO924" —
those models **do not exist**; they were an unverified naming-pattern
extrapolation, corrected here). DHO800 models vary in channel count
(2 vs 4), which any generic table must carry. Community hacks lift
DHO800 bandwidth/memory toward DHO924 levels while `*IDN?` still
reports the stock model — relevant to auto-detection below.

Sources: [Rigol DHO800](https://www.rigolna.com/products/rigol-digital-oscilloscopes/dho800/),
[TestEquity DHO802](https://www.testequity.com/product/20002527-DHO802),
[Meilhaus DHO800](https://www.meilhaus.de/en/rigol-dho800.htm),
[TestEquity MHO934](https://www.testequity.com/product/20019880-MHO934),
[Techni-Tool MHO954](https://www.techni-tool.com/product/20019881-MHO954),
[TestEquity MHO984](https://www.testequity.com/product/20019883-MHO984),
plus the §2 sources for DHO924S/MHO98.

## 5. Approach (revised 2026-08-11 — supersedes the original Phase 1–3 plan)

**Decision revision, recorded honestly**: an earlier revision of this
document decided on a new `eez-rigol-dho900` family repo built as an
`.eez-project`. That is **superseded** (kept below as a deferred option)
by a KiSS-driven sequential approach: the actual goal is comprehensive,
stable support for the two owned instruments, and for exactly two
instruments the family machinery front-loads plumbing (a converter
script or GUI-manual builds, a new repo, an exemplar-only JSON format)
before any functional gain.

**The approach**: take **MHO98 to 100% first**, in the existing
`eez-rigol-mho98` repo, then generate **DHO924S as a scripted subset**
in the existing `eez-rigol-dho924s` repo. Model-specific behavior is
handled at **runtime**: shortcuts query `*IDN?` at start and select a
row from an embedded `MODELS` table (schema = §4's columns), so support
for further models later is a data row, not new code.

Feasibility of the runtime table — every building block verified in EEZ
Studio 0.29.0 source this session:

- Scripts query `*IDN?` freely (model = 2nd CSV field of the reply).
- Scripts receive a per-instrument persistent `storage.getItem/setItem`
  API (verified in `packages/instrument/window/script.ts`,
  `prepareJavaScriptModules`) — the override path for hacked units
  whose IDN under-reports their real specs.
- `input()` dialogs with `type:"enum"` dropdowns — in production use in
  our own mho98 Vertical/Trigger dialogs.
- One shared superset SDL is harmless to models lacking a subsystem —
  the official `rigol_ds_mso_1000` family ships its conditional
  `:LA`/`:SOURce` subsystems to all 9 models.

Known costs, stated plainly: the shortcut sandbox has **no JS module
system** (verified — the reason `qts()` is copy-pasted per shortcut), so
the ~1 KB `MODELS` table is embedded per capability-dependent shortcut;
kept in sync mechanically because the DHO924S files are *generated* from
the MHO98 source (hand edits to derived files prohibited). One extra
query at script start is negligible.

### Step 1 — MHO98 to 100% (`eez-rigol-mho98`)
Each item is released and user-tested on the real instrument before the
next starts:
1. **Command-set source**: fetch the MHO900 programming guide from
   rigol.com (fallback if unavailable: DHO800/900 guide + our measured
   mho98-only entries, explicitly flagged as such); extract the command
   tree. This also produces the MHO900-vs-DHO900 command diff.
2. **`MODELS` table + `detectModel()`** pasted block: `*IDN?` at script
   start selects the row; unknown model → notify + safe defaults.
3. **Capture fidelity**: `WAVeform:FORMat` BYTE → **WORD** (BYTE
   transfers discard 4 of the 12 bits); chunking re-sized for 2-byte
   samples; memory limit from the table row (MHO98: 500 Mpts).
4. **LA support** (first in the EEZ ecosystem): `:LA` SDL subsystem +
   shortcuts, gated on the table's LA field; iterated on real hardware
   with the PLA2216 probe.
5. **AWG completeness** against the guide (2×100 MHz; dialogs exist —
   verify coverage incl. arbitrary waveforms), gated on the table's AWG
   fields.
6. **SDL expansion** toward full guide coverage (official family: 692
   commands) — generated by script from the extracted command tree, not
   hand-edited XML.
7. **docs/ HTML command reference** — stretch goal, last.

### Step 2 — DHO924S as a generated subset (`eez-rigol-dho924s`)
- New `derive-from-mho98.py`: reads the MHO98 `package.json` + superset
  SDL, applies transforms (labels/IDN/guid — AWG and LA behavior differ
  at runtime via the shared `MODELS` table, so script bodies stay
  identical), emits the dho924s files. Derivation is part of the release
  procedure; hand edits to derived files prohibited.
- Add `image.png` (currently missing).
- User tests on the real DHO924S; release.

### Deferred (documented, unscheduled)
- DHO800 rows activation + hacked-unit override dialog (storage-backed).
- MHO934/954/984 rows — data-only additions once verifiable against real
  hardware or a manual-verified IDN.
- Single universal extension packaging — requires first verifying how
  EEZ Studio matches the `.idf`/package.json IDN string (single string;
  multi-series matching semantics unverified).
- The `.eez-project` family build and upstreaming to
  `eez-open/studio-extensions` — revisit only if sibling-model coverage
  or upstreaming becomes a real goal.
