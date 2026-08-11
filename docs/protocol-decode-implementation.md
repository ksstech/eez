# 1-Wire / I2C / DS248x decode — implementation record

Built 2026-08-11/12 from the plan in
[protocol-decode-analysis.md](protocol-decode-analysis.md), option (a):
from-scratch against vendor specifications. Repo:
[ksstech/eez-protocol-decode](https://github.com/ksstech/eez-protocol-decode).

## What shipped

| Component | Where |
|---|---|
| Decoder library + measurement-function extension | `eez-protocol-decode` v1.0.0 |
| Capture-and-decode shortcuts (1W / I2C / DS248x) | `eez-rigol-mho98` v1.1.0 |

Two delivery vehicles, **one source**: the shortcut sandbox has no module
system, so `tools/build-shortcuts.js` inlines the library behind a CommonJS
shim. `test/run-bundle-tests.js` asserts the bundled and directly-required
paths produce byte-identical output, so the two vehicles cannot drift.

## Verification: 140 tests

| Suite | Tests | What it proves |
|---|---|---|
| `run-tests.js` | 72 | Protocol logic on synthetic waveforms, incl. datasheet ground truth (+25.0625 °C = 0x0191, −55 °C = 0xFC90, CRC-8 zero property) and impairments (RC edges, noise, 12-bit quantization) |
| `run-extension-tests.js` | 28 | The package loads and runs exactly as EEZ Studio loads it (`require(main).default`, script path resolution, `IMeasureTask` shape) |
| `run-bundle-tests.js` | 19 | Bundled core ≡ direct require; generated shortcuts parse inside EEZ's real async wrapper |
| `hw-decode.js` | 21 | Real MHO98 captures through the actual analog path |

## Hardware-in-the-loop method

The AWG **cannot** be loaded with arbitrary sample data over SCPI —
`:SOURce<n>:LOAD:ARBitrary` reads a file from the instrument's own storage and
no upload command exists (verified in the programming guide; the only
file-transfer commands are SMB *save* and image save). Protocol *frames*
therefore cannot be synthesised in hardware.

What the AWG does provide precisely is square waves with 1–99 % duty control,
which generates genuine 1-Wire **slot timings**:

| Stimulus | AWG setting | Decoder measured | Instrument's own measurement |
|---|---|---|---|
| write-1 slots | 6 µs low / 64 µs high | 6.03 µs | 6.024 µs (`NWIDth`) |
| write-0 slots | 60 µs low / 10 µs high | 60.00 µs | — |
| reset pulses | 600 µs low | 600.04 µs | — |
| phase-locked pair | 100 kHz + 50 kHz | 100.00 / 50.00 kHz, ratio 2.0000 | — |

Independent agreement to within 6 ns on the write-1 slot.

## Findings that came out of hardware testing

1. **Stuck waveform read window (real bug, fixed).** `:WAVeform:STARt/STOP`
   are validated against the *current* memory depth. A window left beyond a
   subsequently-smaller depth (10 Mpt capture → 1 Mpt capture) is rejected
   with `-200` and stays stuck, silently returning the **wrong samples** —
   this produced a flat-line capture in the harness. Fixed in both the Python
   harness and the mho98 shortcuts with a verify-and-recover `setWindow()`.
   The shipped `Capture` shortcut's command *ordering* was separately checked
   and found correct — the firmware tolerates a transient `STARt > STOP`.
2. **Phantom decodes from a static line (real robustness gap, fixed).** Auto-
   thresholding a flat trace puts the trigger points inside the noise band;
   the decoder turned an idle-high capture into 25 279 "bits". A `minSwing`
   guard now reports "line is static" instead.
3. **Two of my own test expectations were wrong, not the decoder** — two
   phase-locked squares *do* contain spec-valid START/STOP conditions
   (UM10204 §3.1.4: SDA falling while SCL high **is** a START), and a
   START/STOP one clock apart legitimately yields no completed byte. The
   tests were corrected to assert the spec-correct behaviour rather than
   "fixing" correct code.

## Caveats carried in the code and README

- RW1990 opcodes (0xD1/0xD5/0xB5) are community-sourced, not from an official
  datasheet — reported as "unofficial" with a warning attached.
- Master and slave are indistinguishable on a single 1-Wire trace (wired-AND);
  meaning comes from command context. Every single-line decoder shares this.
- WORD-format byte order is undocumented by Rigol; little-endian was
  determined empirically and is asserted by the hardware tests.
- No sigrok/libsigrokdecode code was used or consulted — the repo is MIT and
  carries no GPLv3 obligation.

## Not yet done

- Device-layer decode for DS2431/DS2433 EEPROM and DS2408 I/O families
- `docs/` HTML command reference and the SDL expansion (separate plan items)
- Real-device validation: every 1-Wire *frame* test is synthetic, because the
  AWG cannot generate protocol data. Decoding an actual DS18B20 or iButton
  transaction on the bench is the one piece of validation still outstanding.
