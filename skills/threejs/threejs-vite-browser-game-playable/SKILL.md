---
name: threejs-vite-browser-game-playable
description: Three.js Vite browser game debugging playbook — pre-flight checks, browser verification workflow, visual QA, input binding standards, and commit discipline.
---

# Three.js Vite browser-game playable workflow

When asked to implement or verify a Three.js browser game in a Vite project:

## 1 Pre-flight
- `node --check src/**/*.js` — syntax gate every file.
- `npm install` then `npm run build` (green).
- `git status` clean on branch; commit restored/template state before diagnosis.
- Verify `index.html` must match Vite entry (`src/main.js`).

## 2 Browser setup
- Open the game in a browser with DevTools available for console inspection and JS evaluation.
- Use the browser's console to inspect live state, trigger events, and verify DOM/canvas.

## 3 Verification sequence (real browser, not headless-only)
1. Load page. Confirm canvas present on pause screen.
2. Press start key (Space). Expect overhead to switch to play state.
3. Fly using AZERTY-safe physical bindings (`event.code`).
4. Measure: distance grew, score accrued, no JS errors shown.
5. Teleport to past biome distance to visually confirm each biome (Asteroid Belt, Nebula Corridor, Wormhole Tunnel).
6. Test collision/death: hit large object → takeDamage → die.
7. Test restart: press restart key → resurrect + reset to pause screen (alive, health MAX, paused).
8. Test persistence: high score appears in localStorage.

## 4 Input binding rule
- Bind by `event.code` (physical position), never `event.key`.
- Document controls by physical position, so AZERTY/QWERTY share the same hand map.
- Chosen layout: Z/S forward/back, Q/D strafe left/right, A/E vertical, Space fire, R restart, M mute, Wheel zoom.
- Flight sticks to mouse yaw/pitch via pointer lock; idle self-level is pitch/roll only, never yaw.

## 5 Camera / FOV standard
- Preferred view: chase/quarter-behind 3rd person so ship appears in lower third of screen.
- Avoid raw clamp-to-[-1,1] steering inputs; use unbounded yaw/pitch accumulator + tanh-bounded per-frame deltas.
- State idle heading rollback as 3-second timer affecting only pitch/roll.

## 6 Visual QA standards
- Render stars as soft round dots at world scale, not square `PointsMaterial`.
- Generate the texture with a radial-gradient `CanvasTexture` reused across `PointsMaterial` draws.
- Bloom: tune thresholds conservatively and cap top brightness to avoid blown-out additive squares.
- Exhaust and impact effects: render with the same soft-dot texture so particles never square out.
- Ship scale and MAX_FOV must keep the ship clearly readable at chase-cam distance and speed.

## 7 Commit and stop discipline
- Playable is not "close enough" — the ship must visibly occupy lower third, biomes must visually differ, restart must work, no console errors.
- Once all three checks green, stage, commit verbose, and offer to write a launcher + skill.
