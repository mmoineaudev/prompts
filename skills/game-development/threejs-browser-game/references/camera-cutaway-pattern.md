# Camera-Adaptive Terrain Cutaway

For top-down angled-camera grid games where the terrain is a solid block of instanced tiles, the camera sits above and behind the player looking down at an angle. The tiles between the camera origin and the player physically block the view — the player's vehicle, tunnels, and ore veins are invisible unless you remove the "near wall" of the terrain.

## Problem

A 40×40×50 grid rendered as a solid `InstancedMesh` block plus a camera at a 45-60° angle means tiles in the camera's direction quadrant sit between the lens and the player. The camera sees only the outer surface of the terrain block.

## Solution: Quadrant Cutaway

Hide tiles dynamically based on which direction the camera is looking from. The camera orbits around the player at angle `θ` in the XZ plane. Determine which X and Z direction the camera is coming from via the signs of `sin(θ)` and `cos(θ)`, then hide tiles in that quadrant at or above the player's depth level.

```js
setCutaway(playerGridX, playerGridY, playerGridZ, camAngle) {
  const margin = 3; // tiles beyond player to preserve
  const sinA = Math.sin(camAngle);
  const cosA = Math.cos(camAngle);
  const signX = sinA > 0.01 ? 1 : (sinA < -0.01 ? -1 : 0);
  const signZ = cosA > 0.01 ? 1 : (cosA < -0.01 ? -1 : 0);

  // Iterate tiles at or above player level (gridY <= playerY) in the camera quadrant
  for (let y = 0; y <= playerGridY; y++) {
    const xStart = signX > 0 ? playerGridX + margin : 0;
    const xEnd   = signX < 0 ? playerGridX - margin : WORLD_WIDTH;
    const zStart = signZ > 0 ? playerGridZ + margin : 0;
    const zEnd   = signZ < 0 ? playerGridZ - margin : WORLD_DEPTH;

    for (let x = xStart; x < xEnd; x++) {
      for (let z = zStart; z < zEnd; z++) {
        // Guard: only tiles in the camera direction
        if (signX !== 0 && Math.sign(x - playerGridX) !== signX) continue;
        if (signZ !== 0 && Math.sign(z - playerGridZ) !== signZ) continue;

        const instIdx = instanceMap[idx(x, y, z)];
        if (instIdx < 0) continue;
        // Hide: zero the instance matrix scale
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(instIdx, dummy.matrix);
        cutawayHidden[idx(x, y, z)] = 1;
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
}
```

## Key Design Decisions

- **Short-circuit**: Track `_lastCutawayPX/Y/Z` and `_lastCamAngle`. Skip the entire loop if nothing changed. The cutaway only runs when the player moves or the camera rotates.
- **One-way hide**: Tiles are hidden but never restored. In a mining game where the player descends, the cutaway only grows in one direction (more tiles above get hidden as the player goes deeper). If the player moves laterally into a previously hidden zone, they're inside invisible tiles — acceptable for MVP since the player rarely backtracks horizontally into hidden areas.
- **Margin of 3 tiles**: Leave a 3-tile buffer around the player so they can see nearby walls and plan digs. The margin prevents the cutaway from eating tiles the player can directly interact with.
- **Per-frame cost**: At 40×40 world with 50 depth, the worst case is ~40 × 40 × 25 × 0.25 ≈ 10,000 JS array lookups per call. This is negligible compared to the render cost and only runs on state change, not every frame.

## Integration

Call `setCutaway` from the game loop whenever the player position or camera angle changes:

```js
// In the descent update loop:
this._terrainRenderer.setCutaway(s.tileX, s.tileY, s.tileZ, this._cam.getAngle());
```

Also call it once after terrain generation with the initial player position to set the starting cutaway.

## Pitfalls

- **Fixed-angle assumption**: If you skip the `signX`/`signZ` logic and hardcode a quadrant (e.g., "hide tiles where x >= playerX + 3 AND z >= playerZ + 3"), the cutaway breaks when the player rotates the camera. The quadrant must follow the camera angle.
- **No restore on backtrack**: If the player walks into the hidden zone, tiles don't reappear. For mining games where the player descends, this is fine. For side-scroller or exploration games, add a restore pass.
- **Instance matrix staleness**: Always set `mesh.instanceMatrix.needsUpdate = true` after batch-hiding instances. Missing this results in hidden tiles still rendering.
