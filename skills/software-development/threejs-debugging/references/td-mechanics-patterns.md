# Tower Defense Mechanics Implementation Patterns

## Aura Slow (Chrono Prism)

Passive effect — no projectile, no cooldown. Every frame, slow all enemies in range.

**Tower def:**
```javascript
{ id: 13, name: 'Chrono Prism', range: 8, rate: 0, damage: 0, auraSlow: 0.35, ... }
```

**Implementation in _towerFire:**
```javascript
// Check BEFORE cooldown — aura runs every frame
if (def.auraSlow) {
  for (const e of this._enemies.enemies) {
    if (e.dead) continue;
    if (e.mesh.position.distanceTo(t.pos) <= t.range) {
      e.slowUntil = Math.max(e.slowUntil, performance.now() + 400);
    }
  }
  return; // skip normal firing logic
}
```

Key detail: `rate: 0` so `t.cooldown` is always 0, but the early `return` means
the normal fire logic never executes. The aura check happens first.

## Pierce (Void Lance)

Projectile passes through the first enemy hit instead of being destroyed.

**Tower def:**
```javascript
{ id: 11, name: 'Void Lance', pierce: true, ... }
```

**Projectile spawn — pass pierce flag:**
```javascript
this._projectiles.spawn({
  ..., pierce: !!def.pierce, ...
});
```

**CollisionSystem — don't remove on hit if pierce:**
```javascript
if (hit && p.pierce) {
  p._pierced = (p._pierced || 0) + 1;
  p.mesh.position.addScaledVector(p.dir, 0.8); // push past hit enemy
  if (p._pierced >= 6) projectiles._remove(p);  // limit
} else if (hit) {
  projectiles._remove(p);  // normal: one hit, then gone
}
```

Key detail: push the projectile forward by 0.8 units so it doesn't re-hit the same
enemy on the next frame. Limit pierce count to prevent infinite projectile lifetime.

## Corrode (Corrosive Spire)

Each hit reduces the enemy's armor stat permanently.

**Tower def:**
```javascript
{ id: 12, name: 'Corrosive Spire', corrode: 0.12, ... }
```

**In CollisionSystem._hit:**
```javascript
if (projectile.corrode && enemy.tags.armor) {
  enemy.tags.armor = Math.max(0, enemy.tags.armor - projectile.corrode);
  enemy._armorReduced = true;
}
```

Key detail: `enemy.tags.armor` is mutable — it's the live reference from the
enemy definition spread. Reducing it affects all future damage calculations for
that enemy. The `Math.max(0, ...)` floor prevents negative armor.

## Stun (Doom Cannon)

Long-duration slow that effectively freezes the enemy.

**Tower def:**
```javascript
{ id: 14, name: 'Doom Cannon', stun: 2.5, damage: 45, rate: 5.0, ... }
```

**Reuses the existing slow mechanic with a longer duration:**
```javascript
// In projectile spawn:
slow: def.stun || def.slow || 0

// In EnemyManager.update:
const pace = enemy.slowUntil > performance.now() ? enemy.speed * 0.45 : enemy.speed;
// slowUntil = performance.now() + 4000 * 2.5 = now + 10 seconds
```

Key detail: `stun` and `slow` share the `slow` projectile field — the only
difference is duration. The slowdown percentage is fixed at 0.45x speed.

## General Pattern for Adding New Tower Mechanics

1. Add a flag to the tower definition in Constants.js (e.g. `pierce: true`)
2. Pass the flag through the projectile spawn call in _towerFire
3. Handle the flag in CollisionSystem._hit or the update loop
4. For passive/aura effects, add a check BEFORE the cooldown gate in _towerFire
5. Always test with at least one wave to verify the mechanic fires