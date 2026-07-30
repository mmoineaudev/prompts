# Prompt 04: Pixel Sentinel — "Neon Lanes"

## Role
You are an expert browser game developer. Create a self-contained web-based tower defense prototype using Three.js, built for long-term progression and retro-sci-fi spectacle. Deliver as a Vite + Three.js project with ES modules.

## Core Concept
"Pixel Sentinel" is a grid-based tower defense on a neon-drenched retro-future grid. Players place towers along a winding path that is generated procedurally through a connected tile grid, route enemies through it, and survive indefinitely scaling waves of enemies. The twist: every component is interactive, the map breathes with smoke-like volumetric shaders, and the difficulty curve is governed by a global wave coefficient that increases money and enemy complexity together.

## Technical Architecture

```
project/
├── index.html                  ← Vite entry: canvas + HUD overlay
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                 ← Bootstrapper: creates Game instance
│   ├── core/
│   │   ├── Constants.js        ← All magic numbers, colors, timings, tower/enemy/wave config
│   │   ├── EventBus.js         ← Singleton pub/sub (domain:action events)
│   │   ├── GameState.js        ← Centralized state singleton with makeInitialState/reset
│   │   └── Game.js             ← Orchestrator: init systems, RAF loop, pause, restart, shutdown
│   ├── systems/
│   │   ├── InputSystem.js      ← Keyboard bindings (event.code), mouse, wheel, right-click suppress
│   │   ├── RenderSystem.js     ← Three.js renderer, scene, camera, resize/render, HiDPI
│   │   ├── PostProcessingSystem.js  ← EffectComposer, UnrealBloomPass, OutputPass
│   │   ├── WaveManager.js      ← Wave scheduling, boss cadence (every 5 waves), coefficient scaling
│   │   ├── EconomyManager.js   ← Money, kill rewards, sell-back (60%), wave bonus, milestones
│   │   ├── PathSystem.js       ← Randomized DFS path generation, mesh ribbon, tile visualization
│   │   ├── TowerManager.js     ← Tower placement, targeting, upgrade (3 levels), sell
│   │   ├── EnemyManager.js     ← Spawning, 7 mob types + 3 boss types, movement along path
│   │   ├── ProjectileSystem.js ← Projectile spawning, movement, collision routing
│   │   ├── CollisionSystem.js  ← Hit-testing projectile↔enemy, boss↔tower
│   │   ├── ParticleSystem.js   ← Smoke, hits, explosions, death effects
│   │   ├── AudioSystem.js      ← Procedural SFX via Web Audio API oscillator beeps
│   │   ├── ContextMenuSystem.js← Right-click folding HTML menus on towers/enemies/tiles
│   │   ├── GameplaySystem.js   ← Bridges input → game actions (placement, selection, menu triggers)
│   │   ├── StarfieldSystem.js  ← Background starfield/ambient particles
│   │   ├── VisualFX.js         ← Screen shake, damage flash, boss indicators
│   │   └── ModelFactory.js     ← Procedural tower/enemy mesh generation
│   ├── ui/
│   │   ├── HUD.js              ← DOM overlay: money, wave, leaks, selected tower, speed
│   │   ├── TooltipMenu.js      ← Hover tooltips for towers/enemies
│   │   ├── DeathOverlay.js     ← Game over screen: wave reached, stats, restart
│   │   ├── PauseOverlay.js     ← Pause screen: economics summary, stats
│   │   └── ContextMenu.js      ← Right-click folding menu: upgrade/sell/target priority/range toggle
│   └── styles/
│       └── game.css
```

### Game Loop Architecture
Single RAF loop with delta-time clamped to 0.1s max. Pause halts all gameplay systems; rendering, post-processing, and HUD continue.

```js
class Game {
  constructor(containerId) { this._isRunning = false; this._isPaused = false; this._lastTime = 0; this._speed = 1; }
  init() { /* create GameState, init all systems, wire EventBus, start loop */ }
  _animate() {
    if (!this._isRunning) return;
    requestAnimationFrame(() => this._animate());
    const dt = Math.min((performance.now() - this._lastTime) / 1000, 0.1);
    this._lastTime = performance.now();
    this._updateInput();
    if (!this._isPaused) {
      this._updateGameplay(dt * this._speed);
      this._updateSystems(dt * this._speed);
    }
    this._updatePostProcessing(dt);
    this._updateHUD();
    this._render();
  }
  togglePause() { this._isPaused = !this._isPaused; EventBus.emit(Events.UI_PAUSE_CHANGED, this._isPaused); }
  restart() { /* full cleanup + reinit */ }
  shutdown() { /* remove all listeners, dispose Three.js resources, cancel RAF */ }
}
```

Speed controls: 1× / 2× / 4× via UI buttons. Only affects gameplay dt, not render frame rate.

### EventBus + State

Events use `domain:action` naming:
- `game:paused`, `game:resumed`, `game:restart`, `game:over`
- `economy:changed` { money, reason }, `economy:towerSold` { refund }
- `wave:started` { wave }, `wave:ended` { wave }, `wave:bossIncoming` { bossType }
- `enemy:spawned` { enemy }, `enemy:killed` { enemy, reward }, `enemy:leaked`
- `tower:placed` { tower }, `tower:sold` { tower }, `tower:upgraded` { tower, level }
- `menu:open`, `menu:close`
- `path:rebuilt`
- `ui:pauseChanged` { paused }, `ui:setSpeed` { speed }, `ui:regenerateMap`

GameState centralizes: money, wave, lives (leaks), grid, path, towers, enemies, projectiles, particles, stats, selected tower, pause state, game-over flag.

### Camera
Fixed isometric view from above (camera at position (0, 50, 0), looking at grid center (GRID_COLS×TILE_SIZE/2, 0, GRID_ROWS×TILE_SIZE/2)). Near 0.1, far 600. Wheel zoom (range 12–80 units altitude). Middle-click drag to pan (no clamp on offset).

### Post-Processing
- **EffectComposer** with RenderPass + UnrealBloomPass + OutputPass
- Bloom: threshold 0.4, strength 0.7, radius 0.5
- No ChromaticAberration or FilmGrain (keep simple, performant)

### Delta-Time Pattern
All movement, cooldowns, and timers use `dt` in seconds. Clamp dt to 0.1s max to prevent physics explosions on tab-switch.

### Shader Composition
Custom ShaderMaterial for smoke path halo: `varying vec2 vUv;` + `uniform float uTime;` for noise sampling. Animate only `uTime` per frame. One ShaderMaterial per effect, reuse where possible.

## Controls

All keyboard input uses **event.code**:
- **Space** — pause/resume (prevent default scroll)
- **Left-click** — place tower (if type selected + valid tile) / select entity
- **Right-click** — open folding context menu on tower/enemy/tile (suppress browser menu)
- **Middle-click drag** — pan camera
- **Mouse wheel** — zoom in/out
- **1–0 keys** — quick-select tower types 1–10 (0 = type 10)
- **Escape** — deselect tower type / close menu

No AZERTY-specific issues — only Space uses keyboard.

## Grid & Camera Constants

```js
export const GRID_COLS = 56;
export const GRID_ROWS = 40;
export const TILE_SIZE = 1;
export const PATH_WIDTH = 1;
export const START_TILE = { qx: 0, qy: Math.floor(GRID_ROWS/2) };
export const END_TILE = { qx: GRID_COLS - 1, qy: Math.floor(GRID_ROWS/2) };
export const CAMERA = {
  position: { x: 0, y: 50, z: 0 },
  lookAt: { x: 28, y: 0, z: 20 },         // grid center
  near: 0.1, far: 600,
  panSpeed: 18, zoomSpeed: 12,
  minZoom: 12, maxZoom: 80,                // altitude range
};
export const COLORS = {
  bg: '#05060d',
  gridDim: 0x111827,
  gridLine: 0x1f2937,
  pathBase: '#0a1325',
  pathGlow: '#00d4ff',
  pathEdge: '#7df9ff',
  buildable: '#0f172a',
  smoke: '#8b5cf6',
  buildableHover: '#1d4ed8',
  towerEmissive: '#00ffcc',
  projectile: '#bf00ff',
  towerStrong: '#ffcc00',
  bossStrong: '#ff3300',
  pauseBg: 'rgba(0,0,0,0.45)',
};
```

## Gameplay Mechanics

### Towers (10 types)

| # | Name | Cost | Range | Rate | Dmg | Proj Speed | Special | Color |
|---|------|------|-------|------|-----|-----------|---------|-------|
| 0 | Pulse Emitter | 25 | 6.5 | 0.35s | 1 | 28 | — | #22d3ee |
| 1 | Arc Spool | 55 | 5.5 | 0.55s | 1 | 22 | Arcs to 2 nearby enemies (chain range 3) | #a78bfa |
| 2 | Rail Sentry | 75 | 13 | 1.4s | 5 | 50 | — | #f9a8d4 |
| 3 | Plasma Mortar | 95 | 6.5 | 0.9s | 3 | 14 | Splash 1.8 radius | #fbbf24 |
| 4 | Frost Core | 110 | 5.2 | 0.65s | 1 | 24 | Slow 45% for 2s on hit | #67e8f9 |
| 5 | Beam Harvester | 130 | 9 | 0.08s tick | 4 | 0 (hitscan) | Continuous beam, damage ramps 0.5×→2× over 3s on same target | #34d399 |
| 6 | Tesla Coil | 145 | 7.5 | 0.75s | 2 | 36 | Chains to 3 enemies (chain range 3) | #e2e8f0 |
| 7 | Railgun Array | 190 | 16 | 2.6s | 10 | 60 | 2 parallel shots | #f472b6 |
| 8 | Ion Storm | 240 | 5.8 | 0.55s | 1.5 | 20 | Splash 2.4, slow 30% + 1dps burn for 3s | #f59e0b |
| 9 | Singularity | 420 | 10 | 3.5s | 0.5 | 16 | Gravity pull toward center, splash 6.5 | #ffffff |

**Targeting priority** (per-tower, via context menu): First, Last, Strongest, Closest.

**Upgrades**: 3 levels. Cost = `floor(baseCost × (0.9 + 0.55 × upgradeLevel))`. Stats scale: damage ×(1 + 0.35×level), range ×(1 + 0.12×level), rate ×(1 - 0.08×level).

**Sell-back**: 60% of cumulative investment (base + all upgrade costs).

### Enemies (7 mobs + 3 bosses)

| # | Name | HP | Speed | Reward | Scale | Type | Special |
|---|------|-----|-------|--------|-------|------|---------|
| 0 | Drone | 10 | 2.0 | 10 | 0.32 | mob | Fast, fragile |
| 1 | Grunt | 18 | 1.5 | 15 | 0.38 | mob | Standard |
| 2 | Shield Bearer | 28 | 1.3 | 20 | 0.42 | mob | 25% front damage reduction |
| 3 | Sprinter | 14 | 2.2 | 13 | 0.30 | mob | High speed |
| 4 | Splitter | 24 | 1.5 | 18 | 0.36 | mob | Splits into 2 half-HP copies on death |
| 5 | Tank | 55 | 0.9 | 30 | 0.52 | mob | 15% armor |
| 6 | Teleporter | 20 | 1.8 | 17 | 0.34 | mob | Short-range warp along path |
| 7 | Warlord | 300 | 1.0 | 160 | 0.90 | boss | Charges nearest tower, deals 30 AOE dmg to towers in range 2 |
| 8 | Mothership | 400 | 0.7 | 200 | 1.05 | boss | Spawns 3 Drones every 5s while alive |
| 9 | Core | 600 | 0.0 | 250 | 1.10 | boss | Stationary, shield zone radius 14 (50% dmg reduction to all enemies inside) |

**HP scaling per wave**: `hp × (1 + (wave - 1) × 0.20)`. Same formula for all enemies including bosses.

**Boss spawn**: every 5 waves (5, 10, 15, …). Boss waves replace standard spawn queue with 1 boss + reduced mob escort (50% of normal count).

**Enemy introduction schedule**:
- Waves 1-2: Drone only
- Wave 3+: Grunt
- Wave 5+: Shield Bearer + Warlord (boss at wave 5)
- Wave 7+: Sprinter + Splitter
- Wave 10+: Tank + Teleporter + Mothership (boss at wave 10)
- Wave 15+: Core (boss at wave 15)

### Wave System

- Waves are continuous; difficulty never resets
- Wave number `W` is the global coefficient
- **Enemy count**: `floor(4 + (W - 1) × 0.5)` enemies per wave
- **Spawn interval**: `max(0.4, 1.2 - W × 0.02)` seconds between enemies
- **Kill reward**: `max(1, W) × enemy.reward` (tier multiplier built into reward stat)
- **Wave bonus**: 15 credits at end of each wave
- **Milestone bonus**: 100 credits every 10 waves
- Boss waves (every 5): 2× wave bonus + 1 boss + half mobs

### Economy

- Starting money: 132 (enough for 2-3 early towers)
- Kill reward: `W × enemyBaseReward`
- Wave completion bonus: 15
- Milestone bonus (every 10 waves): 100
- Tower sell-back: 60% of total invested (base + upgrades)
- HUD shows money, wave number, leaks remaining

### Lives / Leaks

- **20 leaks** = game over
- Displayed as "LEAKS: X/20" in HUD
- Boss leak = 3 leaks (to make boss escapes meaningful)
- On death: DeathOverlay shows wave reached, stats summary, "Press Space or click to restart"

## Procedural Path Generation

### Grid Coordinate System
- 2D square grid `(qx, qy)` in world XZ space
- World position: `x = qx × TILE_SIZE`, `z = qy × TILE_SIZE`
- Tower placement snaps to tile center, rejected if tile is occupied, blocked, or not buildable

### Buildable Tiles
Tiles with Manhattan distance ≤ 1 from any path tile (excluding path tiles themselves). Towers can only be placed on buildable tiles. One tower per tile.

### Path Generation Algorithm
1. Start tile: left edge center `(0, GRID_ROWS/2)`. End tile: right edge center `(GRID_COLS-1, GRID_ROWS/2)`.
2. Randomized DFS: carve primary corridor from end to start via random-walk, choosing cardinal neighbors uniformly. Remove cycles by retracing and replacing loops.
3. Branch creation: traverse corridor, with probability **P_BRANCH = 0.3** extend side branch of 2–6 tiles. Branches do not branch again.
4. Result: 4-connected graph, no isolated islands, minimum width 1 tile.
5. Validate: BFS from start to end. On failure, regenerate.

### Path to Mesh
Convert tile centers into Catmull-Rom spline. Build mesh ribbon around spline by extruding fixed-width band (PATH_WIDTH = 1 tile) in XZ plane. Wrap with translucent smoke shell using custom fragment shader (time-varying noise, alpha-blended).

### Tile Rendering
- Path tiles: emissive wireframe band with smoke shell
- Buildable tiles: dim grid squares, glow faintly on hover (`buildableHover` color)
- Non-buildable tiles: dim grid lines only

## Visual Design
- Dark background (#05060d) with neon grid floor
- Emissive materials + post-processing bloom on all neon elements
- Path: glowing wireframe strip with fog-like semi-transparent smoke shell
- Camera: fixed isometric with wheel zoom + middle-click pan
- Particle effects on hits, explosions, tower fire, enemy death
- Starfield background: subtle star particles for depth
- Tower models: procedurally generated from composite geometries, color-matched per type
- Enemy models: scaled simple geometries with emissive color materials
- Bosses: 2-3× larger scale, bossStrong color accent, health bar drawn above model

## UI / Overlays

### HUD (top bar, DOM overlay)
- Left: MONEY (with change indicator), WAVE number, LEAKS X/20
- Right: selected tower info (name, cost, stats), speed buttons (1×/2×/4×)

### Context Menu (right-click, folding HTML panel)
On towers: Upgrade (cost + stat preview) / Sell (refund shown) / Target Priority (First/Last/Strongest/Closest) / Toggle Range Preview
On enemies: Show HP / Show type / Highlight path
On tiles: Place Tower (if buildable + type selected) / Cancel

### Death Overlay
- "GAME OVER" title
- Wave reached, enemies killed, towers built, money earned
- "Press Space or click to restart"

### Pause Overlay
- "PAUSED" title
- Current wave, money, leaks
- Stats: towers built, enemies killed, total earned
- Resume button

## Canvas & Rendering
- Full-window canvas with responsive resize handler
- HiDPI support via `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- Maintain aspect ratio; black bars if window doesn't match
- Renderer: WebGLRenderer with antialias, alpha false, outputColorSpace SRGB

## Audio (Web Audio API oscillator beeps, minimal)
- Tower fire: short high-pitched blip (pitch varies by tower type)
- Enemy death: descending pitch chirp
- Enemy leak: low warning tone
- Wave start: rising arpeggio (3 notes)
- Boss incoming: low rumble + alarm pulse
- Game over: descending tone sweep
- All sounds are short (< 200ms) oscillator beeps, no samples

## Progression and Endgame
- No level cap; waves continue with sustained difficulty
- Milestone bonuses every 10 waves (100 credits)
- Stats tracked: towersBuilt, enemiesKilled, moneyEarned, wavesSurvived
- Game over: 20 leaks
- Restart: full cleanup + regeneration (new path, fresh state)

## Scope Constraints
- Do NOT implement: multiplayer, account systems, asset downloads, touch controls (desktop-first)
- DO: robust input with right-click suppression, event.code
- Canvas: performant on mid-range hardware (target 60fps)
- All visuals procedural

## Verification and Build
- `npm run dev` serves with HMR
- `npm run build` produces production bundle
- All JS files pass `node --check`
- Restart 3× in a row for deterministic state

## Acceptance Criteria
- [ ] Three.js scene with neon aesthetic, bloom, and smoke-style path halo
- [ ] Path generated procedurally each run, drawn as walkable tile strip + mesh ribbon
- [ ] Tower placement snaps to tile grid, rejected on invalid tiles (off-path, occupied, blocked)
- [ ] 10 tower types placeable, upgradeable (3 levels), sellable (60%), visually distinct
- [ ] 10 enemy types (7 mobs + 3 bosses), bosses every 5 waves
- [ ] Wave coefficient scales enemy count (4 + 0.5×W) and kill reward (W × baseReward)
- [ ] Space pauses/resumes cleanly, no systems mutate during pause
- [ ] Right-click opens folding context menu on towers/enemies/tiles
- [ ] Warlord damages towers in range (30 AOE dmg)
- [ ] Game over after 20 leaks; stats summary shown
- [ ] Restart works cleanly 3× in a row
- [ ] All visuals procedural, no external images
- [ ] HiDPI + responsive resize
- [ ] Speed controls 1×/2×/4× functional