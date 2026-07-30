# Nova Drift Tuning Reference

Session: 2026-07-24, files: `/home/neo/Desktop/nova-drift.html`

## Final Tuned Constants

```js
const GRAVITY      = 0.38;
const FLAP_IMPULSE = -6.8;
const PIPE_GAP     = 168;   // initial 148 → widened for comfort
const PIPE_W       = 72;
const PIPE_SPEED   = 2.6;
const PIPE_SPAWN   = 475;   // initial 95 → ~5x horizontal spacing
const SHIP_X       = 120;
```

## Validated Decisions

- **Vertical gap**: `148 → 168` reduces death-by-tight-pass without trivializing the run.
- **Horizontal spacing**: `95 → 475` gives ~5x more reaction time between obstacles. This is the dominant playability lever; adjust before changing gravity or speed.
- **Hitbox**: ship collision box is intentionally smaller than visual (`size*0.4`, `size*0.3`) so deaths feel fair.
- **Keyboard binding by `event.code`** supports AZERTY/WASD diamond and physical arrow keys.

## Pitfalls

- Increasing horizontal distance too far will reduce pipe count and make score pacing feel slow. Next tuning step before shrinking `PIPE_SPAWN` back down: increase `PIPE_SPEED` to keep challenge density.
- `PIPE_SPAWN` is measured in update-frame count, not pixels. If you raise `PIPE_SPEED`, you normally want proportionally larger `PIPE_SPAWN`.

## Quick Copy

If resuming work, file is at `/home/neo/Desktop/nova-drift.html`.
