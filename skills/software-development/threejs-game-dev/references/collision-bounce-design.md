# Collision and Bounce Design Notes

## Collision Flow

1. `Game._animate()` calls `chunkManager.getCollidables(shipPosition)`.
2. `getCollidables()` returns:
   - `getDestructibles()` → large non-instanced asteroids + debris
   - live NPC ships from `NPCShipManager._ships`
   - NOT planets
3. `PhysicsSystem.checkShipCollisions(shipMesh, collidables)` tests bounding spheres.
4. For each hit, `handleCollision()` deals damage and reflects velocity.

## Damage Model

- Single constant: `Constants.HEALTH.COLLISION_DAMAGE = 10`
- Every non-planet hit subtracts 10% hull
- Game over at 0% via `GameState.takeDamage()`

## Bounce Math

```js
const target = collision.target;
const normal = shipObject.position.clone().sub(target.position);
if (normal.lengthSq() === 0) {
  normal.copy(shipObject.userData.velocity || new THREE.Vector3(0,1,0)).normalize();
}
normal.normalize();

const vel = shipObject.userData.velocity;
const vn = vel.dot(normal);
if (vn > 0) vel.addScaledVector(normal, -(vn + 3.5));
else vel.addScaledVector(normal, 3.5);
vel.multiplyScalar(0.7);
shipObject.position.addScaledVector(normal, pen + 0.2);
```

Key parameters:
- Minimum outbound speed: `3.5`
- Damping: `0.7`
- Penetration push: `1.2 + targetRadiusOrSize + 0.2`

## Forward-Only Flight Caveat

`updatePlayerPhysics()` reconstructs velocity as a scalar along the ship forward axis every frame. After a collision sets a reflected velocity, the next physics frame may override it back to a small forward scalar. If bounce feels weak or absent:

- Option A: Add a short residual override window in `updatePlayerPhysics()` after collision.
- Option B: Accept collision as damage-only with a small camera shake.
- Option C: Switch to true velocity-state flight, not scalar-forward reconstruction.

## Instanced Asteroid Collision

Medium/small asteroids are `InstancedMesh` wrappers skipped by `checkShipCollisions()` because `isInstanced === true` and the wrapper has no `.position`/`.boundingSphere`. Options:

- Keep large-only collisions for gameplay clarity.
- Iterate instances with world-space bounding spheres, throttled.
- Hybrid cluster bounding volumes.
