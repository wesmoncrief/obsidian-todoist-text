# Building the Todoist Text Obsidian Plugin

## Prerequisites
- Node.js (v18+ recommended) and npm installed.
- Git clone the repo: `git clone https://github.com/wesmoncrief/obsidian-todoist-text.git` (or your fork).
- Navigate to repo root: `cd obsidian-todoist-text`.

## Steps to Build
1. **Install Dependencies** (one-time or after clean):
   - Run: `npm install`
   - This installs dev deps (TypeScript, esbuild, etc.) and prod deps (`@doist/todoist-api-typescript`, etc.).
   - Expect ~700 packages; warnings about deprecated tools (e.g., standard-version) are safe to ignore.
   - If errors, delete `node_modules` and `package-lock.json`, then retry.

2. **Development Build (Watch Mode)**:
   - Run: `npm run dev`
   - Builds to `dist/main.js` and watches for changes (auto-rebuilds on save for quick testing).
   - Useful during development; run in terminal while editing.

3. **Production Build**:
   - Run: `npm run build`
   - Full script: `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`
     - `tsc`: TypeScript type-check (no emit; skips lib checks for speed).
     - `esbuild`: Bundles/minifies to single `dist/main.js` (tree-shaken, ~363 KB).
   - Output: `dist/main.js` (Obsidian-compatible JS).
   - If TS errors (e.g., type mismatches), fix code and retry.

4. **Version Bump** (for releases):
   - Run: `npm run version` (updates `manifest.json` and `versions.json` via `version-bump.mjs`).
   - Or: `npm run release` (uses standard-version for changelogs/commits).

## Troubleshooting
- **tsc not found**: Run `npm install` first (installs TypeScript globally-ish via node_modules).
- **Build Fails**: Check console for TS errors (e.g., undefined vars like 'projectMap'). Ensure imports match library types.
- **No main.js**: Build failed; check logs. Clean with `rm -rf dist node_modules` and reinstall.
- **Esbuild Issues**: Update deps if needed, but library uses v0.15.18 (stable).
- **Platform**: Tested on Linux/macOS; Windows may need WSL/npm adjustments.

## Post-Build: Install in Obsidian
1. Copy `manifest.json` (repo root) and `dist/main.js` (rename to `main.js`) to your vault's `.obsidian/plugins/todoist-text/`.
2. In Obsidian: Settings > Community plugins > Reload > Enable "Todoist Text".
3. Test: Add keyword (e.g., `@@TODOIST@@`), run "Replace keyword with todos" command.

For CI/CD, add to GitHub Actions if needed. Build time: <1s on modern hardware.

Last Updated: 2025-09-30
