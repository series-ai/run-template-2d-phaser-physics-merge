import Phaser from 'phaser';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { FRUITS, MAX_DROP_TIER, LAYOUT } from './config';

const CIRCLE_TEXTURE_KEY = 'fruit-circle';

export interface FruitBody extends MatterJS.BodyType {
  gameObject: Phaser.GameObjects.Container;
  fruitTier: number;
  fruitId: number;
}

interface ActiveFruit {
  body: MatterJS.BodyType;
  container: Phaser.GameObjects.Container;
}

export class FruitManager {
  private scene: Phaser.Scene;
  private idCounter = 0;
  private merging = new Set<number>();
  private activeFruits: ActiveFruit[] = [];
  private textureLoaded = false;
  private firstMergeFired = false;
  private tier5Fired = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  async loadAssets(): Promise<void> {
    const blob = await RundotGameAPI.cdn.fetchAsset('circle.png');
    const blobUrl = URL.createObjectURL(blob);
    RundotGameAPI.log(`[FruitManager] Fetched circle.png from CDN, blob size: ${blob.size}`);

    return new Promise((resolve) => {
      this.scene.load.image(CIRCLE_TEXTURE_KEY, blobUrl);
      this.scene.load.once('complete', () => {
        URL.revokeObjectURL(blobUrl);
        this.textureLoaded = true;
        resolve();
      });
      this.scene.load.start();
    });
  }

  reset(): void {
    this.idCounter = 0;
    this.merging.clear();
    this.activeFruits = [];
    this.firstMergeFired = false;
    this.tier5Fired = false;
  }

  getRandomDropTier(): number {
    return Phaser.Math.Between(0, MAX_DROP_TIER);
  }

  createFruitVisual(radius: number, color: number, emoji: string): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);

    if (this.textureLoaded) {
      const sprite = this.scene.add.image(0, 0, CIRCLE_TEXTURE_KEY);
      const diameter = radius * 2;
      sprite.setDisplaySize(diameter, diameter);
      sprite.setTint(color);
      container.add(sprite);
    } else {
      const circle = this.scene.add.graphics();
      circle.fillStyle(color, 1);
      circle.fillCircle(0, 0, radius);
      container.add(circle);
    }

    const emojiSize = Math.max(16, Math.floor(radius * 0.8));
    const label = this.scene.add.text(0, 0, emoji, {
      fontSize: `${emojiSize}px`,
    }).setOrigin(0.5);
    container.add(label);

    return container;
  }

  spawnFruit(x: number, y: number, tier: number, isNew: boolean): void {
    const fruit = FRUITS[tier];
    const container = this.createFruitVisual(fruit.radius, fruit.color, fruit.emoji);
    container.setPosition(x, y);

    const body = this.scene.matter.add.circle(x, y, fruit.radius, {
      restitution: 0.2,
      friction: 0.5,
      density: 0.001 + tier * 0.0005,
      frictionAir: 0.01,
    });

    (body as FruitBody).fruitTier = tier;
    (body as FruitBody).fruitId = this.idCounter++;
    (body as FruitBody).gameObject = container;

    this.activeFruits.push({ body, container });

    if (!isNew) {
      container.setScale(0.1);
      this.scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        ease: 'Back.easeOut',
      });
    }
  }

  syncVisuals(): void {
    for (let i = this.activeFruits.length - 1; i >= 0; i--) {
      const { body, container } = this.activeFruits[i];
      if (!container.active) {
        this.activeFruits.splice(i, 1);
        continue;
      }
      container.setPosition(body.position.x, body.position.y);
      container.setRotation(body.angle);
    }
  }

  setupCollisions(onScore: (points: number) => void): void {
    this.scene.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const pair of event.pairs) {
        const fruitA = (pair.bodyA.parent || pair.bodyA) as FruitBody;
        const fruitB = (pair.bodyB.parent || pair.bodyB) as FruitBody;

        if (fruitA.fruitTier === undefined || fruitB.fruitTier === undefined) continue;
        if (fruitA === fruitB) continue;
        if (fruitA.fruitTier !== fruitB.fruitTier) continue;
        if (fruitA.fruitTier >= FRUITS.length - 1) continue;

        if (this.merging.has(fruitA.fruitId) || this.merging.has(fruitB.fruitId)) continue;
        this.merging.add(fruitA.fruitId);
        this.merging.add(fruitB.fruitId);

        const newTier = fruitA.fruitTier + 1;
        const midX = (fruitA.position.x + fruitB.position.x) / 2;
        const midY = (fruitA.position.y + fruitB.position.y) / 2;
        const idA = fruitA.fruitId;
        const idB = fruitB.fruitId;
        const goA = fruitA.gameObject;
        const goB = fruitB.gameObject;

        this.scene.time.delayedCall(0, () => {
          this.scene.matter.world.remove(fruitA);
          this.scene.matter.world.remove(fruitB);
          goA?.destroy();
          goB?.destroy();

          this.spawnFruit(midX, midY, newTier, false);
          const points = FRUITS[newTier].points;
          onScore(points);

          if (!this.firstMergeFired) {
            this.firstMergeFired = true;
            RundotGameAPI.analytics.recordCustomEvent('first_merge');
            RundotGameAPI.analytics.trackFunnelStep(2, 'first_merge', 'session', 1);
          }
          RundotGameAPI.analytics.recordCustomEvent('fruit_merged', { result_tier: newTier, points });
          if (!this.tier5Fired && newTier >= 5) {
            this.tier5Fired = true;
            RundotGameAPI.analytics.recordCustomEvent('tier_5_reached');
            RundotGameAPI.analytics.trackFunnelStep(3, 'tier_5_reached', 'session', 1);
          }

          this.merging.delete(idA);
          this.merging.delete(idB);
        });
      }
    });
  }

  checkGameOver(): boolean {
    const bodies = this.scene.matter.world.getAllBodies();
    for (const body of bodies) {
      const fb = (body.parent || body) as FruitBody;
      if (fb.fruitTier === undefined) continue;
      if (fb.isStatic) continue;

      const speed = Math.sqrt(fb.velocity.x * fb.velocity.x + fb.velocity.y * fb.velocity.y);
      if (speed > 1) continue;

      if (fb.position.y - FRUITS[fb.fruitTier].radius < LAYOUT.GAME_OVER_Y) {
        return true;
      }
    }
    return false;
  }
}
