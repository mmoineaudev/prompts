# Three.js Init-Order Traps

## The Lazy-Init Pattern

When a subsystem's `createX()` method is called during another system's `init()`, but that subsystem's own `init()` hasn't run yet (or isn't called at all), shared resources are null.

**Symptom:** `Uncaught TypeError: Cannot read properties of null (reading 'morphAttributes')` or similar, traced to a Three.js constructor or helper using a `this._sharedGeo` or `this._sharedMat` that was null.

**Root cause:** The system was designed assuming `init()` is always called first, but the calling chain goes `Parent.init() → Child.init() → _spawnChunk() → Nebula.createCluster()` before `NebulaSystem.init()` runs. Or worse, `init()` is never called on the subsystem at all.

**Fix:** Lazy-initialize shared resources in the method that uses them:

```js
// BEFORE (fragile — depends on init order)
createCluster() {
  // _sharedGeo is null because init() hasn't run
  const billboard = new THREE.Mesh(this._sharedGeo, material);
}

// AFTER (safe regardless of init order)
createCluster() {
  if (!this._sharedGeo) {
    this._sharedGeo = new THREE.PlaneGeometry(1, 1);
  }
  const billboard = new THREE.Mesh(this._sharedGeo, material);
}
```

## The Map.set-before-get Trap

When a Map entry must exist before a called method accesses it, but the entry is set AFTER the call.

**Symptom:** `Uncaught TypeError: Cannot set properties of undefined (setting 'objects')` or `Cannot read properties of undefined`.

**Root cause:** Pattern like this:

```js
// BUG — _spawnChunk calls this._activeChunks.get() but the set hasn't happened yet
this._spawnChunk(cx, cz);
this._activeChunks.set(key, { cx, cz, objects: [] });
// Inside _spawnChunk:
this._activeChunks.get(key).objects = chunkObjects; // 💥 get() returns undefined
```

**Fix:** Create the entry first, then pass it as a parameter:

```js
// SAFE — entry exists before _spawnChunk runs
const chunkEntry = { cx, cz, objects: [] };
this._activeChunks.set(key, chunkEntry);
this._spawnChunk(cx, cz, chunkEntry);
// Inside _spawnChunk:
const chunkObjects = chunkEntry.objects; // direct reference, no .get()
```

## Common Patterns That Trigger These Traps

| Pattern | Why it breaks | Safe approach |
|---------|--------------|---------------|
| `ChunkManager.init() → _spawnChunk() → Nebula.createCluster()` | Nebula init never runs | Lazy-init in createCluster |
| `Map.set(key, val)` after calling method that .get(key) | .get returns undefined | .set before call, or pass val as arg |
| Shared geometry/material created in init() | init() may be skipped or delayed | Lazy-init in first-use method |
| `scene.add()` on objects before scene is ready | Three.js expects scene reference | Check scene reference or defer |

## Diagnostic Checklist

When a Three.js error traces through your system code:

1. Read the stack — identify which method's `this` is null/undefined
2. Trace back: what shared resource does that method use?
3. Check: is that resource created in `init()`? Is `init()` guaranteed to run first?
4. If uncertain → add lazy-init guard `if (!this._resource) this._resource = new ...`
5. For Map-based patterns → ensure `.set()` always happens before any `.get()` on the same key, either by reordering or by passing the value as a parameter.
