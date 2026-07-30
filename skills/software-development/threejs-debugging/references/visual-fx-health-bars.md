# DOM Overlay Health Bars & Damage Numbers via 3D→2D Projection

## Problem

Three.js games need HUD elements (health bars, damage numbers, nameplates) that
follow 3D entities on screen. Sprite-based approaches (canvas textures,
billboarded planes) are clunky — text looks blurry, scaling breaks, and
performance degrades with many sprites.

## Solution: DOM Overlays with Vector3.project()

Use a fixed-position `<div>` overlay (`pointer-events:none;z-index:3;`)
and position child `<div>` elements by projecting 3D world positions to
screen coordinates with `THREE.Vector3.project(camera)`.

```javascript
import * as THREE from 'three';

const W = () => window.innerWidth;
const H = () => window.innerHeight;

function worldToScreen(pos, camera) {
  const v = pos.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * W(),   // NDC → pixels
    y: (-v.y * 0.5 + 0.5) * H(),
    visible: v.z < 1,               // behind camera → skip
  };
}
```

### Health Bar Pattern

```javascript
setHealthBars(enemies, camera) {
  const seen = new Set();
  for (const e of enemies) {
    if (e.dead) continue;
    const screen = worldToScreen(e.mesh.position, camera);
    if (!screen.visible) continue;

    // Get or create bar element
    let entry = this._bars.get(e.id);
    if (!entry) {
      const outer = document.createElement('div');
      outer.style.cssText = 'position:absolute;width:36px;height:4px;background:rgba(0,0,0,0.6);border-radius:2px;transform:translate(-50%,0);';
      const bar = document.createElement('div');
      bar.style.cssText = 'height:100%;border-radius:2px;';
      outer.appendChild(bar);
      this._overlay.appendChild(outer);
      entry = { el: outer, bar };
      this._bars.set(e.id, entry);
    }

    const pct = (e.hp / e.maxHp) * 100;
    entry.bar.style.width = pct + '%';
    entry.bar.style.background = pct > 50 ? '#22ff88' : pct > 25 ? '#ffcc00' : '#ff4444';
    entry.el.style.left = screen.x + 'px';
    entry.el.style.top  = (screen.y - 14) + 'px';  // offset above entity
  }
  // Cleanup dead
  for (const [id, entry] of this._bars) {
    if (!seen.has(id)) { entry.el.remove(); this._bars.delete(id); }
  }
}
```

### Damage Number Pattern

```javascript
spawnDamage(worldPos, amount, camera) {
  const screen = worldToScreen(worldPos, camera);
  if (!screen.visible) return;

  const el = document.createElement('div');
  el.textContent = '-' + amount;
  el.style.cssText = `position:absolute;color:#ffdd44;font:bold 12px monospace;
    text-shadow:0 0 6px #ffdd44;transform:translate(-50%,0);`;
  el.style.left = screen.x + 'px';
  el.style.top  = screen.y + 'px';
  this._overlay.appendChild(el);

  // Track for animation (rise + fade in game loop)
  this._numbers.push({ el, life: 0.8, vy: 30, y: screen.y });
}

// In update(dt):
for (let i = this._numbers.length - 1; i >= 0; i--) {
  const d = this._numbers[i];
  d.life -= dt;
  d.y -= d.vy * dt;
  d.el.style.top = d.y + 'px';
  d.el.style.opacity = Math.max(0, d.life / 0.8);
  if (d.life <= 0) { d.el.remove(); this._numbers.splice(i, 1); }
}
```

## HTML Setup

```html
<div id="visualFX" style="position:fixed;inset:0;pointer-events:none;z-index:3;"></div>
```

## Integration in Game Loop

```javascript
// After enemy update, before render:
this._visualFX.setHealthBars(this._enemies.enemies);
this._visualFX.update(dt);

// On hit, from CollisionSystem or _towerFire:
this._vfx.spawnDamage(enemy.mesh.position, Math.round(dmg), '#ffdd44');
```

## Performance Notes

- DOM overlays are cheaper than sprite batches for < 100 entities
- `project()` does a matrix multiply per entity — fine for game-loop scale
- Clean up dead entries each frame (the `seen` set pattern above)
- Use `transform:translate(-50%,0)` to center bars above entity
- Offset Y by ~14px so bars hover above, not inside, the entity