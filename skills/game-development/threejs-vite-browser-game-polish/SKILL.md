--- 
name: threejs-vite-browser-game-polish
description: >
  Class-level skill for evolving an existing Vite + Three.js browser game repo
  toward a verified playable. Covers scaffolding, controls, collision rules,
  biome spacing, start-screen ship selection, NPC encounters, commit
  discipline, and browser verification protocol.
tags:
  - threejs
  - vite
  - browser-game
  - gamebalancing
  - playable
related_skills:
  - threejs-vite-browser-game-playable
---

# Three.js Vite browser-game polish

Use when working inside an existing Vite + Three.js browser game repo and the goal is
to ship a playable build with verified systems, not just scaffold.

## Trigger
- The project already has `index.html`, `vite.config.*`, and `src/` modules.
- You are changing gameplay systems, controls, visuals, or UI.
- You are adding ship selection, NPC behavior, biome spacing, or lethality rules.
- You are asked to verify browser behavior, not only syntax.

## Repo conventions
- Git root is usually outside the project dir; cd to the project when staging/committing.
- Touch only `src/` plus `index.html`; `play.sh` is okay but not required.
- Run `node --check src/**/*.js` before committing every gameplay change.

## Control-scheme policy (user preferences)
- Bind by `event.code`; never `event.key`.
- Arrow keys = gyroscopic pitch/yaw/roll.
- Shift = accelerate, Space = brake/reverse.
- F / left click = fire.
- M = mute, R = restart/after-death respawn.
- Mouse via pointer lock is alternative yaw/pitch only.
- No idle auto-leveling unless explicitly requested.

## Camera / FOV policy
- Use chase/quarter-behind 3rd-person so the ship sits in the lower screen third.
- Keep MAX_FOV under 90, use ship scale ~1.35 for readability.
- Mouse-wheel zoom is available; do not clamp steering inputs to [-1, 1].

## Visual QA policy
- Stars and particles must use a soft radial-gradient canvas texture.
- Avoid blown-out additive squares: cap bloom and emissive intensities.
- Ship visibility must be preserved at speed with elevated scale.

## Visual event systems
### Shooting stars
- Replace static position clouds with a moving “trail + head glow” system:
  - One `Points` for the trailing ribbon; one `Sprite` for the white-hot head.
  - Per-frame, advance the whole streak object, then shift the ribbon’s vertex array so the head becomes the new leading vertex — gives a visible extending tail.
  - Fade opacity with `1 - Math.pow(age/life, 2)` and soften scale instead of a hardcut.

### Wormhole cylinders
- Never rely on a single thin cylinder. Use an **outer shell + inner core** with different radii, color mixes, and `side: BackSide/DoubleSide` respectively. This preserves readability at speed.
- Increase length and cross-section vs. base chunk size and raise poly counts on both meshes so shader detail survives rasterization.
- Animate both materials’ `uTime` each frame, and dispose both geometries/materials on eviction.

### Distant shooting stars / comet trails
- Do not spawn meteors near the ship; they will look like cockpit-local effects.
- Place origins in a **far shell**: thousands of units away, mostly biased away from the ship, with optional upward offset to read as “from above”.
- Make comet tails **longer than near-field intuition suggests**: at those distances a 18-unit tail compresses to nothing; use a 140+ unit ribbon so it still reads as a streaking meteor.
- Use a trailing birth effect: each frame shift the vertex array back and write the current head position at index 0, so the streak visibly extends behind the head glow.

## Gameplay rule changes
### Planet collision
- Planet meshes must carry `userData.kind === 'planet'` and `userData.radius`.
- `ChunkManager.getCollidables()` must include planets.
- `PhysicsSystem.checkShipCollisions()` must label planet hits `kind:'planet'`.
- `Game` loop must treat planet hits as `GameState.takeDamage(Constants.HEALTH.MAX)` → guaranteed game over.

### Collidables wiring
- When adding a new collidable subsystem, pass it through the subsystem bundle to `ChunkManager` and add a safe-read block: `const planets = this._sub.planets && this._sub.planets._planets;` then iterate. Never assume `this._planets` exists on the manager — that name belongs to `PlanetManager` on a different object, so the reference usually `undefined`-dereferences and silently drops collisions.

## Bug taxonomy: gameplay / scoring
- **Distance typing bug:** if distance accumulation reads from a mistyped delta variable, the value can collapse to 0 or become noisy. Use precomputed `dx,dy,dz` from current−previous position and sum absolute values.
- **Planet non-collision:** if planets aren’t injected into `getCollidables()`, ship-vs-world never detects them, so the guaranteed-kill planet brush appears to do nothing. Run collision QA after any refactor touching `ChunkManager` locals or the subsystem bundle.

### Biome spacing
- Content should stream before the player reaches it. Doubling `CHUNK.SPAWN_AHEAD`/`CLEANUP_BEHIND` is preferred over chasing sight-distance only.
- Biome zone bounds can be widened; double zone lengths together with `CYCLE_LENGTH` and `INTENSITY_DIVISOR` to keep transition pacing.

### Wandering NPCs
- Deterministic grid spawn is fine but must coexist with random near-path wanderers.
- `NPCShipManager.update()` should run a per-second diced random spawn near the flight path.
- Wanderers share the existing mesh + trail + wander systems; keep `MAX_COUNT` hard.

## Start screen / ship selection
- Store ship choice in `GameState.game.selectedPreset`.
- `PlayerShip` must accept a preset, use it for colors and scale, and expose `setPreset()` to swap after death without tearing systems.
- StartScreen should mount before first launch and not leave ghost overlays on death/restart.
- Space/F from start screen should either confirm selection or launch when one is active.

## Browser verification sequence
1. Start screen: 4 ship cards render, click sets preset, space launches.
2. Flight: ship visible lower third, soft stars, biomes feel distinct.
3. Planet contact: single hit → death.
4. Wandering ships: appear in flight without teleporting.
5. Restart after death: returns to clean state, retains selection intent.
6. Persistence: high score loads/saves.
7. Console: zero JS errors.

## Commit discipline
- One logical change per commit when possible.
- Commit messages describe rule/behavior change, not just file names.
- Once the above checks are green, stop.

## references/
For project-specific constants, ship presets, and reproduction recipes, append short
reference notes under `references/`.