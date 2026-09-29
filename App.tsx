
import React, { useState, useEffect, useCallback } from 'react';
import SudokuGame from './components/SudokuGame';
import Dashboard from './components/Dashboard';
import { UserStats, Difficulty, SudokuGameRecord, GameState, Grid, SerializedGrid } from './types';

const INITIAL_STATS: UserStats = {
  totalCompleted: 0,
  bestTimes: {
    'Easy': null,
    'Medium': null,
    'Hard': null,
    'Expert': null,
  },
  dailyLog: {},
  history: [],
};

const App: React.FC = () => {
  const [view, setView] = useState<'game' | 'dashboard'>('game');
  const [resumeTarget, setResumeTarget] = useState<SudokuGameRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('zen_sudoku_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('zen_sudoku_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.history) parsed.history = [];
      return parsed;
    }
    return INITIAL_STATS;
  });

  useEffect(() => {
    localStorage.setItem('zen_sudoku_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('zen_sudoku_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('zen_sudoku_theme', 'light');
    }
  }, [isDarkMode]);

  const serializeGrid = (grid: Grid): SerializedGrid => {
    return grid.map(row => row.map(cell => ({
      ...cell,
      notes: Array.from(cell.notes)
    })));
  };

  const handleGameStateUpdate = useCallback((gameState: GameState) => {
    setStats(prev => {
      const history = [...(prev.history || [])];
      const index = history.findIndex(h => h.id === gameState.id);
      
      const updatedRecord: SudokuGameRecord = {
        id: gameState.id,
        grid: serializeGrid(gameState.grid),
        solution: gameState.solution,
        difficulty: gameState.difficulty,
        timeSeconds: gameState.timer,
        status: 'ongoing',
        date: new Date().toISOString(),
        history: gameState.history,
        historyIndex: gameState.historyIndex
      };

      if (index >= 0) {
        history[index] = updatedRecord;
      } else {
        history.push(updatedRecord);
      }

      return { ...prev, history };
    });
  }, []);

  const handleGameComplete = (record: SudokuGameRecord) => {
    const today = new Date().toISOString().split('T')[0];
    
    setStats(prev => {
      const newDailyLog = { ...prev.dailyLog };
      if (!newDailyLog[today]) {
        newDailyLog[today] = { date: today, completed: 0, bestTime: null };
      }
      
      const dayData = newDailyLog[today];
      dayData.completed += 1;
      if (dayData.bestTime === null || record.timeSeconds < dayData.bestTime) {
        dayData.bestTime = record.timeSeconds;
      }

      const newBestTimes = { ...prev.bestTimes };
      if (newBestTimes[record.difficulty] === null || record.timeSeconds < (newBestTimes[record.difficulty] as number)) {
        newBestTimes[record.difficulty] = record.timeSeconds;
      }

      const history = [...(prev.history || [])];
      const index = history.findIndex(h => h.id === record.id);
      if (index >= 0) {
        history[index] = record;
      } else {
        history.push(record);
      }

      return {
        ...prev,
        totalCompleted: prev.totalCompleted + 1,
        bestTimes: newBestTimes,
        dailyLog: newDailyLog,
        history,
      };
    });
    setResumeTarget(null);
  };

  const handleSelectGameToResume = (game: SudokuGameRecord) => {
    setResumeTarget(game);
    setView('game');
  };

  const handleClearHistory = () => {
    if (confirm('¿Estás seguro de que quieres borrar todo tu historial y estadísticas? Esta acción no se puede deshacer.')) {
      setStats(INITIAL_STATS);
      setIsSettingsOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col h-screen overflow-hidden transition-colors duration-200">
      <header className="py-4 px-6 flex justify-between items-center bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100 dark:shadow-none">
            Z
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-lg tracking-tight hidden sm:inline">Zen Sudoku</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => { setView('game'); setResumeTarget(null); }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'game' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <i className="fa-solid fa-play text-xs"></i>
            <span>Jugar</span>
          </button>
          <button 
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <i className="fa-solid fa-chart-line text-xs"></i>
            <span>Stats</span>
          </button>
        </div>

        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="w-9 h-9 flex items-center justify-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm"
        >
          <i className="fa-solid fa-gear text-lg"></i>
        </button>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto pt-4 overflow-y-auto custom-scrollbar">
        {view === 'game' ? (
          <SudokuGame 
            onGameComplete={handleGameComplete} 
            onGameStateUpdate={handleGameStateUpdate}
            resumeGame={resumeTarget}
          />
        ) : (
          <Dashboard 
            stats={stats} 
            onSelectGame={handleSelectGameToResume}
          />
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ajustes</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200">Modo Oscuro</p>
                  <p className="text-xs text-slate-500">Cambia el aspecto visual</p>
                </div>
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`w-14 h-8 rounded-full transition-colors relative ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${isDarkMode ? 'translate-x-6' : ''} flex items-center justify-center`}>
                    <i className={`fa-solid ${isDarkMode ? 'fa-moon text-indigo-600' : 'fa-sun text-amber-500'} text-[10px]`}></i>
                  </div>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <button 
                  onClick={handleClearHistory}
                  className="w-full flex items-center gap-3 text-rose-500 hover:text-rose-600 font-bold p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  <i className="fa-solid fa-trash-can"></i>
                  <span>Borrar historial</span>
                </button>
              </div>
            </div>

            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="mt-8 w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-transform active:scale-95"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
