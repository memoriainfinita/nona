
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SudokuBoard from './SudokuBoard';
import { Difficulty, GameState, Grid, SudokuGameRecord, Cell, SerializedGrid } from '../types';
import { SudokuService } from '../services/sudokuService';

interface SudokuGameProps {
  onGameComplete: (record: SudokuGameRecord) => void;
  onGameStateUpdate: (gameState: GameState) => void;
  resumeGame?: SudokuGameRecord | null;
}

const SudokuGame: React.FC<SudokuGameProps> = ({ onGameComplete, onGameStateUpdate, resumeGame }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('Easy');

  const deserializeGrid = (sGrid: SerializedGrid): Grid => {
    return sGrid.map(row => row.map(cell => ({
      ...cell,
      notes: new Set(cell.notes)
    })));
  };

  const serializeGrid = (grid: Grid): SerializedGrid => {
    return grid.map(row => row.map(cell => ({
      ...cell,
      notes: Array.from(cell.notes)
    })));
  };

  const numberStats = useMemo(() => {
    if (!gameState) return Array(10).fill(0);
    const counts = Array(10).fill(0);
    gameState.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.value !== null && cell.value === gameState.solution[r][c]) {
          counts[cell.value]++;
        }
      });
    });
    return counts;
  }, [gameState?.grid, gameState?.solution]);

  const startNewGame = useCallback((difficulty: Difficulty = 'Easy') => {
    const { grid, solution } = SudokuService.generateBoard(difficulty);
    const serializedInitial = serializeGrid(grid);
    const newState: GameState = {
      id: crypto.randomUUID(),
      grid,
      initialGrid: grid,
      solution,
      difficulty,
      startTime: Date.now(),
      isPaused: false,
      isGameOver: false,
      selectedCell: null,
      activeNumbers: [],
      notesMode: false,
      eraserMode: false,
      mistakes: 0,
      timer: 0,
      history: [serializedInitial],
      historyIndex: 0,
    };
    setGameState(newState);
  }, []);

  useEffect(() => {
    if (resumeGame) {
      const grid = deserializeGrid(resumeGame.grid);
      setGameState({
        id: resumeGame.id,
        grid,
        initialGrid: deserializeGrid(resumeGame.history[0]),
        solution: resumeGame.solution,
        difficulty: resumeGame.difficulty,
        startTime: Date.now(),
        isPaused: false,
        isGameOver: resumeGame.status === 'completed',
        selectedCell: null,
        activeNumbers: [],
        notesMode: false,
        eraserMode: false,
        mistakes: 0,
        timer: resumeGame.timeSeconds,
        history: resumeGame.history,
        historyIndex: resumeGame.historyIndex,
      });
    }
  }, [resumeGame]);

  useEffect(() => {
    if (gameState && !gameState.isGameOver) {
      onGameStateUpdate(gameState);
    }
  }, [gameState, onGameStateUpdate]);

  useEffect(() => {
    let interval: any;
    if (gameState && !gameState.isPaused && !gameState.isGameOver) {
      interval = setInterval(() => {
        setGameState(prev => prev ? { ...prev, timer: prev.timer + 1 } : null);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState?.isPaused, gameState?.isGameOver]);

  const addToHistory = (grid: Grid, state: GameState): Partial<GameState> => {
    const serialized = serializeGrid(grid);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(serialized);
    if (newHistory.length > 50) newHistory.shift();
    return { grid, history: newHistory, historyIndex: newHistory.length - 1 };
  };

  const clearCell = (r: number, c: number, state: GameState): GameState => {
    if (state.grid[r][c].fixed) return state;
    const newGrid = [...state.grid.map(row => [...row])];
    newGrid[r][c] = { ...newGrid[r][c], value: null, notes: new Set() };
    return { ...state, ...addToHistory(newGrid, state) };
  };

  const applyInputToCell = (r: number, c: number, num: number, state: GameState): GameState => {
    if (state.grid[r][c].fixed) return state;
    if (!state.notesMode && numberStats[num] >= 9 && state.grid[r][c].value !== num) return state;

    const newGrid = [...state.grid.map(row => [...row])];
    const targetCell = { ...newGrid[r][c] };

    if (state.notesMode) {
      const newNotes = new Set(targetCell.notes);
      if (newNotes.has(num)) newNotes.delete(num);
      else newNotes.add(num);
      targetCell.notes = newNotes;
      targetCell.value = null;
    } else {
      if (targetCell.value === num) {
        targetCell.value = null;
      } else {
        targetCell.value = num;
        targetCell.notes = new Set();
        if (num === state.solution[r][c]) {
          for (let i = 0; i < 9; i++) {
            if (newGrid[r][i].notes.has(num)) {
              newGrid[r][i] = { ...newGrid[r][i], notes: new Set(newGrid[r][i].notes) };
              newGrid[r][i].notes.delete(num);
            }
            if (newGrid[i][c].notes.has(num)) {
              newGrid[i][c] = { ...newGrid[i][c], notes: new Set(newGrid[i][c].notes) };
              newGrid[i][c].notes.delete(num);
            }
          }
          const boxStartR = Math.floor(r / 3) * 3;
          const boxStartC = Math.floor(c / 3) * 3;
          for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
            for (let colOffset = 0; colOffset < 3; colOffset++) {
              const currR = boxStartR + rowOffset;
              const currC = boxStartC + colOffset;
              if (newGrid[currR][currC].notes.has(num)) {
                newGrid[currR][currC] = { ...newGrid[currR][currC], notes: new Set(newGrid[currR][currC].notes) };
                newGrid[currR][currC].notes.delete(num);
              }
            }
          }
        }
      }
    }

    newGrid[r][c] = targetCell;
    const historyUpdate = addToHistory(newGrid, state);
    const isComplete = SudokuService.isComplete(newGrid, state.solution);
    if (isComplete) {
      const finalState = { ...state, ...historyUpdate, isGameOver: true };
      onGameComplete({
        id: state.id,
        grid: serializeGrid(newGrid),
        solution: state.solution,
        difficulty: state.difficulty,
        timeSeconds: state.timer,
        status: 'completed',
        date: new Date().toISOString(),
        history: finalState.history,
        historyIndex: finalState.historyIndex,
      });
      return finalState;
    }
    return { ...state, ...historyUpdate };
  };

  const handleUndo = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.historyIndex <= 0) return prev;
      const newIndex = prev.historyIndex - 1;
      return { ...prev, grid: deserializeGrid(prev.history[newIndex]), historyIndex: newIndex };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.historyIndex >= prev.history.length - 1) return prev;
      const newIndex = prev.historyIndex + 1;
      return { ...prev, grid: deserializeGrid(prev.history[newIndex]), historyIndex: newIndex };
    });
  }, []);

  const toggleNotesMode = useCallback(() => {
    setGameState(prev => prev ? { 
      ...prev, 
      notesMode: !prev.notesMode,
      eraserMode: false 
    } : null);
  }, []);

  const toggleEraserMode = useCallback(() => {
    setGameState(prev => prev ? { 
      ...prev, 
      eraserMode: !prev.eraserMode,
      notesMode: false,
      activeNumbers: [] 
    } : null);
  }, []);

  const handleCellClick = (r: number, c: number) => {
    if (!gameState || gameState.isGameOver) return;
    const cell = gameState.grid[r][c];
    const isAlreadySelected = gameState.selectedCell?.[0] === r && gameState.selectedCell?.[1] === c;

    if (gameState.eraserMode) {
      setGameState(prev => prev ? clearCell(r, c, prev) : null);
      return;
    }

    // LÓGICA DE 3 PASOS PARA CELDAS CON NÚMERO
    if (cell.value !== null) {
      setGameState(prev => {
        if (!prev) return null;
        
        if (isAlreadySelected) {
          const isPinned = prev.activeNumbers.includes(cell.value!);
          
          if (isPinned) {
            // PASO 3: Borrar (si no es fijo) o Desseleccionar todo (si es fijo)
            if (cell.fixed) {
               return { ...prev, activeNumbers: [] };
            }
            const updated = clearCell(r, c, prev);
            return { ...prev, ...updated, activeNumbers: [] };
          } else {
            // PASO 2: Resaltar (Pin)
            return { ...prev, activeNumbers: [cell.value!] };
          }
        }

        // PASO 1: Seleccionar
        return { 
          ...prev, 
          selectedCell: [r, c],
          activeNumbers: [], // Limpiamos resaltados previos al cambiar de celda
          eraserMode: false 
        };
      });
      return;
    }

    // LÓGICA DE 2 PASOS PARA CELDAS VACÍAS
    if (isAlreadySelected) {
      toggleNotesMode();
    } else {
      if (gameState.activeNumbers.length > 0) {
        // Si hay un número fijado y tocamos una vacía, lo escribimos
        const lastNum = gameState.activeNumbers[gameState.activeNumbers.length - 1];
        setGameState(prev => prev ? applyInputToCell(r, c, lastNum, prev) : null);
        setGameState(prev => prev ? { ...prev, selectedCell: [r, c] } : null);
      } else {
        // Seleccionar vacía
        setGameState(prev => prev ? { 
          ...prev, 
          selectedCell: [r, c],
          eraserMode: false 
        } : null);
      }
    }
  };

  const handleNumberInput = useCallback((num: number) => {
    setGameState(prev => {
      if (!prev || prev.isGameOver) return prev;
      const isAlreadyActive = prev.activeNumbers.includes(num);
      return {
        ...prev,
        activeNumbers: isAlreadyActive ? prev.activeNumbers.filter(n => n !== num) : [num],
        eraserMode: false 
      };
    });
  }, []);

  // ... rest of the file stays same ...
  // KEYBOARD HANDLER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState || gameState.isGameOver) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault();
        setGameState(prev => {
          if (!prev) return null;
          let [r, c] = prev.selectedCell || [0, 0];
          if (!prev.selectedCell) return { ...prev, selectedCell: [0, 0] };
          if (key === 'ArrowUp') r = (r - 1 + 9) % 9;
          if (key === 'ArrowDown') r = (r + 1) % 9;
          if (key === 'ArrowLeft') c = (c - 1 + 9) % 9;
          if (key === 'ArrowRight') c = (c + 1) % 9;
          return { ...prev, selectedCell: [r, c] };
        });
        return;
      }

      if (key === ' ') {
        e.preventDefault();
        setGameState(prev => {
          if (!prev || !prev.selectedCell) return prev;
          const [r, c] = prev.selectedCell;
          const val = prev.grid[r][c].value;
          if (val === null) return prev;
          const isAlreadyIn = prev.activeNumbers.includes(val);
          return {
            ...prev,
            activeNumbers: isAlreadyIn ? [] : [val]
          };
        });
        return;
      }

      if (/^[1-9]$/.test(key)) {
        const num = parseInt(key);
        if (gameState.selectedCell) {
          const [r, c] = gameState.selectedCell;
          setGameState(prev => prev ? applyInputToCell(r, c, num, prev) : null);
        } else {
          handleNumberInput(num);
        }
        return;
      }

      if (key.toLowerCase() === 'm') {
        toggleNotesMode();
        return;
      }

      if (key === 'Backspace' || key === 'Delete') {
        if (gameState.selectedCell) {
          const [r, c] = gameState.selectedCell;
          setGameState(prev => prev ? clearCell(r, c, prev) : null);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (key.toLowerCase() === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleNumberInput, toggleNotesMode, handleUndo, handleRedo]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-5xl font-bold shadow-2xl shadow-indigo-200 dark:shadow-none mb-8 animate-bounce">
          Z
        </div>
        <h1 className="text-4xl font-extrabold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">Zen Sudoku</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-xs">Usa Flechas para navegar y Espacio para fijar números permanentemente.</p>
        <div className="w-full max-w-sm space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(['Easy', 'Medium', 'Hard', 'Expert'] as Difficulty[]).map(diff => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`py-3 px-4 rounded-2xl font-bold transition-all border-2 ${selectedDifficulty === diff ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'}`}
              >
                {diff === 'Easy' ? 'Fácil' : diff === 'Medium' ? 'Medio' : diff === 'Hard' ? 'Difícil' : 'Experto'}
              </button>
            ))}
          </div>
          <button 
            onClick={() => startNewGame(selectedDifficulty)}
            className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-black dark:hover:bg-indigo-700 active:scale-[0.98] transition-all mt-4 flex items-center justify-center gap-3"
          >
            <i className="fa-solid fa-play"></i>
            Nueva Partida
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 pb-8 max-w-md mx-auto animate-in fade-in duration-500">
      <div className="w-full flex justify-between items-center px-4">
        <button 
          onClick={() => setGameState(null)}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-2"
        >
          <i className="fa-solid fa-chevron-left mr-2"></i>
          <span className="text-xs font-bold uppercase text-slate-400">Menú</span>
        </button>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Tiempo</span>
          <span className="font-mono text-xl tabular-nums text-slate-700 dark:text-slate-300">{formatTime(gameState.timer)}</span>
        </div>
      </div>

      <SudokuBoard 
        grid={gameState.grid} 
        selectedCell={gameState.selectedCell} 
        activeNumbers={gameState.activeNumbers}
        onCellClick={handleCellClick}
        solution={gameState.solution}
        showErrors={true}
      />

      <div className="w-full grid grid-cols-4 gap-2 px-2">
        <button 
          onClick={handleUndo}
          disabled={gameState.historyIndex <= 0}
          title="Deshacer (Ctrl+Z)"
          className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border-2 ${gameState.historyIndex <= 0 ? 'opacity-30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700'}`}
        >
          <i className="fa-solid fa-rotate-left text-sm mb-1"></i>
          <span className="text-[9px] font-bold uppercase text-slate-400">Atrás</span>
        </button>
        <button 
          onClick={handleRedo}
          disabled={gameState.historyIndex >= gameState.history.length - 1}
          title="Rehacer (Ctrl+Y)"
          className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border-2 ${gameState.historyIndex >= gameState.history.length - 1 ? 'opacity-30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700'}`}
        >
          <i className="fa-solid fa-rotate-right text-sm mb-1"></i>
          <span className="text-[9px] font-bold uppercase text-slate-400">Adelante</span>
        </button>
        <button 
          onClick={toggleNotesMode}
          title="Modo Notas (M)"
          className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border-2 ${gameState.notesMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'}`}
        >
          <i className="fa-solid fa-pencil text-sm mb-1"></i>
          <span className="text-[9px] font-bold uppercase">Notas</span>
        </button>
        <button 
          onClick={toggleEraserMode}
          title="Borrar (Borrar/Suprimir)"
          className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border-2 ${gameState.eraserMode ? 'bg-rose-500 text-white border-rose-600 shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'}`}
        >
          <i className="fa-solid fa-eraser text-sm mb-1"></i>
          <span className="text-[9px] font-bold uppercase">Borrar</span>
        </button>
      </div>

      <div className="w-full flex flex-col gap-2 px-4">
        <div className="grid grid-cols-9 gap-1 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
            const isCompleted = numberStats[num] >= 9;
            const isSelected = gameState.activeNumbers.includes(num) && !gameState.eraserMode;
            return (
              <button
                key={num}
                onClick={() => handleNumberInput(num)}
                className={`relative flex flex-col items-center justify-center border-2 rounded-xl py-2 sm:py-3 transition-all duration-200 shadow-sm
                  ${isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-700 ring-4 ring-indigo-100 dark:ring-indigo-900/30 -translate-y-1 z-10' 
                    : isCompleted
                      ? 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-400 opacity-60'
                      : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 active:scale-95'}
                `}
              >
                <span className="text-xl sm:text-2xl font-bold">{num}</span>
                {!isCompleted && (
                  <span className={`text-[8px] font-bold mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-300 dark:text-slate-500'}`}>
                    {9 - numberStats[num]}
                  </span>
                )}
                {isCompleted && (
                  <i className={`fa-solid fa-check text-[8px] mt-0.5 ${isSelected ? 'text-white' : 'text-green-500'}`}></i>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {gameState.isGameOver && (
        <div className="fixed inset-0 bg-slate-900/80 dark:bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl animate-bounce">
              <i className="fa-solid fa-trophy"></i>
            </div>
            <h2 className="text-3xl font-bold mb-2 text-slate-800 dark:text-slate-100">¡Victoria!</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Has completado el desafío en {formatTime(gameState.timer)}.</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => startNewGame(gameState.difficulty)}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-xl shadow-indigo-200 dark:shadow-none text-lg"
              >
                Jugar otro
              </button>
              <button 
                onClick={() => setGameState(null)}
                className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Ir al Menú
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SudokuGame;
