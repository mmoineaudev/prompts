# Three.js + Vite Bootstrap Pitfalls

Common crashes when bootstrapping a Three.js game in a Vite project.

## 1. Importmap conflicts with Vite resolution

**Symptom:** Console shows "Ignored an import map value of 'three': Bare specifier"

**Cause:** Using an HTML importmap with explicit paths to `node_modules/three/build/three.module.js`. Vite already resolves bare `'three'` imports from node_modules natively. The importmap conflicts.

**Fix:** Remove the `<script type="importmap">` block entirely. Use bare imports in ES modules:
```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
```

## 2. RenderPass created before camera, or camera is null

**Symptom:** `Uncaught TypeError: Cannot read properties of null (reading 'isCamera')` at `WebGLRenderer.render`

**Cause:** `new RenderPass(scene, null)` or creating the RenderPass/EffectComposer before the CameraSystem is initialized. The RenderPass needs a valid camera reference to render.

**Fix:** Create `CameraSystem` first, then pass `camera.getCamera()` to RenderPass:
```js
this.camera = new CameraSystem();
this._composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, this.camera.getCamera());
this._composer.addPass(renderPass);
```
Never pass `null` as the camera argument to `RenderPass`.

## 3. Constructor ordering: reset() depends on data loaded after it

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'upgrades')` or similar on first frame

**Cause:** The constructor calls `this.reset()` before loading meta-progression or configuration that `reset()` depends on. For example, loading `localStorage` data after calling `reset()` which tries to access it.

**Fix:** Load dependencies before calling reset:
```js
class GameState {
  constructor() {
    this._meta = this._loadMeta(); // load first
    this.reset();                  // then reset
  }
}
```

## 4. Chaining .position.set() on constructors returns Vector3, not the object

**Symptom:** `THREE.Object3D.add: object not an instance of THREE.Object3D. _Vector3`

**Cause:** Method chaining like `new THREE.DirectionalLight(hex, intensity).position.set(x, y, z)` evaluates `.position.set(...)` which returns the Vector3 position, not the light. The Vector3 is what gets passed to `scene.add()` — which rejects it.

**Fix:** Break into separate statements:
```js
const light = new THREE.DirectionalLight(0x8888ff, 0.3);
light.position.set(-10, 20, -10);
scene.add(light);
```
This applies to any `Scene.add(new Thing().property.method())` chain — the return value of the last method is what gets added, not the Thing.
