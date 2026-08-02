/** Geometria e utilitários de áreas / FoW do mapa. */

export function clampCircleToGrid(center, radius, gridW, gridH) {
  let cx = Number(center.x);
  let cy = Number(center.y);
  const r = Math.max(0, Number(radius) || 0);
  // Translate so the circle bbox fits inside the grid
  const minX = cx - r;
  const maxX = cx + r;
  const minY = cy - r;
  const maxY = cy + r;
  if (minX < 0) cx -= minX;
  if (minY < 0) cy -= minY;
  if (maxX > gridW - 1) cx -= maxX - (gridW - 1);
  if (maxY > gridH - 1) cy -= maxY - (gridH - 1);
  // If still larger than grid, pin to center of map
  if (r * 2 > gridW - 1) cx = (gridW - 1) / 2;
  if (r * 2 > gridH - 1) cy = (gridH - 1) / 2;
  return { center: { x: cx, y: cy }, radius: r };
}

/** Círculo a partir de centro + raio (células). */
export function cellsForCircle(center, radius, gridW, gridH) {
  const { center: c, radius: r } = clampCircleToGrid(center, radius, gridW, gridH);
  const cells = [];
  for (let x = 0; x < gridW; x++) {
    for (let y = 0; y < gridH; y++) {
      const dist = Math.hypot(x - c.x, y - c.y);
      if (dist <= r + 0.5) cells.push({ x, y });
    }
  }
  return { cells, center: c, radius: r };
}

/** Diametro entre dois polos; se algum polo sai da grid, translada o par. */
export function cellsForDiameter(poleA, poleB, gridW, gridH) {
  let ax = Number(poleA.x);
  let ay = Number(poleA.y);
  let bx = Number(poleB.x);
  let by = Number(poleB.y);
  // Translate both points by the same delta so both lie inside grid if possible
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  let dx = 0;
  let dy = 0;
  if (minX < 0) dx = -minX;
  if (minY < 0) dy = -minY;
  if (maxX + dx > gridW - 1) dx -= maxX + dx - (gridW - 1);
  if (maxY + dy > gridH - 1) dy -= maxY + dy - (gridH - 1);
  ax += dx;
  ay += dy;
  bx += dx;
  by += dy;
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  const radius = Math.hypot(bx - ax, by - ay) / 2;
  return cellsForCircle({ x: cx, y: cy }, radius, gridW, gridH);
}

export function translateCells(cells, dx, dy, gridW, gridH) {
  return (cells || [])
    .map((c) => ({ x: c.x + dx, y: c.y + dy }))
    .filter((c) => c.x >= 0 && c.y >= 0 && c.x < gridW && c.y < gridH);
}

export function tokenFootprint(token) {
  const w = Math.max(1, Number(token.width) || 1);
  const h = Math.max(1, Number(token.height) || 1);
  const x0 = Number(token.x) || 0;
  const y0 = Number(token.y) || 0;
  return { x: x0, y: y0, width: w, height: h, cx: x0 + (w - 1) / 2, cy: y0 + (h - 1) / 2 };
}

export function tokenOccupiesCell(token, x, y) {
  const f = tokenFootprint(token);
  return x >= f.x && x < f.x + f.width && y >= f.y && y < f.y + f.height;
}

export function cellsInArea(area, token) {
  const cells = area?.cells || [];
  const f = tokenFootprint(token);
  for (let x = f.x; x < f.x + f.width; x++) {
    for (let y = f.y; y < f.y + f.height; y++) {
      if (cells.some((c) => c.x === x && c.y === y)) return true;
    }
  }
  return false;
}

/** LOS simples: Bresenham; walls = Set "x,y" */
export function hasLineOfSight(x0, y0, x1, y1, wallSet) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xEnd = Math.round(x1);
  const yEnd = Math.round(y1);
  const dx = Math.abs(xEnd - x);
  const dy = Math.abs(yEnd - y);
  const sx = x < xEnd ? 1 : -1;
  const sy = y < yEnd ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (!(x === Math.round(x0) && y === Math.round(y0)) && !(x === xEnd && y === yEnd)) {
      if (wallSet.has(`${x},${y}`)) return false;
    }
    if (x === xEnd && y === yEnd) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return true;
}

export function computeVisibleCells({
  viewerToken,
  gridW,
  gridH,
  wallCells,
  fogCells,
  isGM,
}) {
  if (isGM) {
    const all = [];
    for (let x = 0; x < gridW; x++) for (let y = 0; y < gridH; y++) all.push(`${x},${y}`);
    return new Set(all);
  }
  const wallSet = new Set((wallCells || []).map((c) => `${c.x},${c.y}`));
  const fogSet = new Set((fogCells || []).map((c) => `${c.x},${c.y}`));
  const f = tokenFootprint(viewerToken || { x: 0, y: 0, width: 1, height: 1 });
  const visible = new Set();
  for (let x = 0; x < gridW; x++) {
    for (let y = 0; y < gridH; y++) {
      const key = `${x},${y}`;
      if (fogSet.has(key)) continue;
      if (hasLineOfSight(f.cx, f.cy, x, y, wallSet)) visible.add(key);
    }
  }
  return visible;
}
