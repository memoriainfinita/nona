
import React, { useMemo } from 'react';
import { UserStats, Difficulty, SudokuGameRecord, DailyStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell as ReCell } from 'recharts';

interface DashboardProps {
  stats: UserStats;
  onSelectGame: (game: SudokuGameRecord) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, onSelectGame }) => {
  const chartData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      // Fix: Safely access dailyLog with explicit type casting to avoid 'unknown' property error
      const dayData = stats.dailyLog[key] as DailyStats | undefined;
      last7Days.push({
        date: key.slice(5), // MM-DD
        count: dayData ? dayData.completed : 0,
        fullDate: key
      });
    }
    return last7Days;
  }, [stats.dailyLog]);

  const formatTime = (s: number | null) => {
    if (s === null) return '--:--';
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalPoints = useMemo(() => {
    // Fix: Explicitly cast values to DailyStats array to ensure 'completed' property access
    const dailyStatsEntries = Object.values(stats.dailyLog) as DailyStats[];
    return dailyStatsEntries.reduce((acc, curr) => acc + curr.completed, 0);
  }, [stats.dailyLog]);

  const ongoingGames = useMemo(() => {
    return (stats.history || []).filter(g => g.status === 'ongoing').reverse();
  }, [stats.history]);

  const completedHistory = useMemo(() => {
    return (stats.history || []).filter(g => g.status === 'completed').reverse();
  }, [stats.history]);

  return (
    <div className="p-6 flex flex-col gap-8 pb-24 max-w-lg mx-auto overflow-y-auto h-full custom-scrollbar">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Tu Progreso</h1>
        <p className="text-slate-500 dark:text-slate-400">¡Sigue así, maestro del Zen!</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Completados</span>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.totalCompleted}</span>
            <span className="text-xs text-green-500 dark:text-green-400 font-bold mb-1">Total</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Experiencia</span>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{totalPoints * 100}</span>
            <span className="text-xs text-indigo-500 dark:text-indigo-400 font-bold mb-1">XP</span>
          </div>
        </div>
      </div>

      {/* Ongoing Games */}
      {ongoingGames.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-widest">Partidas en curso</h3>
          <div className="flex flex-col gap-3">
            {ongoingGames.map(game => (
              <div key={game.id} className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 p-4 rounded-2xl flex justify-between items-center transition-colors">
                <div>
                  <p className="font-bold text-indigo-900 dark:text-indigo-300">{game.difficulty}</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400/80">{formatTime(game.timeSeconds)} transcurridos</p>
                </div>
                <button 
                  onClick={() => onSelectGame(game)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-100 dark:shadow-none active:scale-95 transition-transform"
                >
                  Continuar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Chart */}
      <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-widest">Actividad (7 días)</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: '#1e293b', color: '#f8fafc' }}
                itemStyle={{ color: '#818cf8' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <ReCell key={`cell-${index}`} fill={entry.count > 0 ? '#6366f1' : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Best Times List */}
      <section>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-widest">Mejores Tiempos</h3>
        <div className="space-y-3">
          {(['Easy', 'Medium', 'Hard', 'Expert'] as Difficulty[]).map(diff => (
            <div key={diff} className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{diff}</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatTime(stats.bestTimes[diff])}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent History List */}
      <section>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-widest">Historial</h3>
        <div className="flex flex-col gap-2">
          {completedHistory.slice(0, 10).map((game) => (
            <div key={game.id} className="flex items-center gap-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
              <div className="bg-slate-50 dark:bg-slate-900 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 font-bold text-xs">
                <i className="fa-solid fa-check text-green-500 dark:text-green-400"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{game.difficulty}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(game.date).toLocaleDateString()}</p>
              </div>
              <div className="ml-auto text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                {formatTime(game.timeSeconds)}
              </div>
            </div>
          ))}
          {completedHistory.length === 0 && (
            <div className="text-center py-8 text-slate-400 italic">Aún no hay sudokus completados.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
