# Reliability & Performance Patterns for EEZ Studio TCP/SCPI Bridges

Every pattern here was discovered solving a real, reproduced failure in
[eez-ea-ps2k](https://github.com/ksstech/eez-ea-ps2k) (a Python driver + TCP
bridge fronting a USB-serial instrument, with EEZ Studio as one of several
possible clients). They're written up here — not in that repo — because
they apply to *any* instrument bridge of this shape: USB/serial device →
Python driver → TCP server → EEZ Studio (or other SCPI client), typically
hosted on a Raspberry Pi / Linux box via systemd.

If you're building or maintaining a bridge for a different instrument, check
each of these against your own implementation before assuming they don't
apply — several were non-obvious until they caused a real outage.

---

## 1. USB autosuspend is the #1 cause of "worked for days, then died"

**Symptom:** bridge and device both look fine after startup, works for hours
or days, then the driver starts getting I/O errors or timeouts on every
command — no code change, no device fault, no cable issue.

**Cause:** Linux's USB power management suspends idle USB devices by
default. A serial instrument that goes quiet for a while (nobody polling it)
gets autosuspended, and the kernel doesn't always resume it cleanly for the
driver.

**Fix:** a udev rule that disables autosuspend for the specific device
(match by `idVendor`/`idProduct`), applied at `ACTION=="add"`:
```
ACTION=="add", SUBSYSTEM=="usb", ATTRS{idVendor}=="xxxx", ATTRS{idProduct}=="yyyy", \
    ATTR{power/control}="on"
```
Verify: `cat /sys/bus/usb/devices/*/power/control` should show `on`, not `auto`,
for your device.

## 2. Stable device naming via udev symlink, not `/dev/ttyACMx`

**Symptom:** the bridge's serial port config points at `/dev/ttyACM0`, which
works until a reboot or a USB hub replug event shifts enumeration order and
the device becomes `/dev/ttyACM1` — bridge fails to find it, looks like a
hardware fault.

**Fix:** a second udev rule creating a stable symlink based on VID:PID
(immune to renumbering), and point the bridge config at the symlink instead
of a raw `ttyACMx` path:
```
SUBSYSTEM=="tty", ATTRS{idVendor}=="xxxx", ATTRS{idProduct}=="yyyy", \
    SYMLINK+="my-instrument-port"
```

## 3. `termios.error` is not a subclass of `OSError`

**Symptom:** a serial I/O error-recovery `except OSError:` block that's
supposed to catch and recover from device disconnects sometimes doesn't
fire — the exception propagates uncaught instead.

**Cause:** on Linux, `pyserial`'s `reset_input_buffer()` calls
`termios.tcflush()` internally, which raises `termios.error` when the fd is
already in an EIO state (e.g. mid-USB-disconnect). `termios.error` is its
own exception class, **not** a subclass of `OSError` — a bare
`except OSError:` silently misses it.

**Fix:**
```python
try:
    import termios as _termios
    _TERMIOS_ERROR: type = _termios.error
except ImportError:
    _TERMIOS_ERROR = OSError   # Windows/macOS: termios unavailable, harmless fallback

# ...
except (OSError, _TERMIOS_ERROR) as exc:
    ...
```
Also make sure `reset_input_buffer()` (or any other termios-touching call)
is actually *inside* the try block — easy to accidentally place a "harmless
cleanup" call just before the try starts, where its errors go uncaught.

## 4. Two-tier reconnect: lazy (on command) + watchdog (on idle)

**Symptom:** the driver correctly closes the port and clears its connection
state after an I/O error, and correctly reconnects the *next time a client
sends a command* — but if no client is actively polling (e.g. overnight, or
between EEZ Studio sessions), the port never gets reopened, because the
reconnect logic only runs from inside the command-dispatch path.

**Fix:** a background daemon thread, started once at bridge startup, that
wakes on an interval (20–30s is reasonable) and reconnects if the port is
down — independent of whether any client is currently connected:
```python
def _watchdog_loop(self):
    while True:
        time.sleep(_WATCHDOG_INTERVAL)
        if not self.driver.is_connected:
            with self.lock:                    # same lock client handlers use
                if not self.driver.is_connected:  # re-check under lock
                    self._reconnect()
```
Rate-limit actual reconnect *attempts* (not just the watchdog's wake
interval) with a cooldown, so a device that's genuinely absent doesn't get
hammered with repeated `open()` calls from both the watchdog and every
incoming client command:
```python
if now - self._last_reconnect_attempt < _RECONNECT_COOLDOWN:
    return False
```

## 5. A single lock around the shared serial connection

The watchdog thread (pattern 4) and per-client TCP handler threads (each
client typically gets its own thread) both touch the same serial connection.
Without a shared lock, a watchdog reconnect and an in-flight client command
can race and corrupt the connection state. Use one lock, held for the full
duration of any serial transfer *and* any reconnect attempt — not just the
write, not just the read.

## 6. `TCP_NODELAY` — disable Nagle's algorithm on every accepted client socket

**Symptom:** SCPI responses arrive noticeably delayed, especially with small
payloads — client-perceived latency far higher than the actual instrument's
response time would suggest.

**Cause:** Nagle's algorithm batches small outgoing TCP packets to reduce
overhead, adding up to ~40ms delay by default. For a request/response
protocol like SCPI-over-TCP, this only hurts.

**Fix:** one line, on every accepted connection:
```python
conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
```

## 7. Short socket read timeout + explicit dispatch-on-timeout fallback

**Symptom:** EEZ Studio (or another client) occasionally shows multi-second
round-trip times for a command that should be near-instant.

**Cause:** if the bridge's read loop waits for a trailing newline before
dispatching a command, and the client library omits the trailing `\n` on
some code path, the bridge will wait for its full socket timeout before
falling back to dispatching whatever's in the buffer. A long default timeout
(e.g. 5s) becomes a visible multi-second stall for exactly that class of
request.

**Fix:** use a short read timeout (~100ms) and treat the timeout itself as a
trigger to dispatch any buffered-but-unterminated command, rather than using
the timeout only as an idle/keepalive signal:
```python
conn.settimeout(0.1)
# ...
except socket.timeout:
    if buf.strip():
        dispatch(buf.strip())   # don't wait out a long timeout for a missing \n
```
This one change was the direct fix for a reproducible 6-second round-trip
observed specifically from EEZ Studio's connection layer.

## 8. Batch multi-value/multi-channel reads into one command

**Symptom:** a live-readout shortcut polling N channels does N separate
`connection.query()` calls per update cycle — each one a full TCP round
trip from the EEZ Studio script sandbox, not just a local function call.
At a 100ms poll interval this adds real, visible latency and can make the
"Live" toast pattern (see [eez-live-toast-pattern.md](eez-live-toast-pattern.md))
stutter.

**Fix:** add bridge-side "both"/"all" commands that read every channel's
data in a single request/response, at the cost of a slightly more complex
response format (e.g. pipe-delimited per-channel groups):
```
MEAS:BOTH?  →  v1,i1,on1,mode1|v2,i2,on2,mode2
```
Halves (or better) the round-trip count for any shortcut that needs
multiple channels' data, which matters most for exactly the high-frequency
polling loops this pattern is usually paired with.

## 9. Enforce protocol-mandated inter-command delay centrally, once

Many instrument protocols specify a minimum delay between commands (check
your programming guide). Don't scatter `time.sleep()` calls through calling
code — centralize the wait inside the single transfer function, gated by
the same lock used for thread safety (pattern 5), so *every* caller gets it
automatically and correctly, including future code that doesn't know the
spec requirement exists:
```python
with self._lock:
    wait = _MIN_DELAY - (time.monotonic() - self._last_tx)
    if wait > 0:
        time.sleep(wait)
    # ... send, then update self._last_tx
```

## 10. Read exactly the expected byte count, not "read until timeout"

If the protocol's framing tells you the response length up front (e.g. a
length nibble in the first byte), read exactly that many more bytes rather
than reading into a fixed-size buffer and relying on the read timeout to
signal "done." The latter means paying the *full* timeout on every single
command, even successful ones — the former returns as soon as the last
expected byte arrives.

## 11. `systemd` restart policy: `Restart=on-failure` + a burst limit

```ini
Restart=on-failure
RestartSec=5s
StartLimitIntervalSec=60
StartLimitBurst=5
```
Gets the bridge back up automatically after a crash, but the burst limit
stops a genuinely broken state (e.g. device permanently gone) from
crash-looping indefinitely — after 5 restarts in 60s, systemd stops trying
and the failure becomes visible (`systemctl status` shows `failed`) instead
of silently spinning forever.

## 12. VirtualHere and a Python USB bridge cannot share a device

If the host also runs VirtualHere USB Server (common on a shared RPi
exposing multiple instruments over the network), it and any Python bridge
using `pyserial` **cannot** both claim the same USB device — you'll see
`[Errno 5] Input/output error` from the Python side, or the device simply
won't show up at `/dev/ttyACMx` because VirtualHere claimed it first at the
kernel level.

**Fix:** add the device to VirtualHere's ignore list. Three formatting traps
that are easy to get wrong and fail silently with no error:
- The key is **`IgnoredDevices`**, not `ExcludeDevices` (that key doesn't
  exist — VH silently accepts and ignores it)
- Format is `vid/pid` with a **forward slash**, not a colon
- **No** `0x` prefix and **no** leading zeros — `232e/18`, not `0x232e:0x0018`
  or `232e/0018`

Find the actual config path VirtualHere is using (varies by install) from
its own startup log rather than assuming:
```bash
sudo journalctl -u virtualhere -n 20 --no-pager | grep "Using configuration"
```

## 13. `resetAndAcquire()` pattern for EEZ Studio shortcuts

Shortcuts that don't run continuously (unlike the Live pattern) should
release and re-acquire the connection defensively at the start, rather than
assuming a clean connection state left over from a previous shortcut run:
```javascript
async function resetAndAcquire(){
    try { connection.release(); } catch(e) {}
    await new Promise(r => setTimeout(r, 400));
    await connection.acquire(true);
}
```
The 400ms pause gives the bridge time to fully process the release before
the next acquire — omitting it risks the new acquire racing the old
connection's teardown.

---

## Reference implementation

All of the above were first solved in
[eez-ea-ps2k](https://github.com/ksstech/eez-ea-ps2k) — see
`ea_ps2k_driver.py` and `ea_ps2k_bridge.py` for the actual code, and that
repo's README for the full design writeup.
