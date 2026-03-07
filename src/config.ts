export interface FruitDef {
  name: string;
  radius: number;
  color: number;
  emoji: string;
  points: number;
}

export const FRUITS: FruitDef[] = [
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

export const MAX_DROP_TIER = 4;

export const LAYOUT = {
  WALL_LEFT: 60,
  WALL_RIGHT: 520,
  FLOOR_Y: 1480,
  GAME_OVER_Y: 200,
  DROP_Y: 120,
  GAME_WIDTH: 720,
  GAME_HEIGHT: 1560,
  WALL_THICKNESS: 20,
} as const;
