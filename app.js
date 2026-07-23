(() => {
  "use strict";

  // Remove cache workers left behind by a previously deployed site on this domain.
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    }).catch(() => {});
  }
  if (typeof caches !== "undefined") {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
  }

  const canvas = document.querySelector("#world");
  const ctx = canvas.getContext("2d", { alpha: true });
  const materialButton = document.querySelector("#materialButton");
  const materialMenu = document.querySelector("#materialMenu");
  const materialName = document.querySelector("#materialName");
  const materialSwatch = document.querySelector("#materialSwatch");
  const modeTitle = document.querySelector("#modeTitle");
  const modeHint = document.querySelector("#modeHint");
  const resetButton = document.querySelector("#resetButton");
  const gestureHint = document.querySelector("#gestureHint");

  const TAU = Math.PI * 2;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = innerWidth;
  let height = innerHeight;
  let dpr = 1;
  let mode = "clay";
  let particles = [];
  let lastTime = performance.now();
  let elapsed = 0;
  let interacted = false;
  let resizeTimer = 0;

  const pointer = {
    x: width * 0.5,
    y: height * 0.5,
    px: width * 0.5,
    py: height * 0.5,
    vx: 0,
    vy: 0,
    down: false,
    active: false,
    id: null,
    grabbed: null,
    grabX: 0,
    grabY: 0
  };

  const modeCopy = {
    clay: ["Clay", "Living clay", "Drag through it"],
    straw: ["Straw", "Loose straw", "Push it. Blow it around."],
    timber: ["Timber", "Timber offcuts", "Grab a piece. Throw it."],
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => min + Math.random() * (max - min);
  const mobile = () => Math.min(width, height) < 700;

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, mobile() ? 1.55 : 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clayParticle(index, count) {
    const angle = (index / count) * TAU + random(-0.3, 0.3);
    const radius = random(0.05, 0.3) * Math.min(width, height);
    return {
      type: "clay",
      x: width * 0.53 + Math.cos(angle) * radius * random(0.6, 1.2),
      y: height * 0.47 + Math.sin(angle) * radius * random(0.55, 1.1),
      vx: random(-0.25, 0.25),
      vy: random(-0.25, 0.25),
      r: random(mobile() ? 15 : 19, mobile() ? 27 : 36),
      shade: Math.floor(random(0, 4)),
      seed: random(0, 1000)
    };
  }

  function strawParticle() {
    return {
      type: "straw",
      x: random(-20, width + 20),
      y: random(-20, height + 20),
      vx: random(-0.35, 0.35),
      vy: random(-0.3, 0.3),
      length: random(12, 31),
      thick: random(1.2, 2.8),
      angle: random(0, TAU),
      va: random(-0.015, 0.015),
      shade: Math.floor(random(0, 5)),
      seed: random(0, 1000)
    };
  }

  function timberParticle(index) {
    const long = Math.random() > 0.76;
    const length = long ? random(95, 155) : random(48, 94);
    return {
      type: "timber",
      x: random(width * 0.1, width * 0.9),
      y: random(height * 0.12, height * 0.7),
      vx: random(-1.1, 1.1),
      vy: random(-0.3, 0.5),
      length: mobile() ? length * 0.75 : length,
      thick: random(10, 18),
      angle: random(-Math.PI, Math.PI),
      va: random(-0.025, 0.025),
      mass: long ? 1.5 : 1,
      shade: index % 5,
      seed: random(0, 1000),
      grabbed: false
    };
  }

  function reset(nextMode = mode) {
    mode = nextMode;
    pointer.grabbed = null;
    const areaScale = clamp((width * height) / (1280 * 760), 0.62, 1.35);

    if (mode === "clay") {
      const count = Math.round((mobile() ? 58 : 86) * areaScale);
      particles = Array.from({ length: count }, (_, index) => clayParticle(index, count));
    } else if (mode === "straw") {
      const count = Math.round((mobile() ? 120 : 210) * areaScale);
      particles = Array.from({ length: count }, strawParticle);
    } else {
      const count = Math.round((mobile() ? 20 : 32) * areaScale);
      particles = Array.from({ length: count }, (_, index) => timberParticle(index));
    }
  }

  function switchMode(nextMode) {
    if (!modeCopy[nextMode]) return;
    const [name, title, hint] = modeCopy[nextMode];
    materialName.textContent = name;
    modeTitle.textContent = title;
    modeHint.textContent = hint;
    materialSwatch.className = `material-swatch ${nextMode}`;
    document.documentElement.dataset.material = nextMode;
    closeMenu();
    reset(nextMode);
  }

  function openMenu() {
    materialMenu.hidden = false;
    materialButton.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    materialMenu.hidden = true;
    materialButton.setAttribute("aria-expanded", "false");
  }

  function hideGesture() {
    if (interacted) return;
    interacted = true;
    gestureHint.classList.add("dismissed");
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = x;
    pointer.y = y;
    pointer.vx = clamp(x - pointer.px, -45, 45);
    pointer.vy = clamp(y - pointer.py, -45, 45);
    pointer.active = true;
  }

  function findTimber(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const piece of particles) {
      const dx = x - piece.x;
      const dy = y - piece.y;
      const cos = Math.cos(-piece.angle);
      const sin = Math.sin(-piece.angle);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      if (Math.abs(localX) < piece.length * 0.56 && Math.abs(localY) < piece.thick * 1.15) {
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          best = piece;
          bestDistance = distance;
          pointer.grabX = localX;
          pointer.grabY = localY;
        }
      }
    }
    return best;
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    hideGesture();
    updatePointer(event);
    pointer.down = true;
    pointer.id = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    if (mode === "timber") {
      pointer.grabbed = findTimber(pointer.x, pointer.y);
      if (pointer.grabbed) pointer.grabbed.grabbed = true;
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    updatePointer(event);
    if (event.pointerType !== "mouse" || pointer.down) hideGesture();
  });

  function releasePointer(event) {
    if (event.pointerId !== pointer.id && pointer.id !== null) return;
    if (pointer.grabbed) {
      pointer.grabbed.grabbed = false;
      pointer.grabbed.vx = pointer.vx * 0.72;
      pointer.grabbed.vy = pointer.vy * 0.72;
      pointer.grabbed.va += (pointer.vx - pointer.vy) * 0.0018;
    }
    pointer.down = false;
    pointer.id = null;
    pointer.grabbed = null;
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("pointerleave", (event) => {
    if (!pointer.down && event.pointerType === "mouse") pointer.active = false;
  });

  materialButton.addEventListener("click", (event) => {
    event.stopPropagation();
    materialMenu.hidden ? openMenu() : closeMenu();
  });

  materialMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-material]");
    if (button) switchMode(button.dataset.material);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!materialMenu.hidden && !event.target.closest(".topbar")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
    if (event.key.toLowerCase() === "r") reset();
  });

  resetButton.addEventListener("click", () => reset());

  function pointerForce(particle, radius, strength, velocityScale = 0.12) {
    if (!pointer.active) return;
    const dx = particle.x - pointer.x;
    const dy = particle.y - pointer.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > radius * radius || distanceSq < 0.001) return;
    const distance = Math.sqrt(distanceSq);
    const power = (1 - distance / radius) * strength * (pointer.down ? 1.65 : 0.75);
    particle.vx += (dx / distance) * power + pointer.vx * velocityScale * power;
    particle.vy += (dy / distance) * power + pointer.vy * velocityScale * power;
  }

  function updateClay(step) {
    const count = particles.length;
    const centerX = width * 0.52 + Math.sin(elapsed * 0.00024) * width * 0.035;
    const centerY = height * 0.47 + Math.cos(elapsed * 0.00021) * height * 0.03;

    for (let i = 0; i < count; i += 1) {
      const p = particles[i];
      let nearX = 0;
      let nearY = 0;
      let neighbors = 0;

      for (let j = i + 1; j < count; j += 1) {
        const q = particles[j];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const distanceSq = dx * dx + dy * dy;
        const desired = (p.r + q.r) * 0.68;

        if (distanceSq < 125 * 125) {
          nearX += q.x;
          nearY += q.y;
          neighbors += 1;
        }

        if (distanceSq > 0.01 && distanceSq < desired * desired) {
          const distance = Math.sqrt(distanceSq);
          const push = (desired - distance) / desired * 0.038 * step;
          const nx = dx / distance;
          const ny = dy / distance;
          p.vx -= nx * push;
          p.vy -= ny * push;
          q.vx += nx * push;
          q.vy += ny * push;
        }
      }

      if (neighbors) {
        p.vx += ((nearX / neighbors) - p.x) * 0.000026 * step;
        p.vy += ((nearY / neighbors) - p.y) * 0.000026 * step;
      }

      p.vx += (centerX - p.x) * 0.000012 * step;
      p.vy += (centerY - p.y) * 0.000012 * step;
      p.vx += Math.sin(elapsed * 0.00045 + p.seed) * 0.0018 * step;
      p.vy += Math.cos(elapsed * 0.00038 + p.seed * 0.7) * 0.0018 * step;
      pointerForce(p, mobile() ? 115 : 155, 0.12 * step, 0.18);

      p.vx *= Math.pow(0.975, step);
      p.vy *= Math.pow(0.975, step);
      p.x += p.vx * step;
      p.y += p.vy * step;

      const pad = p.r * 0.45;
      if (p.x < -pad) p.vx += 0.055 * step;
      if (p.x > width + pad) p.vx -= 0.055 * step;
      if (p.y < -pad) p.vy += 0.055 * step;
      if (p.y > height + pad) p.vy -= 0.055 * step;
    }
  }

  function updateStraw(step) {
    const gustX = Math.sin(elapsed * 0.00031) * 0.018 + 0.008;
    const gustY = Math.cos(elapsed * 0.00023) * 0.008;
    for (const p of particles) {
      const wind = Math.sin(p.y * 0.009 + elapsed * 0.0007 + p.seed) * 0.009;
      p.vx += (gustX + wind) * step;
      p.vy += (gustY + Math.cos(p.x * 0.007 + p.seed) * 0.003) * step;
      pointerForce(p, mobile() ? 150 : 205, 0.32 * step, 0.25);

      p.vx *= Math.pow(0.988, step);
      p.vy *= Math.pow(0.988, step);
      p.va += (p.vx * 0.0009 + wind * 0.01) * step;
      p.va *= Math.pow(0.985, step);
      p.angle += p.va * step;
      p.x += p.vx * step;
      p.y += p.vy * step;

      const margin = 45;
      if (p.x > width + margin) p.x = -margin;
      if (p.x < -margin) p.x = width + margin;
      if (p.y > height + margin) p.y = -margin;
      if (p.y < -margin) p.y = height + margin;
    }
  }

  function updateTimber(step) {
    const floor = height - Math.max(70, height * 0.08);
    for (const p of particles) {
      if (p.grabbed && pointer.down) {
        const targetAngle = p.angle;
        const offsetX = pointer.grabX * Math.cos(targetAngle) - pointer.grabY * Math.sin(targetAngle);
        const offsetY = pointer.grabX * Math.sin(targetAngle) + pointer.grabY * Math.cos(targetAngle);
        const targetX = pointer.x - offsetX;
        const targetY = pointer.y - offsetY;
        p.vx += (targetX - p.x) * 0.18 * step;
        p.vy += (targetY - p.y) * 0.18 * step;
        p.va += pointer.vx * 0.00025 * step;
      } else {
        p.vy += 0.16 * step * p.mass;
        pointerForce(p, mobile() ? 95 : 125, 0.17 * step, 0.14);
      }

      p.vx *= Math.pow(0.993, step);
      p.vy *= Math.pow(0.995, step);
      p.va *= Math.pow(0.991, step);
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.angle += p.va * step;

      const half = p.length * 0.5;
      const extentX = Math.abs(Math.cos(p.angle)) * half + p.thick;
      const extentY = Math.abs(Math.sin(p.angle)) * half + p.thick;

      if (p.x - extentX < 0) {
        p.x = extentX;
        p.vx = Math.abs(p.vx) * 0.54;
        p.va += p.vy * 0.0015;
      }
      if (p.x + extentX > width) {
        p.x = width - extentX;
        p.vx = -Math.abs(p.vx) * 0.54;
        p.va -= p.vy * 0.0015;
      }
      if (p.y - extentY < 0) {
        p.y = extentY;
        p.vy = Math.abs(p.vy) * 0.5;
      }
      if (p.y + extentY > floor) {
        p.y = floor - extentY;
        if (Math.abs(p.vy) > 0.6) p.va += p.vx * 0.0025;
        p.vy = -Math.abs(p.vy) * 0.34;
        p.vx *= 0.91;
        p.va *= 0.82;
      }
    }

    for (let i = 0; i < particles.length; i += 1) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j += 1) {
        const b = particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distanceSq = dx * dx + dy * dy;
        const minDistance = (a.thick + b.thick) * 1.15;
        if (distanceSq > 0.1 && distanceSq < minDistance * minDistance) {
          const distance = Math.sqrt(distanceSq);
          const overlap = (minDistance - distance) * 0.3;
          const nx = dx / distance;
          const ny = dy / distance;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const impulse = ((b.vx - a.vx) * nx + (b.vy - a.vy) * ny) * 0.36;
          a.vx += nx * impulse;
          a.vy += ny * impulse;
          b.vx -= nx * impulse;
          b.vy -= ny * impulse;
        }
      }
    }
  }

  function clear() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
  }

  function drawGroundShadow(x, y, radiusX, radiusY, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, radiusY / radiusX);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    gradient.addColorStop(0, `rgba(55, 42, 31, ${alpha})`);
    gradient.addColorStop(1, "rgba(55, 42, 31, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radiusX, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawClay() {
    const palette = ["#a94f38", "#b75c42", "#99513f", "#c06b50"];
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.filter = "blur(22px)";
    for (const p of particles) {
      ctx.fillStyle = "#604034";
      ctx.beginPath();
      ctx.arc(p.x + 6, p.y + 16, p.r * 1.06, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      for (let j = i + 1; j < particles.length; j += 1) {
        const q = particles[j];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const max = (p.r + q.r) * 1.32;
        if (dx * dx + dy * dy < max * max) {
          ctx.strokeStyle = palette[p.shade];
          ctx.lineWidth = Math.min(p.r, q.r) * 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    for (const p of particles) {
      const gradient = ctx.createRadialGradient(
        p.x - p.r * 0.28,
        p.y - p.r * 0.34,
        p.r * 0.1,
        p.x,
        p.y,
        p.r * 1.08
      );
      gradient.addColorStop(0, palette[Math.min(3, p.shade + 1)]);
      gradient.addColorStop(0.72, palette[p.shade]);
      gradient.addColorStop(1, "#884633");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStraw() {
    const palette = ["#b78530", "#d2ac59", "#e0c278", "#a9782a", "#c89a42"];
    drawGroundShadow(width * 0.53, height * 0.76, width * 0.33, 65, 0.045);
    ctx.lineCap = "round";
    for (const p of particles) {
      const cos = Math.cos(p.angle) * p.length * 0.5;
      const sin = Math.sin(p.angle) * p.length * 0.5;
      ctx.strokeStyle = "rgba(60, 45, 24, 0.13)";
      ctx.lineWidth = p.thick + 1.8;
      ctx.beginPath();
      ctx.moveTo(p.x - cos + 1.5, p.y - sin + 2.5);
      ctx.lineTo(p.x + cos + 1.5, p.y + sin + 2.5);
      ctx.stroke();
      ctx.strokeStyle = palette[p.shade];
      ctx.lineWidth = p.thick;
      ctx.beginPath();
      ctx.moveTo(p.x - cos, p.y - sin);
      ctx.quadraticCurveTo(p.x + Math.sin(p.seed) * 2, p.y + Math.cos(p.seed) * 2, p.x + cos, p.y + sin);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 245, 198, 0.42)";
      ctx.lineWidth = Math.max(0.45, p.thick * 0.28);
      ctx.beginPath();
      ctx.moveTo(p.x - cos * 0.8, p.y - sin * 0.8);
      ctx.lineTo(p.x + cos * 0.8, p.y + sin * 0.8);
      ctx.stroke();
    }
  }

  function roundedRect(context, x, y, w, h, radius) {
    const r = Math.min(radius, Math.abs(w) * 0.5, Math.abs(h) * 0.5);
    context.beginPath();
    context.roundRect(x, y, w, h, r);
  }

  function drawTimber() {
    const palette = ["#755b3f", "#8a6a48", "#684e38", "#9a7750", "#795c42"];
    const floor = height - Math.max(70, height * 0.08);
    const floorGradient = ctx.createLinearGradient(0, floor - 30, 0, height);
    floorGradient.addColorStop(0, "rgba(100, 75, 48, 0)");
    floorGradient.addColorStop(1, "rgba(112, 86, 57, 0.08)");
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, floor - 30, width, height - floor + 30);

    for (const p of particles) {
      ctx.save();
      ctx.translate(p.x + 5, p.y + 7);
      ctx.rotate(p.angle);
      ctx.fillStyle = "rgba(54, 43, 33, 0.15)";
      roundedRect(ctx, -p.length * 0.5, -p.thick * 0.5, p.length, p.thick, p.thick * 0.22);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const gradient = ctx.createLinearGradient(0, -p.thick * 0.5, 0, p.thick * 0.5);
      gradient.addColorStop(0, "#a17e57");
      gradient.addColorStop(0.24, palette[p.shade]);
      gradient.addColorStop(1, "#5a4534");
      ctx.fillStyle = gradient;
      roundedRect(ctx, -p.length * 0.5, -p.thick * 0.5, p.length, p.thick, p.thick * 0.2);
      ctx.fill();

      ctx.save();
      roundedRect(ctx, -p.length * 0.5, -p.thick * 0.5, p.length, p.thick, p.thick * 0.2);
      ctx.clip();
      ctx.strokeStyle = "rgba(47, 33, 23, 0.22)";
      ctx.lineWidth = 0.7;
      for (let g = -2; g <= 2; g += 1) {
        const y = g * p.thick * 0.18 + Math.sin(p.seed + g) * 1.2;
        ctx.beginPath();
        ctx.moveTo(-p.length * 0.46, y);
        ctx.bezierCurveTo(-p.length * 0.18, y + Math.sin(p.seed) * 2.4, p.length * 0.14, y - 1.8, p.length * 0.46, y + 0.8);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = "rgba(224, 190, 139, 0.65)";
      ctx.beginPath();
      ctx.ellipse(-p.length * 0.5 + 1, 0, 2.3, p.thick * 0.38, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function tick(now) {
    const delta = Math.min(34, now - lastTime);
    const step = reduceMotion ? 0.35 : delta / 16.667;
    lastTime = now;
    elapsed += delta;

    if (mode === "clay") updateClay(step);
    else if (mode === "straw") updateStraw(step);
    else updateTimber(step);

    clear();
    if (mode === "clay") drawClay();
    else if (mode === "straw") drawStraw();
    else drawTimber();

    pointer.vx *= 0.72;
    pointer.vy *= 0.72;
    requestAnimationFrame(tick);
  }

  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      reset();
    }, 120);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    lastTime = performance.now();
  });

  resize();
  reset("clay");
  requestAnimationFrame(tick);
  setTimeout(() => gestureHint.classList.add("dismissed"), 6500);
})();
