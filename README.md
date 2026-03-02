# Retro Racer 🏎️

A 2D pseudo-3D forward-scrolling car racing game in retro arcade style, built with vanilla HTML5/Canvas and JavaScript.

## Overview

Retro Racer is a browser-based racing game inspired by classic arcade racers like OutRun and Road Fighter. Experience high-speed racing with:

- **Pseudo-3D Road Rendering**: Segment-based depth projection for authentic retro perspective
- **AI Opponents**: 4 rubber-band AI cars that adapt to your racing pace
- **Arcade Gameplay**: Complete 3 laps to win
- **Retro Aesthetic**: Pixelated graphics, classic color palette, Press Start 2P fonts

## Quick Start

1. Open `index.html` in any modern web browser
2. Press **Enter** to start the race
3. Use **Arrow Keys** or **WASD** to control your car
4. Complete 3 laps to finish the race

## Controls

| Key | Action |
|-----|--------|
| Arrow Up / W | Accelerate |
| Arrow Down / S | Brake |
| Arrow Left / A | Steer Left |
| Arrow Right / D | Steer Right |
| Enter | Start/Restart |

## Game Features

- **Realistic Physics**: Speed limits, off-road penalties, centrifugal drift on curves
- **Dynamic AI**: Rubber-band system keeps races competitive
- **World Collision**: Bump into AI cars and lose speed
- **HUD Display**: Real-time speed gauge, lap counter, and race timer
- **Procedural Track**: Randomly generated curves and hills for varied gameplay

## Technical Details

### Architecture

- **Rendering Engine**: Canvas-based segment rasterization
- **Physics**: Fixed 60Hz timestep for deterministic gameplay
- **Game Loop**: RAF-based with fixed-step accumulator
- **State Machine**: Menu → Countdown → Racing → Finish

### Key Files

- `index.html` - Canvas shell with CSS pixel scaling
- `game.js` - Complete game engine (no external dependencies)

### Constants (Tuning)

```javascript
SEGMENT_LENGTH = 200        // World units per segment
CAMERA_DEPTH = 0.84         // Field of view
LAPS_TO_WIN = 3             // Race duration
Player.maxSpeed = 3000      // Top speed
```

## No External Dependencies

This game is built with **vanilla JavaScript only** — no frameworks, no libraries. Just pure Canvas rendering and DOM events.

## Browser Support

Works on all modern browsers supporting:
- HTML5 Canvas
- ES6 JavaScript
- Google Fonts (Press Start 2P)

## Future Enhancements

- Sound effects and music
- Multiple difficulty levels
- Track selection
- Leaderboard system
- Mobile touch controls
- Day/night cycle

## License

Free to use and modify for personal or educational purposes.
