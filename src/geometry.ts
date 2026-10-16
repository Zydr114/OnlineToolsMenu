type Point = { x: number; y: number; z: number };
type Preferences = { motion: () => boolean; dark: () => boolean };

/** Orthographic mesh renderer with discrete surfaces and depth-sorted wireframes. */
export function createGeometry(
  canvas: HTMLCanvasElement,
  host: HTMLButtonElement,
  preferences: Preferences,
) {
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const ctx = context;
  let width = 0,
    height = 0,
    frame = 0,
    lastFrame = 0,
    elapsed = 0;
  let visible = true,
    shape = 0,
    targetShape = 0;
  let tiltX = 0,
    tiltY = 0,
    targetX = 0,
    targetY = 0;
  const pointer = matchMedia("(hover: hover) and (pointer: fine)");

  function draw() {
    if (!width || !height) return;
    const foreground = preferences.dark() ? 245 : 16;
    const background = preferences.dark() ? 10 : 250;
    const color = (alpha: number) =>
      `rgba(${foreground},${foreground},${foreground},${alpha})`;
    const surface = (amount: number) => {
      const value = Math.round(background + (foreground - background) * amount);
      return `rgb(${value},${value},${value})`;
    };
    ctx.clearRect(0, 0, width, height);
    const columns = width < 400 ? 40 : 48;
    const rows = 16;
    const scale = Math.min(width * 0.235, height * 0.33);
    const rotateX = -0.77 + tiltX;
    const rotateY = 0.33 + elapsed * 0.0001 + tiltY;
    const rotateZ = -0.26;
    const points: Point[] = [];
    const rounded = (value: number, power: number) =>
      Math.sign(value) * Math.pow(Math.abs(value), power);
    for (let u = 0; u < columns; u++) {
      const theta = (u / columns) * Math.PI * 2;
      const power = 1 - shape * 0.57;
      for (let v = 0; v < rows; v++) {
        const phi = (v / rows) * Math.PI * 2;
        const radius = 1.05 + 0.43 * Math.cos(phi);
        let x = rounded(Math.cos(theta), power) * radius;
        let z = rounded(Math.sin(theta), power) * radius;
        let y = 0.43 * Math.sin(phi);
        [y, z] = [
          y * Math.cos(rotateX) - z * Math.sin(rotateX),
          y * Math.sin(rotateX) + z * Math.cos(rotateX),
        ];
        [x, z] = [
          x * Math.cos(rotateY) + z * Math.sin(rotateY),
          -x * Math.sin(rotateY) + z * Math.cos(rotateY),
        ];
        [x, y] = [
          x * Math.cos(rotateZ) - y * Math.sin(rotateZ),
          x * Math.sin(rotateZ) + y * Math.cos(rotateZ),
        ];
        points.push({ x: width / 2 + x * scale, y: height / 2 + y * scale, z });
      }
    }
    const at = (u: number, v: number) =>
      points[(u % columns) * rows + (v % rows)];
    const faces: { vertices: Point[]; depth: number; patch: boolean }[] = [];
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
          patch: u % 6 < 2 && v % 4 < 2,
        });
      }
    faces.sort((a, b) => a.depth - b.depth);
    ctx.lineWidth = 0.65;
    ctx.lineJoin = "round";
    for (const face of faces) {
      const depth = Math.max(0, Math.min(1, (face.depth + 1.6) / 3.2));
      ctx.beginPath();
      face.vertices.forEach((point, index) =>
        index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
      );
      ctx.closePath();
      ctx.fillStyle = surface(
        face.patch ? 0.025 + depth * 0.045 : 0.004 + depth * 0.008,
      );
      ctx.fill();
      ctx.strokeStyle = color(0.09 + depth * 0.31);
      ctx.stroke();
      const point = face.vertices[0];
      ctx.fillStyle = color(0.25 + depth * 0.5);
      ctx.fillRect(point.x - 0.65, point.y - 0.65, 1.3, 1.3);
    }
    canvas.dataset.shape = targetShape ? "square" : "round";
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
      shape += (targetShape - shape) * 0.09;
      tiltX += (targetX - tiltX) * 0.07;
      tiltY += (targetY - tiltY) * 0.07;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function refresh() {
    cancelAnimationFrame(frame);
    lastFrame = 0;
    if (!preferences.motion()) {
      shape = targetShape;
      tiltX = 0;
      tiltY = 0;
    }
    draw();
    canvas.dataset.animating = String(
      visible && !document.hidden && preferences.motion(),
    );
    frame =
      visible && !document.hidden && preferences.motion()
        ? requestAnimationFrame(tick)
        : 0;
  }
  const resize = new ResizeObserver(() => {
    const box = host.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    refresh();
  });
  resize.observe(host);
  host.addEventListener("pointermove", (event) => {
    if (!pointer.matches || !preferences.motion()) return;
    const box = host.getBoundingClientRect();
    targetY = ((event.clientX - box.left) / width - 0.5) * 0.55;
    targetX = ((event.clientY - box.top) / height - 0.5) * 0.4;
  });
  host.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
  });
  host.addEventListener("click", () => {
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
