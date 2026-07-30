# Prompt 01: Gravity Flip Platformer — "Neon Descent"

## Role
You are an expert HTML5 game developer. Create a single-file, self-contained web-based platformer game prototype called "Neon Descent".

## Core Concept
A side-scrolling platformer with a **gravity inversion mechanic**: the player can flip gravity at any time, causing them to fall toward the ceiling instead of the floor (and vice versa). Platforms exist on the top and bottom boundaries, plus scattered mid-screen platforms. The challenge is navigating by flipping between ceiling-walking and floor-walking to avoid obstacles and collect items.

## Technical Requirements
- Single HTML file with embedded CSS and JavaScript (no external dependencies, no image assets)
- Use HTML5 Canvas for rendering at **960×540** logical resolution with HiDPI support (devicePixelRatio scaling)
- All visuals must be procedural: draw shapes, lines, and colored rectangles using Canvas API
- Keyboard controls: Arrow keys + ZQSD (via event.code) for movement and gravity flip. Touch: tap to flip.
- Game loop using requestAnimationFrame with delta-time physics
- Simple sound feedback using Web Audio API oscillator beeps

## Controls

- **ArrowLeft / Q** — move left (event.code, AZERTY compatible)
- **ArrowRight / D** — move right
- **ArrowUp / Z or Space** — flip gravity
- **Touch**: tap anywhere to flip gravity
- **Start / Restart**: Space, Enter, or click

## Gameplay Mechanics

### Player Character
- **Appearance**: glowing circle, 24×24px, cyan neon color (#00ffff)
- **ShadowBlur**: 15px for neon glow effect
- **Horizontal movement**: accelerate to 300px/s top speed, accelerate at 1200px/s², decelerate at 800px/s²
- **Gravity flip**: instant inversion of gravity direction (up ↔ down). Fall speed: 400px/s in both directions.
- **Cooldown**: 0.2 seconds between gravity flips
- **Invincibility frames**: 1 second after taking damage (visual: blink/flash)

### Level Design
- Procedurally generated, scrolls horizontally as player moves right
- Platforms on ceiling (top 12px), floor (bottom 12px), and scattered mid-screen
- Platform dimensions: 80-120px wide × 12px tall, drawn as colored rectangles with neon glow
- Each segment is **800px wide**, generated as player advances; keep 3 segments ahead
- Minimum platform gap: 60px. Maximum mid-air gap: 200px.

#### Segment types (5 distinct, randomly selected):
1. **Narrow corridor** — ceiling and floor platforms close together, forces gravity flips
2. **Wide open space** — sparse platforms, collectibles floating in the gap
3. **Obstacle gauntlet** — spikes on one surface (ceiling or floor, alternating), must flip to avoid
4. **Collectible clusters** — 5-8 orbs floating between staggered platforms
5. **Staggered platforms** — alternating ceiling/floor platforms in a zigzag pattern

### Obstacles
- **Spikes**: triangles (20px base × 20px height), pointing down on ceiling, up on floor. Red neon (#ff0044).
- **Moving platforms**: 80px wide, move horizontally at 80px/s, reverse at segment boundaries. Player moves with them.
- **Dead zones**: gaps 200-400px wide in floor or ceiling with no platform. Falling into one = death.

### Items and Scoring
- **Collectibles**: glowing orbs (12px radius, yellow neon #ffdd00), 3-8 per segment, random on platforms and mid-air
- **Speed boost pads**: green neon (#00ff66), 48×12px on platforms, 2× speed for 2 seconds
- **Health**: 3 HP. Spike = 1 damage. Death at 0.
- **Score**: 10 points per collectible + 1 point per 100px distance

### Difficulty Scaling
- **0-5000px**: spikes only
- **5000-10000px**: spikes + moving platforms introduced, spike density ×1.5
- **10000px+**: spikes + moving platforms + dead zones introduced, corridor width -20%
- Primary score metric: max distance traveled

## UI/UX
- **Start screen**: title "NEON DESCENT" in large cyan text, "Arrow Keys/ZQSD to move, Space to flip" instructions, "Press Space or tap to start"
- **HUD**: top-left: score + distance. Top-right: 3 hearts (♥). Heart turns empty (♡) on damage.
- **Game over screen**: final score, distance, "Press Space or click to restart"
- **Color palette**: background #0a0a1a, platforms #1a1a3e with #00ffff glow, obstacles as noted above
- **Canvas scaling**: responsive — scale to fit window while maintaining 16:9 aspect ratio

## Scope Constraints
- Do NOT implement: multiplayer, vertical-only rooms, complex animations, parallax backgrounds
- DO keep level generation coherent and challenging
- Physics must feel responsive — no floating or drifting
- Game must be immediately playable on load — no loading screens

## Acceptance Criteria
- [ ] Single HTML file runs in any modern browser without setup
- [ ] Gravity flip mechanic works smoothly with immediate response
- [ ] Procedural level generation creates a coherent, challenging experience
- [ ] At least 5 distinct segment types appear in the level pool
- [ ] Scoring system (collectibles + distance) is visible and functional
- [ ] Game over condition triggers cleanly with restart option
- [ ] All visuals are procedurally drawn — no external assets required
- [ ] Controls work on both AZERTY and QWERTY keyboards
- [ ] Canvas scales responsively while maintaining 16:9 aspect ratio