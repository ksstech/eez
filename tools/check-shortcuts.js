#!/usr/bin/env node
"use strict";
// Syntax-check every JavaScript shortcut in an EEZ Studio instrument extension.
//
// Why this exists: a shortcut's script is stored as a JSON string inside
// package.json and is only compiled when EEZ Studio runs it. A syntax error is
// therefore invisible to json.load(), to git diff, and to the extension build
// -- it surfaces only when a user clicks the button and gets "Invalid or
// unexpected token". That is exactly how a literal newline inside a JS string
// literal shipped in eez-keysight-34465a v1.0.49/v1.0.50.
//
// The check compiles each script inside the SAME wrapper EEZ Studio uses
// (packages/instrument/window/script.ts):
//     const factoryFnCode = `return async (${args}) => {\n${code}\n}`;
//     new Function(factoryFnCode);
// so top-level await is legal here, exactly as it is in a real shortcut.
//
// Usage:
//   node check-shortcuts.js <path-to-package.json> [more...]
//   node check-shortcuts.js --all      # every extension under this repo
//
// Exit code 1 if any script fails to compile.

const fs = require("fs");
const path = require("path");

// The module names EEZ injects into every shortcut (script.ts globalModules).
const ARGS = ["session", "connection", "instrument", "notify", "validators",
              "input", "format", "storage"].join(", ");

function checkPackage(pkgPath) {
    let pkg;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch (e) {
        console.log("  ERROR  cannot parse " + pkgPath + ": " + e.message);
        return { total: 0, bad: 1 };
    }
    const eez = pkg["eez-studio"] || {};
    const shortcuts = eez.shortcuts || [];
    let total = 0, bad = 0;

    for (const s of shortcuts) {
        const a = s.action || {};
        if (a.type !== "javascript") continue;
        total++;
        try {
            new Function("return async (" + ARGS + ") => {\n" + a.data + "\n}");
        } catch (e) {
            bad++;
            console.log("  FAIL   " + s.name + ": " + e.message);
            // Point at the offending line: compile progressively to find it.
            const lines = a.data.split("\n");
            for (let i = 1; i <= lines.length; i++) {
                try {
                    new Function("return async (" + ARGS + ") => {\n" +
                                 lines.slice(0, i).join("\n") + "\n}");
                } catch (inner) {
                    if (!/Unexpected end of input|Unterminated/.test(inner.message)) {
                        console.log("         first bad line " + i + ": " +
                                    JSON.stringify(lines[i - 1].slice(0, 90)));
                        break;
                    }
                }
            }
        }
    }
    // Sanity checks that are cheap and catch real mistakes.
    for (const s of shortcuts) {
        const a = s.action || {};
        if (a.type === "javascript" && /\bconnection\.acquire\b/.test(a.data) &&
            !/connection\.release\(\)/.test(a.data)) {
            console.log("  WARN   " + s.name + ": acquires the connection but " +
                        "never calls connection.release()");
        }
    }
    return { total, bad };
}

let targets = process.argv.slice(2);
if (targets.length === 0 || targets[0] === "--all") {
    const root = path.join(__dirname, "..");
    targets = [];
    for (const d of fs.readdirSync(root)) {
        for (const cand of [path.join(root, d, "package.json"),
                            path.join(root, d, "eezstudio", "package.json")]) {
            if (fs.existsSync(cand)) {
                try {
                    const p = JSON.parse(fs.readFileSync(cand, "utf8"));
                    if (p["eez-studio"] && p["eez-studio"].shortcuts) targets.push(cand);
                } catch (e) { /* not an extension manifest */ }
            }
        }
    }
}

let grandTotal = 0, grandBad = 0;
for (const t of targets) {
    const rel = path.relative(path.join(__dirname, ".."), t) || t;
    console.log("== " + rel);
    const { total, bad } = checkPackage(t);
    grandTotal += total; grandBad += bad;
    if (bad === 0) console.log("  OK     " + total + " javascript shortcut(s) compile");
}
console.log("\n" + "=".repeat(60));
console.log(grandBad === 0
    ? "ALL GOOD: " + grandTotal + " shortcuts compile across " + targets.length + " extension(s)"
    : "FAILURES: " + grandBad + " of " + grandTotal + " shortcuts do not compile");
console.log("=".repeat(60));
process.exit(grandBad ? 1 : 0);
