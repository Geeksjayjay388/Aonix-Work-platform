import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import type { Project, Activity as ActivityType } from '../lib/supabase';
import { useToast } from '../components/Toast';
import {
    Users,
    FolderKanban,
    CreditCard,
    ArrowUpRight,
    Plus,
    Activity,
    ChevronRight
} from 'lucide-react';

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({ projects: 0, pendingPayments: 0, totalClients: 0, totalRevenue: 0 });
    const [recentProjects, setRecentProjects] = useState<(Project & { taskCount: number, completedCount: number })[]>([]);
    const [activities, setActivities] = useState<ActivityType[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const { data: projects, error: projectsError } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
            const { data: clients, error: clientsError } = await supabase.from('clients').select('*', { count: 'exact' });
            const { data: payments, error: paymentsError } = await supabase.from('payments').select('*');
            const { data: activityData } = await supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(5);

            if (projectsError || clientsError || paymentsError) {
                toast.error('Failed to load dashboard data');
                setLoading(false);
                return;
            }

            if (projects && clients && payments) {
                setStats({
                    projects: projects.length,
                    totalClients: clients.length,
                    pendingPayments: payments.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((acc, p) => acc + p.amount, 0),
                    totalRevenue: payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0)
                });

                const enrichedProjects = await Promise.all(projects.slice(0, 5).map(async (p) => {
                    const { data: tasks } = await supabase.from('tasks').select('*').eq('project_id', p.id);
                    return {
                        ...p,
                        taskCount: tasks?.length || 0,
                        completedCount: tasks?.filter(t => t.is_completed).length || 0
                    };
                }));
                setRecentProjects(enrichedProjects);
            }
            if (activityData) setActivities(activityData);
        } catch (err) {
            console.error('Dashboard error:', err);
            toast.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);


    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-16 pb-24"
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-5xl font-extrabold tracking-tighter text-text-main">
                        Overview
                    </h1>
                    <p className="text-muted text-lg font-medium">Monitoring your studio's creative pulse.</p>
                </div>
                <div className="flex gap-4">
                    <button className="premium-btn group">
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                        <span>Initialize Project</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                {[
                    { label: 'Live Projects', value: stats.projects, icon: FolderKanban, color: 'var(--primary)', delay: 0 },
                    { label: 'Active Clients', value: stats.totalClients, icon: Users, color: 'var(--secondary)', delay: 0.1 },
                    { label: 'Pending Yield', value: `$${stats.pendingPayments.toLocaleString()}`, icon: CreditCard, color: 'var(--warning)', delay: 0.2 },
                    { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: CreditCard, color: 'var(--success)', delay: 0.3 },
                ].map((stat) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: stat.delay, duration: 0.6 }}
                        className="glass-card p-8 group overflow-hidden relative"
                    >
                        <div className="absolute -right-4 -top-4 w-32 h-32 bg-current opacity-[0.03] rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" style={{ color: stat.color }} />

                        <div className="relative z-10">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/5 group-hover:scale-110 transition-all duration-500"
                                style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                            >
                                <stat.icon size={26} strokeWidth={2.5} />
                            </div>
                            <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</p>
                            <h3 className="text-4xl font-extrabold mt-1 tracking-tighter">
                                {loading ? (
                                    <div className="h-10 w-24 skeleton rounded-xl mt-1" />
                                ) : (
                                    stat.value
                                )}
                            </h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Recent Projects */}
                <div className="lg:col-span-2 space-y-10">
                    <div className="glass-card shadow-premium overflow-hidden">
                        <div className="p-8 md:p-12">
                            <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                        <FolderKanban size={24} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-3xl font-extrabold tracking-tighter">Current Pipeline</h3>
                                </div>
                                <button className="text-primary font-bold text-sm hover:translate-x-1 transition-all duration-300 flex items-center gap-2 group p-2 rounded-xl hover:bg-primary/5">
                                    Review All
                                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {loading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-28 skeleton rounded-3xl" />
                                        ))}
                                    </div>
                                ) : recentProjects.length > 0 ? recentProjects.map(proj => (
                                    <div key={proj.id} className="group glass-card p-6 border-transparent hover:border-primary/20 hover:bg-white/40 dark:hover:bg-primary/5 flex items-center justify-between transition-all duration-500">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-indigo-600/10 rounded-2xl flex items-center justify-center text-primary group-hover:from-primary group-hover:to-indigo-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-primary/30 transition-all duration-500">
                                                <FolderKanban size={22} strokeWidth={2.5} />
                                            </div>
                                            <div className="space-y-2">
                                                <h4 className="font-extrabold text-xl tracking-tight leading-none">{proj.name}</h4>
                                                <div className="flex items-center gap-6">
                                                    <span className={`badge ${proj.status === 'completed' ? 'badge-success' : 'badge-primary'}`}>
                                                        {proj.status}
                                                    </span>
                                                    <div className="flex items-center gap-4 w-48">
                                                        <div className="flex-1 progress-container overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${proj.taskCount > 0 ? (proj.completedCount / proj.taskCount) * 100 : 0}%` }}
                                                                transition={{ duration: 1.5, ease: "circOut" }}
                                                                className="progress-bar"
                                                            />
                                                        </div>
                                                        <span className="text-xs font-black text-text-main min-w-[3ch]">{proj.taskCount > 0 ? Math.round((proj.completedCount / proj.taskCount) * 100) : 0}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted group-hover:text-primary group-hover:bg-primary/10 transition-all duration-300">
                                            <ChevronRight size={24} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                )) : (
                                    <div className="text-center py-24 bg-primary/[0.02] rounded-[32px] border-2 border-dashed border-border/60 flex flex-col items-center">
                                        <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center text-muted mb-6 border border-border/20">
                                            <FolderKanban size={32} />
                                        </div>
                                        <h4 className="font-extrabold text-2xl tracking-tighter">Your pipeline is clear</h4>
                                        <p className="text-muted max-w-xs mx-auto mt-3 font-medium leading-relaxed">Let's populate your workspace with some breakthrough projects.</p>
                                        <button className="premium-btn mt-10 px-8 py-4">Create New Project</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="space-y-8">
                    <div className="glass-card p-12 shadow-premium">
                        <div className="flex items-center gap-4 mb-14">
                            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shadow-inner">
                                <Activity size={26} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-3xl font-extrabold tracking-tighter">Timeline</h3>
                        </div>
                        <div className="space-y-10 relative before:absolute before:left-[23px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-border/80 before:to-transparent before:rounded-full">
                            {activities.map((activity, i) => {
                                const Icon = activity.type === 'project' ? FolderKanban : activity.type === 'payment' ? CreditCard : activity.type === 'task' ? Activity : Users;
                                const colorClass = activity.type === 'project' ? 'text-primary' : activity.type === 'payment' ? 'text-success' : activity.type === 'task' ? 'text-accent' : 'text-secondary';
                                const bgClass = activity.type === 'project' ? 'bg-primary/10' : activity.type === 'payment' ? 'bg-success/10' : activity.type === 'task' ? 'bg-accent/10' : 'bg-secondary/10';

                                return (
                                    <motion.div
                                        key={activity.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 + (i * 0.1) }}
                                        className="relative flex gap-6 pl-12 group"
                                    >
                                        <div className={`absolute left-0 w-12 h-12 rounded-2xl ${bgClass} border-4 border-bg-main shadow-lg flex items-center justify-center z-10 ${colorClass} group-hover:scale-110 transition-transform duration-500`}>
                                            <Icon size={18} strokeWidth={2.5} />
                                        </div>
                                        <div className="pt-1 select-none">
                                            <p className="text-base font-extrabold leading-tight tracking-tight group-hover:text-primary transition-colors cursor-default">{activity.title}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <p className="text-[10px] font-black text-muted/60 uppercase tracking-widest">{new Date(activity.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                                                <span className="w-1.5 h-1.5 bg-border rounded-full" />
                                                <p className="text-[9px] font-black uppercase tracking-widest bg-white dark:bg-white/5 border border-border/40 px-2.5 py-0.5 rounded-full text-muted">{activity.type}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                        <button className="secondary-btn w-full mt-12 text-xs font-black uppercase tracking-[0.2em] border-2 shadow-sm hover:shadow-md transition-all active:scale-95">
                            Examine All Logs
                        </button>
                    </div>

                    <div className="glass-card p-10 bg-gradient-to-br from-indigo-600 to-violet-700 border-none shadow-premium relative group overflow-hidden">
                        <div className="absolute -right-6 -bottom-6 p-8 text-white/5 group-hover:rotate-12 transition-transform duration-1000">
                            <ArrowUpRight size={180} strokeWidth={3} />
                        </div>
                        <div className="relative z-10 text-white">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center mb-8 border border-white/20 shadow-xl">
                                <ArrowUpRight size={28} strokeWidth={3} />
                            </div>
                            <h4 className="text-3xl font-extrabold tracking-tighter mb-4 leading-[1.1]">Unlock Creative Excellence</h4>
                            <p className="text-sm font-semibold text-white/80 mb-10 leading-relaxed">Activate custom analytics, neural project insights, and elite cloud performance.</p>
                            <button className="w-full bg-white text-indigo-600 font-extrabold text-sm py-4 rounded-2xl shadow-2xl shadow-black/20 hover:bg-white/90 active:scale-95 transition-all uppercase tracking-widest">Aonix Platinum</button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );

};

export default Dashboard;

