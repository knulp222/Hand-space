
export interface PhysicsObject {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isGrabbed: boolean;
  grabbedByHandIndex: number | null; // 0 for Left, 1 for Right
  wobblePhase: number; // For blob effect
  createdAt: number; // Timestamp to prevent immediate fusion/eating
}

export interface GameSettings {
  gravity: number;
  friction: number;
  bounce: number;
  pinchThreshold: number;
  throwForce: number;
  handColor: string;
  showSkeleton: boolean;
  debug: boolean;
  enableCollisions: boolean;
  fusionChance: number; // 0 to 1
  blobFactor: number; // How much they wobble
}

export interface HandPoint {
  x: number;
  y: number;
}