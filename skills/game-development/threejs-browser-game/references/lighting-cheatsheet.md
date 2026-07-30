# Lighting Cheatsheet

## Scene baseline
```js
const ambient = new THREE.AmbientLight(0x161e33, 0.85);
const sun = new THREE.DirectionalLight(0xddeeff, 1.1);
const fill = new THREE.DirectionalLight(0x5577aa, 0.6);
const rim = new THREE.DirectionalLight(0x335577, 0.4);
const horizon = new THREE.HemisphereLight(0x334466, 0x0a0a0a, 0.35);
```

## When it's too dark
- First: raise ambient, sun, fill, rim, hemisphere intensities/temps.
- Second: add hemisphere light for sky/ground gradient.
- Only then consider bloom/stars as a brightness lever.

## When planets/horizon are invisible
- Increase planet shader fresnel rim multiplier and base alpha floor.
- Add or raise hemisphere light; fog color should not kill distant planets.
- Avoid slamming bloom back to previous highs.

## Ship-mounted lights
- Keep headlight/spot modest; point it forward, not back.
- Accent light is chrome/polish fill, not main illumination.
- Engine glow sprite: scale down and lower opacity before removing.

## Post-processing clamps
- Bloom strength scale with speed ratio, but keep max bounded.
- Chromatic aberration max offset should stay subtle.
