# Installing an EEZ Studio extension from this family

Applies to all four instrument repos (`eez-ea-ps2k`, `eez-keysight-34465a`,
`eez-rigol-dho924s`, `eez-rigol-mho98`). No script, no terminal — just
downloading the right file and pointing EEZ Studio at it.

## 1. Install EEZ Studio itself

Download from **[eez-open/studio releases](https://github.com/eez-open/studio/releases/latest)**
(not from any of the ksstech repos — EEZ Studio is a separate upstream app):

- **macOS**: `EEZ.Studio-X.Y.Z-arm64.dmg` (Apple Silicon) or `EEZ.Studio-X.Y.Z.dmg` (Intel)
- **Windows**: `EEZ-Studio-Setup-X.Y.Z.exe`
- **Linux**: `.AppImage`, `.deb`, or `.rpm`, depending on your distro

## 2. Download the extension zip — the two mistakes to avoid

On each instrument repo's GitHub page, go to **Releases** and download the
`.zip` listed under **Assets** for the latest version (e.g.
`rigol_mho98-1.0.4.zip`).

**Mistake #1 — the wrong download button.** Don't use the green **"Source
code (zip)"** button at the top of the Releases page. That downloads the
entire git repository (README, docs, and for `eez-ea-ps2k` the Python
bridge/driver too) wrapped in an extra folder — not the flat extension zip
EEZ Studio expects. Use the file listed under **Assets**, further down the
page.

**Mistake #2 — Safari silently unzips it.** macOS Safari has "Open 'safe'
files after downloading" on by default, and treats `.zip` as safe — so it
auto-extracts every zip you download and deletes the original, leaving you
with a folder instead. If you get a folder instead of a `.zip`:
- Turn it off: Safari → Settings → General → uncheck **"Open 'safe' files
  after downloading"**, then re-download, **or**
- Re-zip what you have: open the extracted folder, select its *contents*
  (not the folder itself), right-click → **Compress**. Compressing the
  folder itself instead of going inside it first re-creates the same
  problem one level down.

## 3. Verify before installing (optional but cheap)

A correct zip has `package.json` sitting at the top level — not inside a
subfolder:
```
rigol_mho98-1.0.4.zip
├── package.json
├── rigol_mho98.idf
├── rigol_mho98.sdl
└── image.png
```
If `package.json` is one level deeper than that, EEZ Studio's installer
fails with **"Failed to read description"** — that error means exactly
this, nothing else. Re-check steps 2's two mistakes above.

## 4. Install in EEZ Studio

**Extensions Manager → Install → Install from file...**, pick the zip.
Repeat for each instrument you want.

## For maintainers: building a release zip

Each repo has its own `build-extension-zip.py` (Python 3, stdlib only —
runs identically on macOS/Windows/Linux). It reads the version straight out
of `package.json` and always writes a flat zip, so it can't produce the
nested-folder mistake above:
```bash
python3 build-extension-zip.py
```
