# eez

Shared reference material for building EEZ Studio instrument extensions —
patterns, helpers, and platform-level notes that apply across multiple
instruments, rather than to any single one.

## Scope

This repo is **not** where instrument-specific extensions or their built zips
live. Each instrument has its own self-contained repo, with source in the repo
and the built `.zip` published as a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github)
asset on that repo — clone or download from there directly, no need to visit
this repo at all just to get one instrument working.

| Instrument | Repo |
|---|---|
| EA-PS2000B series power supply | [ksstech/eez-ea-ps2k](https://github.com/ksstech/eez-ea-ps2k) |
| Keysight 34465A DMM | [ksstech/eez-keysight-34465a](https://github.com/ksstech/eez-keysight-34465a) |
| Rigol MHO98 oscilloscope | [ksstech/eez-rigol-mho98](https://github.com/ksstech/eez-rigol-mho98) |
| Rigol DHO924S oscilloscope | [ksstech/eez-rigol-dho924s](https://github.com/ksstech/eez-rigol-dho924s) |

What belongs here instead:

- **[docs/eez-live-toast-pattern.md](docs/eez-live-toast-pattern.md)** — the
  continuous live-readout toast pattern used by every instrument's "Live"
  shortcut (persistent toast, 100ms poll loop, multi-line CSS fix).
- **[docs/qts-helper.md](docs/qts-helper.md)** — the `qts()` query-result
  normalizer copy-pasted into every JavaScript shortcut across all four
  instrument extensions.
- Notes on EEZ Studio version quirks and behavior that isn't obvious from its
  own docs (e.g. `console.log()` producing no output in the 0.28.0 script
  sandbox, `notify.update()` vs dismiss+recreate).
- Tracking of upstream `eez-open/studio` issues filed as a result of building
  these extensions.

## Release workflow (for maintaining the instrument repos)

Each instrument repo builds its own zip from its `package.json`/`.idf`/`.sdl`
files and publishes it as a tagged GitHub Release — the zip itself is
`.gitignore`'d in the source tree, not committed, so repo size and history
stay clean across versions:

```bash
# from inside the instrument's repo, after bumping the version in package.json
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z path/to/built.zip --title "vX.Y.Z" --notes "..."
```

## History note

This repo previously archived every instrument's built zip directly (plus one
unrelated backup zip that had already drifted here by mistake). That caused
real staleness — some archived zips fell up to 22 versions behind their
source before anyone noticed, because publishing here was a manual step
separate from the actual release. Moved to per-repo GitHub Releases instead
so there's exactly one place each artifact can live, with no manual
sync step to forget.
