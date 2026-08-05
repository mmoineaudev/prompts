# Dungeon Crawler — Visual Showcase

A first-person atmospheric dungeon exploration demo built with Three.js + Vite. Zero combat, pure atmosphere — a walking sim through procedurally generated torch-lit corridors and chambers designed to showcase the full visual potential of Three.js.

## Tech Stack
- Three.js (ES modules via npm)
- Vite (build tool)
- No external game framework — raw Three.js

## Visual Feature Checklist (in priority order)

| # | Feature | Three.js API | Visual impact |
|---|---------|-------------|---------------|
| 1 | Torch shadow-casting lights | `PointLight` + `castShadow`, PCF soft shadows | ⭐⭐⭐⭐⭐ |
| 2 | Bloom post-processing | `UnrealBloomPass` (EffectComposer) | ⭐⭐⭐⭐⭐ |
| 3 | Floating dust particles | `Points` + custom circular texture, lit by nearby torches | ⭐⭐⭐⭐ |
| 4 | Emissive wall runes | `MeshStandardMaterial.emissive` + `emissiveIntensity`, sine-wave animation | ⭐⭐⭐⭐ |
| 5 | Vignette | `ShaderPass(VignetteShader)` | ⭐⭐⭐ |
| 6 | Distance fog | `scene.fog` (exponential) | ⭐⭐⭐ |
| 7 | Water puddle reflections | `MeshStandardMaterial` with low roughness + envMap, or simple mirror plane | ⭐⭐⭐ |
| 8 | God-ray light shafts | Semi-transparent cone meshes + additive blending below torches | ⭐⭐⭐ |
| 9 | Chromatic aberration | `ShaderPass(ChromaticAberrationShader)` at screen edges | ⭐⭐ |
| 10 | Glowing collectible orbs | Emissive spheres with bloom, floating bobbing animation | ⭐⭐ |

## Controls

Bind by `event.code` for cross-layout compatibility:

| Action | Key (QWERTY) | Key (AZERTY) | `event.code` |
|--------|-------------|-------------|-------------|
| Forward | W | Z | `KeyW` (maps to Z on AZERTY physically) |
| Backward | S | S | `KeyS` |
| Strafe left | A | Q | `KeyA` (maps to Q on AZERTY physically) |
| Strafe right | D | D | `KeyD` |
| Look | Mouse | Mouse | `mousemove` + pointer lock |
| Interact / collect | E | E | `KeyE` |
| Toggle minimap | M | M | `KeyM` |
| Toggle post-processing | P | P | `KeyP` (for before/after comparison) |

Mouse: click to lock pointer, Esc to release. Sensitivity: 0.002 rad/pixel. Invert-Y: off by default, toggle with I key.

Movement speed: 4 units/sec. No sprint, no crouch — keep it simple.

## World Generation

### Layout
The dungeon is a grid of connected rooms and corridors, generated once on load.

**Grid:** 8×8 to 12×12 cells (random seed). Each cell = 6×6 units.

**Generation algorithm (simplified):**
1. Place entrance room at grid edge
2. Random walk to place 8-12 rooms, minimum 2 cells apart
3. Connect rooms with corridors (A* pathfinding, carve straight corridors)
4. Place exit room (largest room farthest from entrance)
5. Dead-end corridors branch off main paths (0-2 per corridor)

### Room types (3 variants)
| Type | Size (cells) | Features | Probability |
|------|-------------|----------|-------------|
| Chamber | 2×2 or 3×3 | 4-8 torches on walls, center feature (fountain/pillar/brazier), rune patterns on floor | 40% |
| Hall | 1×2 or 2×1 | 2-4 torches, arched ceiling | 35% |
| Vault | 3×3 or 4×4 | 8-12 torches, water puddle, elevated platform, treasure orb, grand runes | 25% |

### Corridors
- Width: 1 cell (6 units), height: 4 units
- Torches every 8 units alternating left/right walls
- 30% chance of archway (ceiling raised to 5 units, arched geometry)
- 15% chance of wall crack with emissive light leaking through

### Geometry construction
- **Walls:** `BoxGeometry(0.3, 4, 6)` for corridor segments, instanced. Material: `MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.85, metalness: 0.1 })`.
- **Floor:** Single large `PlaneGeometry` per room/corridor. Material: `MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.9, metalness: 0.0 })`.
- **Ceiling:** `PlaneGeometry` at y=4. Material: `MeshStandardMaterial({ color: 0x1a1a25, roughness: 0.95 })`.
- **Arches:** `TorusGeometry(arc=π, tubeRadius=0.15, radius=3)` rotated 90° — placed at corridor ceiling every 12 units where arch probability triggers. Material: same as walls but slightly lighter (`0x4a4a5a`).

All geometry pre-built at generation time — no chunk streaming needed.

## Lighting

### Torches
Each torch = 1 wall-mounted light source:

- **Geometry:** Small `BoxGeometry(0.15, 0.6, 0.15)` at y=2.5 on wall + `SphereGeometry(0.12)` at top for flame bulb.
- **Flame material:** `MeshBasicMaterial({ color: 0xff8830 })` — immune to scene lighting.
- **Bracket material:** `MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.6, metalness: 0.8 })`.
- **PointLight:** `color: 0xff9944, intensity: 3.0, distance: 12, decay: 1.8`.
- **Shadow:** `castShadow: true`, shadow map 256×256, camera near=0.5, far=12. PCF soft shadows (`shadowMapType: PCFSoftShadowMap`).
- **Flicker:** Random intensity ±15% at 6-10 Hz via `Math.sin(time * freq) * 0.15 + 1.0` multiplier on light intensity.

**Torch shadow budget:** Only the 8 nearest torches to the player cast shadows. All other torches have `castShadow: false`. Re-evaluate nearest torches every 500ms. This keeps shadow passes at 48/frame (8 torches × 6 cubemap faces) instead of 240+.

### Ambient
`AmbientLight(0x111122, 0.15)` — very dim blue-tinted ambient. Most light comes from torches.

### Fog
`scene.fog = new FogExp2(0x0a0a15, 0.025)` — dark blue-black exponential fog. Makes distant corridors fade to black.

## Particle System (Dust Motes)

- Single `Points` object with 500-800 particles, recycled.
- Each particle: random position within 8-unit radius of camera, reassigned when behind camera or too far.
- Size: 0.02-0.05 units, `sizeAttenuation: true`.
- Material: `PointsMaterial({ map: softCircleTexture, blending: AdditiveBlending, depthWrite: false, opacity: 0.4, color: 0xffcc88 })`.
- Only visible when within 5 units of a torch — opacity scales with distance to nearest torch light.

**Soft circle texture:** generated at init via `CanvasTexture` — radial gradient white center to transparent edge, 64×64.

## Post-Processing Pipeline

```js
EffectComposer
├── RenderPass(scene, camera)
├── UnrealBloomPass(resolution, strength=1.2, radius=0.4, threshold=0.6)
├── ShaderPass(ChromaticAberrationShader) — offset: 0.001
├── ShaderPass(VignetteShader) — darkness: 0.5, offset: 0.95
└── OutputPass()  // tone mapping + color space
```

Toggle with P key: swap between composer rendering and direct renderer. Useful for before/after comparison.

## Collectible Orbs

- 3-5 orbs placed in random rooms (at least 1 in Vault rooms).
- **Geometry:** `SphereGeometry(0.25, 32, 32)`.
- **Material:** `MeshStandardMaterial({ color: 0x44aaff, emissive: 0x44aaff, emissiveIntensity: 2.5, roughness: 0.2, metalness: 0.3 })`.
- Bobbing animation: `y += Math.sin(time * 3) * 0.15`.
- Self-rotation: `rotateY(time * 0.5)`.
- Collection: player within 1.5 units + E key pressed → orb shrinks (scale→0 over 0.3s), then removed.
- Counter: "Orbs: N/5" HUD element in top-left.
- All collected → golden particles burst from player position, "All orbs collected" message.

## HUD

Minimal DOM overlay (HTML/CSS, no canvas drawing):

- **Top-left:** Orb counter: `Orbs: 0/5` (semi-transparent dark background, white text, font: monospace 14px).
- **Top-right:** FPS counter (small, dim).
- **Bottom-center:** Interaction prompt: `[E] Collect` — only visible when near an orb.
- **Bottom-right:** Minimap toggle hint: `[M] Map [P] Effects`.
- **Center:** Crosshair — subtle dot or cross, CSS-only.

## Minimap

- Canvas-rendered 2D top-down view in bottom-right corner (150×150 px).
- Shows visited rooms/corridors as white lines on dark background.
- Player position as cyan dot.
- Orbs as blue dots (only revealed when within 3 cells).
- Exit room marked in gold.
- Fog of war: only revealed cells are drawn. Unexplored = black.

## Water Puddles

- Vault rooms only.
- `PlaneGeometry(3, 2)` at y=0.01, centered.
- Material: `MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.15, metalness: 0.9, opacity: 0.7, transparent: true })`.
- Subtle sine-wave vertex displacement on y-axis (amplitude 0.03, frequency 2) — only 4 vertices need updating.

## God-Ray Shafts

- Below each torch in Vault rooms (not corridors — too expensive).
- `CylinderGeometry(0.3, 1.5, 5, 8, 1, true)` (open-ended cone, wider at bottom).
- Material: `MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.06, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })`.
- Positioned with top at torch, extending downward.

## Architecture

```
src/
├── core/
│   ├── Constants.js       — All numbers, colors, generation params
│   ├── GameState.js       — Player position, orbs collected, visited cells
│   └── Game.js            — Orchestrator: init, loop, input, HUD
├── systems/
│   ├── InputSystem.js     — Keyboard + mouse + pointer lock
│   ├── LightingSystem.js  — Torch creation, flicker, shadow management
│   ├── ParticleSystem.js  — Dust motes
│   └── PostProcessing.js  — EffectComposer, passes, toggle
├── world/
│   ├── DungeonGenerator.js — Grid generation, room placement, corridor carving
│   ├── WorldBuilder.js    — Converts grid to Three.js geometry (walls, floor, ceiling, arches)
│   ├── TorchManager.js    — Torch placement, flame meshes
│   └── Minimap.js         — 2D canvas minimap
├── entities/
│   └── Orb.js             — Collectible orb (geometry, animation, collection)
├── ui/
│   └── HUD.js             — DOM overlay management
└── main.js                — Bootstrap
```

## GameState Schema

```js
{
  player: { x, y, z, yaw, pitch },
  collectedOrbs: number,
  totalOrbs: number,
  visitedCells: Set<string>,  // "x,z" keys
  dungeonSeed: number,
  effectsEnabled: boolean,
  minimapVisible: boolean
}
```

## Performance Targets

- 60 FPS on mid-range hardware (GTX 1060 / integrated GPU 2020+) at 1920×1080.
- Torch shadow map: 256×256 max (not 512 or 1024).
- Dust particles: 500 max (not 800) on mobile/low-end.
- God rays: Vault rooms only, max 4 at a time.
- Bloom resolution: half-res (default UnrealBloomPass behavior).
- Post-processing toggle (P key) for low-end fallback.

## Edge Cases & State Handling

| Edge case | Resolution |
|-----------|-----------|
| Pointer lock lost (Esc) | Game continues, mouse look disabled until re-click. HUD shows "Click to look" prompt. |
| All orbs collected | Golden particle burst at player, HUD message, but can keep exploring. |
| Player walks through wall (collision off) | No collision for this demo — pure exploration. Walls are visual only. |
| Browser tab hidden | Delta time capped at 0.1s to prevent jump on return. |
| Very large dungeon seed (12×12) | Torch cap enforced: beyond 40, shadow casting disabled for farthest torches. |
| WebGL not supported | Fallback message in DOM: "WebGL required." |

## What's NOT in Scope (explicitly excluded)

- Enemies, combat, health, death
- Inventory, items, equipment
- Doors, keys, locked areas
- NPCs, dialogue
- Save/load (single session, regenerated on reload)
- Mobile/touch support (desktop only)
- Audio (visual showcase only — add later)
- Collision detection (walk-through-walls demo)

## Visual Priority vs Implementation Order

| Phase | Features | Goal |
|-------|----------|------|
| 1 (MVP) | Procedural corridors + rooms, torch lights (no shadows), basic materials, movement + mouse look | Walkable dungeon |
| 2 | Torch shadows, bloom post-processing, vignette, fog | Atmospheric lighting |
| 3 | Dust particles, emissive runes on walls, torch flicker, god rays | Life and movement |
| 4 | Orbs + collection, HUD, minimap, water puddles | Interaction + polish |
| 5 | Chromatic aberration, chromatic archways, cracked walls, golden particle burst | Final polish |

## Color Palette

| Element | Hex | Use |
|---------|-----|-----|
| Wall stone | `#3a3a4a` | Corridor walls |
| Floor stone | `#2a2a35` | Floor |
| Ceiling | `#1a1a25` | Ceiling planes |
| Arch accent | `#4a4a5a` | Archways |
| Torch flame | `#ff8830` | Flame bulb |
| Torch light | `#ff9944` | PointLight color |
| Rune glow | `#44aaff` | Wall runes, orbs |
| Rune alt | `#ff6644` | Secondary rune color |
| Water | `#1a2a4a` | Puddle base |
| Fog | `#0a0a15` | Exponential fog |
| Ambient | `#111122` | AmbientLight |
| HUD bg | `rgba(0,0,0,0.5)` | HUD backgrounds |
| HUD text | `#cccccc` | Text |

## Camera

- FOV: 75°
- Near plane: 0.1, far plane: 50
- Player eye height: 1.7 units (standing eye level)
- Pointer lock: click canvas to activate, Esc to release
- Pitch clamp: ±85° (avoid gimbal flip at 90°)
- Sensitivity: 0.002 rad/pixel

## Start & Exit

- **Entrance room:** Player spawns at center of the first room placed during generation. Facing inward (toward dungeon center).
- **Exit room:** Marked by a golden glowing rune circle on the floor (`emissive: 0xffaa00, emissiveIntensity: 3`). Walking into the exit room (player within 2 units of its center) triggers a fade-to-white over 2 seconds, then regenerates a new dungeon with a new seed.
- **HUD message on reaching exit:** "The depths beckon further... [E] to descend" — press E to trigger regeneration immediately.

## Canvas & Renderer

- Resolution: full window (`window.innerWidth × window.innerHeight`), responsive resize.
- Renderer: `WebGLRenderer({ antialias: true, alpha: false })`.
- Shadow map: `PCFSoftShadowMap`.
- Tone mapping: `ACESFilmicToneMapping`, exposure: 1.0.
- Pixel ratio: `Math.min(window.devicePixelRatio, 2)` — cap at 2× for performance.
- Background: `scene.background = new Color(0x0a0a15)` — matches fog.

## Rune System

- Runes are small emissive planes parented to wall surfaces.
- 10-30 per room depending on room type.
- Geometry: `PlaneGeometry(0.3, 0.3)` offset 0.02 from wall surface.
- Material: `MeshBasicMaterial({ color: runeColor })` — emissive, immune to lighting, visible through fog.
- Animation: `material.opacity = 0.4 + Math.sin(time * runeSpeed + runeOffset) * 0.3` where each rune has unique offset.
- Placement: random positions on walls at y ∈ [0.5, 3.5], avoiding torch positions.
