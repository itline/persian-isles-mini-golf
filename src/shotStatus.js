// Stable references: the game markup is mounted once for the page lifetime.
// Compare each output independently: pause can change disabled without changing text.
export function createShotStatusView({ status, controls, putt }) {
  return (text, disabled) => {
    const phase = text === 'Holed!' ? 'holed' : text === 'Rolling' ? 'rolling' : 'ready';
    if (controls.dataset.phase !== phase) controls.dataset.phase = phase;
    if (status.textContent !== text) status.textContent = text;
    if (putt.disabled !== disabled) putt.disabled = disabled;
  };
}
