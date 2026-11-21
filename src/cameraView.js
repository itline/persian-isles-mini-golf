// Preserve the existing projection; world-space camera motion is independent.
export function updateCameraFraming(camera, { width, height, playing, zoom }) {
  const portrait = width < height;
  const scale =
    (playing ? (portrait ? 27 : 12) : portrait ? Math.max(35, (16 * height) / width) : 14.4) / zoom;
  const shift = playing
    ? height < 560 && width > height
      ? -2.5
      : 0
    : portrait
      ? -scale * 0.49
      : -2;
  const left = (-scale * width) / height,
    right = (scale * width) / height;
  const top = scale + shift,
    bottom = -scale + shift;
  if (
    camera.left === left &&
    camera.right === right &&
    camera.top === top &&
    camera.bottom === bottom
  )
    return;
  camera.left = left;
  camera.right = right;
  camera.top = top;
  camera.bottom = bottom;
  camera.updateProjectionMatrix();
}
