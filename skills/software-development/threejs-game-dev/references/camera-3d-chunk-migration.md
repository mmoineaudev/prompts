# Three.js Camera Framing + 3D Chunking Reference

## Camera Framing Notes

- Default follow-cam shift to 3/4 above-behind:
  - `FOLLOW_HEIGHT=6`, `FOLLOW_DISTANCE=12`
  - Aim offset applied as `position + up *(-LOOK_OFFSET_Y) + back * LOOK_OFFSET_Z`
  - Positive back is +Z in ship-local space when quaternion is aligned; negative look offset on Y drops the aim point below the ship center.
- After switching mouse control, yaw sign flips because screen-space and Euler-space axes are mirrored:
  - Use `-mouseX` for yaw, `+mouseY` for pitch unless the user requests invert.
- Pointer-lock re-centering:
  - On `pointerdown` left click, call `requestPointerLock()`.
  - On `mousemove`, if locked, accumulate `movementX/movementY` into `_steerX/_steerY`; if unlocked, raw NDC fallback applies.
  - On `pointerlockchange` unlock, reset `_steerX/_steerY` to 0 and fall back to NDC smoothing.

## Chunk Migration Notes

- From 2D key `${cx},${cz}` to 3D key `${cx},${cy},${cz}`.
- Volume constants required: add `HEIGHT` so chunk center Y becomes `cy * HEIGHT + HEIGHT / 2`.
- Spawn neighborhood: 3D nested loop with radius `SPAWN_AHEAD` in every axis. Near origin you can keep `dy` narrower to avoid flooding the start area, but vertical axis must still chunk.
- Cleanup: remove only when `abs(cx-shipCx) > cleanupBehind && abs(cy-shipCy) > cleanupBehind && abs(cz-shipCz) > cleanupBehind`.
- Placement helper: replace `randomInCylinder` with `randomInSphere` / `randomInBox` so asteroids/debris/nebula cores fill the full cubic volume.
- Always cleanup `userData.isChunkObject` and `userData.isWormhole` objects in `_clearAllChunks()` traverse.