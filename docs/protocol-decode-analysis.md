# 1-Wire / DS248x protocol analysis in EEZ Studio — feasibility analysis

Written 2026-08-11. Question: both scopes lack 1-Wire (iButton
DS1990/RW1990, DS18x20) and DS248x-aware I2C protocol analysis — to what
extent and level of detail could this be added into EEZ Studio, or is a
different mechanism better?

## 1. The scopes cannot do it, and we cannot add it to them (verified)

The decode ("bus") types are firmware-fixed lists. Verified across both
programming guides (518 + 452 pages): **zero mentions of 1-Wire** in
either. Available types — DHO800/900: Parallel, RS232, I2C, SPI, CAN,
LIN; MHO900 adds FlexRay and I2S. Nothing user-extensible exists at the
firmware level. Any 1-Wire analysis therefore happens **on captured
waveform data, in software** — the only question is where that software
lives.

## 2. EEZ Studio has a purpose-built slot for exactly this (verified in source)

EEZ Studio's third extension type, **`measurement-functions`**, runs
scripts over any waveform chart in the session history (this is how the
built-in Min/Max/FFT and the catalog's "Advanced measurements" work).
The API (`eez-studio-shared/extensions/extension.ts`) is a natural
protocol-decoder interface:

- `IMeasureTask` provides `samplingRate`, sample access, and
  **multi-channel inputs** (`arity > 1`, `inputs: IInput[]` — e.g.
  SDA + SCL, or I2C pair + 1-Wire line);
- `parametersDescription` gives the same dialog-field UI our shortcuts
  already use (thresholds, speed standard, device type);
- crucially, `result: number | string | IChart` — a decoder can return
  a **full text transaction report** and/or a **reconstructed chart**.

So the integration exists as designed infrastructure, not a hack. A
lighter first step also exists: a "Decode 1-Wire" JS *shortcut* reusing
our Capture pipeline (threshold → decode → chart + report). Same
algorithms; the measurement-function form is the architecturally right
home because it works on any stored chart (including past captures) and
composes with the history/notebook workflow.

## 3. Achievable level of detail: beyond any hardware decoder

Software decode has no depth limit. Full stack, per layer:

- **Link**: reset/presence detection, slot classification (write-0/
  write-1/read), standard + overdrive timing, and **spec-margin
  analysis** (slot-timing histograms vs. Maxim limits) — a diagnostic
  no scope decoder offers.
- **Network**: ROM commands (Read/Match/Search/Skip), 64-bit ROM decode
  = family code + serial + **CRC8 verification** — this *is* the
  DS1990A/iButton identity read.
- **Device**: DS18x20 (Convert T, scratchpad → temperature with
  resolution bits, alarm thresholds, CRC); RW1990 write-pulse
  detection (nonstandard long programming slots).
- **DS248x**: it is an I2C slave, so: decode I2C (2-channel) → DS248x
  command/register layer (1WRS, 1WWB, 1WRB, triplet…) → **correlate
  host-side I2C intent with wire-side 1-Wire activity on a third
  channel, on one timeline** — a view no instrument firmware provides
  at any price.
- **Analog bonus**: decoding our 12-bit *analog* capture (vs. an LA's
  1-bit view) additionally exposes pull-up strength, reflections,
  marginal V_OL — directly useful for iButton contact/probe debugging.

Data-rate feasibility (numbers): standard 1-Wire slots are 60–120 µs,
reset ~480 µs; overdrive ~8× faster. A 10 Mpts capture at 12.5–25 MSa/s
spans 0.4–0.8 s at ≥40 ns resolution — several complete transactions.
(A DS18x20's ~750 ms conversion wait is idle line; capture around the
frames, or 25 Mpts at 25 MSa/s = 1 s.) The planned PLA2216 LA support
adds 16 digital channels — the natural front-end for the DS248x
three-line correlation case.

## 4. The different mechanism: sigrok/PulseView (honest comparison)

The established best-in-class for this exact need (verified):
official `onewire_link` + `onewire_network` decoders, an official
`ds243x` decoder, a third-party stacked DS18B20 decoder
(DS1822/1825/18S20/18B20/28EA00 — temperature, thresholds, resolution),
and DS1985 iButton dumps in the sigrok-dumps repo. With a ~$30
fx2lafw-class logic analyzer, PulseView delivers deep 1-Wire decode
**today, zero development**.

Trade-offs vs. the EEZ path:

| | sigrok + cheap LA | EEZ decoder (ours) |
|---|---|---|
| Available | immediately | must be built |
| Decode depth | link/network/device (mature) | same, plus spec-margin + analog integrity |
| DS248x I2C↔1-Wire correlation | manual (two decoders, eyeball) | single-timeline by design |
| Bench integration | none — separate tool, separate hardware | in-history, correlates with PSU/DMM flows (the bench essence) |
| Analog signal quality | blind (1-bit) | 12-bit view |

**Licensing note** for the EEZ decoder: libsigrokdecode is GPLv3 — do
not translate its code; implement from the Maxim/ADI specifications
(DS18B20/DS1990A datasheets, AN126, AN937), which is straightforward.

## 4.1 sigrok project health (verified from the repos, 2026-08-11)

Alive, but in **maintenance mode** — measured directly:

| Repo | Last formal release | Commits, last 12 months | Last push |
|---|---|---|---|
| PulseView (the GUI) | 0.4.2 — **March 2020** | **1** (a CMake fix) | 2025-11-10 |
| libsigrok (drivers) | 0.5.2 era; tags now "unreleased" | 29 (Python bindings, Nov 2025) | 2025-11-20 |
| **libsigrokdecode (the protocol decoders)** | 0.5.3 | **0** | 2024-10-13 |

None archived; the practical distribution is nightly builds (formal
releases are 6+ years old). Interpretation for our purposes:

- For **using it today** as a 1-Wire debugging stopgap: stagnation
  barely matters. The relevant decoders (onewire_link/network, i2c,
  ds243x) are mature, long-stable code; a cheap fx2lafw-class LA remains
  fully supported. It works now and will keep working.
- For **building on it**: the decoder library has had zero commits in a
  year and the GUI one — there is no upstream momentum to co-develop
  with, new-hardware driver support is slowing, and the stacked
  device-layer decoders (e.g. the DS18B20 one) are personal third-party
  repos. This strengthens the case for the EEZ-native decoder as the
  strategic path, and confirms implementing from the Maxim/ADI specs
  (there is also no active upstream that a contribution would thrive in).

## 4.2 Hassle/viability: from-scratch vs. reusing sigrok (GPL set aside)

Grounded in measured facts: the mature sigrok decoders are small —
`onewire_link` **347 lines**, `onewire_network` ~180 lines, `i2c`
**364 lines** of Python (~900 lines total for everything sigrok has
that we need). The device layers we care most about (DS1990
interpretation, DS18x20 beyond a third-party repo, RW1990, DS248x
correlation) largely **don't exist in sigrok** — they must be written
fresh under every option. Also verified: sigrok-cli decodes from files
without hardware (`-I csv`/`binary` input modules, logic + analog), so
"reuse" splits into two distinct sub-options.

| Dimension | (a) From scratch, official specs (NXP UM10204, Maxim AN126/AN937 + datasheets) | (b1) Port sigrok PDs Python→JS | (b2) Wrap sigrok-cli as subprocess |
|---|---|---|---|
| Core-layer dev effort | ~900–1200 lines JS (estimate; sigrok's own sizes prove the scale is small) | Comparable — the srd runtime API (`self.wait()` edge/skip semantics, annotation rows) has no JS equivalent and must be re-invented around someone else's structure | Days: CSV/binary export + annotation parsing |
| Edge-case debugging risk | The real cost of (a) — but neutralized by using sigrok as a **test oracle**: run both on the same captures/sigrok-dumps, diff outputs. Free mature-QA without touching their code (and GPL-clean, making the premise moot) | Inherited edge-case maturity — the one real advantage | Inherited |
| Fit to EEZ measurement API | Native — written against `IMeasureTask` directly | Poor — translated structure fights the API | Foreign — subprocess + text parsing glued into a measurement script |
| Deployment | None — ships in the extension | None | **Every bench machine needs a sigrok nightly installed, forever** |
| Device layers (DS1990/DS18x20/RW1990) | Written fresh | Written fresh (not in sigrok core) | Partially (third-party DS18B20 PD), rest fresh |
| Differentiators (spec-margin histograms, DS248x I2C↔1-Wire timeline, analog-quality view) | Fully possible | Fully possible, but zero help from ported code | **Dead end** — sigrok has none of it |
| Upstream future | n/a | Frozen upstream (0 commits/yr in libsigrokdecode) — a one-time copy, never a collaboration | Wrapping a frozen tool |
| Data volume | in-process | in-process | 10 Mpts captures marshaled through files per decode |

**Verdict**: (a) wins. sigrok's only transferable asset for this job is
~900 lines of small, simple state machines — and its edge-case maturity
is fully capturable as a *test oracle* rather than as code. Everything
of real value (device layers, DS248x correlation, margin analysis,
analog view) is fresh work under every option. (b2) remains worth
keeping in the pocket as a days-not-weeks byte-level MVP if an interim
decode capability is wanted before the native one exists.

## 5. Recommendation (planning input, nothing scheduled)

1. If 1-Wire debugging is needed *now*: a cheap LA + PulseView is the
   honest immediate answer.
2. For the bench (per [rigol-support-essence.md](rigol-support-essence.md)
   Tier 1): build the decoder in EEZ as a `measurement-functions`
   extension — MVP = link + network layers, single channel, string
   report + reconstructed chart; then DS18x20/DS1990 device layers;
   DS248x I2C correlation last (wants the LA capture support first).
   This is a genuine differentiator: the scopes don't have it, Web
   Control doesn't have it, and no official EEZ extension has anything
   like it.
3. Sequencing fit: after the LA-capture item of Step 1 (the decoder
   consumes exactly what that item produces).
