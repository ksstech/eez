# The essence of our EEZ Rigol-scope support — analysis vs. Rigol Web Control

Written 2026-08-11, prompted by the honest question: *what are we likely
to achieve, UI/functionality-wise, that Rigol's own HTTP Web Control
doesn't already provide?*

## 1. The journey that defines the requirement

1. **PS2342 via IP (achieved)** — the EA-PS2000B speaks only a USB
   binary protocol; the bridge + extension made it a LAN/WAN instrument.
2. **34465A control for automated, coordinated PSU + measurement
   (NOT yet achieved)** — this is the actual objective the whole effort
   serves. The DMM extension exists and works interactively, but the
   *coordination* — PSU and DMM acting together in one automated
   procedure — hasn't been built.
3. **Rigol scopes (current work)** — entered as a sidetrack from #2.

The through-line is not "a UI for each instrument": it is **one
IP-reachable bench where instruments act together**.

## 2. What Rigol Web Control actually is (verified)

On the DHO800/900 (and MHO900) platform, Web Control is a browser-based
remote UI for **one scope**: live screen mirror with full touch/mouse
control, plus an LXI info page (VISA strings, IP config). Constraints
verified from Rigol's documentation: **one user login at a time**;
per-instrument only.
Sources: [DHO900 Quick Start — Remote Control](https://www.manualslib.com/manual/3335386/Rigol-Dho900-Series.html?page=28),
[DHO900 User Manual — Remote Control via USB/LAN](https://www.manualslib.com/manual/3292263/Rigol-Dho900-Series.html?page=274),
[WebControl DHO900/DHO800 demo](https://www.youtube.com/watch?v=U6F3PksEXAI).

**Honest verdict**: as a remote *UI for the scope itself*, Web Control
wins and will keep winning. It mirrors the instrument's own touchscreen —
every menu, perfectly current with firmware, zero maintenance from us.
Our config dialogs (Vertical/Trigger/Horizontal/Measure) re-implement a
subset of that, worse. If the goal were "operate the scope from a
browser", this project would be pointless.

## 3. What Web Control structurally cannot do — and EEZ can

These are architecture facts, not feature gaps Rigol might close:

1. **Cross-instrument coordination.** Web Control controls one Rigol.
   The bench has an EA PSU speaking a private bridge protocol and a
   Keysight DMM — no Rigol UI will ever touch either. EEZ Studio's
   dashboard projects (EEZ Flow) are built for exactly this — verified
   in source (`project-editor/flow/components/actions/instrument.tsx`):
   the `SCPI` action component's `instrument` property is an expression
   resolving to an `object:Instrument` variable; a dashboard declares as
   many instrument variables as it needs and each action targets any of
   them. PSU-step → DMM-read → scope-capture in one flow, with loops,
   UI widgets, and charts.
2. **Data as artifacts.** Web Control shows; it does not record. EEZ
   persists every capture/measurement into the session history — charts,
   CSV export, notebooks — which is what an automated measurement
   campaign actually produces.
3. **Deep-memory extraction.** Our Capture pulls the RAW record to the
   host at true 12-bit (hardware-verified) into an analyzable chart.
   Web Control gives eyes on the screen, not the record as data.
4. **Repeatability.** A shortcut/flow runs identically every time;
   a human clicking a mirrored touchscreen does not.
5. **One tool, whole bench, same IP paths** — including the WAN path
   already built for the PS2342. (Web Control also allows only one
   logged-in user; whether its login coexists with a concurrent SCPI
   socket session is **unverified** — test before relying on
   simultaneous use.)

## 4. The essence, defined

**Our Rigol support exists to make the scope a first-class *programmable
data source and stimulus* in a coordinated, IP-reachable bench — not to
be the scope's UI.** Rigol already ships the better UI.

Tiered consequences for what we build:

- **Tier 1 — the essence (invest):**
  - Reliable capture-to-host (done: 12-bit WORD, verified).
  - Everything automation touches: run/stop/single/force, measurement
    queries, trigger config *as programmatic operations* usable from
    flows and the terminal.
  - SDL depth (synopses + docs) — this is what makes flows and terminal
    work writable without the programming manual open.
  - LA and AWG as *programmatic resources*: LA capture as data;
    AWG set-waveform/frequency/amplitude as stimulus steps in a flow.
- **Tier 2 — convenience (keep, stop expanding):** the config dialogs
  (Vertical/Trigger/Horizontal/Measure/AWG dialog, Live Meas toast).
  They cost nothing to keep but duplicate Web Control — no further
  investment.
- **Tier 3 — out of scope (never build):** anything that mirrors the
  scope's screen or reimplements its interactive UI.

## 5. Priority consequence (proposal)

1. Finish the automation-serving remainder of Step 1: SDL expansion
   (Tier 1), LA as capture/data (Tier 1), AWG programmatic completeness
   (Tier 1, minimal); skip further dialog polish (Tier 2).
2. Step 2 (DHO924S derivation) unchanged — it inherits the Tier 1 core.
3. **Then return to the unachieved original objective**: a demonstrator
   EEZ dashboard (Flow project) coordinating PS2342 + 34465A — e.g.
   "step PSU 0→12 V in 0.5 V steps, DMM reading at each step, results
   charted" — extended with the scope as transient-capture. That
   delivers the integration the whole effort was started for, and is
   the first thing Web Control could never have provided.
