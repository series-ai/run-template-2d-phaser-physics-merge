import Phaser from 'phaser';
import { FRUITS, LAYOUT } from '../config';
import { FruitManager } from '../FruitManager';
import { GameOverOverlay } from '../GameOverOverlay';

export default class GameScene extends Phaser.Scene {
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private dropLine!: Phaser.GameObjects.Line;
  private currentFruitTier = 0;
  private nextFruitTier = 0;
  private currentDropX = (LAYOUT.WALL_LEFT + LAYOUT.WALL_RIGHT) / 2;
  private previewFruit!: Phaser.GameObjects.Container;
  private nextPreviewContainer!: Phaser.GameObjects.Container;
  private canDrop = true;
  private isGameOver = false;
  private dropGraceTimer = 0;
  private fruits!: FruitManager;

  constructor() {
    super("game");
  }

  create(): void {
    this.score = 0;
    this.isGameOver = false;
    this.canDrop = true;
    this.dropGraceTimer = 0;

    this.fruits = new FruitManager(this);
    this.fruits.reset();

    this.createContainer();
    this.createUI();
    this.setupInput();
    this.fruits.setupCollisions((points) => {
      this.score += points;
      this.scoreText.setText(`Score: ${this.score}`);
    });

    this.canDrop = false;
    this.fruits.loadAssets().then(() => {
      this.currentFruitTier = this.fruits.getRandomDropTier();
      this.nextFruitTier = this.fruits.getRandomDropTier();
      this.spawnPreview();
      this.updateNextPreview();
      this.canDrop = true;
    });
  }

  private createContainer(): void {
    const { WALL_LEFT, WALL_RIGHT, FLOOR_Y, GAME_OVER_Y, WALL_THICKNESS } = LAYOUT;
    const wallOptions: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      friction: 0.1,
      restitution: 0.2,
    };

    // Physics walls
    this.matter.add.rectangle(WALL_LEFT - WALL_THICKNESS / 2, 800, WALL_THICKNESS, 1400, wallOptions);
    this.matter.add.rectangle(WALL_RIGHT + WALL_THICKNESS / 2, 800, WALL_THICKNESS, 1400, wallOptions);
    this.matter.add.rectangle((WALL_LEFT + WALL_RIGHT) / 2, FLOOR_Y + WALL_THICKNESS / 2, WALL_RIGHT - WALL_LEFT + WALL_THICKNESS, WALL_THICKNESS, wallOptions);

    // Visual walls
    const gfx = this.add.graphics();
    gfx.fillStyle(0x8B4513, 1);
    gfx.fillRect(WALL_LEFT - WALL_THICKNESS, 100, WALL_THICKNESS, 1400);
    gfx.fillRect(WALL_RIGHT, 100, WALL_THICKNESS, 1400);
    gfx.fillRect(WALL_LEFT - WALL_THICKNESS, FLOOR_Y, WALL_RIGHT - WALL_LEFT + WALL_THICKNESS * 2, WALL_THICKNESS);

    // Game over line
    const line = this.add.line(0, 0, WALL_LEFT, GAME_OVER_Y, WALL_RIGHT, GAME_OVER_Y, 0xFF0000, 0.5);
    line.setOrigin(0, 0);
    line.setLineWidth(1);
  }

  private createUI(): void {
    const containerMidX = (LAYOUT.WALL_LEFT + LAYOUT.WALL_RIGHT) / 2;
    const sidebarX = (LAYOUT.WALL_RIGHT + LAYOUT.GAME_WIDTH) / 2;

    this.scoreText = this.add.text(containerMidX, 40, 'Score: 0', {
      fontSize: '48px',
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.dropLine = this.add.line(0, 0, containerMidX, LAYOUT.DROP_Y, containerMidX, LAYOUT.FLOOR_Y, 0xAAAAAA, 0.3);
    this.dropLine.setOrigin(0, 0);
    this.dropLine.setLineWidth(1);

    this.add.text(sidebarX, 150, 'Next', {
      fontSize: '28px',
      color: '#666666',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.nextPreviewContainer = this.add.container(sidebarX, 250);
  }

  private setupInput(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver) return;
      const x = Phaser.Math.Clamp(pointer.x, LAYOUT.WALL_LEFT + 30, LAYOUT.WALL_RIGHT - 30);
      this.currentDropX = x;
      if (this.previewFruit) {
        this.previewFruit.setX(x);
      }
      this.dropLine.setTo(x, LAYOUT.DROP_Y, x, LAYOUT.FLOOR_Y);
    });

    this.input.on('pointerup', () => {
      if (this.isGameOver || !this.canDrop) return;
      this.dropFruit();
    });
  }

  private spawnPreview(): void {
    const fruit = FRUITS[this.currentFruitTier];
    this.previewFruit = this.fruits.createFruitVisual(fruit.radius, fruit.color, fruit.emoji);
    this.previewFruit.setPosition(this.currentDropX, LAYOUT.DROP_Y);
    this.previewFruit.setAlpha(0.6);
  }

  private updateNextPreview(): void {
    this.nextPreviewContainer.removeAll(true);
    const fruit = FRUITS[this.nextFruitTier];
    const visual = this.fruits.createFruitVisual(fruit.radius * 0.6, fruit.color, fruit.emoji);
    this.nextPreviewContainer.add(visual);
  }

  private dropFruit(): void {
    this.canDrop = false;

    if (this.previewFruit) {
      this.previewFruit.destroy();
    }

    this.fruits.spawnFruit(this.currentDropX, LAYOUT.DROP_Y, this.currentFruitTier, true);
    this.dropGraceTimer = 1000;

    this.currentFruitTier = this.nextFruitTier;
    this.nextFruitTier = this.fruits.getRandomDropTier();

    this.time.delayedCall(500, () => {
      if (this.isGameOver) return;
      this.canDrop = true;
      this.spawnPreview();
      this.updateNextPreview();
    });
  }

  update(): void {
    this.fruits.syncVisuals();

    if (this.isGameOver) return;
    if (this.dropGraceTimer > 0) {
      this.dropGraceTimer -= this.game.loop.delta;
      return;
    }

    if (this.fruits.checkGameOver()) {
      this.isGameOver = true;
      this.canDrop = false;
      if (this.previewFruit) {
        this.previewFruit.destroy();
      }
      GameOverOverlay.show(this, this.score);
    }
  }
}
