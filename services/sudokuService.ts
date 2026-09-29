
import { Difficulty, Cell, Grid } from '../types';

export class SudokuService {
  private static isValid(grid: number[][], row: number, col: number, num: number): boolean {
    for (let x = 0; x < 9; x++) {
      if (grid[row][x] === num || grid[x][col] === num) return false;
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (grid[i + startRow][j + startCol] === num) return false;
      }
    }
    return true;
  }

  private static solveSudoku(grid: number[][]): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (this.isValid(grid, row, col, num)) {
              grid[row][col] = num;
              if (this.solveSudoku(grid)) return true;
              grid[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  private static shuffle<T>(array: T[]): T[] {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  }

  public static generateBoard(difficulty: Difficulty): { grid: Grid; solution: number[][] } {
    // 1. Create empty board
    const solution: number[][] = Array(9).fill(0).map(() => Array(9).fill(0));
    
    // 2. Fill diagonal 3x3 blocks first (independent)
    for (let i = 0; i < 9; i += 3) {
      const nums = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      let k = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          solution[i + r][i + c] = nums[k++];
        }
      }
    }

    // 3. Solve the rest
    this.solveSudoku(solution);

    // 4. Copy solution to actual grid and remove numbers based on difficulty
    const grid: Grid = solution.map((row) =>
      row.map((val) => ({
        value: val,
        fixed: true,
        notes: new Set<number>(),
      }))
    );

    const counts: Record<Difficulty, number> = {
      'Easy': 35,
      'Medium': 45,
      'Hard': 55,
      'Expert': 62,
    };

    let removed = 0;
    while (removed < counts[difficulty]) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (grid[r][c].value !== null) {
        grid[r][c].value = null;
        grid[r][c].fixed = false;
        removed++;
      }
    }

    return { grid, solution };
  }

  public static isComplete(grid: Grid, solution: number[][]): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c].value !== solution[r][c]) return false;
      }
    }
    return true;
  }
}
