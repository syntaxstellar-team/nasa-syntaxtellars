import type { World } from '../game/World';

let current: World | null = null;
export function setWorld(w: World | null): void {
  current = w;
  (window as unknown as { __world?: World | null }).__world = w; // handy for debugging in the console
}
export function getWorld(): World | null { return current; }
