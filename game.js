// ========== CONSTANTS ==========
const SEGMENT_LENGTH  = 200;
const ROAD_WIDTH      = 2000;
const TRACK_SEGMENTS  = 600;
const DRAW_DISTANCE   = 150;
const CAMERA_HEIGHT   = 1000;
const CAMERA_DEPTH    = 0.84;
const LAPS_TO_WIN     = 3;

const CAR_WORLD_WIDTH  = 400;
const CAR_WORLD_HEIGHT = 900;

const SEGMENT_COLORS = [
  {
    grass:  '#1a7a1a',
    road:   '#606060',
    rumble: '#cc2222',
    lane:   '#cccccc',
  },
  {
    grass:  '#1a9a1a',
    road:   '#707070',
    rumble: '#eeeeee',
    lane:   '#606060',
  }
];

const SKY_COLOR = '#4488ff';

// ========== UTILITY FUNCTIONS ==========
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
  return `${m}:${s}.${ms}`;
}

// ========== CLASSES ==========

// InputHandler: tracks key state
class InputHandler {
  constructor() {
    this.keys = {};
    this.justPressed = {};

    document.addEventListener('keydown', (e) => {
      if (!this.keys[e.key]) {
        this.justPressed[e.key] = true;
      }
      this.keys[e.key] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
      this.justPressed[e.key] = false;
    });
  }

  isDown(key) {
    return this.keys[key] || false;
  }

  isJustPressed(key) {
    return this.justPressed[key] || false;
  }

  clearJustPressed() {
    this.justPressed = {};
  }
}

// Track: builds and manages segments
class Track {
  constructor() {
    this.segments = [];
    this.build();
  }

  build() {
    // Build track using procedural DSL
    this.addStraight(20);
    this.addCurve(40, 2.5);
    this.addHill(20, 200);
    this.addStraight(15);
    this.addCurve(50, -2.0);
    this.addHill(25, -300);
    this.addStraight(25);
    this.addCurve(35, 1.8);
    this.addStraight(30);
    this.addCurve(60, -1.5);
    this.addHill(20, 250);
    this.addStraight(20);
    this.addCurve(40, 2.2);
    this.addHill(15, -200);
    this.addStraight(25);
    this.addCurve(50, -2.5);
    this.addStraight(15);
    this.addHill(20, 300);
    this.addStraight(30);

    // Fill remaining with simple loops
    while (this.segments.length < TRACK_SEGMENTS) {
      this.addStraight(20);
      this.addCurve(30, 1.5);
      this.addStraight(20);
      this.addCurve(35, -1.8);
      this.addHill(15, 200);
      this.addStraight(20);
    }

    // Trim to exact size
    this.segments = this.segments.slice(0, TRACK_SEGMENTS);

    // Assign colors and scenery
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].colorSet = Math.floor(i / 2) % 2;
      this.segments[i].sprites = [];
    }

    this.assignScenery();
  }

  addStraight(count) {
    for (let i = 0; i < count; i++) {
      this.segments.push({
        index: this.segments.length,
        z: this.segments.length * SEGMENT_LENGTH,
        curve: 0,
        hill: 0,
        colorSet: 0,
        sprites: [],
        projected: null
      });
    }
  }

  addCurve(count, curvature) {
    for (let i = 0; i < count; i++) {
      this.segments.push({
        index: this.segments.length,
        z: this.segments.length * SEGMENT_LENGTH,
        curve: curvature,
        hill: 0,
        colorSet: 0,
        sprites: [],
        projected: null
      });
    }
  }

  addHill(count, totalHeight) {
    const dy = totalHeight / count;
    for (let i = 0; i < count; i++) {
      this.segments.push({
        index: this.segments.length,
        z: this.segments.length * SEGMENT_LENGTH,
        curve: 0,
        hill: dy,
        colorSet: 0,
        sprites: [],
        projected: null
      });
    }
  }

  assignScenery() {
    for (let i = 0; i < this.segments.length; i++) {
      if (i % 5 === 0) {
        this.segments[i].sprites.push({ x: -1.5, type: 'TREE' });
        this.segments[i].sprites.push({ x: 1.5, type: 'TREE' });
      }
      if (i % 20 === 0) {
        this.segments[i].sprites.push({ x: -2.2, type: 'POLE' });
        this.segments[i].sprites.push({ x: 2.2, type: 'POLE' });
      }
    }
  }

  getSegment(index) {
    return this.segments[index % this.segments.length];
  }

  getLength() {
    return this.segments.length * SEGMENT_LENGTH;
  }
}

// Player: manages player car state
class Player {
  constructor() {
    this.z = 0;
    this.x = 0;
    this.speed = 0;
    this.maxSpeed = 3000;
    this.accel = 6000;
    this.brake = 8000;
    this.decel = 3000;
    this.steering = 0.2;
    this.lapCount = 0;
    this.color = '#ffffff';
  }

  update(input, track, dt) {
    const trackLength = track.getLength();
    const currentSeg = track.getSegment(Math.floor(this.z / SEGMENT_LENGTH));
    const onRoad = Math.abs(this.x) < 1.0;

    // Acceleration / braking
    if (input.isDown('ArrowUp') || input.isDown('KeyW') || input.isDown('w')) {
      this.speed += this.accel * dt;
    } else if (input.isDown('ArrowDown') || input.isDown('KeyS') || input.isDown('s')) {
      this.speed -= this.brake * dt;
    } else {
      this.speed -= this.decel * dt;
    }

    // Speed limit based on road
    const speedLimit = onRoad ? this.maxSpeed : this.maxSpeed * 0.4;
    this.speed = clamp(this.speed, 0, speedLimit);

    // Steering
    if (input.isDown('ArrowLeft') || input.isDown('KeyA') || input.isDown('a')) {
      this.x -= this.steering * (this.speed / this.maxSpeed) * dt;
    }
    if (input.isDown('ArrowRight') || input.isDown('KeyD') || input.isDown('d')) {
      this.x += this.steering * (this.speed / this.maxSpeed) * dt;
    }

    // Centrifugal drift on curves
    const centrifugal = (this.speed / this.maxSpeed) * currentSeg.curve * 0.003;
    this.x -= centrifugal;

    // Clamp position
    this.x = clamp(this.x, -3.0, 3.0);

    // Move forward
    this.z += this.speed * dt;

    // Lap detection
    if (this.z >= trackLength) {
      this.z -= trackLength;
      this.lapCount++;
    }
  }
}

// AICarManager: spawns and manages AI cars
class AICarManager {
  constructor(player) {
    this.cars = [];
    this.spawn(player);
  }

  spawn(player) {
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
    const trackLength = TRACK_SEGMENTS * SEGMENT_LENGTH;
    for (let i = 0; i < 4; i++) {
      this.cars.push({
        z: (player.z + (i + 1) * SEGMENT_LENGTH * 8) % trackLength,
        x: (Math.random() - 0.5) * 1.2,
        speed: player.maxSpeed * 0.8,
        targetSpeed: player.maxSpeed * 0.8,
        speedBias: Math.random(),
        color: colors[i % colors.length],
        screenRect: null
      });
    }
  }

  update(player, track, dt) {
    const trackLength = track.getLength();

    for (const car of this.cars) {
      // Rubber-band AI
      let gap = car.z - player.z;
      if (gap < -trackLength / 2) gap += trackLength;
      if (gap > trackLength / 2) gap -= trackLength;

      const normalizedGap = gap / trackLength;

      if (normalizedGap > 0.05) {
        car.targetSpeed = player.maxSpeed * 0.98;
      } else if (normalizedGap < -0.05) {
        car.targetSpeed = player.maxSpeed * 0.75;
      } else {
        car.targetSpeed = player.maxSpeed * lerp(0.85, 0.95, car.speedBias);
      }

      car.speed = lerp(car.speed, car.targetSpeed, 0.02);

      // Steering
      const currentSeg = track.getSegment(Math.floor(car.z / SEGMENT_LENGTH));
      car.x += (0 - car.x) * 0.04;
      car.x -= currentSeg.curve * 0.003;
      car.x += (Math.random() - 0.5) * 0.002;
      car.x = clamp(car.x, -0.9, 0.9);

      car.z += car.speed * dt;
      if (car.z >= trackLength) car.z -= trackLength;
    }

    this.checkCollisions(player);
  }

  checkCollisions(player) {
    for (const car of this.cars) {
      const dz = Math.abs(player.z - car.z);
      const dx = Math.abs(player.x - car.x) * ROAD_WIDTH;

      if (dz < SEGMENT_LENGTH * 1.5 && dx < CAR_WORLD_WIDTH * 1.2) {
        player.speed *= 0.5;
        player.x += (player.x > car.x) ? 0.2 : -0.2;
      }
    }
  }
}

// Renderer: handles all drawing
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.fillStyle = SKY_COLOR;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  projectSegments(track, player) {
    const startIndex = Math.floor(player.z / SEGMENT_LENGTH) % track.segments.length;
    let worldX = 0;
    let dx = 0;
    let worldY = 0;

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const segIndex = (startIndex + n) % track.segments.length;
      const seg = track.segments[segIndex];

      const segZ = (n + 1) * SEGMENT_LENGTH;
      const depth = 1.0 / segZ;
      const scale = CAMERA_DEPTH / segZ * this.canvas.height;

      const screenX = Math.round(this.canvas.width / 2 + (worldX - player.x * ROAD_WIDTH) * scale);
      const screenY = Math.round(this.canvas.height / 2 - (worldY - CAMERA_HEIGHT) * scale);
      const screenW = Math.round(scale * ROAD_WIDTH / 2);

      seg.projected = {
        x: screenX,
        y: screenY,
        w: screenW,
        scale: scale,
        clip: this.canvas.height
      };

      dx += seg.curve;
      worldX += dx;
      worldY += seg.hill;
    }
  }

  drawRoad(track, player) {
    const startIndex = Math.floor(player.z / SEGMENT_LENGTH) % track.segments.length;
    let clipY = this.canvas.height;

    for (let n = DRAW_DISTANCE - 1; n >= 0; n--) {
      const seg = track.segments[(startIndex + n) % track.segments.length];
      const nextSeg = track.segments[(startIndex + n + 1) % track.segments.length];

      const p = seg.projected;
      const np = nextSeg.projected;

      if (!p || !np) continue;

      if (p.y >= clipY) continue;

      const colors = SEGMENT_COLORS[seg.colorSet];

      // Grass
      this.ctx.fillStyle = colors.grass;
      this.ctx.fillRect(0, np.y, this.canvas.width, p.y - np.y);

      // Rumble strips
      this.drawTrapezoid(np.x, np.y, np.w * 1.2, p.x, p.y, p.w * 1.2, colors.rumble);

      // Road
      this.drawTrapezoid(np.x, np.y, np.w, p.x, p.y, p.w, colors.road);

      // Center line
      if (seg.colorSet % 4 < 2) {
        this.drawTrapezoid(np.x, np.y, np.w * 0.03, p.x, p.y, p.w * 0.03, colors.lane);
      }

      clipY = p.y;
      seg.projected.clip = clipY;
    }
  }

  drawTrapezoid(x1, y1, w1, x2, y2, w2, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x1 - w1, y1);
    this.ctx.lineTo(x1 + w1, y1);
    this.ctx.lineTo(x2 + w2, y2);
    this.ctx.lineTo(x2 - w2, y2);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawPixelCar(x, y, w, h, color) {
    // Body
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y + h * 0.3, w, h * 0.6);
    // Roof
    this.ctx.fillRect(x + w * 0.15, y, w * 0.7, h * 0.35);
    // Windshield
    this.ctx.fillStyle = '#88aacc';
    this.ctx.fillRect(x + w * 0.2, y + h * 0.05, w * 0.6, h * 0.25);
    // Wheels
    this.ctx.fillStyle = '#111111';
    this.ctx.fillRect(x, y + h * 0.75, w * 0.25, h * 0.25);
    this.ctx.fillRect(x + w * 0.75, y + h * 0.75, w * 0.25, h * 0.25);
  }

  drawScenery(track, player) {
    const startIndex = Math.floor(player.z / SEGMENT_LENGTH) % track.segments.length;

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const seg = track.segments[(startIndex + n) % track.segments.length];
      if (!seg.projected) continue;

      const p = seg.projected;

      for (const sprite of seg.sprites) {
        const screenX = p.x + sprite.x * p.w;
        const screenY = p.y;

        if (sprite.type === 'TREE') {
          const w = Math.round(300 * p.scale);
          const h = Math.round(600 * p.scale);
          if (screenY > p.clip) continue;

          // Simple tree
          this.ctx.fillStyle = '#226622';
          this.ctx.fillRect(screenX - w / 2, screenY - h, w, h);
          this.ctx.fillStyle = '#338833';
          const triW = w * 1.3;
          const triH = h * 0.7;
          this.ctx.beginPath();
          this.ctx.moveTo(screenX, screenY - h - triH);
          this.ctx.lineTo(screenX - triW / 2, screenY - h);
          this.ctx.lineTo(screenX + triW / 2, screenY - h);
          this.ctx.closePath();
          this.ctx.fill();
        } else if (sprite.type === 'POLE') {
          const w = Math.round(50 * p.scale);
          const h = Math.round(800 * p.scale);
          if (screenY > p.clip) continue;

          this.ctx.fillStyle = '#886644';
          this.ctx.fillRect(screenX - w / 2, screenY - h, w, h);
        }
      }
    }
  }

  drawCars(track, player, aiCars) {
    const startIndex = Math.floor(player.z / SEGMENT_LENGTH) % track.segments.length;
    const trackLength = track.getLength();

    // Draw AI cars
    for (const car of aiCars) {
      let drawZ = car.z;
      if (Math.abs(drawZ - player.z) > trackLength / 2) {
        if (drawZ < player.z) drawZ += trackLength;
        else drawZ -= trackLength;
      }

      const relZ = drawZ - player.z;
      const segIndex = Math.floor(relZ / SEGMENT_LENGTH);

      if (segIndex < 0 || segIndex >= DRAW_DISTANCE) continue;

      const seg = track.segments[(startIndex + segIndex) % track.segments.length];
      if (!seg.projected) continue;

      const p = seg.projected;
      const screenX = p.x + car.x * p.w;
      const screenY = p.y;

      if (screenY > p.clip) continue;

      const carW = Math.round(CAR_WORLD_WIDTH * p.scale);
      const carH = Math.round(CAR_WORLD_HEIGHT * p.scale);

      this.drawPixelCar(screenX - carW / 2, screenY - carH, carW, carH, car.color);
      car.screenRect = { x: screenX - carW / 2, y: screenY - carH, w: carW, h: carH };
    }

    // Draw player car (always at bottom of screen)
    const playerCarW = Math.round(CAR_WORLD_WIDTH * 0.015 * this.canvas.height);
    const playerCarH = Math.round(CAR_WORLD_HEIGHT * 0.015 * this.canvas.height);
    const playerX = this.canvas.width / 2 + player.x * ROAD_WIDTH * 0.015 * this.canvas.height;
    const playerY = this.canvas.height - playerCarH - 40;

    this.drawPixelCar(playerX - playerCarW / 2, playerY - playerCarH, playerCarW, playerCarH, player.color);
  }

  drawHUD(player, raceTimer) {
    this.ctx.font = '12px "Press Start 2P"';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'left';

    // Speed
    const kph = Math.round((player.speed / player.maxSpeed) * 200);
    this.ctx.fillText(`${kph.toString().padStart(3, '0')} KM/H`, 10, this.canvas.height - 50);

    // Lap counter
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`LAP ${player.lapCount + 1}/${LAPS_TO_WIN}`, this.canvas.width / 2, 20);

    // Timer
    this.ctx.textAlign = 'right';
    this.ctx.fillText(formatTime(raceTimer), this.canvas.width - 10, 20);

    // Speed bar
    const barW = Math.round((kph / 200) * 100);
    this.ctx.fillStyle = kph > 160 ? '#ff4444' : '#44ff44';
    this.ctx.fillRect(10, this.canvas.height - 30, barW, 10);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(10, this.canvas.height - 30, 100, 10);
  }

  drawMenu() {
    this.ctx.font = 'bold 20px "Press Start 2P"';
    this.ctx.fillStyle = '#ffff00';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.fillText('RETRO RACER', this.canvas.width / 2, this.canvas.height / 2 - 80);

    this.ctx.font = '12px "Press Start 2P"';
    this.ctx.fillStyle = '#00ff00';
    this.ctx.fillText('PRESS ENTER TO START', this.canvas.width / 2, this.canvas.height / 2 + 20);
  }

  drawCountdown(countdown) {
    this.ctx.font = 'bold 40px "Press Start 2P"';
    this.ctx.fillStyle = countdown < 1 ? '#00ff00' : '#ffff00';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const displayNum = Math.max(1, Math.ceil(countdown));
    if (displayNum <= 3) {
      this.ctx.fillText(displayNum.toString(), this.canvas.width / 2, this.canvas.height / 2);
    }
  }

  drawFinish(player, raceTimer) {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.font = 'bold 16px "Press Start 2P"';
    this.ctx.fillStyle = '#00ff00';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.fillText('RACE COMPLETE!', this.canvas.width / 2, this.canvas.height / 2 - 60);

    this.ctx.font = '12px "Press Start 2P"';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(`TIME: ${formatTime(raceTimer)}`, this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.fillText(`LAPS: ${player.lapCount}`, this.canvas.width / 2, this.canvas.height / 2 + 40);

    this.ctx.fillStyle = '#ffff00';
    this.ctx.fillText('PRESS ENTER FOR MENU', this.canvas.width / 2, this.canvas.height / 2 + 100);
  }
}

// StateManager: handles game states
class StateManager {
  constructor() {
    this.state = 'MENU';
    this.countdownTimer = 3.0;
  }

  update(input, game, dt) {
    switch (this.state) {
      case 'MENU':
        if (input.isJustPressed('Enter')) {
          game.reset();
          this.state = 'COUNTDOWN';
          this.countdownTimer = 3.0;
        }
        break;

      case 'COUNTDOWN':
        this.countdownTimer -= dt;
        if (this.countdownTimer <= 0) {
          this.state = 'RACING';
        }
        break;

      case 'RACING':
        game.updateWorld(dt);
        if (game.player.lapCount >= LAPS_TO_WIN) {
          game.finalTime = game.raceTimer;
          this.state = 'FINISH';
        }
        break;

      case 'FINISH':
        if (input.isJustPressed('Enter')) {
          this.state = 'MENU';
        }
        break;
    }

    input.clearJustPressed();
  }

  render(renderer, game) {
    renderer.clear();
    renderer.projectSegments(game.track, game.player);
    renderer.drawRoad(game.track, game.player);
    renderer.drawScenery(game.track, game.player);
    renderer.drawCars(game.track, game.player, game.aiManager.cars);

    switch (this.state) {
      case 'MENU':
        renderer.drawMenu();
        break;

      case 'COUNTDOWN':
        renderer.drawHUD(game.player, game.raceTimer);
        renderer.drawCountdown(this.countdownTimer);
        break;

      case 'RACING':
        renderer.drawHUD(game.player, game.raceTimer);
        break;

      case 'FINISH':
        renderer.drawHUD(game.player, game.finalTime);
        renderer.drawFinish(game.player, game.finalTime);
        break;
    }
  }
}

// Main Game class
class Game {
  constructor() {
    this.canvas = document.querySelector('canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputHandler();
    this.track = new Track();
    this.player = new Player();
    this.aiManager = new AICarManager(this.player);
    this.stateManager = new StateManager();
    this.gameLoop = new GameLoop(() => this.update(), () => this.render());
    this.raceTimer = 0;
    this.finalTime = 0;
  }

  reset() {
    this.player = new Player();
    this.aiManager = new AICarManager(this.player);
    this.raceTimer = 0;
    this.finalTime = 0;
  }

  update() {
    const dt = this.gameLoop.deltaTime;
    this.stateManager.update(this.input, this, dt);

    if (this.stateManager.state === 'RACING') {
      this.raceTimer += dt;
    }
  }

  updateWorld(dt) {
    this.player.update(this.input, this.track, dt);
    this.aiManager.update(this.player, this.track, dt);
  }

  render() {
    this.stateManager.render(this.renderer, this);
  }

  start() {
    this.gameLoop.start();
  }
}

// GameLoop: handles RAF and fixed timestep
class GameLoop {
  constructor(updateFn, renderFn) {
    this.update = updateFn;
    this.render = renderFn;
    this.lastTime = 0;
    this.accumulator = 0;
    this.fixedDt = 1 / 60;
    this.deltaTime = this.fixedDt;
  }

  start() {
    const tick = (timestamp) => {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
      this.lastTime = timestamp;
      this.accumulator += dt;
      this.deltaTime = dt;

      while (this.accumulator >= this.fixedDt) {
        this.update();
        this.accumulator -= this.fixedDt;
      }

      this.render();
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}

// ========== START GAME ==========
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.start();
});
