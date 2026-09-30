import type { MVScene, SceneContext } from '../engine/types';

export abstract class SceneBase implements MVScene {
  abstract readonly id: string;
  abstract init(): Promise<void> | void;
  abstract render(ctx: SceneContext): void;
  abstract resize(width: number, height: number): void;
  abstract dispose(): void;
}
