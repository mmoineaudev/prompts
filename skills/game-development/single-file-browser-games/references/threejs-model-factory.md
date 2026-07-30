# Three.js Model Factory Pattern — Distinct Entity Models

## Problem

A tower-defense or entity-heavy Three.js game uses a single generic geometry
for every tower (e.g. `CylinderGeometry`) and every enemy (e.g.
`IcosahedronGeometry`). All entities look identical apart from color. The
player can't tell a Plasma Mortar from a Rail Sentry at a glance, and
enemies blur together.

## Pattern

Create a dedicated `ModelFactory` module that exports static methods for
building each entity type. Each method returns a `THREE.Group` containing
multiple child meshes with **named identifiers** (`mesh.name = '_glowCore'`,
`'_ring'`, `'_body'`) so the game loop can target specific parts for:

- **Idle animations**: glow pulsing, ring rotation, bobbing, crystal spin
- **Combat feedback**: emissive flash on fire, engine pulse on sprint
- **Cleanup**: a single `traverse` call disposes all child geometry/materials

## Key design rules

### 1. Named children for animation hooks
```javascript
const glow = new THREE.Mesh(geo, glowMat);
glow.name = '_glowCore';  // ← animateTarget picks this up
g.add(glow);

const ring = new THREE.Mesh(torus, ringMat);
ring.name = '_ring';      // ← rotated each frame
g.add(ring);
```

### 2. Shared geometry for identical shapes
```javascript
const _sharedBase = new THREE.CylinderGeometry(0.22, 0.28, 0.35, 8);
// Reused across all tower pedestals — saves VRAM
```

### 3. Material helpers reduce repetition
```javascript
function _towerMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex), emissive: new THREE.Color(hex),
    emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.7,
  });
}
```

### 4. Public API is two static methods
```javascript
export default class ModelFactory {
  static buildTower(defIdx) { return buildFns[defIdx]; }
  // Returns: (color) => THREE.Group   — the caller passes def.color
  static buildEnemy(defIdx, scale, color) { ... }
  // Returns: THREE.Group

  static animateTower(group, defIdx, time) { /* per-frame */ }
  static animateEnemy(group, defIdx, time, speed) { /* per-frame */ }
}
```

### 5. Caller passes per-instance params (color, scale)
The factory doesn't import constants directly — it receives color and scale
as arguments so the same factory works for any palette or scaling system.

## Tower design catalog (10 types)

| # | Name | Distinctive shape | Animation hook |
|---|------|-------------------|----------------|
| 0 | Pulse Emitter | Dish + antenna | `_glowCore` pulse |
| 1 | Arc Spool | Coil ring + core | `_ring` rotate, `_glowCore` pulse |
| 2 | Rail Sentry | Tall pillar + fin | `_glowCore` pulse |
| 3 | Plasma Mortar | Wide barrel + muzzle | `_glowCore` pulse |
| 4 | Frost Core | Octahedron crystal | `_crystal` rotate, `_glowCore` halo pulse |
| 5 | Beam Harvester | Cone dish | `_dish` bob, `_glowCore` pulse |
| 6 | Tesla Coil | Coil body + top ring | `_ring` rotate, `_glowCore` pulse |
| 7 | Railgun Array | Twin barrels | `_glowCore` pulse |
| 8 | Ion Storm | Orb + torus | `_ring` rotate, `_glowCore` pulse |
| 9 | Singularity | Dark core + accretion ring + halo disc | `_ring` rotate, `_glowCore` pulse |

## Enemy design catalog (10 types)

| # | Name | Distinctive shape | Animation hook |
|---|------|-------------------|----------------|
| 0 | Drone | Octahedron | `_body` rotate, `_eye` pulse |
| 1 | Grunt | Box + 4 cone spikes | `_body` (parent hover-bob) |
| 2 | Shield Bearer | Sphere + torus shield | `_shield` rotate |
| 3 | Sprinter | Cone (forward-pointed) | `_engine` scale pulse |
| 4 | Splitter | Dual lobes + center connector | `_body` rotate, `_lobe` hover |
| 5 | Tank | Hexagonal prism + armor plates | `_body` hover-bob |
| 6 | Teleporter | Semi-transparent sphere + tilted ring | `_ring` rotate, `_body` rotate |
| 7 | Warlord | Dodecahedron + 5 horns + eye | `_eye` pulse, `_horn` hover |
| 8 | Mothership | Double domed saucer + rim ring | `_rim` rotate |
| 9 | Core | Sphere + 2 tilted orbital rings | `_ringA`/`_ringB` rotate |

## Integration points

### TowerManager changes
```javascript
import ModelFactory from './ModelFactory.js';

place(state, tileIdx, qx, qy, defIdx, pathSet) {
  // ... validation ...
  const group = ModelFactory.buildTower(defIdx)(def.color);
  group.position.copy(pos);
  this.scene.add(group);
  const tower = { ..., mesh: group, pos, ... };
}

update(dt, state) {
  this._time += dt;
  for (const t of this.towers) {
    ModelFactory.animateTower(t.mesh, t.defIdx, this._time);
    // Emissive lerp-back after flash
    t.mesh.traverse(child => {
      if (child.material?.emissiveIntensity !== undefined) {
        const base = 1.2 + t.level * 0.8;
        child.material.emissiveIntensity += (base - child.material.emissiveIntensity) * 5 * dt;
      }
    });
  }
}
```

### EnemyManager changes
```javascript
import ModelFactory from './ModelFactory.js';

spawnWave(queue, pathSystem) {
  queue.forEach(item => {
    const def = ENEMY_DEFS[item.defIdx];
    const group = ModelFactory.buildEnemy(item.defIdx, def.scale, def.color);
    // ... position, add to scene ...
  });
}

update(dt) {
  this._time += dt;
  for (const enemy of this.enemies) {
    if (enemy.dead) continue;
    ModelFactory.animateEnemy(enemy.mesh, enemy.defIdx, this._time, enemy.speed);
    // ... movement logic ...
  }
}
```

### Dispose cleanup (Groups contain child meshes)
```javascript
_disposeGroup(group) {
  group.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
}
```

## When to use this pattern

- Any Three.js game with 5+ entity types that need visual differentiation
- When entities need per-frame idle animations (glow, spin, bob)
- When entities need combat-feedback hooks (flash, shake, scale pulse)
- When you want a single file as the authority on "what does X look like"

Don't use this pattern for:
- A game with only 1-2 entity types (a simple geometry per type is fine)
- Entities that use external GLTF/glb models (ModelFactory is for procedural geometry)

## Fresnel Rim Shader for Enemies

Flat `MeshStandardMaterial` on all enemies makes them bleed into a dark background.
A custom `ShaderMaterial` with a fresnel/rim effect — dark center, bright edges —
makes every enemy pop and look neon/sci-fi.

**Vertex shader** passes world-space normal and view direction:
```glsl
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
```

**Fragment shader** computes the rim factor and mixes base color with edge glow:
```glsl
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform vec3 uRimColor;
uniform float uRimPower;   // 1.5 (soft/ghostly) to 5.0 (sharp/holographic)
uniform float uHitFlash;   // 0→1 on damage, decays each frame

void main() {
  float rim = 1.0 - abs(dot(vNormal, vViewDir));
  rim = pow(rim, uRimPower);
  vec3 col = mix(uColor * 0.2, uColor, rim * 0.7 + 0.3);
  col += uEmissive * rim * 0.6;
  col += uRimColor * rim * 0.35;
  col = mix(col, vec3(1.0), uHitFlash * 0.7);  // white overlay on hit
  gl_FragColor = vec4(col, 1.0);
}
```

**Material presets per enemy type** (tuned rim + tint):
```javascript
const ENEMY_MATERIAL_PRESETS = [
  { rimPower: 3.5, rimColor: '#88ccff' },  // 0: Drone — sharp cyan-white
  { rimPower: 2.8, rimColor: '#ffcc88' },  // 1: Grunt — softer warm edge
  { rimPower: 5.0, rimColor: '#ffffff' },  // 9: Core — extreme white-hot
  // ... one per defIdx
];
```

**Hit flash** — set `uHitFlash = 1.0` on damage, decay by `* 0.85` per frame:
```javascript
static flashEnemy(group) {
  group.traverse(child => {
    if (child.material?.uniforms?.uHitFlash) {
      child.material.uniforms.uHitFlash.value = 1.0;
    }
  });
}
```

## Visual Polish Catalog

Techniques that compound with the model factory to elevate the game's feel:

| Technique | Implementation | Files touched |
|-----------|---------------|---------------|
| **Death dissolve** | Track dying enemies in `_dying[]` queue. Animate `scale.setScalar(t)` and `material.opacity = t` over 0.35s, then remove. | EnemyManager |
| **Spawn burst** | Create an expanding additive torus ring that scales from 1→3.5× and fades over 0.4s at the spawn point. Start enemies at 0.01 scale, ease-in cubic over 0.3s. | EnemyManager |
| **Health bars** | DOM divs positioned via 3D→2D projection (`pos.project(camera)`). Green→yellow→red gradient. Mapped `enemy.id → {el, bar}`. Clean up on death. | VisualFX system |
| **Damage numbers** | Floating DOM text ("-1.5") that rises and fades over 0.8s from hit world-pos. Spawned from both projectile collisions and beam ticks. | VisualFX system |
| **Tower rotation** | `atan2(dx, dz)` computes angle to target; smooth `lerp` in `update()`. `recoil()` dips tower 0.12 units on fire, springs back. | TowerManager |
| **Range circle** | Green additive torus, `scale.setScalar(def.range)`, shown at cursor while in build mode. Hidden on place/cancel. | GameplaySystem |
| **Path energy flow** | 24 `THREE.Points` dots animate along centerline (`offset += dt * speed`). Loops at 100%. Shows enemy flow direction. | PathSystem |
| **Ambient dust** | 80 tiny blue-white `THREE.Points` floating above map, additive blending, opacity twinkle via `sin(time)`. | PathSystem |
| **Enemy hit flash** | `flashEnemy(group)` sets rim shader `uHitFlash=1.0` on any collision. Decays over ~200ms. Also flash splash-hit enemies. | CollisionSystem |