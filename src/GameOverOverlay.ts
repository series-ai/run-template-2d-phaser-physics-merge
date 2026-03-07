import Phaser from 'phaser';

export class GameOverOverlay {
  static show(scene: Phaser.Scene, score: number): void {
    const overlay = scene.add.rectangle(360, 780, 720, 1560, 0x000000, 0.5);
    overlay.setDepth(100);

    scene.add.text(360, 600, 'Game Over!', {
      fontSize: '72px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(101);

    scene.add.text(360, 700, `Score: ${score}`, {
      fontSize: '48px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(101);

    const restartButton = scene.add.text(360, 850, 'Tap to Restart', {
      fontSize: '40px',
      color: '#FFFFFF',
      backgroundColor: '#E74C3C',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

    restartButton.on('pointerdown', () => {
      scene.scene.restart();
    });
  }
}
