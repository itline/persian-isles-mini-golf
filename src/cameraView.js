// Fit a phone's playable outline, not the surrounding decorative island.
export function touchCourseView({ width, height, coarsePointer, outline, angle }) {
  if (!coarsePointer || Math.min(width, height) > 600) return null;
  const portrait = width < height;
  const elevation = .87 / Math.hypot(1, .87);
  const horizontal = outline.map(([x, z]) => x * Math.cos(angle) - z * Math.sin(angle));
  const depth = outline.map(([x, z]) => x * Math.sin(angle) + z * Math.cos(angle));
  const u = (Math.min(...horizontal) + Math.max(...horizontal)) / 2;
  const v = (Math.min(...depth) + Math.max(...depth)) / 2;
  const x = u * Math.cos(angle) + v * Math.sin(angle);
  const z = -u * Math.sin(angle) + v * Math.cos(angle);
  const halfWidth = (Math.max(...horizontal) - Math.min(...horizontal)) / 2;
  const halfHeight = (Math.max(...depth) - Math.min(...depth)) * elevation / 2;
  const top = portrait ? 110 : 90, bottom = portrait ? 130 : 85;
  const scale = Math.max(
    halfWidth * height / Math.max(1, width - 48),
    halfHeight * height / Math.max(1, height - top - bottom),
  ) * 1.06;
  return { x, z, scale, playScale: height / 80, shift: scale * (top - bottom) / height };
}

// World-space camera motion is independent from projection updates.
export function updateCameraFraming(camera, { width, height, playing, zoom, touchView = null, overview = true }) {
  const portrait = width < height;
  const scale =
    (playing ? (touchView ? (overview ? touchView.scale : touchView.playScale) : (portrait ? 27 : 12)) : portrait ? Math.max(35, (16 * height) / width) : 14.4) / zoom;
  const shift = playing
    ? touchView
      ? overview ? touchView.shift : 0
      : height < 560 && width > height
        ? -2.5
        : 0
    : portrait
      ? -scale * 0.49
      : -2;
  const left = (-scale * width) / height, right = (scale * width) / height;
  const top = scale + shift, bottom = -scale + shift;
  if (camera.left === left && camera.right === right && camera.top === top && camera.bottom === bottom) return;
  camera.left = left;
  camera.right = right;
  camera.top = top;
  camera.bottom = bottom;
  camera.updateProjectionMatrix();
}
