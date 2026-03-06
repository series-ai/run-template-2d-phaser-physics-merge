import Phaser from 'phaser';

// Fruit definitions: name, radius, color, emoji, points
const FRUITS = [
  { name: 'cherry',     radius: 25,  color: 0xE74C3C, emoji: '🍒', points: 1 },
  { name: 'strawberry', radius: 35,  color: 0xFF6B81, emoji: '🍓', points: 3 },
  { name: 'grape',      radius: 45,  color: 0x8E44AD, emoji: '🍇', points: 6 },
  { name: 'dekopon',    radius: 55,  color: 0xF39C12, emoji: '🍊', points: 10 },
  { name: 'apple',      radius: 65,  color: 0xE74C3C, emoji: '🍎', points: 15 },
  { name: 'pear',       radius: 75,  color: 0x27AE60, emoji: '🍐', points: 21 },
  { name: 'peach',      radius: 85,  color: 0xFFB6C1, emoji: '🍑', points: 28 },
  { name: 'pineapple',  radius: 95,  color: 0xF1C40F, emoji: '🍍', points: 36 },
  { name: 'melon',      radius: 110, color: 0x2ECC71, emoji: '🍈', points: 45 },
  { name: 'watermelon', radius: 130, color: 0x27AE60, emoji: '🍉', points: 55 },
];

// Max fruit tier that can be randomly dropped (0-indexed, first 5 types)
const MAX_DROP_TIER = 4;

interface FruitBody extends MatterJS.BodyType {
  gameObject: Phaser.GameObjects.Container;
  fruitTier: number;
  fruitId: number;
}

export default class GameScene extends Phaser.Scene {
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private dropLine!: Phaser.GameObjects.Line;
  private gameOverLine!: Phaser.GameObjects.Line;
  private nextFruitTier = 0;
  private currentDropX = 360;
  private previewFruit!: Phaser.GameObjects.Container;
  private nextPreviewContainer!: Phaser.GameObjects.Container;
  private canDrop = true;
  private isGameOver = false;
  private fruitIdCounter = 0;
  private merging = new Set<number>();
  private activeFruits: { body: MatterJS.BodyType; container: Phaser.GameObjects.Container }[] = [];
  // Container boundaries
  private readonly WALL_LEFT = 60;
  private readonly WALL_RIGHT = 660;
  private readonly FLOOR_Y = 1480;
  private readonly GAME_OVER_Y = 200;
  private readonly DROP_Y = 120;

  constructor() {
    super("game");
  }

  create(): void {
    this.score = 0;
    this.isGameOver = false;
    this.canDrop = true;
    this.fruitIdCounter = 0;
    this.merging.clear();
    this.activeFruits = [];

    this.createContainer();
    this.createUI();
    this.setupInput();
    this.setupCollisions();

    this.nextFruitTier = this.getRandomDropTier();
    this.spawnPreview();
    this.updateNextPreview();
  }

  private createContainer(): void {
    const wallThickness = 20;
    const wallOptions: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      friction: 0.1,
      restitution: 0.2,
    };

    // Left wall
    this.matter.add.rectangle(
      this.WALL_LEFT - wallThickness / 2, 800,
      wallThickness, 1400,
      wallOptions
    );
    // Right wall
    this.matter.add.rectangle(
      this.WALL_RIGHT + wallThickness / 2, 800,
      wallThickness, 1400,
      wallOptions
    );
    // Floor
    this.matter.add.rectangle(
      360, this.FLOOR_Y + wallThickness / 2,
      this.WALL_RIGHT - this.WALL_LEFT + wallThickness, wallThickness,
      wallOptions
    );

    // Visual walls
    const gfx = this.add.graphics();
    gfx.fillStyle(0x8B4513, 1);
    // Left
    gfx.fillRect(this.WALL_LEFT - wallThickness, 100, wallThickness, 1400);
    // Right
    gfx.fillRect(this.WALL_RIGHT, 100, wallThickness, 1400);
    // Floor
    gfx.fillRect(this.WALL_LEFT - wallThickness, this.FLOOR_Y, this.WALL_RIGHT - this.WALL_LEFT + wallThickness * 2, wallThickness);

    // Game over line (dashed)
    this.gameOverLine = this.add.line(0, 0, this.WALL_LEFT, this.GAME_OVER_Y, this.WALL_RIGHT, this.GAME_OVER_Y, 0xFF0000, 0.5);
    this.gameOverLine.setOrigin(0, 0);
    this.gameOverLine.setLineWidth(1);
  }

  private createUI(): void {
    // Score
    this.scoreText = this.add.text(360, 40, 'Score: 0', {
      fontSize: '48px',
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Drop guide line
    this.dropLine = this.add.line(0, 0, 360, this.DROP_Y, 360, this.FLOOR_Y, 0xAAAAAA, 0.3);
    this.dropLine.setOrigin(0, 0);
    this.dropLine.setLineWidth(1);

    // "Next" label
    this.add.text(this.WALL_RIGHT + 40, 150, 'Next', {
      fontSize: '28px',
      color: '#666666',
      fontStyle: 'bold',
    });

    // Next fruit preview container
    this.nextPreviewContainer = this.add.container(this.WALL_RIGHT + 70, 230);
  }

  private setupInput(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver) return;
      const x = Phaser.Math.Clamp(pointer.x, this.WALL_LEFT + 30, this.WALL_RIGHT - 30);
      this.currentDropX = x;
      if (this.previewFruit) {
        this.previewFruit.setX(x);
      }
      this.dropLine.setTo(x, this.DROP_Y, x, this.FLOOR_Y);
    });

    this.input.on('pointerup', () => {
      if (this.isGameOver || !this.canDrop) return;
      this.dropFruit();
    });
  }

  private setupCollisions(): void {
    this.matter.world.on('collisionstart', (_event: Phaser.Physics.Matter.Events.CollisionStartEvent, bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType) => {
      const fruitA = bodyA as FruitBody;
      const fruitB = bodyB as FruitBody;

      if (fruitA.fruitTier === undefined || fruitB.fruitTier === undefined) return;
      if (fruitA.fruitTier !== fruitB.fruitTier) return;
      if (fruitA.fruitTier >= FRUITS.length - 1) return; // watermelon can't merge further

      // Prevent double-merging
      if (this.merging.has(fruitA.fruitId) || this.merging.has(fruitB.fruitId)) return;
      this.merging.add(fruitA.fruitId);
      this.merging.add(fruitB.fruitId);

      const newTier = fruitA.fruitTier + 1;
      const midX = (fruitA.position.x + fruitB.position.x) / 2;
      const midY = (fruitA.position.y + fruitB.position.y) / 2;

      // Remove old fruits
      const goA = fruitA.gameObject;
      const goB = fruitB.gameObject;
      this.matter.world.remove(fruitA);
      this.matter.world.remove(fruitB);
      goA?.destroy();
      goB?.destroy();

      // Spawn merged fruit
      this.spawnFruit(midX, midY, newTier, false);

      // Update score
      this.score += FRUITS[newTier].points;
      this.scoreText.setText(`Score: ${this.score}`);

      // Flash effect
      this.cameras.main.flash(100, 255, 255, 200, false);

      this.merging.delete(fruitA.fruitId);
      this.merging.delete(fruitB.fruitId);
    });
  }

  private getRandomDropTier(): number {
    return Phaser.Math.Between(0, MAX_DROP_TIER);
  }

  private spawnPreview(): void {
    const tier = this.nextFruitTier;
    const fruit = FRUITS[tier];
    this.previewFruit = this.createFruitVisual(fruit.radius, fruit.color, fruit.emoji);
    this.previewFruit.setPosition(this.currentDropX, this.DROP_Y);
    this.previewFruit.setAlpha(0.6);
  }

  private updateNextPreview(): void {
    this.nextPreviewContainer.removeAll(true);
    this.nextFruitTier = this.getRandomDropTier();
    const fruit = FRUITS[this.nextFruitTier];
    const visual = this.createFruitVisual(fruit.radius * 0.6, fruit.color, fruit.emoji);
    this.nextPreviewContainer.add(visual);
  }

  private createFruitVisual(radius: number, color: number, emoji: string): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    const circle = this.add.graphics();
    circle.fillStyle(color, 1);
    circle.fillCircle(0, 0, radius);
    // Highlight
    circle.fillStyle(0xFFFFFF, 0.3);
    circle.fillCircle(-radius * 0.25, -radius * 0.25, radius * 0.35);
    container.add(circle);

    const emojiSize = Math.max(16, Math.floor(radius * 0.8));
    const label = this.add.text(0, 0, emoji, {
      fontSize: `${emojiSize}px`,
    }).setOrigin(0.5);
    container.add(label);

    return container;
  }

  private dropFruit(): void {
    this.canDrop = false;

    const tier = this.nextFruitTier;

    // Remove preview
    if (this.previewFruit) {
      this.previewFruit.destroy();
    }

    // Drop the fruit
    this.spawnFruit(this.currentDropX, this.DROP_Y, tier, true);

    // Cooldown before next drop
    this.time.delayedCall(500, () => {
      if (this.isGameOver) return;
      this.canDrop = true;
      this.spawnPreview();
      this.updateNextPreview();
    });
  }

  private spawnFruit(x: number, y: number, tier: number, isNew: boolean): void {
    const fruit = FRUITS[tier];
    const container = this.createFruitVisual(fruit.radius, fruit.color, fruit.emoji);
    container.setPosition(x, y);

    const body = this.matter.add.circle(x, y, fruit.radius, {
      restitution: 0.2,
      friction: 0.5,
      density: 0.001 + tier * 0.0005,
      frictionAir: 0.01,
    });

    (body as FruitBody).fruitTier = tier;
    (body as FruitBody).fruitId = this.fruitIdCounter++;
    (body as FruitBody).gameObject = container;

    this.activeFruits.push({ body, container });

    // Pop-in animation for merged fruits
    if (!isNew) {
      container.setScale(0.1);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        ease: 'Back.easeOut',
      });
    }
  }

  update(): void {
    // Sync visuals to physics bodies
    for (let i = this.activeFruits.length - 1; i >= 0; i--) {
      const { body, container } = this.activeFruits[i];
      if (!container.active) {
        this.activeFruits.splice(i, 1);
        continue;
      }
      container.setPosition(body.position.x, body.position.y);
      container.setRotation(body.angle);
    }

    if (this.isGameOver) return;
    this.checkGameOver();
  }

  private checkGameOver(): void {
    const bodies = this.matter.world.getAllBodies();
    for (const body of bodies) {
      const fb = body as FruitBody;
      if (fb.fruitTier === undefined) continue;
      if (fb.isStatic) continue;

      // Only check settled fruits (low velocity)
      const speed = Math.sqrt(fb.velocity.x * fb.velocity.x + fb.velocity.y * fb.velocity.y);
      if (speed > 1) continue;

      if (fb.position.y - FRUITS[fb.fruitTier].radius < this.GAME_OVER_Y) {
        this.triggerGameOver();
        return;
      }
    }
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.canDrop = false;

    if (this.previewFruit) {
      this.previewFruit.destroy();
    }

    // Dim the scene
    const overlay = this.add.rectangle(360, 780, 720, 1560, 0x000000, 0.5);
    overlay.setDepth(100);

    this.add.text(360, 600, 'Game Over!', {
      fontSize: '72px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(101);

    this.add.text(360, 700, `Score: ${this.score}`, {
      fontSize: '48px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(101);

    const restartButton = this.add.text(360, 850, 'Tap to Restart', {
      fontSize: '40px',
      color: '#FFFFFF',
      backgroundColor: '#E74C3C',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

    restartButton.on('pointerdown', () => {
      this.scene.restart();
    });
  }
}
