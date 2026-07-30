# Instanced Collision Pattern

## Problem
`InstancedMesh` is a single draw-call wrapper; `target.isInstanced === true`, so naive ship-collision loops skip it entirely.

## Fix
Attach per-instance collidables to the `InstancedMesh.userData._collidables[]` array during construction:

```js
const collidables = [];
for (let i = 0; i < count; i++) {
  // ... position/rotation/scale setup ...
  collidables.push({ instanceId: i, position: pos, size, radius: size });
}
instancedMesh.userData._collidables = collidables;
```

Then in collision:

```js
if (target.isInstanced) {
  if (!target.userData?._collidables) continue;
  const meshCenter = target.position.clone();
  for (const c of target.userData._collidables) {
    const worldPos = meshCenter.clone().add(c.position);
    // test worldPos sphere against ship sphere
  }
  continue;
}
```

## Notes
- `position` in `_collidables` is the local offset from the `InstancedMesh` origin, not world space.
- `radius` defaults to `size` when not explicitly stored.
- This pattern works for asteroids, debris, decor, or any instanced interactable geometry.
