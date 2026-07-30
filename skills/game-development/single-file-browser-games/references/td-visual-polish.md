# Tower Defense Visual Polish Patterns

Techniques used in a Three.js/Vite tower-defense project. Each pattern is
self-contained — copy the code block, adapt colors/names, it should work.

## Fresnel Rim Shader for Enemies

Problem: enemies use `MeshStandardMaterial` which looks flat against a dark
scene background. All 10 enemy types feel same-y despite different geometry.

Solution: replace with a custom `ShaderMaterial` that applies a rim/fresnel
glow to edges. The result: dark interiors, bright edges — every enemy pops
instantly against `#05060d`.

```glsl
// vertex shader
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}

// fragment shader
varying vec3 vNormal;
varying vec3 vViewDir;
uniform vec3 uColor;
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uHitFlash;

void main() {
  float rim = 1.0 - abs(dot(vNormal, vViewDir));
  rim = pow(rim, uRimPower);
  vec3 col = mix(uColor * 0.2, uColor, rim * 0.7 + 0.3);
  col += uColor * 0.6 * rim;            // emissive rim
  col += uRimColor * rim * 0.35;        // colored highlight
  col = mix(col, vec3(1.0), uHitFlash * 0.7);  // damage flash
  gl_FragColor = vec4(col, 1.0);
}
```

Per-type material presets with different `rimPower` and `rimColor`:
- Drone (sharp, cyan edge): `rimPower: 3.5, rimColor: '#88ccff'`
- Grunt (soft, warm): `rimPower: 2.8, rimColor: '#ffcc88'`
- Tank (dull, metallic): `rimPower: 2.0, rimColor: '#cccccc'`
- Core (extreme, white-hot): `rimPower: 5.0, rimColor: '#ffffff'`

Hit flash: set `uHitFlash = 1.0` on damage, decay `*= 0.85` each frame.

## Death Dissolve Animation

Instead of instant `scene.remove()`, track dying enemies in a `_dying` queue
and animate scale-to-zero + fade over ~0.35s:

```javascript
// On kill — move to _dying, splice from living array:
_enemy.dead = true;
_enemy.mesh.traverse(c => {
  if (c.material && c.material.opacity !== undefined) {
    c.material.transparent = true;
    c.material.depthWrite = false;
  }
});
this._dying.push({ mesh: _enemy.mesh, life: 0.35 });

// In update() — animate dying queue:
for (let i = this._dying.length - 1; i >= 0; i--) {
  const d = this._dying[i];
  d.life -= dt;
  const t = Math.max(0, d.life / 0.35);
  d.mesh.scale.setScalar(t);
  d.mesh.traverse(c => {
    if (c.material && c.material.opacity !== undefined) {
      c.material.opacity = t;
    }
  });
  if (d.life <= 0) { scene.remove(d.mesh); disposeGroup(d.mesh); this._dying.splice(i, 1); }
}
```

## Spawn Burst Effect

Expanding ring that grows and fades when enemy spawns:

```javascript
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(0.3, 0.04, 8, 16),
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false })
);
ring.rotation.x = -Math.PI/2; ring.position.copy(worldPos);
this.scene.add(ring);
this._spawnFX.push({ mesh: ring, life: 0.4 });
// In update: scale up (1→3.5×), fade opacity (0.8→0), remove at life ≤ 0
```

For the enemy itself: spawn at `scale(0.01)`, then ease-in cubic over 0.3s:

```javascript
if (enemy.spawnAnim > 0) {
  enemy.spawnAnim -= dt;
  const st = Math.min(1, 1 - enemy.spawnAnim / 0.3);
  const eased = 1 - Math.pow(1 - st, 3);  // ease-out cubic
  enemy.mesh.scale.setScalar(Math.max(0.01, eased));
}
```

## Dynamic Ground Coloring

Vertex-colored ground grid that shifts based on enemy and tower positions.
Store original colors after building, then compute per-tile blends each frame:

```javascript
// After building grid:
this._groundOrigColors = new Float32Array(allColors);

// Each frame in _updateDynamicGround(enemies, towers, wave):
for (let qy = 0; qy < GRID_ROWS; qy++) {
  for (let qx = 0; qx < GRID_COLS; qx++) {
    // Proximity to enemies → red/warm (radius 1.5 tiles)
    let enemyHeat = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(qx + 0.5 - e.mesh.position.x, qy + 0.5 - e.mesh.position.z);
      if (dist < 1.5) enemyHeat = Math.max(enemyHeat, 1 - dist / 1.5);
    }
    // Proximity to towers → blue/cool (radius 1.2 tiles)
    let towerGlow = 0;
    for (const t of towers) {
      const dist = Math.hypot(qx + 0.5 - t.pos.x, qy + 0.5 - t.pos.z);
      if (dist < 1.2) towerGlow = Math.max(towerGlow, (1 - dist / 1.2) * 0.5);
    }
    // Blend: path tiles pulse, buildable tiles shift warm/cool
    // Write to all 6 vertices per tile, then colorAttr.needsUpdate = true
  }
}
```

Performance note: 56×40 grid = 2240 tiles, 13440 vertices. Updates are fast
(no allocation, just float writes) but call only once per frame.

## Galaxy Background (Dense Moving Stars)

Replace a simple 200-star ring with a multi-layer galaxy:

- 3 parallax layers at radii 50/80/120, total 6000 stars
- Spiral arm distribution: `angle * 3` arm pattern with density variation
- Color distribution: 60% blue-white → 25% yellow → 10% orange → 5% red
- Per-layer rotation speeds for depth parallax (near: fast, far: slow)
- 4 nebula cloud planes with noise-based transparency shaders
- 60 bright foreground stars with opacity twinkle
- All use `vertexColors` + `AdditiveBlending` against dark background

## Health Bars & Damage Numbers (DOM Overlay)

DOM is crisper and cheaper than Three.js sprites. Project 3D positions to screen:

```javascript
function project(pos, camera) {
  const v = pos.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    visible: v.z < 1,
  };
}
```

Health bars: `<div>` per enemy, positioned via `style.left/top`, color green→yellow→red.
Damage numbers: floating `<div>` that rises and fades over 0.8s.

## Range Circle on Placement

Show the selected tower's exact range while in build mode:

```javascript
// Create once in constructor:
this._rangeRing = new THREE.Mesh(
  new THREE.TorusGeometry(1, 0.03, 8, 48),
  new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0.35, depthWrite: false })
);
this._rangeRing.rotation.x = -Math.PI/2;
this._rangeRing.visible = false;
this.towers.scene.add(this._rangeRing);

// On hover during build mode:
const def = TOWER_DEFS[this._selectedType];
this._rangeRing.visible = true;
this._rangeRing.scale.setScalar(def.range);
this._rangeRing.position.set(tile.qx + 0.5, 0.06, tile.qy + 0.5);
```

## Tower Rotation + Recoil

Smoothly rotate towers toward targets, with a spring-back recoil on fire:

```javascript
// Tower properties:
tower._targetAngle = 0;   // set by aimAt()
tower._currentAngle = 0;  // lerped each frame
tower._recoilY = 0;       // recoil offset

// Aim: compute angle to target
aimAt(t, worldTarget) {
  t._targetAngle = Math.atan2(worldTarget.x - t.pos.x, worldTarget.z - t.pos.z);
}

// Fire: trigger recoil dip
recoil(t) { t._recoilY = -0.12; }

// Update: smooth rotation lerp + recoil spring
let diff = t._targetAngle - t._currentAngle;
while (diff > Math.PI) diff -= Math.PI * 2;
while (diff < -Math.PI) diff += Math.PI * 2;
t._currentAngle += diff * Math.min(1, 8 * dt);
t.mesh.rotation.y = t._currentAngle;
t._recoilY += (0 - t._recoilY) * 6 * dt;
t.mesh.position.y = t._recoilY;
```

## Path Flow Dots & Ambient Dust

Energy dots traveling along the path centerline (24 dots, additive glow).
80 ambient dust particles floating above the map with subtle opacity twinkle.
Both use `PointsMaterial` with `AdditiveBlending`.