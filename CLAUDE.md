# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

**Running the game:** Open `index.html` in any modern browser. No build step, no server required.

**Git workflow:** Always commit changes with descriptive messages and push to `https://github.com/casparsin1031-bit/retro-racer`. Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `perf:`, `docs:`.

## Project Overview

**Retro Racer** is a vanilla HTML5/Canvas racing game with pseudo-3D OutRun-style road rendering. It's a **single-file game engine** (`game.js`, ~800 lines) with no external dependencies.

## Architecture

### File Structure
```
index.html          Canvas shell, CSS pixel-scaling, Press Start 2P font
game.js             Complete game engine (constants, classes, game loop, rendering)
```

### Class Hierarchy (All in game.js)

**Game Loop & Input:**
- `GameLoop` - RAF wrapper with fixed 60Hz physics timestep + render accumulator
- `InputHandler` - Keyboard state map; tracks `isDown()` and `isJustPressed()` per key

**World State:**
- `Track` - Segment array with procedural DSL builder (addStraight, addCurve, addHill)
- `Player` - Player car: z/x position, speed, acceleration, lap counter
- `AICarManager` - Spawns 4 AI cars, rubber-band updates, collision detection

**Rendering:**
- `Renderer` - Stateless draw facade; calls sub-methods for road, cars, HUD, menus
  - Projection: `projectSegments()` — back-to-front trapezoid depth math
  - Road drawing: `drawRoad()` with clipY hill handling
  - Sprites: `drawScenery()`, `drawCars()`, pixel-art routines
  - HUD/UI: `drawHUD()`, `drawMenu()`, `drawCountdown()`, `drawFinish()`

**Game State:**
- `StateManager` - FSM: MENU → COUNTDOWN → RACING → FINISH, delegates per-state render

**Main Entry:**
- `Game` - Top-level orchestrator; owns all subsystems and calls update/render loop

### Data Flow

```
Game.update() → StateManager.update(input)
               → StateManager.render(renderer)
                  → Renderer.projectSegments(track, player)  [projection pass]
                  → Renderer.drawRoad(track, player)         [segment rasterization]
                  → Renderer.drawScenery(track, player)      [trees, poles]
                  → Renderer.drawCars(track, player, aiCars) [player + AI]
                  → Renderer.drawHUD(...) or menu screens
```

## Core Systems

### Pseudo-3D Road Rendering (The Heart)

**Key insight:** The road is a 1D array of 600 segments (z=0..599×SEGMENT_LENGTH). Each segment has:
- `curve` — lateral bend (negative=left, positive=right)
- `hill` — vertical slope (per segment height delta)
- `projected` — **scratch space filled each frame** with screen coords

**Projection algorithm:**
1. Loop from farthest visible segment to nearest (DRAW_DISTANCE away)
2. Accumulate lateral offset (`worldX`) via `dx += seg.curve; worldX += dx`
3. Accumulate vertical offset (`worldY`) via `worldY += seg.hill`
4. Project to screen: `scale = CAMERA_DEPTH / segZ * canvas.height`
5. Calculate `screenX`, `screenY`, `screenW` using scale
6. Store in `seg.projected` (reused for sprites + cars)

**Draw pass (back-to-front):**
- Iterate segments in reverse (farthest first — painter's algorithm)
- Track `clipY` to skip segments hidden behind hills
- Draw grass → rumble → road → center line trapezoids

**Critical tuning knobs:**
- `CAMERA_DEPTH = 0.84` — FOV scaling; increase for wider view
- `SEGMENT_LENGTH = 200` — Distance per segment; smaller = higher detail
- `DRAW_DISTANCE = 150` — Max segments to render per frame (perf vs depth)

### Physics (60Hz Fixed Timestep)

**Player (`Player.update`):**
- Acceleration: `speed += accel * dt` if up key held
- Natural decel: `speed -= decel * dt` if no input
- Off-road penalty: cap `maxSpeed * 0.4` if `|player.x| > 1.0`
- Steering: `player.x ± steering * (speed/maxSpeed) * dt`
- **Centrifugal drift:** `player.x -= curve * (speed/maxSpeed) * 0.003` — road pulls on curves
- Lap wrap: `if (player.z >= trackLength) { player.z -= trackLength; lapCount++ }`

**AI (`AICarManager.update`):**
- Rubber-band logic: measure `gap = (car.z - player.z) % trackLength`
  - If `gap > 0.05 * trackLength` (player ahead): `targetSpeed = maxSpeed * 0.98`
  - If `gap < -0.05 * trackLength` (player behind): `targetSpeed = maxSpeed * 0.75`
  - Else (racing): `targetSpeed = maxSpeed * lerp(0.85, 0.95, speedBias)`
- Smooth acceleration: `car.speed = lerp(speed, targetSpeed, 0.02)`
- Steering: drift to centerline + react to curves + random wobble
- **Collision:** if `|dz| < segLen*1.5 && |dx|*ROAD_WIDTH < carWidth*1.2`, slow player by 50%, nudge laterally

### Track Generation

**DSL in `Track.build()`:**
```javascript
this.addStraight(20);      // 20 zero-curve, zero-hill segments
this.addCurve(40, 2.5);    // 40 segments with curve=2.5
this.addHill(20, 200);     // 20 segments totaling 200 units of climb
```

Total fills to `TRACK_SEGMENTS = 600` (one lap = 600×200 = 120,000 world units).

**Scenery assignment in `assignScenery()`:**
- Every 5th segment: trees at `x = ±1.5`
- Every 20th segment: poles at `x = ±2.2`

### Game States

| State | Entry | Update Logic | Exit |
|-------|-------|--------------|------|
| MENU | Init | Listen for Enter | → COUNTDOWN |
| COUNTDOWN | Player presses Enter | Count down 3s | → RACING at 0s |
| RACING | Countdown done | `updateWorld(dt)`: player + AI physics | → FINISH at lapCount ≥ 3 |
| FINISH | Lap limit reached | Show stats overlay | → MENU on Enter |

## Common Development Tasks

### Adjust Difficulty / Speed

**Faster/slower AI:**
- `AICarManager.update()`: Change rubber-band thresholds
  - `gap > 0.05` threshold controls "catch-up" distance
  - `targetSpeed` multipliers (0.98, 0.75, 0.85–0.95 range)

**Faster/slower player:**
- `Player.maxSpeed = 3000` (world units/sec)
- `Player.accel = 6000`, `brake = 8000`, `decel = 3000`
- Off-road limit: `maxSpeed * 0.4`

**Centrifugal drift intensity:**
- `Player.update()`: `curve * (speed/maxSpeed) * 0.003` — scale the `0.003` factor

### Add a New Track Feature

1. In `Track.build()`, call new DSL methods:
   ```javascript
   this.addSpiral(count, curvatureProgression);  // hypothetical
   ```

2. Implement the method:
   ```javascript
   addSpiral(count, curve) {
     for (let i = 0; i < count; i++) {
       const curve = initialCurve + (i / count) * curveProgression;
       this.segments.push({ curve, hill: 0, ... });
     }
   }
   ```

3. The projection and rendering automatically handle it (no other changes needed).

### Tune Road Appearance

**Color palette:** `SEGMENT_COLORS` array in constants
- `grass`, `road`, `rumble`, `lane` — hex colors
- Alternates every 2 segments for stripe effect

**Field of view / perspective:** `CAMERA_DEPTH = 0.84`
- Decrease (e.g., 0.7) for more dramatic depth
- Increase (e.g., 1.0) for wider, flatter view

**Rumble strip width:** In `Renderer.drawRoad()`, `rumble trapezoid: np.w * 1.2`
- Change `1.2` multiplier to widen/narrow

### Add AI Personality Traits

Each AI car already has `speedBias` (random 0–1). Extend with:

```javascript
this.cars.push({
  z, x, speed, targetSpeed, speedBias,
  steeringSharpness: 0.04 + Math.random() * 0.02,  // vary steering response
  driftTendency: Math.random(),                      // prefer curves left/right
  color, screenRect
});
```

Then in `AICarManager.update()`, use these in steering calculation.

### Modify HUD / UI

All HUD drawing is in `Renderer.drawHUD()`, menu screens in separate methods.

```javascript
// Example: add position indicator for AI cars
drawHUD(player, raceTimer) {
  // ... existing code ...
  const position = this.calculatePlayerPosition(player, aiCars);
  ctx.fillText(`POS: ${position}/5`, 10, 100);
}
```

## Performance Considerations

**GPU:** All rendering is 2D Canvas (no WebGL). Typical frame: 60 FPS on modern hardware.

**Bottlenecks to watch:**
1. **Projection loop** (`projectSegments`): O(DRAW_DISTANCE) per frame — ~150 iterations, negligible
2. **Segment drawing** (`drawRoad`): O(DRAW_DISTANCE) trapezoids — main render cost
3. **Sprite rendering** (`drawCars`, `drawScenery`): Sorted back-to-front, ~50–100 objects typical
4. **Collision checks**: O(4 AI cars) per frame, negligible

**Optimization ideas:**
- Reduce `DRAW_DISTANCE` if frame rate drops (trade visual depth for speed)
- Batch segment drawing (less likely to help; Canvas isn't optimized for it)
- Pre-compute segment projections (breaks dynamic camera motion)

## Browser Compatibility

- **Required:** HTML5 Canvas, ES6 (arrow functions, const/let, template strings)
- **Required:** Google Fonts (Press Start 2P) — graceful fallback to system monospace if offline
- **Tested:** Chrome, Firefox, Safari, Edge (all modern versions)

## Git Workflow

**Before pushing:**
1. Test the game manually in a browser
2. Commit with clear message: `git commit -m "feat: add X, fix Y"`
3. Push: `git push origin main`

**When adding features:**
- One logical feature per commit
- Update this CLAUDE.md if architecture changes
- Keep commits small and reviewable

**Example commits:**
```
git commit -m "feat: add multiple laps per race"
git commit -m "fix: correct centrifugal drift scaling on steep curves"
git commit -m "perf: reduce draw distance from 150 to 120 segments"
git commit -m "docs: update README with tuning guide"
```

## Debugging Tips

**Visual debugging:**
- Add `console.log()` in render loop (but watch perf — max 60 FPS)
- Render projection bounding boxes: `ctx.strokeRect(screenX - w, screenY, w*2, 10)`

**Physics debugging:**
- Log `player.z`, `player.x`, `player.speed` in `Player.update()`
- Log `gap`, `targetSpeed` in `AICarManager.update()`

**Track layout:**
- Adjust DSL in `Track.build()` to add curves/hills in different places
- Run game and visually verify road looks right

## Known Limitations & Future Work

- **No sound** — could add with Web Audio API
- **No difficulty selection** — rubber-band thresholds are hardcoded
- **Single track** — procedurally generated but not switchable
- **No mobile support** — keyboard-only, could add touch controls
- **Fixed 3 laps** — could be parameterized
