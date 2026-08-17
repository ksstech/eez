# EEZ Studio — Live Toast Pattern

Reference for implementing a continuous live-readout shortcut in EEZ Studio 0.28.0.
Developed and tested against the EA-PS2342 bridge extension ([eez-ea-ps2k](https://github.com/ksstech/eez-ea-ps2k), v1.0.29).
Apply the same pattern to DMM 34465A, Rigol MHO98, and similar multi-channel instruments.

---

## The Pattern

```javascript
// ── 1. CSS injection — multi-line toast support ───────────────────────────────
// Must run before any notify call that uses \n.
// document is accessible in the EEZ Studio 0.28.0 script sandbox.
// The id guard ensures the style is only injected once per EEZ session.
if (!document.getElementById('my-instrument-toast-fix')) {
    var _s = document.createElement('style');
    _s.id = 'my-instrument-toast-fix';
    _s.textContent = '.Toastify__toast-body{white-space:pre-line}';
    document.head.appendChild(_s);
}

// ── 2. Interval ───────────────────────────────────────────────────────────────
const INTERVAL_MS = 100;   // 100 ms works well; increase if instrument is slow

// ── 3. Acquire connection and open a persistent toast ─────────────────────────
await connection.acquire(true);
var liveToast = notify.info("▶ Live: connecting...", { autoClose: false });

// ── 4. Poll loop ──────────────────────────────────────────────────────────────
try {
    while (!session.isStopped) {
        var raw = await connection.query("YOUR:MEAS:QUERY?");
        // ... parse raw into display string ...
        var line1 = "CH1: " + /* formatted value */;
        var line2 = "CH2: " + /* formatted value */;

        notify.update(liveToast, {
            render: line1 + "\n" + line2,   // \n renders as line break with CSS fix above
            autoClose: false
        });
        await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
    notify.update(liveToast, { render: "Live stopped", autoClose: 2000 });
} catch(e) {
    notify.update(liveToast, { render: "Live failed: " + e.message, autoClose: 5000, type: "error" });
} finally {
    connection.release();
}
```

---

## Key Design Decisions

### notify.update() — not dismiss + recreate

`notify.update(toastId, { render, autoClose })` updates the existing toast **in place**.
Dismiss + recreate causes a new toast to slide in below while the old one slides off —
visible jump on every poll cycle. `notify.update()` has zero animation and zero jump.

`notify.info()` returns a numeric toast ID (e.g. `436`). Pass it directly to `notify.update()`.
This works in EEZ Studio 0.28.0 — it was broken in 0.27.x.

### Single toast only

Two simultaneous toasts (e.g. a hint toast + a data toast) stack and obscure the
Stop button in the Scripts panel. Use one toast for all live data.

### Position the toast away from the Stop button

Create persistent toasts at `bottom-right`:

```javascript
var toast = notify.info("...", { autoClose: false, position: "bottom-right" });
```

`notify.*` passes its options straight through to react-toastify
(`eez-studio-ui/notification.tsx`), and `ToastPosition` in react-toastify
10.0.6 (the version EEZ Studio 0.29.0 ships) accepts
`top-right | top-center | top-left | bottom-right | bottom-center | bottom-left`.
The default container position is `top-right`, which is exactly where the
instrument toolbar's Stop button sits — hence the old "close the toast to
reach Stop" dance. Moving the toast removes the collision entirely, and it
works on 0.29.0 today with no upgrade.

Suggested by the EEZ Studio maintainer in
[eez-open/studio#1013](https://github.com/eez-open/studio/issues/1013).

### Stop mechanism

`session.isStopped` becomes true when the user clicks Stop. Two separate
things can hide that button, not just the toast — verified in
`eez-open/studio` source (`script.ts`, `scripts.tsx`, `navigation-store.tsx`):

1. **The toast covers it** while visible — unless the toast is created at
   `position: "bottom-right"` (see above), which is now the recommended
   practice and removes this cause.
2. **The Stop button only exists in the Scripts tab's own toolbar.**
   Launching a shortcut from the instrument's quick-access toolbar does
   **not** switch you to the Scripts tab (`doExecuteShortcut()` only
   navigates there on a script *error*, never on the normal running path)
   — if you were on a different tab (Terminal, Shortcuts, etc.) when you
   launched it, there is no Stop button visible anywhere until you
   manually click **Scripts** in the left nav.

Document both in the shortcut comment:

```javascript
// To stop: click "Scripts" in the left nav (if not already there), then
// close this toast to reveal the Stop button underneath.
```

### Interval tuning

| Interval | Behaviour |
|----------|-----------|
| 100 ms | Smooth update, readable at rest |
| 500 ms | Readable while scrolling terminal |
| 1000 ms | Comfortable for slow instruments |

100 ms is the practical minimum for MEAS:BOTH? on the EA bridge (single round-trip).
For instruments that require one query per channel, multiply by channel count.

### Multi-line display with \n

EEZ Studio's toast library (react-toastify) does not set `white-space: pre-line`
on `.Toastify__toast-body` by default, so `\n` in a string is collapsed to a space.

**Fix:** inject the CSS rule from the script (see step 1 above).

A GitHub issue has been filed against `eez-open/studio` requesting the fix upstream
(`packages/eez-studio-ui/_stylesheets/app.less`). Once merged the injection becomes
a harmless no-op.

`\n` in a JavaScript string literal inside the EEZ script sandbox becomes a real
newline character at runtime — this is standard JS behaviour. The CSS fix is the
only thing needed to make it visible in the toast.

Things that do NOT work:
- `<br>` — printed as literal text, not rendered as HTML
- `white-space` override without the CSS injection — no effect

### qts() helper — robust query result extraction

See [qts-helper.md](qts-helper.md) — used across all instrument extensions in this
family (eez-ea-ps2k, eez-keysight-34465a, eez-rigol-mho98).

### console.log() produces no output

`console.log()` in the EEZ Studio 0.28.0 script sandbox produces no visible output.
Use `notify.info()` for debugging during development.

---

## Applying to a new instrument

1. **Copy the pattern above** into a new shortcut script for the instrument.
2. **Replace the query** (`YOUR:MEAS:QUERY?`) with the instrument's measurement command.
   - 34465A: `MEAS:VOLT:DC?` / `READ?` / `FETC?` depending on mode
   - MHO98: `MEAS1?` / `MEAS2?` or channel-combined equivalents if available
   - EA-PS2000B (via eez-ea-ps2k bridge): `MEAS:BOTH?` — see that repo for the exact format
3. **Format the result** into `line1` / `line2` strings with units and mode.
4. **Tune `INTERVAL_MS`** to the instrument's response time — GPIB/USB instruments
   may need 200–500 ms.
5. **Use the same CSS injection block** (change only the `id` string to avoid
   conflicts if multiple instruments are open simultaneously).
6. **Add the shortcut to the instrument's `package.json`** and rebuild/publish the
   release (see this repo's top-level README for the release workflow).
