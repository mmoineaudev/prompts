# Starfield Background Patterns for Top-Down Three.js Games

## The Problem

A top-down game needs a space background that feels natural and calm, not artificial. Common mistakes:

1. **Rotating spherical shells of stars** — looks like a planetarium, not deep space
2. **Stars too far away** — invisible due to fog or size attenuation
3. **Stars too small** — `sizeAttenuation: true` shrinks points at distance
4. **Rotation too fast** — feels frantic, not calm
5. **No color variety** — all white stars on black is boring

## The Solution: Flat Drifting Starfield

For a top-down camera, use a flat plane of stars below the grid that slowly scrolls/drifts. This feels like looking down through space.

### Architecture

```
┌─────────────────────────────────┐
│  Camera (top-down, Y=~37)       │
│  ┌───────────────────────────┐  │
│  │  Game grid (Y=0)          │  │
│  └───────────────────────────┘  │
│  ─ ─ ─ ─ stars (Y=-2 to -10) ─ │
│  ─ ─ nebula patches (Y=-3)  ── │
│  ─ ─ bright stars (Y=-4)    ── │
└─────────────────────────────────┘
```

### Key Implementation Details

**1. Flat plane, not a sphere:**
```javascript
positions[i3] = (Math.random() - 0.5) * spread * 2;  // X: random across wide area
positions[i3 + 1] = -2 - Math.random() * 8;           // Y: below the grid
positions[i3 + 2] = (Math.random() - 0.5) * spread * 2;  // Z: random across deep area
```

**2. Drift, don't rotate:**
```javascript
// Wrong — rotation feels artificial:
points.rotation.y += 0.004;

// Right — translation feels like drifting through space:
points.position.x -= driftX * dt;
points.position.z -= driftZ * dt;
// Wrap around when reaching edge:
if (Math.abs(points.position.x) > wrap) points.position.x += -wrap * 2;
```

**3. `sizeAttenuation: false` for consistent visibility:**
```javascript
const mat = new THREE.PointsMaterial({
  size: 1.2,                    // pixels on screen, not world units
  vertexColors: true,
  sizeAttenuation: false,       // CRITICAL: don't shrink at distance
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
```

**4. Fog density must be very low for deep space:**
```javascript
// At distance 300 with density 0.00008: still faintly visible
// At distance 500: naturally gone
scene.fog = new THREE.FogExp2(0x05060d, 0.00008);
```

Rule of thumb: `density ≈ 2 / maxVisibleDistance²`

**5. Color variety with weighted distribution:**
```javascript
const t = Math.random();
if (t < 0.55)      { /* blue-white (most common) */ }
else if (t < 0.75) { /* cool blue */ }
else if (t < 0.88) { /* warm gold */ }
else if (t < 0.95) { /* lavender */ }
else               { /* teal accent */ }
```

**6. Multiple object types for visual richness:**
- **2500 stars** on a flat plane — the bulk of the starfield
- **6 soft nebula patches** — colored `PlaneGeometry` with shader-based soft edges, drifting independently
- **40 bright accent stars** — larger points with gentle opacity twinkle, drifting at different parallax speed

### Performance Notes

- `sizeAttenuation: false` is cheaper than `true` (no per-point distance calculation)
- Flat plane has lower GPU overhead than spherical shells
- Drift + wrap-around is cheaper than rotation (no matrix multiplication per layer)
- Keep total point count under 5000 for smooth 60fps on integrated GPUs

### Natural Feel Checklist

- [ ] Stars drift, don't rotate
- [ ] Multiple parallax speeds (closer = faster)
- [ ] Wrap-around so no edges are visible
- [ ] Color palette has variety (not all white)
- [ ] At least 2-3 different object types (stars, nebulae, brights)
- [ ] Fog is weak enough to see distant objects
- [ ] `sizeAttenuation: false` for consistent brightness
- [ ] Rotation/translation slow enough to feel calm (~0.5-2 units/sec)