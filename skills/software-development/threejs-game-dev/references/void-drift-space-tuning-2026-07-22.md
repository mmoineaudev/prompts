# VOID DRIFT — Space Exploration Tuning Notes (2026-07-22)

## Visible but Not Obvious Bugs
- `PhysicsSystem.js` had distance tracking using a bad intermediate (`dz` typo on the right side)
  - fix: true delta `pos.z - pz` for `dz`
- `ChunkManager.getCollidables()` used `this._planets`
  - fix: pass `planets` into subsystem bundle; read `this._sub.planets._planets`

## Far-Layer Effect Visibility Fixes
- Camera far plane: `5000 -> 100000` so far NPCs / shooting stars render at all
- Shooting stars and NPC trails: set `sizeAttenuation: false`
- Shooting star origin: move from nearby shell to `shipPos + far shell offset`
  - we settled on direction-based offset with `dist = 5000..17000`

## NPC Visibility Tuning
- Increases that made NPCs visible without new systems:
  - `NPC.MAX_COUNT: 28 -> 40`
  - `NPC.SPAWN_CHANCE: 0.15 -> 0.28`
  - `NPC.WANDER_SPAWN_CHANCE: 0.12 -> 0.30`
  - deterministic neighborhood `±1 -> ±2`
  - emissive `0.8 -> 1.6` for dim-but-visible ships

## Wormhole Transparency Tuning
- Lowered fragment shader alpha terms
- Desaturated color mix
- Removed bright outer/rim/pulse contributions
- Tightened discard threshold

## Chunk Coherence Tuning
- `CHUNK.SIZE: 240 -> 480` keeping every per-chunk count unchanged
- Much smoother pop-in because neighborhood persists farther

## Speed Scaling Context
- `MAX_SPEED` was raised multiple times; if you continue tuning, remember to:
  - raise camera far plane alongside top speed
  - raise weapon range/lifetime if projectiles despawn before reaching useful range
