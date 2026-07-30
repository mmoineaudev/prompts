# Procedural 3D Terrain Grid — InstancedMesh Voxel Pattern

For games with a grid-based 3D world (mining, dungeon crawlers, voxel builders, city builders) rendered with Three.js.

## Data Structure

Store terrain as a flat typed array indexed by `x + z * WIDTH + y * WIDTH * DEPTH`:

```js
const total = WIDTH * DEPTH * HEIGHT;
const data = new Uint8Array(total);
function idx(x, y, z) { return x + z * WIDTH + y * WIDTH * DEPTH; }
```

Use `Uint8Array` for memory efficiency — 20×20×50 = 20,000 cells at ~20KB.

## Rendering with InstancedMesh

One draw call per tile type, not one mesh per tile:

```js
const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
const material = new THREE.MeshLambertMaterial({ roughness: 0.8 });
this._mesh = new THREE.InstancedMesh(geometry, material, tileCount);

const dummy = new THREE.Object3D();
const color = new THREE.Color();

tiles.forEach((t, i) => {
  dummy.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
  color.setHex(TILE_COLORS[t.type]);
  mesh.setColorAt(i, color);
});

mesh.instanceMatrix.needsUpdate = true;
mesh.instanceColor.needsUpdate = true;
```

**Per-instance color** via `setColorAt()` lets you color-code tile types without separate materials or textures.

### Removing a Tile (Digging)

Store per-instance metadata (position, type, active flag) in parallel arrays so you can find the right instance:

```js
// On dig:
const dummy = new THREE.Object3D();
dummy.position.set(wx, wy, wz);
dummy.scale.set(0, 0, 0);  // hide instead of remove
dummy.updateMatrix();
mesh.setMatrixAt(instanceIdx, dummy.matrix);
mesh.instanceMatrix.needsUpdate = true;
instanceData.active[instanceIdx] = 0;
```

Do NOT rebuild the entire InstancedMesh on each dig — just zero the instance matrix.

## Procedural Ore Vein Generation

Use cellular-automata blob growth from seed points:

```js
function growVein(data, tileType, sx, sy, sz, minSize, maxSize) {
  const size = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
  const visited = new Set();
  const queue = [{ x: sx, y: sy, z: sz }];
  let placed = 0;

  while (queue.length > 0 && placed < size) {
    const p = queue.shift();
    const key = `${p.x},${p.y},${p.z}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (!inBounds(p.x, p.y, p.z)) continue;
    const cur = getTile(data, p.x, p.y, p.z);
    if (cur !== TILE.STONE && cur !== TILE.DIRT) continue;  // only replace native terrain

    setTile(data, p.x, p.y, p.z, tileType);
    placed++;

    // Randomly shuffled neighbor directions for organic shape
    const dirs = [
      { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
    ];
    shuffleArray(dirs);
    for (const d of dirs) {
      queue.push({ x: p.x + d.x, y: p.y + d.y, z: p.z + d.z });
    }
  }
}
```

Depth-gate ore types: coal shallow (y 4–20), copper mid (y 15–40), gold deep (y 30+).

## Cave Pocket Carving

Same blob growth pattern but set tiles to AIR and skip with 50% probability per neighbor for organic, jagged caves:

```js
function carveCave(data, sx, sy, sz) {
  // ... same queue pattern ...
  for (const d of dirs) {
    if (Math.random() < 0.5) continue;  // keeps caves irregular
    queue.push({ x: p.x + d.x, y: p.y + d.y, z: p.z + d.z });
  }
}
```

## Grid-Based Vehicle Movement with Smooth Interpolation

The vehicle occupies a single grid cell. Movement is grid-locked (snap to tile centers) but interpolated visually:

```js
class Vehicle {
  setTilePosition(x, y, z) {
    this._tileX = x;
    this._tileY = y;
    this._tileZ = z;
    this._targetPos.set(x + 0.5, y + 0.5, z + 0.5);
    this._moveProgress = 0;
  }
```

**CRITICAL — vehicle Y positioning**: The code snippet above places the vehicle at the tile CENTER. In top-down mining games, this puts the vehicle *inside* the tile at the same height as surrounding terrain, making it invisible from the angled camera. Two fixes depending on your coordinate convention:

**Convention A — grid Y is positive downward (depth):** Build the vehicle model so its base sits at local y=0 (treads on ground), then position the group at the tile's TOP face: `(x+0.5, -gridY, z+0.5)` — i.e. `-(tileY)` not `-(tileY + 0.5)`. The vehicle sits ON the tile, visible from above.

**Convention B — grid Y is positive upward:** Build the vehicle model with base at local y=0, position at `(x+0.5, tileY + 1.0, z+0.5)` — one tile-size above the tile center.

The telltale sign of this bug: the player sees terrain everywhere but "the vehicle isn't visible" or "I can't see into the structure." The vehicle is there — it's just buried inside a solid tile at the same depth as everything around it.

**Visual markers for visibility:** Add a small emissive beacon sphere on top of the vehicle (e.g. red `MeshBasicMaterial` sphere at local y=0.65). Even when the rest of the model blends with terrain, a bright colored dot makes the player's position unmistakable.

  update(dt) {
    if (this._moveProgress < 1) {
      this._moveProgress = Math.min(1, this._moveProgress + MOVE_SPEED * dt);
      const t = 1 - Math.pow(1 - this._moveProgress, 3); // ease-out cubic
      this.group.position.lerp(this._targetPos, t);
      if (this._moveProgress >= 1) {
        this.group.position.copy(this._targetPos);
      }
    }
  }
}
```

**Collision checks** happen on the grid data, not physics bodies: check if the target cell is AIR and the cell below is solid before allowing movement.

### Climb Detection

For games where the player can climb walls (mining games with vertical tunnels):

```
player at (px, py, pz), facing direction (dx, 0, dz)
target wall at (px+dx, py, pz+dz) — must be SOLID
space above wall at (px+dx, py-1, pz+dz) — must be AIR
→ climb result: player moves to (px+dx, py-1, pz+dz)
```

Key constraint: **exactly one module owns position state updates**. If both a DigSystem and Vehicle class update `tileX/Y/Z` on GameState for a climb, the player moves two tiles instead of one. Let the Vehicle's movement method be the single source of truth; the DigSystem validates and emits events but does not mutate position.

### Fall Detection

When a tile below the player is removed or the player walks off an edge:

```js
function checkFall(tileX, tileY, tileZ, terrainGen) {
  const below = tileY + 1;
  if (below >= WORLD_HEIGHT) return 0;
  if (terrainGen.get(tileX, below, tileZ) !== TILE.AIR) return 0; // solid ground
  // Count how far the fall is
  let fallDist = 0;
  for (let fy = tileY + 1; fy < WORLD_HEIGHT; fy++) {
    if (terrainGen.get(tileX, fy, tileZ) !== TILE.AIR) break;
    fallDist++;
  }
  return fallDist;
}
```

Move the player down by `fallDist` tiles, apply fall damage proportional to distance, emit PLAYER_FALL event with distance. If `fallDist` exceeds a safe threshold (or reaches WORLD_HEIGHT), treat as lethal.

## Per-Phase Fog Management

When a game has distinct phases with different camera distances (e.g. surface hub at ~28 units vs underground tunnels at ~8 units), the scene fog must change per phase:

```js
// Hub phase — distant camera needs wide fog
this._scene.fog = new THREE.Fog(skyColor, 40, 100);

// Descent phase — tight underground fog for atmosphere + chunk hiding
this._scene.fog = new THREE.Fog(0x111122, 5, 16);
```

Failing to update fog on phase transition is a silent render bug: the scene appears as a blank background-colored screen because every visible object sits beyond the fog FAR distance. Always match fog FAR to `maxCameraDistance + margin` for the active phase.

## Camera for Top-Down Grid Games

Angled 3/4 camera following the vehicle:

```js
const cameraAngle = Math.PI / 3.8; // ~47 degrees
const distance = 22;
const height = 18;

// Follow target with smooth lerp
this._target.lerp(targetPos, Math.min(1, 4 * dt));
const idealX = this._target.x + Math.sin(angle) * distance;
const idealZ = this._target.z + Math.cos(angle) * distance;
const idealY = this._target.y + height;

camera.position.lerp(new THREE.Vector3(idealX, idealY, idealZ), Math.min(1, 4 * dt));
camera.lookAt(this._target.x, this._target.y, this._target.z);
```

Allow mouse-wheel zoom that adjusts distance. Clamp between 8–40 units.

## Performance Notes

- 20×20×50 = 20,000 instances at 1 draw call is well within budget on integrated GPUs.
- Only rebuild instance matrix arrays on dig — one matrix update per interaction, not per frame.
- For larger worlds (100+ deep), implement chunked InstancedMesh: 16×16×16 chunks, only render chunks within camera range.
- Distance fog hides chunk edges and reduces visible draw count.
- Use `MeshLambertMaterial` over `MeshStandardMaterial` for terrain — it's cheaper and flat terrain doesn't need PBR.