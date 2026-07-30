# Tower Defense Visual Enrichment Patterns

Techniques from the Pixel Sentinel tower-defense build for making entities
and environments feel detailed, reactive, and alive in Three.js.

---

## 1. Composite Model Factory (named children for animation hooks)

**Problem:** Generic `CylinderGeometry` / `IcosahedronGeometry` meshes are
indistinguishable — every tower and enemy looks the same aside from color.

**Pattern:** A `ModelFactory` class with one builder function per entity type.
Each returns a `THREE.Group` where child meshes have `name` properties
(`_body`, `_glowCore`, `_ring`, `_eye`, `_engine`, `_shield`, `_crystal`,
`_lobe`, `_horn`, `_rim`, `_dish`, `_shard`). The animation loop uses
`group.getObjectByName('_glowCore')` to pulse specific parts, `group.children
.filter(c => c.name === '_ring')` to rotate all rings, etc.

```javascript
// Builder — returns Group with named children
_buildEnemy[0] = (color, scale, defIdx) => {
  const g = new THREE.Group(); g.name = '_enemy';
  const body = new THREE.Mesh(octaGeo, rimMat);
  body.name = '_body';  // ← animation hook
  g.add(body);
  const eye = new THREE.Mesh(eyeGeo, glowMat);
  eye.name = '_eye';    // ← will pulse in animateEnemy()
  g.add(eye);
  return g;
};

// Animator — uses names, not indices
static animateEnemy(group, defIdx, time) {
  const body = group.getObjectByName('_body');
  if (body) body.position.y = Math.sin(time * 3 + defIdx) * 0.06;
  const eye = group.getObjectByName('_eye');
  if (eye && eye.material.opacity !== undefined)
    eye.material.opacity = 0.5 + Math.sin(time * 5) * 0.4;
  // ring rotation, engine pulse, lobe orbit...
}
```

**Key insight:** `group.getObjectByName()` is cheap (linear scan of children)
and avoids fragile index-based access. Keep Group trees shallow (one level
of named children).

---

## 2. Fresnel Rim Shader for Sci-Fi Entity Pop

**Problem:** `MeshStandardMaterial` on dark entities blends into a dark
`scene.background`. All enemies look like flat-colored blobs.

**Pattern:** A custom `ShaderMaterial` with a fresnel (rim-lighting) term
makes entities glow at the edges. Combined with `uHitFlash` uniform for
damage feedback.

```glsl
// Fragment shader core:
float rim = 1.0 - abs(dot(vNormal, vViewDir));
rim = pow(rim, uRimPower);  // sharpness per entity type
vec3 col = mix(baseColor * 0.2, baseColor, rim * 0.7 + 0.3);
col += uEmissive * rim * 0.6;          // rim glow
col += uRimColor * rim * 0.35;         // tinted rim
col = mix(col, vec3(1.0), uHitFlash * 0.7);  // white flash on damage
```

**Per-type material presets** (array indexed by enemy type):

```javascript
const ENEMY_MATERIAL_PRESETS = [
  { rimPower: 3.5, rimColor: '#88ccff' }, // 0: Drone — sharp
  { rimPower: 2.8, rimColor: '#ffcc88' }, // 1: Grunt — soft
  { rimPower: 5.0, rimColor: '#ffffff' }, // 9: Core — extreme
];
```

**Hit flash decay** — in the animation loop, decay `uHitFlash` to zero:

```javascript
group.traverse(child => {
  if (child.material?.uniforms?.uHitFlash)
    child.material.uniforms.uHitFlash.value *= 0.85;
});
```

On hit: `child.material.uniforms.uHitFlash.value = 1.0;`

---

## 3. Dynamic Vertex-Colored Ground (Reactive Map)

**Problem:** A static ground grid makes the map feel dead. No feedback
about where enemies are, where towers are, or what wave it is.

**Pattern:** Store the original vertex colors at build time, then every
frame compute per-tile color shifts based on proximity to enemies and
towers. Upload via `colorAttr.needsUpdate = true`.

```javascript
// In _buildMeshes(): store original colors
this._groundOrigColors = new Float32Array(allColors);

// In _updateDynamicGround(dt, enemies, towers, wave):
for (let qy = 0; qy < GRID_ROWS; qy++) {
  for (let qx = 0; qx < GRID_COLS; qx++) {
    // Enemy proximity → red heat
    let enemyHeat = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(qx+0.5 - e.mesh.position.x, qy+0.5 - e.mesh.position.z);
      if (dist < 1.5) enemyHeat = Math.max(enemyHeat, 1 - dist / 1.5);
    }
    // Tower proximity → blue glow
    let towerGlow = 0;
    for (const t of towers) {
      const dist = Math.hypot(qx+0.5 - t.pos.x, qy+0.5 - t.pos.z);
      if (dist < 1.2) towerGlow = Math.max(towerGlow, (1 - dist / 1.2) * 0.5);
    }
    // Path tiles: pulse + wave shift
    // Buildable tiles: shift toward red near enemies, blue near towers
    // Write to all 6 vertices of this tile
  }
}
colorAttr.needsUpdate = true;
```

**Performance:** 56×40 = 2240 tiles, 6 vertices each = 13440 color writes
per frame. This is fine for a game-loop update but avoid doing it at
higher grid densities without throttling.

---

## 4. Death Dissolve + Spawn Burst (Entity Lifecycle Feedback)

**Death dissolve:** Instead of `scene.remove(enemy.mesh)` instantly,
move the enemy to a `_dying` queue and animate scale→0 + opacity→0
over 0.3-0.4 seconds.

```javascript
_beginDeathDissolve(enemy) {
  const i = this.enemies.indexOf(enemy);
  if (i >= 0) this.enemies.splice(i, 1);
  // Make all materials transparent for fade
  enemy.mesh.traverse(child => {
    if (child.material?.opacity !== undefined) {
      child.material._origOpacity = child.material.opacity;
      child.material.transparent = true;
      child.material.depthWrite = false;
    }
  });
  this._dying.push({ mesh: enemy.mesh, life: 0.35 });
}

// In update():
for (let i = this._dying.length - 1; i >= 0; i--) {
  const d = this._dying[i];
  d.life -= dt;
  const t = Math.max(0, d.life / 0.35);
  d.mesh.scale.setScalar(t);
  d.mesh.traverse(child => {
    if (child.material?._origOpacity)
      child.material.opacity = t * child.material._origOpacity;
  });
  if (d.life <= 0) {
    this.scene.remove(d.mesh);
    this._disposeGroup(d.mesh);
    this._dying.splice(i, 1);
  }
}
```

**Spawn burst:** On spawn, set `group.scale.set(0.01, 0.01, 0.01)`, then
ease-in with cubic easing over 0.3s. Also spawn an expanding additive ring:

```javascript
_spawnBurst(worldPos, color) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.04, 8, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(worldPos).setY(0.05);
  this.scene.add(ring);
  this._spawnFX.push({ mesh: ring, life: 0.4 });
}

// In update: scale ring up, fade opacity, remove when done
```

---

## 5. Tower Rotation Toward Target + Firing Recoil

**Pattern:** Track `_targetAngle` (computed from tower→target direction)
and `_currentAngle` (smoothed lerp), plus `_recoilY` for spring-back
vertical dip on fire.

```javascript
// Called on fire:
aimAt(t, worldTarget) {
  const dx = worldTarget.x - t.pos.x;
  const dz = worldTarget.z - t.pos.z;
  t._targetAngle = Math.atan2(dx, dz);
}
recoil(t) { t._recoilY = -0.12; }

// In update():
let diff = t._targetAngle - t._currentAngle;
while (diff > Math.PI) diff -= Math.PI * 2;
while (diff < -Math.PI) diff += Math.PI * 2;
t._currentAngle += diff * Math.min(1, 8 * dt);
t.mesh.rotation.y = t._currentAngle;

t._recoilY += (0 - t._recoilY) * 6 * dt;  // spring-back to 0
t.mesh.position.y = t._recoilY;
```

---

## 6. Top-Down Camera for TD Games

For a perpendicular top-down view:
- Camera position: `(centerX, height, centerZ)` directly above
- Camera lookAt: `(centerX, 0, centerZ)` straight down
- WASD pans X/Z, scroll wheel changes height proportionally
- Zoom: `pan.y += sign(delta) * pan.y * 0.08` (proportional, finer close-up)
- Min/max zoom: 12 to 80 units

---

## 7. Economy & HP Wave Scaling (TD Balance)

**Kill reward formula** (keep it from running away):
```
reward = floor(baseReward * (1 + (wave - 1) * killWaveScale) / 5)
```
With `killWaveScale = 0.15`, this gives:
- Wave 1: 1× base
- Wave 10: 2.35× base (÷5 = controlled gold flow)
- Wave 50: 8.35× base

**Enemy HP scaling:**
```
scaledHp = floor(baseHp * (1 + (wave - 1) * HP_WAVE_SCALE))
```
With `HP_WAVE_SCALE = 0.20`:
- Wave 1: 1× base
- Wave 10: 2.8× base
- Wave 50: 10.8× base
- Wave 150: 30.8× base

**Spawn count:**
```
count = floor(mobsBase + mobsGrow * wave)
```
With `mobsBase=4, mobsGrow=0.5`: wave 1 has 4 enemies, wave 50 has 29.