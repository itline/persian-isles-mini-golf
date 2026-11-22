import { describe, expect, it, vi } from 'vitest';
import { createShotStatusView } from './shotStatus.js';

function trackedStatus(text = 'Loading', phase) {
  let currentText = text;
  let currentPhase = phase;
  const textWrites = vi.fn((value) => { currentText = value; });
  const phaseWrites = vi.fn((value) => { currentPhase = value; });
  const status = {
    get textContent() { return currentText; },
    set textContent(value) { textWrites(value); },
    dataset: {
      get phase() { return currentPhase; },
      set phase(value) { phaseWrites(value); },
    },
  };
  return { status, textWrites, phaseWrites };
}

describe('screen-reader shot status', () => {
  it('renders ready, rolling and holed phases on the status element alone', () => {
    const { status } = trackedStatus();
    const render = createShotStatusView({ status });
    for (const [text, phase] of [
      ['Ready to putt', 'ready'],
      ['Rolling', 'rolling'],
      ['Holed!', 'holed'],
      ['Returned to your last shot · +1', 'ready'],
    ]) {
      render(text);
      expect(status.textContent).toBe(text);
      expect(status.dataset.phase).toBe(phase);
    }
  });

  it('does not rewrite unchanged text or phase across animation frames', () => {
    const { status, textWrites, phaseWrites } = trackedStatus();
    const render = createShotStatusView({ status });
    for (const text of ['Ready to putt', 'Rolling', 'Holed!']) {
      render(text);
      textWrites.mockClear();
      phaseWrites.mockClear();
      for (let frame = 0; frame < 60; frame++) render(text);
      expect(textWrites).not.toHaveBeenCalled();
      expect(phaseWrites).not.toHaveBeenCalled();
    }
  });

  it('updates ready text without redundantly writing the unchanged phase', () => {
    const { status, textWrites, phaseWrites } = trackedStatus('Ready to putt', 'ready');
    const render = createShotStatusView({ status });
    render('Returned to your last shot · +1');
    expect(textWrites).toHaveBeenCalledExactlyOnceWith('Returned to your last shot · +1');
    expect(phaseWrites).not.toHaveBeenCalled();
  });

  it('repairs an out-of-date phase without rewriting unchanged text', () => {
    const { status, textWrites, phaseWrites } = trackedStatus('Holed!', 'rolling');
    createShotStatusView({ status })('Holed!');
    expect(phaseWrites).toHaveBeenCalledExactlyOnceWith('holed');
    expect(textWrites).not.toHaveBeenCalled();
  });
});
