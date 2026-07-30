---
name: threejs-browser-game
description: Three.js browser-based game development — procedural space-flight titles, scene/camera/controls, collision and physics, instanced-mesh pattern, shaders, lighting, and ad-hoc verification without a test suite.
triggers:
  - Three.js scene, shader, mesh, material, camera, lighting, or post-processing changes
  - Ship controls, collision, physics, projectiles, hull/damage/game-over flow
  - Instanced meshes or per-instance collision/spawn data
  - Procedural world generation: asteroids, planets, nebulae, shooting stars
  - Voxel/grid-based 3D terrain generation with InstancedMesh
  - Browser input handling and layout-independent key bindings
  - Ad-hoc verification of ES module game code
references:
  - collision-pattern.md
  - instanced-collision.md
  - lighting-cheatsheet.md
  - procedural-3d-terrain-grid.md
  - dual-instanced-glow.md
  - dual-mesh-cutaway.md
  - transparent-terrain.md
  - verification-script-template.js
---

# Three.js Browser Game Development

## Scope
Use this skill for Three.js browser-based games built with Vite, especially procedural space-flight/exploration titles with chunked infinite worlds.

## How To Work Here

### Input bindings
- Always bind movement/controls by `event.code`, never `event.key`.
- This keeps WASD/arrow diamond working on AZERTY and QWERTY alike.
- Document controls by physical key position, not key label.
- **AZERTY camera controls**: on AZERTY layouts, ZQSD maps to the same physical positions as WASD on QWERTY. Use Z=forward (pan camera away), Q=left (pan left), S=back (pan toward), D=right (pan right). Bind camera orbit to A (counter-clockwise) and E (clockwise) — these keys are in the same positions on both layouts. Mouse drag (left button) should also orbit the camera, with sensitivity ~0.005 rad/pixel.
- **Vehicle movement stays on arrow keys always** — never remap vehicle movement to letter keys unless the user explicitly asks. Arrow keys are layout-independent and don't conflict with camera pan keys.

### Ship controls / camera
- Ship forward axis is local; movement is forward-only with optional braking.
- Yaw: rotate on world Y. Pitch: rotate on local X. Clamp pitch to avoid gimbal flip.
- Camera follows behind/above in 3rd person; allow mouse-wheel zoom.
- 3-second idle self-level affects pitch/roll only; never yaw.

### Lighting baseline
- Start with: hemisphere light for sky/ground gradient, one directional sun, one fill, one rim.
- Keep ship-mounted lights modest; avoid additive engine blooms that look like white squares.
- If the scene feels too dark: raise ambient/sun/fill/rim intensities before lowering post-processing bloom.
- If planets/horizon feel invisible: increase planet shader rim/alpha and add hemisphere light.

### Planet shaders
- Use animated uniforms for `uTime`-driven noise/bands.
- Keep base alpha modest; tune visibility via fresnel rim multiplier and alpha floor.
- Sparse spawn: hash-gate chunk keys before creating planets to limit count.
- Support size variation: scale radius across a wide range, not just large bodies.

### Instanced meshes + collision
- When asteroids/debris/decor use `InstancedMesh`, store per-instance collidables on `mesh.userData._collidables[]`.
- Each entry needs: `instanceId`, `position` (local offset), `size`, `radius`.
- Collision checks must branch on `target.isInstanced` and iterate `_collidables` rather than skipping instanced targets.
- Never rely solely on a single mesh-level bounding sphere for instanced content.

### Voxel/grid-based 3D terrain
- For grid-based worlds (mining games, dungeon crawlers, voxel builders), see `references/procedural-3d-terrain-grid.md`.
- Store terrain as a flat `Uint8Array` indexed by `x + z * WIDTH + y * WIDTH * DEPTH`.
- Render with a single `InstancedMesh` + per-instance color rather than individual meshes per tile.
- On dig/remove: zero the instance matrix scale instead of rebuilding the mesh.
- Generate ore veins with cellular-automata blob growth from seed points.
- For per-instance glow/emissive on ore tiles (since MeshLambertMaterial lacks per-instance emissive): use a second additive InstancedMesh — see `references/dual-instanced-glow.md`.
- **Transparent terrain (simplest, most reliable)**: for mining/digging/burrowing games, make ALL terrain tiles semi-transparent by default — use `MeshLambertMaterial({ transparent: true, opacity: 0.2–0.25, depthWrite: false })`. No cutaway logic needed. The player can see the vehicle, ores, enemies, and tunnel structure through the ghost-like terrain from any camera angle. This is the simplest approach and always preferred FIRST before attempting dual-mesh cutaway systems. Only add cutaway if the gameplay requires opaque terrain for atmosphere (horror, limited-visibility mechanics). See `references/transparent-terrain.md` for the full pattern.
- **Dual-mesh cutaway (fallback)**: when you DO need opaque terrain with selective transparency, use a second `InstancedMesh` with `transparent:true, opacity:0.12, depthWrite:false` and move cutaway tiles from the opaque mesh to the transparent one. See `references/dual-mesh-cutaway.md`. This preserves spatial context while letting the player see through camera-shadowed tiles.
- **Vehicle positioning on tiles**: in grid-based games, place entities at `worldY = -tileY` (on TOP of the tile), NOT at `-(tileY + 0.5)` (tile center). Entities at tile center sit buried inside the terrain and are invisible from above. Build vehicle models so the chassis sits at y=0.3–0.5 above ground level, and add a bright emissive beacon sphere at the highest point for visibility through fog/transparent terrain.
- **Vehicle model visibility checklist**: (1) 2x or larger scale — a 0.7-unit vehicle is invisible in a 40-unit world (2) emissive body material with emissiveIntensity ≥ 0.4 (3) bright-colored beacon sphere on top (MeshBasicMaterial, red or yellow, radius ≥ 0.15) (4) emissive headlights on front (5) blue/silver canopy with emissive for contrast against terrain.

### Damage / bounce / game over
- Damage constant lives in `Constants.HEALTH.COLLISION_DAMAGE`; don't inline magic numbers.
- Bounce math: compute surface normal from ship to target; reflect velocity; apply minimum outbound speed; damp; push ship out along normal by target radius + margin to prevent re-trigger.
- Exclude planets from ship collision by omitting them from the collidables list.
- Game-over path: `GameState.takeDamage(0)` then emit `game:gameover`; HUD/loop handle the rest.

### Visual detail without cost
- Add detail with trim geometry, edge panels, fins, nacelles—cheap meshes beat expensive shaders for small ships.
- Engine flames: small cone + normal-blended shader; large additive sprites become white squares behind the ship.
- Reduce glow sprite scale/opacity before removing effects entirely.

### Verification before commit
- No test suite is required, but every edit set needs a focused ad-hoc `/tmp/hermes-verify-*.js` script.
- At minimum: inspect changed files contain the expected strings, parse as valid ES module source, and confirm game-over/damage wiring still present.
- Clean tempfiles after verification; summarize results as ad-hoc verification, not full-suite green.
- Commit and push frequently after verification passes.

## Pitfalls
- `event.key` breaks AZERTY; use `event.code`.
- `InstancedMesh` wrappers are not individual colliders; skipping them makes collisions feel broken.
- Bounce without penetration push causes same-frame re-collision and apparent “stuck” state.
- Additive flame sprites with large scale bloom into white squares behind ship geometry.
- Raising post-processing bloom to fix darkness is the wrong lever; fix scene lights first.
- Planet surfeit: limit by chunk-key hash-gate and increase spacing, not just color.
- **Phase-dependent fog distance**: when a game switches between phases with different camera distances (e.g. hub overview at 28 units vs underground at 8 units), the scene fog FAR must be updated per phase. A fog set for tight underground play will completely obscure a hub scene viewed from farther away — everything beyond FAR blends to the background color, producing a blank screen. Always set fog per-phase, and match FAR to the maximum camera-to-target distance in that phase plus a margin. For hub/surface views, FAR=80–100 is a safe default; for tight underground views, FAR=12–18 works.
- **Double state update on player actions**: when a validation system (e.g. DigSystem.canClimb) and the entity (e.g. Vehicle.climbUp) both update GameState.tileX/Y/Z for the same action, the entity moves twice — once from the system, once from itself. Fix: designate the entity as the sole authority for position state. Validation systems should only check preconditions and emit events — never mutate position on GameState directly.
- **Camera orbit for grid games**: in top-down mining/dungeon games, allow the player to rotate the camera around the vehicle (A/E keys or equivalent) to see the tunnel from different angles. The cutaway must track the camera angle dynamically — hardcoding one quadrant breaks when the player rotates. The orbit maps to `sin(angle)` for X offset and `cos(angle)` for Z offset, with A increasing and E decreasing the angle.
- **`roughness` on MeshLambertMaterial**: `MeshLambertMaterial` does not support `roughness`. Passing it produces a Three.js console warning but no error. Use `MeshStandardMaterial` if you need roughness/PBR, or omit it and use `{}` for Lambert.
- **Null entity crash after death/cleanup**: when `_cleanupDescent()` sets `this._vehicle = null` but the render loop is still running, any access to `this._vehicle.worldPos` (or any other entity property) will throw `Cannot read properties of null`. Always null-guard entity accesses at the top of update methods: `if (this._vehicle) this._cam.follow(this._vehicle.worldPos, dt)`. This is especially critical during the death-screen phase when entities are disposed but rendering continues with the camera.
- **Hub prompt with controls**: always show a DOM overlay at the hub/surface phase listing all controls (movement, dig, camera orbit/pan, zoom, and how to start the game). Use a pulsing opacity animation to draw attention. The prompt should be removed when gameplay begins. Also show a compact controls reference in the HUD during gameplay (e.g. bottom-right corner, small font, dim color). Users unfamiliar with the game will not guess the controls otherwise.
