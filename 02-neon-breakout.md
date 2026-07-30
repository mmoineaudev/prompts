# Prompt 02: Neon Breakout — "Chain Reaction"

## Role
You are an expert HTML5 game developer. Create a single-file, self-contained web-based brick-breaking paddle game prototype called "Chain Reaction".

## Core Concept
A breakout/arkanoid-style brick-breaking game with a **chain reaction mechanic**: when a ball breaks two adjacent bricks of the same color, they both explode and launch a secondary ball that targets remaining bricks of matching colors. Chain reactions cascade, potentially clearing large sections of the board in spectacular fashion. The twist: instead of one ball always destroying everything, you strategically want to create color matches for combos.

## Technical Requirements
- Single HTML file with embedded CSS and JavaScript (no external dependencies, no image assets)
- Use HTML5 Canvas for all rendering at **800×600** logical resolution with HiDPI support (devicePixelRatio scaling)
- Canvas centered in window, scales responsively while maintaining aspect ratio
- All visuals must be procedural — shapes, lines, glowing rectangles using Canvas API
- Keyboard controls: Arrow keys + Q/D (via event.code, AZERTY compatible) for paddle movement, Space to launch ball
- Mouse/touch support: paddle follows cursor/finger X position. Click/tap to launch ball.
- Game loop using requestAnimationFrame with delta-time physics
- Simple sound feedback using Web Audio API oscillator beeps

## Controls

- **ArrowLeft / Q** — move paddle left (event.code)
- **ArrowRight / D** — move paddle right
- **Space** — launch ball from paddle
- **Mouse/touch move** — paddle center follows cursor X (absolute tracking)
- **Click/tap** — launch ball from paddle

## Gameplay Mechanics

### Paddle and Ball(s)
- **Paddle**: 120×16px glowing bar, cyan (#00ffff), y-position: canvas height - 40px (560 on 600px canvas). Keyboard speed: 500px/s.
- **Ball**: radius 8px, neon white (#ffffff) with 12px cyan ShadowBlur glow. Base speed: **350px/s**, +25px/s per level, capped at 600px/s.
- **Launch**: ball starts stuck to paddle center. Launches at random angle between 45° and 135° (upward cone).
- **Ball bounce on paddle**: angle depends on hit position. Left edge = 150°, center = 90°, right edge = 30°.
- **Lives**: 3 balls. Lose ball → reset to paddle, must re-launch. Game over at 0 balls.
- **Max simultaneous balls**: 5 (chain reaction + multi-ball capped).

### Brick Grid

#### Layout (Levels 1-2)
- 8 columns × 6 rows = 48 bricks
- Colored brick: **75×28px**, 2px gap between bricks
- Grid area: 710px wide (8×75 + 7×2 = 614px), centered horizontally at x=93
- Grid starts at y=60 from top
- 4 colors: each color occupies **2 adjacent columns × 6 rows = 12 bricks** (vertical stripe pattern → adjacent bricks in same column share color, enabling planned chain reactions)
- Color order (left to right): cyan (#00ffff), magenta (#ff00ff), yellow (#ffdd00), green (#00ff66)

#### Brick HP
- Rows 1-3 (bottom): 1 HP
- Row 4: 2 HP
- Rows 5-6 (top): 3 HP
- **HP visualization**: full saturation at max HP → 66% at 2HP → 33% at 1HP (desaturate toward gray)

#### Level 3+ changes
- **Shielded bricks**: top 2 rows gain +2 HP shield overlay (translucent white border on brick). A 3HP top-row brick becomes 5HP effective.
- **Indestructible bricks**: 3 narrow gray (#555555) columns (30px wide each) inserted between the 4 color pairs. Function as permanent walls — balls bounce, can't destroy.
- Rows increase by 1 per level (max 12 rows). At level 12: 12 rows × 11 columns (8 colored + 3 gray) = 96 colored + 36 gray bricks.
- Brick height shrinks proportionally when rows > 6 to fit within same grid height: height = min(28, (canvas_height - 120) / rows).

### Chain Reaction System

#### Trigger
When a ball breaks a brick, check all 4 orthogonally adjacent bricks. If any share the **same color**, they are also destroyed (explosion propagates).

#### Secondary balls
- Each exploded brick in a chain launches a **secondary ball** (radius 4px, same color as brick) toward a random remaining brick of that same color.
- Secondary ball flies in a straight line at 400px/s.
- If no same-color bricks remain, secondary ball fires in a random upward direction.
- **Max 3 secondary balls** per chain reaction trigger.
- Secondary balls count toward the 5-ball max.

#### Cascade limit
- Chains stop after **5 cascade levels** (depth counter). Level 1 = initial brick, level 2 = its orthogonal neighbors, etc.

#### Visual feedback
- **Brick explosion**: expanding ring animation — grows from 0 to 60px radius over 0.4s, matched to brick color, fades alpha 1→0.
- **Particle burst**: 4-8 small squares (6×6px) fly outward from destroyed brick at random angles, 300px/s, fade over 0.5s.
- **Chain indicator**: brief "+X CHAIN" text at explosion point, yellow, rises and fades.

### Power-ups

20% chance to drop when any brick is destroyed. Falls at 150px/s straight down, bounces off walls and paddle. Collected when paddle overlaps. Lasts until caught or falls off screen.

| Power-up | Color | Icon | Effect | Duration |
|----------|-------|------|--------|----------|
| Wide Paddle | Cyan | W | Paddle width ×1.5 | 10s |
| Multi-ball | Magenta | M | Split current ball into 3 (capped at 5 max) | Instant |
| Slow Motion | Yellow | S | All balls at 50% speed | 8s |
| Piercing Shot | Green | P | Ball passes through bricks (no bounce, destroys all it touches) | 5s |

Power-up icon: 24×24px glowing square with white letter, colored to match power-up type.

**Stacking rules**: catching same power-up while active resets its timer (does not stack duration). Wide Paddle additional catches add 25% width but still reset timer. Power-ups clear between levels.

### Level Progression

- Clear all colored bricks → level complete
- Next level: rows +1 (max 12), ball speed +25px/s, paddle resets to default width, all power-ups cleared
- Level 3+: shielded top rows + indestructible gray columns introduced
- Brief "Level Complete" overlay (1.5s) showing score bonus

## Canvas Layout (800×600)

```
┌──────────────────────────────────────────────────────────────┐
│  y=0                                                         │
│  y=30  SCORE: 1,240    LEVEL 3    BALLS: ● ● ○              │  ← HUD
│  y=60  ┌──────────────────────────────────────────────────┐  │
│        │  [cyan][cyan][gray][magenta][magenta][gray]...    │  │  ← Bricks
│        │                                                    │  │
│        │                    (playfield)                     │  │
│        │                                                    │  │
│        │                        ○  (ball)                   │  │
│  y=560 │  ════════════════  (paddle)  ═══════════════════  │  │
│  y=600 └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Scoring

- **Base**: 10 points × chain depth per brick destroyed
  - Depth 1 (initial hit): 10 pts
  - Depth 2 (first adjacent): 20 pts
  - Depth 3: 30 pts, etc.
- **Combo bonus**: 50 pts for clearing all 12 bricks of one color in a single chain sequence
- **Level completion**: 500 × level number
- **Distance/score not affected by ball speed**

## UI/UX

- **Start screen**: title "CHAIN REACTION" (large cyan), "Arrow Keys or Q/D to move", "Space to launch ball", "Mouse/touch also supported", "Press Space or click to start"
- **HUD** (top bar, y=15-45): left = score + level, right = lives (● = filled, ○ = empty), active power-up icons with remaining time
- **Game over screen**: final score, highest level reached, "Press Space or click to restart"
- **Color palette**: background #0a0a1a, paddle #00ffff glow, ball #ffffff with #00ffff glow

## Scope Constraints
- Do NOT implement: 3D graphics, complex animations, sound beyond oscillator beeps
- DO keep physics predictable and fair
- Ball speed: base 350px/s, max 600px/s
- Canvas: 800×600, centered, HiDPI, responsive scaling

## Acceptance Criteria
- [ ] Single HTML file runs in any modern browser without setup
- [ ] Basic paddle-ball-brick physics work correctly (bouncing, collision detection)
- [ ] Chain reaction mechanic triggers when adjacent same-color bricks are destroyed
- [ ] Secondary balls from chain reactions launch and behave correctly
- [ ] Cascade limit prevents infinite loops (max 5 levels deep)
- [ ] All 4 power-ups functional with visible effects
- [ ] Scoring system tracks chains, combos, and level bonuses
- [ ] Visual explosion effects on brick destruction (rings + particles)
- [ ] Level progression: row growth, shielded bricks at L3, indestructible columns at L3
- [ ] Game over condition and restart work properly
- [ ] All visuals procedurally drawn — no external assets
- [ ] Controls work on both AZERTY and QWERTY (event.code)
- [ ] Canvas scales responsively with HiDPI support