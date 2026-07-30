# Dual InstancedMesh Transparent Cutaway

For grid-based 3D terrain games where the camera looks down at an angle into a solid block of terrain. The player needs to see through the "near wall" of the terrain to spot the vehicle, enemies, and ores.

## Problem

Single InstancedMesh renders ALL terrain tiles. Tiles between the camera and the player block the view. Hiding them (scale=0) works but gives no spatial context — the player loses sense of depth and structure.

## Solution: Opaque + Transparent Dual Mesh

Two InstancedMeshes sharing geometry, each with its own material:

```js
// Opaque mesh — fully visible tiles, depthWrite on
const opMat = new THREE.MeshLambertMaterial({ roughness: 0.8 });
const opaqueMesh = new THREE.InstancedMesh(geom, opMat, totalTiles);
opaqueMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

// Transparent mesh — cutaway tiles, depthWrite off, low opacity
const trMat = new THREE.MeshLambertMaterial({
  roughness: 0.8, transparent: true, opacity: 0.12, depthWrite: false,
});
const transparentMesh = new THREE.InstancedMesh(geom, trMat, totalTiles);
transparentMesh.count = 0; // starts empty
transparentMesh.renderOrder = 1;
transparentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
```

## Instance Management

Track two maps: `opaqueMap[gridIdx] → instIdx` and `transMap[gridIdx] → instIdx`. Both initialized to -1.

**Initial build**: Put ALL non-air tiles in opaqueMesh.

**Moving tile to cutaway** (opaque → transparent):
1. Set opaque instance matrix scale to (0,0,0) — effectively hide
2. `opaqueMap[gridIdx] = -1`
3. Set transparent instance matrix at `transparentMesh.count` to correct world pos + scale(1,1,1)
4. Copy per-instance color from tile type
5. `transMap[gridIdx] = transparentMesh.count`
6. `transparentMesh.count += 1`
7. `needsUpdate = true` on both mesh instance matrices + colors

**Digging a tile**: Check both maps — whichever has the instance, zero its scale.

## Cutaway Logic

Camera is at angle θ in XZ plane. Camera direction signs:
```js
const signX = Math.sin(angle) > 0.01 ? 1 : (Math.sin(angle) < -0.01 ? -1 : 0);
const signZ = Math.cos(angle) > 0.01 ? 1 : (Math.cos(angle) < -0.01 ? -1 : 0);
```

Tiles in cutaway: those where `Math.sign(tileX - playerX) === signX` AND `Math.sign(tileZ - playerZ) === signZ`, at `gridY <= playerY`, with a margin of 3+ tiles. Skip tiles already in cutaway state.

## Performance Notes

- 80k tiles (40×40×50) at 2 InstancedMeshes = 2 draw calls. Fine on integrated GPUs.
- Cutaway update iterates only tiles in the camera quadrant at/above player level — worst case ~40×40×25×0.25 = 10k checks per step. Only runs when player moves tile or camera rotates.
- Both mesh instance matrices use DynamicDrawUsage since tiles move between them at runtime.

## Pitfalls

- Transparent mesh must have `depthWrite: false` and `renderOrder > 0` or it will occlude the opaque mesh behind it.
- `transparentMesh.count` starts at 0 and increments as tiles enter cutaway. Must pre-allocate capacity to max possible tiles (set `maxCount` in the InstancedMesh constructor's third argument).
- Per-instance colors must be copied to the transparent mesh when moving tiles, or cutaway tiles lose their biome/ore tinting.
