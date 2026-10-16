type Vector = { x: number; y: number; z: number };
type Projected = Vector & { perspective: number };
type Preferences = { motion: () => boolean; dark: () => boolean };
type Drag = {
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  orbitX: number;
  orbitY: number;
  moved: boolean;
  touch: boolean;
};

const TAU = Math.PI * 2;
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
const normalize = (v: Vector): Vector => {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};
const cross = (a: Vector, b: Vector): Vector => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** Closed parametric curves; morphing blends positions rather than non-integer frequencies. */
function center(t: number, shape: number, time: number): Vector {
  const breathing = Math.sin(time * 0.00018) * 0.035;
  const radius = 1.02 + (0.43 + breathing) * Math.cos(3 * t);
  const alternate = 0.52 * (2 + Math.cos(2 * t));
  return {
    x: mix(radius * Math.cos(2 * t), alternate * Math.cos(3 * t), shape),
    y: mix(radius * Math.sin(2 * t), alternate * Math.sin(3 * t), shape),
    z: mix(0.57 * Math.sin(3 * t), 0.61 * Math.sin(4 * t), shape),
  };
}

/** Perspective, depth-sorted knot surfaces with sparse moving red/blue filaments. */
export function createGeometry(
  canvas: HTMLCanvasElement,
  host: HTMLButtonElement,
  preferences: Preferences,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const context = ctx;
  let width = 0,
    height = 0,
    frame = 0,
    lastFrame = 0,
    elapsed = 0;
  let visible = true,
    shape = 0,
    targetShape = 0;
  let orbitX = 0,
    orbitY = 0,
    velocityX = 0,
    velocityY = 0;
  let hoverX = 0,
    hoverY = 0,
    targetHoverX = 0,
    targetHoverY = 0;
  let drag: Drag | null = null;
  let suppressClick = false;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

  function draw() {
    if (!width || !height) return;
    const dark = preferences.dark();
    const ink = dark ? 245 : 16;
    const background = dark ? 10 : 250;
    const red = dark ? "255,88,99" : "211,38,59";
    const blue = dark ? "91,145,255" : "38,93,224";
    const mono = (opacity: number) => `rgba(${ink},${ink},${ink},${opacity})`;
    const tint = (amount: number) => {
      const value = Math.round(mix(background, ink, amount));
      return `rgb(${value},${value},${value})`;
    };
    context.clearRect(0, 0, width, height);
    const columns = width < 400 ? 108 : 144;
    const rows = 10;
    const scale = Math.min(width * 0.245, height * 0.355);
    const angleX = 0.55 + orbitX + hoverX + Math.sin(elapsed * 0.00009) * 0.12;
    const angleY = -0.38 + orbitY + hoverY + elapsed * 0.00006;
    const angleZ = -0.24 + Math.sin(elapsed * 0.00007) * 0.09;
    const cx = Math.cos(angleX),
      sx = Math.sin(angleX);
    const cy = Math.cos(angleY),
      sy = Math.sin(angleY);
    const cz = Math.cos(angleZ),
      sz = Math.sin(angleZ);
    const project = (point: Vector): Projected => {
      let { x, y, z } = point;
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      const perspective = 6.7 / (6.7 - z);
      return {
        x: width / 2 + x * scale * perspective,
        y: height / 2 + y * scale * perspective,
        z,
        perspective,
      };
    };
    const points: Projected[] = [];
    for (let u = 0; u < columns; u++) {
      const t = (u / columns) * TAU;
      const origin = center(t, shape, elapsed);
      const previous = center(t - 0.002, shape, elapsed);
      const next = center(t + 0.002, shape, elapsed);
      const tangent = normalize({
        x: next.x - previous.x,
        y: next.y - previous.y,
        z: next.z - previous.z,
      });
      const normal = normalize(
        cross(
          tangent,
          Math.abs(tangent.z) > 0.95
            ? { x: 0, y: 1, z: 0 }
            : { x: 0, y: 0, z: 1 },
        ),
      );
      const binormal = cross(tangent, normal);
      const radius = 0.165 + 0.022 * Math.sin(t * 3 - elapsed * 0.00025);
      const twist = 0.3 * Math.sin(t * 2 + elapsed * 0.00013);
      for (let v = 0; v < rows; v++) {
        const angle = (v / rows) * TAU + twist;
        const n = Math.cos(angle) * radius,
          b = Math.sin(angle) * radius;
        points.push(
          project({
            x: origin.x + normal.x * n + binormal.x * b,
            y: origin.y + normal.y * n + binormal.y * b,
            z: origin.z + normal.z * n + binormal.z * b,
          }),
        );
      }
    }
    // Fit the entire projected knot, including during rotation and morphing.
    // The canvas bounds never crop a loop or its tube surface.
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    const padding = width < 400 ? 23 : 29;
    const fit = Math.min(
      1,
      (width - padding * 2) / (maxX - minX),
      (height - padding * 2) / (maxY - minY),
    );
    for (const point of points) {
      point.x = (point.x - (minX + maxX) / 2) * fit + width / 2;
      point.y = (point.y - (minY + maxY) / 2) * fit + height / 2;
    }
    const at = (u: number, v: number) =>
      points[(u % columns) * rows + (v % rows)];
    const faces: {
      vertices: Projected[];
      depth: number;
      u: number;
      v: number;
    }[] = [];
    for (let u = 0; u < columns; u++)
      for (let v = 0; v < rows; v++) {
        const vertices = [
          at(u, v),
          at(u + 1, v),
          at(u + 1, v + 1),
          at(u, v + 1),
        ];
        faces.push({
          vertices,
          depth: vertices.reduce((sum, p) => sum + p.z, 0) / 4,
          u,
          v,
        });
      }
    faces.sort((a, b) => a.depth - b.depth);
    const phase = elapsed * 0.000022;
    context.lineJoin = "round";
    for (const face of faces) {
      const depth = Math.max(0, Math.min(1, (face.depth + 1.8) / 3.6));
      const { vertices, u, v } = face;
      context.beginPath();
      vertices.forEach((p, i) =>
        i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y),
      );
      context.closePath();
      context.fillStyle = tint(0.007 + depth * 0.018);
      context.fill();
      context.strokeStyle = mono(0.07 + depth * 0.24);
      context.lineWidth = 0.55;
      context.stroke();
      // A few longitudinal sections carry color; the mathematical surface stays neutral.
      const travel = (((u / columns - phase) % 1) + 1) % 1;
      const accent =
        v === 7 && travel > 0.04 && travel < 0.43
          ? red
          : v === 8 && travel > 0.53 && travel < 0.94
            ? blue
            : null;
      if (accent) {
        context.beginPath();
        context.moveTo(vertices[0].x, vertices[0].y);
        context.lineTo(vertices[1].x, vertices[1].y);
        context.strokeStyle = `rgba(${accent},${0.55 + depth * 0.4})`;
        context.lineWidth = 1.3 * vertices[0].perspective;
        context.stroke();
        const end = accent === red ? 0.43 : 0.94;
        if (end - travel < 1 / columns) {
          context.fillStyle = `rgb(${accent})`;
          context.beginPath();
          context.arc(vertices[1].x, vertices[1].y, 2, 0, TAU);
          context.fill();
        }
      } else if (u % 12 === 0 && v % 2 === 0) {
        context.fillStyle = mono(0.25 + depth * 0.5);
        context.fillRect(vertices[0].x - 0.65, vertices[0].y - 0.65, 1.3, 1.3);
      }
    }
    canvas.dataset.shape = targetShape ? "figure-eight" : "trefoil";
    host.classList.add("geometry-ready");
  }

  function tick(time: number) {
    if (!visible || document.hidden || !preferences.motion()) {
      frame = 0;
      return;
    }
    const delta = lastFrame ? Math.min(time - lastFrame, 64) : 32;
    if (delta >= 30) {
      elapsed += delta;
      lastFrame = time;
      const factor = 1 - Math.pow(0.91, delta / 32);
      shape = mix(shape, targetShape, factor);
      hoverX = mix(hoverX, targetHoverX, factor);
      hoverY = mix(hoverY, targetHoverY, factor);
      if (!drag) {
        orbitX += (velocityX * delta) / 32;
        orbitY += (velocityY * delta) / 32;
        velocityX *= Math.pow(0.92, delta / 32);
        velocityY *= Math.pow(0.92, delta / 32);
      }
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function refresh() {
    cancelAnimationFrame(frame);
    lastFrame = 0;
    if (!preferences.motion()) {
      shape = targetShape;
      hoverX = hoverY = targetHoverX = targetHoverY = velocityX = velocityY = 0;
    }
    draw();
    const animated = visible && !document.hidden && preferences.motion();
    canvas.dataset.animating = String(animated);
    frame = animated ? requestAnimationFrame(tick) : 0;
  }
  new ResizeObserver(() => {
    const box = host.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    refresh();
  }).observe(host);
  host.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    velocityX = velocityY = 0;
    suppressClick = false;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      orbitX,
      orbitY,
      moved: false,
      touch: event.pointerType === "touch",
    };
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener("pointermove", (event) => {
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      // Vertical touch gestures stay available to native page scrolling.
      if (drag.touch && !drag.moved && Math.abs(dy) > Math.abs(dx)) return;
      drag.moved = true;
      host.dataset.dragging = "true";
      orbitX = drag.orbitX + dy * 0.006;
      orbitY = drag.orbitY + dx * 0.007;
      velocityX = Math.max(
        -0.06,
        Math.min(0.06, (event.clientY - drag.lastY) * 0.004),
      );
      velocityY = Math.max(
        -0.06,
        Math.min(0.06, (event.clientX - drag.lastX) * 0.004),
      );
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.lastTime = event.timeStamp;
      if (!preferences.motion()) draw();
    } else if (finePointer.matches && preferences.motion()) {
      const box = host.getBoundingClientRect();
      targetHoverY = ((event.clientX - box.left) / width - 0.5) * 0.4;
      targetHoverX = ((event.clientY - box.top) / height - 0.5) * 0.3;
    }
  });
  const finishDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    suppressClick = drag.moved;
    if (event.type === "pointercancel" || event.timeStamp - drag.lastTime > 90)
      velocityX = velocityY = 0;
    drag = null;
    host.dataset.dragging = "false";
    if (host.hasPointerCapture(event.pointerId))
      host.releasePointerCapture(event.pointerId);
  };
  host.addEventListener("pointerup", finishDrag);
  host.addEventListener("pointercancel", finishDrag);
  host.addEventListener("lostpointercapture", finishDrag);
  host.addEventListener("pointerleave", () => {
    targetHoverX = targetHoverY = 0;
  });
  host.addEventListener("click", (event) => {
    if (suppressClick && event.detail > 0) {
      suppressClick = false;
      return;
    }
    suppressClick = false;
    targetShape = 1 - targetShape;
    host.setAttribute("aria-pressed", String(Boolean(targetShape)));
    refresh();
  });
  document.addEventListener("visibilitychange", refresh);
  return {
    refresh,
    setVisible(value: boolean) {
      visible = value;
      refresh();
    },
  };
}
