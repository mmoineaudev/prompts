# Transparent Terrain Pattern

For mining, digging, or burrowing games where the player needs to see entities
inside a 3D grid of tiles. **Use this first — before attempting any cutaway system.**

## Why

- Zero cutaway logic. No dual meshes, no quadrant math, no per-frame updates.
- Player sees vehicle, ores, enemies, and tunnel layout from any camera angle.
- Simpler code, fewer bugs, faster iteration.
- User can still see spatial context (imagine a ghostly rock layer).

## When NOT to use

- Horror games needing limited visibility (use fog + tight cutaway instead)
- Games where terrain opacity is a core mechanic

## Implementation

```js
// Single InstancedMesh, all tiles share one material
const mat = new THREE.MeshLambertMaterial({
  transparent: true,
  opacity: 0.22,       // 20-25% — high enough to read terrain, low enough to see through
  depthWrite: false,   // CRITICAL: lets entities render on top
});
const mesh = new THREE.InstancedMesh(geometry, mat, tileCount);

// Per-instance colors still work for biome/ore differentiation
mesh.setColorAt(i, colorForTileType);

// Ore glow: separate additive InstancedMesh (always visible through transparent terrain)
const glowMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.6,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
```

## Rendering order

- Opaque entities (vehicle, enemies): renderOrder = 0 (default)
- Transparent terrain: renderOrder = 1
- Additive glow (ores): renderOrder = 2

All three layers share `depthWrite: false` on the terrain and glow, so
entities always render on top regardless of depth buffer state.

## Vehicle visibility with transparent terrain

Even with transparent terrain, the vehicle must be clearly visible:
- 2x scale minimum (a 0.7-unit model is invisible in a 40-unit world)
- Emissive body (`emissiveIntensity >= 0.4`)
- Bright beacon sphere on top (MeshBasicMaterial, red/yellow, radius >= 0.15)
- Emissive headlights on front
- Contrast canopy color (blue/silver against gray/brown terrain)

## Performance

- 40×40×50 = 80,000 instances at one draw call — fine on integrated GPUs
- `depthWrite: false` is cheaper than depth-sorting transparent objects
- No per-frame cutaway updates — set once, never touch
