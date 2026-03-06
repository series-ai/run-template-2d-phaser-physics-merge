import Phaser from 'phaser';
import GameScene from './scenes/GameScene';
import './style.css';
import RundotGameAPI from "@series-inc/rundot-game-sdk/api";

async function bootstrap(): Promise<void> {
  try {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 720,
      height: 1560,
      parent: "app",
      backgroundColor: "#FFF8DC",
      scene: GameScene,
      physics: {
        default: "matter",
        matter: {
          gravity: { x: 0, y: 2 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    new Phaser.Game(config);
    RundotGameAPI.log("[Main] Suika game created");
  } catch (error) {
    console.error("[Main] Bootstrap error:", error);
  }
}

bootstrap();
