// Stable references: the game markup is mounted once for the page lifetime.
export function createShotStatusView({ status }) {
  return (text) => {
    const phase = text === 'Holed!' ? 'holed' : text === 'Rolling' ? 'rolling' : 'ready';
    if (status.dataset.phase !== phase) status.dataset.phase = phase;
    if (status.textContent !== text) status.textContent = text;
  };
}
