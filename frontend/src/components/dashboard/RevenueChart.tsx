import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardStats } from '@/hooks/useDashboardData';

export function RevenueChart() {
    const { data: stats, isLoading } = useDashboardStats();
    const [range, setRange] = useState('1W');

    // 1. Static Mock Data (Fallback / Demo)
    const demoData = [
        { name: 'Mon', income: 4000, expense: 2400 },
        { name: 'Tue', income: 3000, expense: 1398 },
        { name: 'Wed', income: 2000, expense: 9800 },
        { name: 'Thu', income: 2780, expense: 3908 },
        { name: 'Fri', income: 1890, expense: 4800 },
        { name: 'Sat', income: 2390, expense: 3800 },
        { name: 'Sun', income: 3490, expense: 4300 },
    ];

    // 2. Use real data if available and not empty, otherwise demo
    let data = demoData;
    if (stats?.chartData && stats.chartData.length > 0) {
        // Simple check to ensure we have non-zero data to show "activity"
        const hasActivity = stats.chartData.some((d: any) => d.income > 0);
        if (hasActivity) {
            data = stats.chartData;
        }
    }

    return (
        <GlassCard className="lg:col-span-2 relative overflow-hidden group">
            {/* Header / Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                <div>
                    <h3 className="text-xl font-semibold text-zinc-900">Financial Performance</h3>
                    <p className="text-sm text-zinc-500">Revenue vs. Expenses (Real-time)</p>
                </div>

                <div className="flex items-center gap-6">
                    {/* Legend */}
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Income
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Expenses
                        </div>
                    </div>

                    {/* Range Switcher (Visual Only for now) */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['1D', '1W', '1M', '1Y'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${range === r
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="h-[300px] w-full">
                {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">Loading chart...</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(0,0,0,0.05)',
                                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
                                    color: '#1e293b',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}
                                itemStyle={{ padding: 0 }}
                                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="income"
                                stroke="#6366f1"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorIncome)"
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="expense"
                                stroke="#14b8a6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorExpense)"
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </GlassCard>
    );
}
