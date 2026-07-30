# Collision Pattern

## Target shape

```js
checkShipCollisions(shipObject, targets) {
  const collisions = [];
  this._sphere.copy(shipObject.userData.boundingSphere || new THREE.Sphere(shipObject.position, 1.2));

  for (const target of targets) {
    if (!target.visible) continue;
    if (target.userData?.isDestroyed) continue;

    if (target.isInstanced) {
      if (!target.userData?._collidables) continue;
      const meshCenter = target.position.clone();
      for (const c of target.userData._collidables) {
        const worldPos = meshCenter.clone().add(c.position);
        this._targetSphere.center.copy(worldPos);
        this._targetSphere.radius = c.radius || 1;
        if (this._sphere.intersectsSphere(this._targetSphere)) {
          collisions.push({
            target: { position: worldPos, userData: { size: c.size, radius: c.radius } },
            isLarge: c.size > 2,
            damage: Constants.HEALTH.COLLISION_DAMAGE,
          });
        }
      }
      continue;
    }

    if (!target.userData?.boundingSphere) continue;
    this._targetSphere.copy(target.userData.boundingSphere);
    if (this._sphere.intersectsSphere(this._targetSphere)) {
      collisions.push({ target, isLarge: (target.userData.size || 1) > 2, damage: Constants.HEALTH.COLLISION_DAMAGE });
    }
  }
  return collisions;
}
```

```js
handleCollision(shipObject, collision) {
  GameState.takeDamage(collision.damage);
  EventBus.emit('physics:collision', { damage: collision.damage, isLarge: collision.isLarge });

  const target = collision.target;
  const normal = new THREE.Vector3().subVectors(shipObject.position, target.position);
  if (normal.lengthSq() === 0) {
    if (shipObject.userData.velocity.lengthSq() > 0) normal.copy(shipObject.userData.velocity).normalize();
    else normal.set(0, 1, 0);
  }
  normal.normalize();

  const vel = shipObject.userData.velocity;
  const vn = vel.dot(normal);
  if (vn > 0) vel.addScaledVector(normal, -(vn + 3.5));
  else vel.addScaledVector(normal, 3.5);
  vel.multiplyScalar(0.7);

  let pen = 1.2;
  if (target.userData) {
    if (target.userData.radius) pen = target.userData.radius;
    else if (target.userData.size) pen = target.userData.size;
  }
  shipObject.position.addScaledVector(normal, pen + 0.2);
  EventBus.emit('camera:shake', collision.isLarge ? 0.8 : 0.3);
  shipObject.userData.hitFlash = 0.25;
}
```

## Notes
- Always define `target`, `normal`, `vel`, `vn` before using them.
- Penetration push prevents same-frame re-collision.
- Damage constant is `Constants.HEALTH.COLLISION_DAMAGE`, currently `10`.
- Planets must be excluded from the collidables list passed into `checkShipCollisions()`.
