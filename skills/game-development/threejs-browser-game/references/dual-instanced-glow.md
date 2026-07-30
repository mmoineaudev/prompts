# Dual InstancedMesh for Per-Instance Glow

**Problem**: `MeshLambertMaterial` / `MeshStandardMaterial` set per-instance color via `setColorAt()` but have no per-instance emissive. Ore veins, crystals, or glowing terrain features need pulsing emissive that varies per tile — impossible with a single InstancedMesh using Lambert/Standard materials.

**Solution**: Create a second `InstancedMesh` that shares the same `BoxGeometry`, uses `MeshBasicMaterial` with `AdditiveBlending`, and only includes the glowing subset of tiles. This acts as a cheap per-instance emissive overlay.

## Implementation

```js
// --- Solid mesh (all non-air tiles) ---
const solidGeom = new THREE.BoxGeometry(0.98, 0.98, 0.98);
const solidMat = new THREE.MeshLambertMaterial({ roughness: 0.8 });
const solidMesh = new THREE.InstancedMesh(solidGeom, solidMat, solidCount);

// --- Glow mesh (ore tiles only, additive pass) ---
const glowMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const glowMesh = new THREE.InstancedMesh(solidGeom, glowMat, oreCount);
glowMesh.renderOrder = 1;

// Fill both meshes during terrain build
for each tile:
  if tile is ore:
    solidMesh.setMatrixAt(solidIdx, matrix);    // color from TILE_COLORS
    glowMesh.setMatrixAt(glowIdx, matrix);      // additive overlay

// Per-frame: pulse the glow opacity
updateGlow(dt) {
  this._glowTime += dt;
  const sine = Math.sin(this._glowTime * PULSE_SPEED);
  const opacity = MIN_INTENSITY + (sine * 0.5 + 0.5) * (MAX_INTENSITY - MIN_INTENSITY);
  this._glowMesh.material.opacity = opacity;
}

// On dig: zero the instance matrix on BOTH meshes
```

## Key Details

- **Same geometry, shared reference**: Both meshes can use the same `THREE.BoxGeometry` instance — Three.js handles this fine.
- **AdditiveBlending**: Only brightens, never darkens. Works over any terrain color.
- **depthWrite: false**: Prevents glow from occluding other glow tiles.
- **renderOrder: 1**: Renders after the solid pass so glow sits on top.
- **Per-frame opacity**: A single `material.opacity` drives all glow instances. Color differentiation comes from the solid mesh underneath — the glow just adds brightness. For per-ore-type color variation in the glow itself, use separate glow meshes per ore type, each with its own `color` uniform.
- **On tile removal**: Zero both the solid instance and the glow instance matrices. Keep `_instanceMap` and `_glowMap` as parallel `Int32Array` lookup tables mapping grid index → instance index (or -1 for none).

## Performance

- Ore count is typically 30–50 tiles out of 20,000. A second 50-instance mesh is negligible.
- The additive pass is one extra draw call, not one per instance.
- No per-instance uniform updates needed — opacity is material-level and works for all glow instances.

## When NOT to Use

- If you need per-ore-type emissive colors, use multiple glow meshes (one per ore type) each with a fixed material color, or switch to a custom ShaderMaterial with per-instance attributes.
- If your ore count exceeds ~500, consider whether the additive pass is worth it vs. a simpler approach (just bright instanceColor on the solid mesh).
