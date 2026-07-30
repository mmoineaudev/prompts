# Control Schemes Reference

## Mouse-only + click thrust/brake

Preferred for small-team / solo projects and endless flyer-style games **when the user asks for mouse flight**. Orientation uses smoothed `mouseX` / `mouseY`. Left click (`button === 0`) = thrust while held, right click (`button === 2`) = brake, `contextmenu` is suppressed, and ship velocity is rebuilt every frame from the current forward vector.

### Why this no longer wins by default in this repo

Later sessions showed that this control scheme still requires multiple iterations to feel right. When the user asks for simpler controls or reports imperfect navigation, this project now defaults to keyboard-only screen-relative flight instead of another mouse-scheme pass.

### Important pitfall: mouse steering is not zero-cost

If you do use mouse orientation:
- Do not clamp `mouseX/Y` to `[-1,1]` before steering. That is the “turn cap” bug.
- Use an unbounded accumulator for orientation, then bounded deltas each frame.
- Defaults are usually inverted: `yaw += -mouseX`, `pitch += mouseY`.
- If the user later asks for simpler controls, switch to pure keyboard/screen-relative flight rather than another mouse iteration.

## Forward-only flight invariant

In `PhysicsSystem.updatePlayerPhysics()`:
1. Compute ship-local `forward` from quaternion.
2. Read `forwardSpeed = vel.dot(forward)`.
3. Modify scalar `forwardSpeed` with `dt * acceleration` or `dt * deceleration`.
4. Clamp to `[0, MAX_SPEED]`.
5. Rebuild `vel = forward * forwardSpeed`.

Consequences:
- No lateral drift from previous orientations.
- Rotating the ship while flying redirects velocity onto the new nose.
- Braking reaches exactly 0 and does not reverse into negative forward speed.

## Low-fps and MAX_SPEED

- Keep `MAX_SPEED` modest for low-fps stability; this project uses `35`.
- Always integrate acceleration/deceleration through `dt`.
- Rebuilding `vel` each frame avoids velocity accumulation artifacts at low framerates.
