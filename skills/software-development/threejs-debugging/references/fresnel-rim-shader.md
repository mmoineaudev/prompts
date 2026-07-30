# Fresnel Rim Shader for Sci-Fi Entities

## Problem

Entities in a dark Three.js scene with standard `MeshStandardMaterial` blend into the
background. The ambient+emissive approach gives a uniform glow but doesn't create
the crisp edge-highlight look that makes sci-fi units read clearly against a dark
backdrop.

## Solution: Custom ShaderMaterial with Fresnel Factor

The key is the dot product between the surface normal and view direction:
`rim = 1.0 - abs(dot(normal, viewDir))` — this produces 0 at the surface center
(facing the camera) and 1 at the edges (grazing angle). Raising it to a power
sharpens the rim:

```glsl
float rim = 1.0 - abs(dot(vNormal, vViewDir));
rim = pow(rim, uRimPower);
```

Then blend: dark center × baseColor + bright rim × emissive + colored rim tint:

```glsl
vec3 col = mix(baseColor * 0.2, baseColor, rim * 0.7 + 0.3);
col += uEmissive * rim * 0.6;
col += uRimColor * rim * 0.35;
```

### Full Shader

**Vertex shader** — pass world-space normal and view direction to fragment:

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

**Fragment shader** — fresnel rim with hit flash support:

```glsl
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uHitFlash;
uniform float uTime;

void main() {
  float rim = 1.0 - abs(dot(vNormal, vViewDir));
  rim = pow(rim, uRimPower);

  float noise = sin(vWorldPos.x * 30.0 + uTime) * sin(vWorldPos.z * 30.0 + uTime * 0.7) * 0.05;
  vec3 baseColor = uColor * (1.0 + noise);

  vec3 col = mix(baseColor * 0.2, baseColor, rim * 0.7 + 0.3);
  col += uEmissive * rim * 0.6;
  col += uRimColor * rim * 0.35;
  col = mix(col, vec3(1.0), uHitFlash * 0.7);

  gl_FragColor = vec4(col, 1.0);
}
```

### Material Presets Per Type

Different entity types get different rim sharpness and tint colors, creating visual
variety without needing entirely different shaders:

```javascript
// Drone — sharp holographic edge
{ rimPower: 3.5, rimColor: '#88ccff' }
// Grunt — softer warm glow
{ rimPower: 2.8, rimColor: '#ffcc88' }
// Tank — dull metallic rim
{ rimPower: 2.0, rimColor: '#cccccc' }
// Core — extreme white-hot edge
{ rimPower: 5.0, rimColor: '#ffffff' }
```

### Hit Flash

The `uHitFlash` uniform provides damage feedback: set to `1.0` on hit, decay in
`update()` with `uHitFlash.value *= 0.85` each frame:

```javascript
static flashEnemy(group) {
  group.traverse(child => {
    if (child.material?.uniforms?.uHitFlash) {
      child.material.uniforms.uHitFlash.value = 1.0;
    }
  });
}
```

### Usage Notes

- Set `transparent: false` and `depthWrite: true` — the rim glow comes from the
  shader math, not alpha blending
- The `uTime` uniform drives subtle surface noise for visual detail
- Pass `uHitFlash` on `spawn` and decay in the animation loop
- Rim power range: 1.5 (ghostly/wide glow) to 5.0 (sharp/crisp holographic)