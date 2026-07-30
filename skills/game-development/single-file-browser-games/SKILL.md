---
name: single-file-browser-games
description: Create standalone 2D HTML5 canvas browser games in a single HTML file with no build step or external dependencies. For Three.js games with multiple systems, prefer Vite multi-file projects (see 'When to Use' section below). Use when asked for a playable game file, flappy-style game, arcade demo, or any one-file browser game.
---

# Single-File Browser Games

Create self-contained HTML5 games as one `.html` file: no bundlers, no CDNs, no asset pipeline.

## File Structure

- Single `.html` containing `<style>`, `<canvas>`, overlay `<div>`s, then `<script>` IIFE.
- Canvas renders gameplay; HTML/CSS overlays handle start screen, HUD, and game-over panels for crisp text and trivial CSS animations.
- Responsive: use a fixed logical resolution (e.g. `BASE_W/BASE_H`) and scale via `canvas.width/height` + `ctx.setTransform`. Keep a `SCALE` factor.

## Tuning Workflow

Expose gameplay constants at the top of the physics block so they are easy to adjust without touching game logic:

```js
const GRAVITY      = 0.38;
const FLAP_IMPULSE = -6.8;
const PIPE_GAP     = 168;   // vertical pass space
const PIPE_W       = 72;
const PIPE_SPEED   = 2.6;
const PIPE_SPAWN   = 475;   // horizontal gap between pipes in world coords
```

Playability tuning order:
1. **Comfort first:** increase `PIPE_GAP` if the player keeps dying in tight passages.
2. **Read time:** increase `PIPE_SPAWN` to widen horizontal space between obstacles. The user’s default target is roughly `5×` the original spawn distance.
3. **Feel second:** tweak `FLAP_IMPULSE` / `GRAVITY` for snappiness, then `PIPE_SPEED` for difficulty curve.

## Input

- Keyboard: bind by `event.code` for layout-independent AZERTY/QWERTY compatibility.
- Pointer/touch: `pointerdown` on canvas plus `touchstart` preventDefault to avoid zoom/scroll. Use a small helper to avoid double-fire from simultaneous pointer+touch events on mobile.

## Visual Stack

- Use additive blending (`globalCompositeOperation = 'lighter'`) for particles and thruster trails.
- Glow: `ctx.shadowBlur` + `ctx.shadowColor`. Reset to `0` after glow passes.
- Parallax: separate star layers with per-star `speed` and `twinkle`; nebulae as low-opacity radial gradients.
- Screen shake: apply `ctx.translate` jitter from a countdown timer during death, then restore.

## State Machine

Avoid spaghetti conditionals. Use explicit states:

```js
const STATE = { IDLE: 0, PLAYING: 1, DYING: 2, DEAD: 3 };
```

- `IDLE`: start screen showing animated ship / idle input.
- `PLAYING`: update physics, spawn obstacles, score, collision.
- `DYING`: ship falls off screen after explosion; particles continue.
- `DEAD`: game-over UI visible; input returns to `IDLE`.

## When to Use Single-File vs Multi-File (Vite + Three.js)

This skill covers **single-file HTML canvas games** (2D, no build step). Use it for:
- Quick arcade prototypes (flappy bird, breakout, platformer demos)
- 2D canvas-only games with simple state machines
- Shareable `.html` files that open anywhere

For **Three.js games with multiple systems, procedural worlds, or roguelite progression**, prefer a Vite multi-file project instead:
- ES module structure with `src/core/`, `src/systems/`, `src/entities/`, `src/visuals/`, `src/ui/`
- The `game-architecture` skill's layer pattern (EventBus, GameState, Constants, Orchestrator)
- References like `tower-defense-bootstrap.md` and `procedural-3d-terrain-grid.md` for prebuilt patterns
- Single-file Three.js games become unmanageable beyond 500 lines due to importmap complexity, lack of tree-shaking, and flat namespace

Rule of thumb: if the game needs more than 3 systems (input, physics, enemies), or persistent meta-progression, or procedural generation, reach for Vite + ES modules.

## Reference

See `references/nova-drift-tuning.md` for a concrete tuning cookbook and hitbox/input port choices.
See `references/tower-defense-bootstrap.md` for a Vite/Three.js tower-defense bootstrap pattern and a Browserbase-compatible blank-page debugging ladder.
See `references/bootstrap-pitfalls.md` for common Three.js+Vite startup crashes — importmap conflicts, RenderPass null camera, constructor ordering, and `.position.set()` chaining.
See `references/td-visual-polish.md` for Three.js tower-defense visual FX patterns — fresnel rim shaders, death dissolve, spawn bursts, dynamic ground coloring, galaxy backgrounds, health bars, range circles, tower rotation/recoil, path flow dots, ambient dust.
See `references/threejs-model-factory.md` for the composite Group model pattern — building visually distinctive entity models with named animation hooks for tower-defense and entity-heavy Three.js games.
