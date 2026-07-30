# Tower Defense Bootstrap — Vite + Three.js

## What this is
A reproducible baseline for a grid-based tower-defense prototype built with Three.js in a Vite project rather than a single `.html`. Use this when the user asks for a tower-defense game specifically, or when the request is a multi-file browser game with ESM modules.

## Prereqs + verify
```bash
cd <project-root>
npm create vite@latest . -- --template vanilla
npm install three
node --check src/main.js
npm run build
npm run dev
```
HTTP verify: `curl -I http://localhost:5173/` must return `200 OK` before opening a browser.

## Repo skeleton the user expects
- `index.html` → `<canvas id="gameCanvas">`, `#hud`, `#pauseOverlay`, `#tooltipMenu`, `#contextMenu`, `#deathOverlay`
- `src/main.js` tiny boot
- `src/game.js` or `src/core/Game.js`
- `src/styles/game.css`

## Critical Vite/Three.js wiring
When using Vite + npm-installed Three.js: **do NOT use an importmap.** Vite resolves bare specifier imports (`import * as THREE from 'three'` and `import { ... } from 'three/addons/...'`) directly from `node_modules/`. An importmap with explicit paths like `"three": "three/build/three.module.js"` conflicts with Vite's resolution and produces "Ignored an import map value" warnings in the console.

Correct `index.html` script entry (no importmap needed):
```html
<script type="module" src="/src/main.js"></script>
```

Correct `package.json` deps:
```json
{
  "dependencies": { "three": "^0.170.0" },
  "devDependencies": { "vite": "^6.0.0" }
}
```

In your ES modules, use bare imports:
```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
```

Avoid `npm create vite` defaults that create `style.css` when the game needs a custom root stylesheet; either delete or rename conflicting files.

## Three.js circuit-breaker rule
If `build` succeeds and `dev` returns HTTP 200 but the browser shows a blank page with empty element_count:
1. First assume the script **never executed**, not that it failed silently.
2. Drop a visible DOM probe into `main.js`:
   ```js
   const el = document.createElement('pre');
   el.textContent = 'MAIN_SYNTAX_OK';
   document.body.appendChild(el);
   ```
3. If HTML serves but the probe is missing, the module evaluation is dead before any app code runs.
4. If the probe appears, the renderer is the likely problem; instrument with window globals.

## Browser tool optimization
- `browser_console` empty-page reads are unreliable under some CDP backends; do not loop on them.
- Prefer `Target.getTargets` to confirm you are on the right tab, then use page-level commands scoped by `target_id`.
- If `browser_cdp` is exhausted, verify resource delivery with `curl`/source fetch of `/src/main.js` rather than re-navigating.

## Retrofit rule
If the project shipped detailed class files that are now partial or broken:
- Add a single self-contained `src/game.js` that imports only the constants it needs.
- Keep `src/main.js` as a one-line bootstrap: `import './game.js';`
- Delete or box the class layout to avoid import cycles from systems that never wired up.