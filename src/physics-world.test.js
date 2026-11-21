import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsWorld } from './vendor/physics/PhysicsWorld';

const resources = [];
afterEach(() => {
  for (const physics of resources.splice(0)) physics.dispose();
});

async function simulation() {
  const physics = new PhysicsWorld();
  await physics.init();
  resources.push(physics);
  physics.world.createCollider(physics.rapier.ColliderDesc.cuboid(10, 0.1, 10));
  return physics;
}

function drop(physics) {
  const { rapier, world } = physics;
  const body = world.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, 1, 0));
  world.createCollider(
    rapier.ColliderDesc.ball(0.145).setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS),
    body,
  );
  return body;
}

function retainedEvents(physics) {
  let count = 0;
  physics.drainCollisionEvents(() => count++);
  return count;
}

describe('fixed-step collision queue lifetime', () => {
  it('does not retain old collisions across repeated ball resets', async () => {
    const physics = await simulation();
    let largestQueue = 0;
    for (let cycle = 0; cycle < 12; cycle++) {
      const body = drop(physics);
      for (let step = 0; step < 120; step++) physics.step(1 / 120);
      physics.world.removeRigidBody(body);
      // With an auto-drained queue only the latest substep can remain.
      let count = 0;
      physics.eventQueue.drainCollisionEvents(() => count++);
      largestQueue = Math.max(largestQueue, count);
    }
    expect(largestQueue).toBe(0);
    expect(retainedEvents(physics)).toBe(0);
    expect(physics.getFixedDelta()).toBe(1 / 120);
  });

  it('keeps the current step collision event available to explicit consumers', async () => {
    const physics = await simulation();
    drop(physics);
    let collisions = 0;
    for (let step = 0; step < 120; step++) {
      physics.step(1 / 120);
      collisions += retainedEvents(physics);
    }
    expect(collisions).toBeGreaterThan(0);
  });
});
