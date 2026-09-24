#!/usr/bin/env node
"use strict";
// Run an EEZ Studio javascript shortcut outside EEZ Studio, against a live
// instrument or bridge over raw TCP — a functional test, where
// check-shortcuts.js is only a compile test.
//
// The script is wrapped exactly as EEZ Studio wraps it
// (packages/instrument/window/script.ts: `return async (${args}) => {code}`)
// and given stand-ins for the injected modules:
//   connection  query()/command()/acquire()/release() over TCP, newline-terminated
//   input()     "clicks OK" with the dialog's default values (or --answer JSON)
//   notify      prints info/error/update to the console
//   session     isStopped turns true after --loops update() calls (Live loops)
//   storage     in-memory
//   document    minimal stub, enough for the toast CSS injection
//
// Usage:
//   node run-shortcut.js <package.json> "<shortcut name>" [--host 127.0.0.1] [--port 5025]
//                        [--answer '{"field":value}'] [--loops 3]
//
// Exit code 1 if the script throws or calls notify.error.

const fs = require("fs");
const net = require("net");

function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : def;
}
const [pkgPath, shortcutName] = process.argv.slice(2);
if (!pkgPath || !shortcutName) {
    console.log("usage: node run-shortcut.js <package.json> <shortcut name> [--host H] [--port P] [--answer JSON] [--loops N]");
    process.exit(2);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const eez = pkg["eez-studio"];
const sc = eez.shortcuts.find(s => s.name === shortcutName);
if (!sc) { console.log("no shortcut named " + JSON.stringify(shortcutName)); process.exit(2); }
const host = arg("--host", "127.0.0.1");
const port = parseInt(arg("--port", String(eez.properties.connection.ethernet.port)));
const answer = JSON.parse(arg("--answer", "{}"));
const loops = parseInt(arg("--loops", "3"));

let errors = 0;
const sock = net.connect(port, host);
let buf = "", waiters = [];
sock.on("data", d => {
    buf += d.toString("latin1");
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        const w = waiters.shift();
        if (w) w(line);
    }
});

const connection = {
    acquire: async () => {},
    release: () => {},
    command: (cmd) => { console.log("  > " + cmd); sock.write(cmd + "\n"); },
    query: (cmd) => new Promise((resolve, reject) => {
        console.log("  ? " + cmd);
        const t = setTimeout(() => { waiters = waiters.filter(w => w !== fn); reject(new Error("query timeout: " + cmd)); }, 5000);
        const fn = line => { clearTimeout(t); console.log("  < " + line); resolve(line); };
        waiters.push(fn);
        sock.write(cmd + "\n");
    }),
};
let updates = 0;
const session = { get isStopped() { return updates >= loops; } };
const notify = {
    info: (m) => { console.log("[info]  " + m); return 1; },
    error: (m) => { errors++; console.log("[ERROR] " + m); return 2; },
    update: (id, o) => { updates++; if (o.type === "error") errors++; console.log("[toast] " + o.render); },
};
const input = async (dlg, defaults) => {
    const vals = Object.assign({}, defaults, answer);
    console.log("[input] " + dlg.title + "\n        -> " + JSON.stringify(vals));
    return vals;
};
const mem = {};
const storage = { getItem: (k, d) => (k in mem ? mem[k] : d), setItem: (k, v) => { mem[k] = v; } };
global.document = { getElementById: () => null, createElement: () => ({}), head: { appendChild: () => {} } };

const ARGS = ["session", "connection", "instrument", "notify", "validators", "input", "format", "storage"];
sock.on("connect", async () => {
    console.log(`== ${pkg.name} / ${sc.name}  (${host}:${port})`);
    try {
        if (sc.action.type === "javascript") {
            const fn = new Function("return async (" + ARGS.join(", ") + ") => {\n" + sc.action.data + "\n}")();
            await fn(session, connection, {}, notify, {}, input, {}, storage);
        } else {
            for (const line of sc.action.data.split("\n").filter(Boolean)) connection.command(line);
            const e = await connection.query("SYST:ERR:ALL?");
            if (!e.startsWith("+0,")) { errors++; console.log("[ERROR] " + e); }
        }
    } catch (e) {
        errors++;
        console.log("[THROW] " + e.stack);
    }
    sock.end();
    console.log(errors ? `== FAILED (${errors} error(s))` : "== OK");
    process.exit(errors ? 1 : 0);
});
sock.on("error", e => { console.log("socket error: " + e.message); process.exit(1); });
