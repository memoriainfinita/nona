
import React from 'react';
import { Grid, Cell } from '../types';

interface SudokuBoardProps {
  grid: Grid;
  selectedCell: [number, number] | null;
  activeNumbers: number[]; // These are the "pinned" numbers
  onCellClick: (r: number, c: number) => void;
  solution: number[][];
  showErrors: boolean;
}

const SudokuBoard: React.FC<SudokuBoardProps> = ({ grid, selectedCell, activeNumbers, onCellClick, solution, showErrors }) => {
  const isSelected = (r: number, c: number) => 
    selectedCell?.[0] === r && selectedCell?.[1] === c;

  // El número de la celda que el usuario tiene seleccionada actualmente (Auto-Highlight)
  const currentCellValue = selectedCell ? grid[selectedCell[0]][selectedCell[1]].value : null;

  const isInSameArea = (r: number, c: number) => {
    if (!selectedCell) return false;
    const [selR, selC] = selectedCell;
    if (r === selR || c === selC) return true;
    const boxR = Math.floor(r / 3);
    const boxC = Math.floor(c / 3);
    const selBoxR = Math.floor(selR / 3);
    const selBoxC = Math.floor(selC / 3);
    return boxR === selBoxR && boxC === selBoxC;
  };

  const isHighlightedValue = (val: number | null) => {
    if (val === null) return false;
    // Resaltamos si está "fijado" o si coincide con la celda actual
    return activeNumbers.includes(val) || val === currentCellValue;
  };

  return (
    <div className="grid grid-cols-9 w-full max-w-[450px] aspect-square border-2 border-slate-800 dark:border-slate-950 bg-slate-800 dark:bg-slate-950 gap-[1px] select-none shadow-xl rounded overflow-hidden">
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const selected = isSelected(r, c);
          const isHighlighted = isHighlightedValue(cell.value);
          const related = isInSameArea(r, c);
          const isError = showErrors && cell.value !== null && !cell.fixed && cell.value !== solution[r][c];
          
          let bgColor = 'bg-white dark:bg-slate-800';
          
          if (selected) {
            bgColor = 'bg-indigo-100 dark:bg-indigo-900/60';
          } else if (isHighlighted) {
            bgColor = 'bg-amber-100 dark:bg-amber-900/40';
          } else if (related) {
            bgColor = 'bg-slate-50 dark:bg-slate-700/40';
          }

          const borderB = (r + 1) % 3 === 0 && r < 8 ? 'border-b-2 border-slate-800 dark:border-slate-950' : '';
          const borderR = (c + 1) % 3 === 0 && c < 8 ? 'border-r-2 border-slate-800 dark:border-slate-950' : '';

          return (
            <div
              key={`${r}-${c}`}
              onClick={() => onCellClick(r, c)}
              className={`
                relative flex items-center justify-center text-lg sm:text-2xl cursor-pointer transition-all duration-150 
                ${bgColor} ${borderB} ${borderR} h-full
                ${selected ? 'z-10 ring-2 ring-inset ring-indigo-600 dark:ring-indigo-400 shadow-inner' : 'z-0'}
              `}
            >
              {cell.value !== null ? (
                <span className={`
                  ${cell.fixed ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-normal text-indigo-600 dark:text-indigo-400'}
                  ${isError ? 'text-rose-500 dark:text-rose-400' : ''}
                  ${isHighlighted && !selected ? 'scale-110' : ''} 
                  ${selected ? 'scale-110 font-bold brightness-110' : ''}
                  transition-transform
                `}>
                  {cell.value}
                </span>
              ) : (
                <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-[2px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
                    const isNoteHighlighted = isHighlightedValue(n);
                    return (
                      <span 
                        key={n} 
                        className={`
                          text-[8px] sm:text-[10px] leading-none text-center flex items-center justify-center transition-all
                          ${cell.notes.has(n) 
                            ? (isNoteHighlighted ? 'text-indigo-600 dark:text-indigo-300 font-bold scale-125' : 'text-slate-400 dark:text-slate-500') 
                            : 'text-transparent'}
                        `}
                      >
                        {n}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default SudokuBoard;
