<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<title>2D Gravity Simulation</title>
<style>
  body { margin: 0; overflow: hidden; background: rgb(10, 10, 30); color: white; font-family: Arial, sans-serif; }
  canvas { display: block; }
  #overlay {
    position: absolute;
    left: 10px; top: 10px;
    font-size: 14px;
    pointer-events: none;
    white-space: pre-line;
  }
</style>
</head>
<body>
<canvas id="canvas"></canvas>
<div id="overlay"></div>

<script>
(() => {
  // --- Konfiguration ---
  const BG_COLOR = "rgb(10, 10, 30)";
  const TEXT_COLOR = "white";

  const START_BODIES_COUNT = 1;
  const MASS_MIN = 1;
  const MASS_MAX = 2;

  let G = 2000;
  let COLLISION_ENABLED = true;
  let SPAWN_ENABLED = true;
  let RANDOM_VELOCITY_ENABLED = true;
  let RANDOM_VELOCITY_STRENGTH = 3000;
  const SPAWN_INTERVAL = 0.002;
  const MAX_FORCE = 10000;

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");

  let WIDTH, HEIGHT;

  function resize() {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
  }
  window.addEventListener("resize", resize);
  resize();

  // --- Hilfsfunktionen ---
  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  // --- Klasse Body ---
  class Body {
    constructor(x, y, masse, vx = 0, vy = 0) {
      this.x = x;
      this.y = y;
      this.masse = masse;
      this.vx = vx;
      this.vy = vy;
      this.radius = this.calcRadius();
    }

    calcRadius() {
      return Math.max(5, Math.floor(Math.pow(this.masse, 0.8)));
    }

    draw(ctx) {
      ctx.fillStyle = "rgb(150, 180, 255)";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.floor(this.masse), this.x, this.y);
    }

    updatePosition(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    applyForce(fx, fy, dt) {
      const ax = fx / this.masse;
      const ay = fy / this.masse;
      this.vx += ax * dt;
      this.vy += ay * dt;
    }

    isOffScreen(width, height) {
      return (
        this.x + this.radius < 0 ||
        this.x - this.radius > width ||
        this.y + this.radius < 0 ||
        this.y - this.radius > height
      );
    }
  }

  function gravForce(b1, b2, G) {
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    let distSq = dx * dx + dy * dy;
    let dist = Math.sqrt(distSq);
    if (dist < 0.5) {
      dist = 0.5;
      distSq = dist * dist;
    }
    let force = (G * b1.masse * b2.masse) / distSq;
    force = Math.min(force, MAX_FORCE);
    const fx = (force * dx) / dist;
    const fy = (force * dy) / dist;
    return [fx, fy];
  }

  function checkCollisions(bodies, collisionEnabled) {
    if (!collisionEnabled) return bodies;

    const merged = [];
    const skip = new Set();
    const newBodies = [];

    for (let i = 0; i < bodies.length; i++) {
      if (skip.has(i)) continue;
      const b1 = bodies[i];

      let mergedThis = false;
      for (let j = i + 1; j < bodies.length; j++) {
        if (skip.has(j)) continue;
        const b2 = bodies[j];

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < b1.radius + b2.radius) {
          const totalMass = b1.masse + b2.masse;
          const x = (b1.x * b1.masse + b2.x * b2.masse) / totalMass;
          const y = (b1.y * b1.masse + b2.y * b2.masse) / totalMass;
          const vx = (b1.vx * b1.masse + b2.vx * b2.masse) / totalMass;
          const vy = (b1.vy * b1.masse + b2.vy * b2.masse) / totalMass;

          const newBody = new Body(x, y, totalMass, vx, vy);
          newBodies.push(newBody);
          skip.add(i);
          skip.add(j);
          mergedThis = true;
          break;
        }
      }
      if (!mergedThis && !skip.has(i)) {
        merged.push(b1);
      }
    }
    return merged.concat(newBodies);
  }

  function randomVelocity(randomEnabled, strength) {
    if (randomEnabled) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = Math.random() * strength;
      return [Math.cos(angle) * speed, Math.sin(angle) * speed];
    }
    return [0, 0];
  }

  function spawnStar(randomEnabled, strength) {
    const x = randomRange(0, WIDTH);
    const y = randomRange(0, HEIGHT);
    const masse = randomRange(MASS_MIN, MASS_MAX);
    const [vx, vy] = randomVelocity(randomEnabled, strength);
    return new Body(x, y, masse, vx, vy);
  }

  // --- Simulation ---
  let bodies = [];
  let spawnTimer = 0;

  function reset() {
    bodies = [];
    for (let i = 0; i < START_BODIES_COUNT; i++) {
      const x = randomRange(WIDTH / 2 - 150, WIDTH / 2 + 150);
      const y = randomRange(HEIGHT / 2 - 150, HEIGHT / 2 + 150);
      const masse = randomRange(MASS_MIN, MASS_MAX);
      const [vx, vy] = randomVelocity(RANDOM_VELOCITY_ENABLED, RANDOM_VELOCITY_STRENGTH);
      bodies.push(new Body(x, y, masse, vx, vy));
    }
    G = 2000;
    COLLISION_ENABLED = true;
    SPAWN_ENABLED = true;
    RANDOM_VELOCITY_ENABLED = true;
    RANDOM_VELOCITY_STRENGTH = 3000;
    spawnTimer = 0;
  }
  reset();

  // --- Input-Handling ---
  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "Escape":
        // Browser tab schließen oder Simulation stoppen? Keine Aktion hier.
        break;
      case "r":
      case "R":
        reset();
        break;
      case "ArrowUp":
        G *= 1.1;
        break;
      case "ArrowDown":
        G /= 1.1;
        break;
      case "c":
      case "C":
        COLLISION_ENABLED = !COLLISION_ENABLED;
        break;
      case "s":
      case "S":
        SPAWN_ENABLED = !SPAWN_ENABLED;
        break;
      case "v":
      case "V":
        RANDOM_VELOCITY_ENABLED = !RANDOM_VELOCITY_ENABLED;
        break;
      case "ArrowRight":
        RANDOM_VELOCITY_STRENGTH += 10;
        break;
      case "ArrowLeft":
        RANDOM_VELOCITY_STRENGTH = Math.max(0, RANDOM_VELOCITY_STRENGTH - 10);
        break;
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const masse = randomRange(MASS_MIN, MASS_MAX);
    const [vx, vy] = randomVelocity(RANDOM_VELOCITY_ENABLED, RANDOM_VELOCITY_STRENGTH);
    bodies.push(new Body(mx, my, masse, vx, vy));
  });

  // --- Main Loop ---
  let lastTimestamp = 0;

  function loop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = (timestamp - lastTimestamp) / 1000; // in Sekunden
    lastTimestamp = timestamp;

    if (SPAWN_ENABLED) {
      spawnTimer += dt;
    }

    if (SPAWN_ENABLED && spawnTimer >= SPAWN_INTERVAL) {
      bodies.push(spawnStar(RANDOM_VELOCITY_ENABLED, RANDOM_VELOCITY_STRENGTH));
      spawnTimer = 0;
    }

    // Kraftberechnung
    const forces = bodies.map(() => [0, 0]);

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const [fx, fy] = gravForce(bodies[i], bodies[j], G);
        forces[i][0] += fx;
        forces[i][1] += fy;
        forces[j][0] -= fx;
        forces[j][1] -= fy;
      }
    }

    // Bewegung
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].applyForce(forces[i][0], forces[i][1], dt);
    }

    bodies.forEach(b => b.updatePosition(dt));

    // Kollisionen
    bodies = checkCollisions(bodies, COLLISION_ENABLED);

    // Entferne Körper außerhalb des Bildschirms (optional)
    bodies = bodies.filter(b => !b.isOffScreen(WIDTH, HEIGHT));

    // Zeichnen
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    bodies.forEach(b => b.draw(ctx));

    // Overlay Text
    overlay.textContent = `
Anzahl Körper: ${bodies.length}
Gravitationskonstante (G): ${G.toFixed(0)}
Kollisionen: ${COLLISION_ENABLED ? "AN" : "AUS"}
Spawn: ${SPAWN_ENABLED ? "AN" : "AUS"}
Random Velocity: ${RANDOM_VELOCITY_ENABLED ? "AN" : "AUS"}
Random Velocity Stärke: ${RANDOM_VELOCITY_STRENGTH.toFixed(0)}

Tasten:
- Pfeil Hoch/Runter: G erhöhen/verringern
- C: Kollision ein/aus
- S: Spawn ein/aus
- V: Random Velocity ein/aus
- Pfeil Rechts/Links: Random Velocity Stärke ändern
- R: Reset
- Klick: Neuer Körper an Mausposition
    `.trim();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
</script>
</body>
</html>
