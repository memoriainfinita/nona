
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface Cell {
  value: number | null;
  fixed: boolean;
  notes: Set<number>;
}

export interface SerializedCell {
  value: number | null;
  fixed: boolean;
  notes: number[];
}

export type Grid = Cell[][];
export type SerializedGrid = SerializedCell[][];

export interface GameState {
  id: string;
  grid: Grid;
  initialGrid: Grid;
  solution: number[][];
  difficulty: Difficulty;
  startTime: number;
  isPaused: boolean;
  isGameOver: boolean;
  selectedCell: [number, number] | null;
  activeNumbers: number[]; // Changed from activeNumber: number | null
  notesMode: boolean;
  eraserMode: boolean;
  mistakes: number;
  timer: number;
  history: SerializedGrid[];
  historyIndex: number;
}

export interface SudokuGameRecord {
  id: string;
  grid: SerializedGrid;
  solution: number[][];
  difficulty: Difficulty;
  timeSeconds: number;
  status: 'ongoing' | 'completed';
  date: string;
  history: SerializedGrid[];
  historyIndex: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  completed: number;
  bestTime: number | null;
}

export interface UserStats {
  totalCompleted: number;
  bestTimes: Record<Difficulty, number | null>;
  dailyLog: Record<string, DailyStats>;
  history: SudokuGameRecord[];
}
