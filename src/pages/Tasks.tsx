import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Search, Calendar, FolderKanban, ListChecks } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Task } from '../lib/supabase';

const Tasks: React.FC = () => {
    const [tasks, setTasks] = useState<(Task & { project_name: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

    const fetchData = async () => {
        setLoading(true);
        const { data: taskData } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
        const { data: projData } = await supabase.from('projects').select('*');

        if (taskData && projData) {
            const enrichedTasks = taskData.map(t => ({
                ...t,
                project_name: projData.find(p => p.id === t.project_id)?.name || 'Unknown Project'
            }));
            setTasks(enrichedTasks);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleTask = async (task: Task) => {
        const { error } = await supabase.from('tasks').update({ is_completed: !task.is_completed }).eq('id', task.id);
        if (!error) fetchData();
    };

    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.project_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' ||
            (filter === 'completed' && t.is_completed) ||
            (filter === 'pending' && !t.is_completed);
        return matchesSearch && matchesFilter;
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-12 pb-16"
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">Active Operations</h1>
                    <p className="text-muted text-lg font-medium">Coordinate your workflow and achieve your creative objectives.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-4 top-4 w-5 h-5 text-muted group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter by task or project..."
                            className="pl-12 py-4 bg-white/50 border-2 border-border focus:border-primary/30 transition-all rounded-2xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-white/50 border-2 border-border p-1.5 rounded-2xl">
                        {(['all', 'pending', 'completed'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-muted hover:text-primary hover:bg-primary/5'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-28 skeleton rounded-3xl" />
                        ))}
                    </div>
                ) : filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
                        <motion.div
                            layout
                            key={task.id}
                            className={`glass-card p-8 group flex items-center justify-between border-l-[12px] bg-white transition-all duration-500 rounded-[32px] shadow-premium ${task.is_completed ? 'border-success/40 opacity-70 scale-[0.98]' : 'border-primary'}`}
                        >
                            <div className="flex items-center gap-6 flex-1">
                                <button
                                    onClick={() => toggleTask(task)}
                                    className="p-1 hover:bg-primary/5 rounded-full transition-all duration-300 flex-shrink-0 bg-transparent transform group-hover:scale-110"
                                >
                                    {task.is_completed ? (
                                        <CheckCircle2 className="text-success shadow-sm" size={32} strokeWidth={2.5} />
                                    ) : (
                                        <Circle className="text-border group-hover:text-primary" size={32} strokeWidth={2.5} />
                                    )}
                                </button>
                                <div>
                                    <h3 className={`font-black text-2xl tracking-tight transition-all duration-500 ${task.is_completed ? 'line-through text-muted' : 'text-text-main group-hover:text-primary'}`}>
                                        {task.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-6 text-xs font-bold mt-2">
                                        <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-xl text-primary">
                                            <FolderKanban size={14} strokeWidth={2.5} />
                                            <span className="uppercase tracking-widest">{task.project_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted/60">
                                            <Calendar size={14} strokeWidth={2.5} />
                                            <span className="uppercase tracking-widest">Added {new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm transform group-hover:rotate-3 transition-transform ${task.is_completed ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                                    {task.is_completed ? 'Synchronized' : 'In Progress'}
                                </span>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="glass-card p-32 text-center bg-white/50 border-none rounded-[40px] shadow-premium flex flex-col items-center">
                        <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center text-primary/10 mb-8">
                            <ListChecks size={64} strokeWidth={1} />
                        </div>
                        <h3 className="text-3xl font-black tracking-tight mb-4 text-text-main">Pipeline Clear</h3>
                        <p className="text-muted font-medium max-w-sm mx-auto leading-relaxed italic">No operations found matching your criteria. Perfect timing for a creative recharge.</p>
                        <button className="premium-btn mt-10 px-10 py-4 rounded-2xl shadow-premium uppercase tracking-[0.2em] text-xs font-black">
                            Initialize New Task
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default Tasks;
