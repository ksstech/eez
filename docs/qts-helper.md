# qts() — robust EEZ Studio query result extraction

`connection.query()` in EEZ Studio can return a string, a number, or a binary
`ArrayBuffer`-like object depending on connection state and instrument driver — the
shape isn't consistent enough to just call `.trim()` on the result directly. Every
JavaScript shortcut across this instrument family (eez-ea-ps2k, eez-keysight-34465a,
eez-rigol-mho98) starts with the same helper to normalize that:

```javascript
function qts(r) {
    if (r === null || r === undefined) return "";
    if (typeof r === "string") return r.trim();
    if (typeof r === "number") return String(r);
    if (r.data) { var t = new TextDecoder().decode(new Uint8Array(r.data)); return t.trim(); }
    return String(r).trim();
}
```

Usage — wrap every `connection.query()` call:
```javascript
var idn = qts(await connection.query("*IDN?"));
```

## Why each branch exists

- `null`/`undefined` — connection dropped or command produced no reply; return
  empty string rather than throwing, so calling code can check `if (!idn)` uniformly.
- `string` — the common case, still needs `.trim()` since instruments often pad
  responses with trailing `\r`/`\n`/whitespace.
- `number` — some drivers parse numeric SCPI responses (e.g. `MEAS:VOLT:DC?`) into
  a JS number before handing it back; stringify for uniform downstream parsing.
- `r.data` (binary) — seen when the connection is in a state expecting binary
  transfer; decode as UTF-8 text and trim. This is the branch that's easy to miss
  and causes the most confusing bugs if omitted (result silently stringifies to
  `"[object Object]"` instead).
- Fallback — anything else, best-effort stringify.

## Adopting in a new instrument extension

Copy the function verbatim into any shortcut that calls `connection.query()`.
There's no shared JS module system in the EEZ Studio script sandbox (each shortcut's
`action.data` is a self-contained script), so this does have to be copy-pasted per
shortcut rather than imported — that's expected, not an oversight.
