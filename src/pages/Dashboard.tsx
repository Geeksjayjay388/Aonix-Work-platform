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
    ChevronRight,
    Bell,
    Clock,
    MessageSquare,
    CheckSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getResolvedProfile } from '../lib/profile';

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({ projects: 0, pendingPayments: 0, totalClients: 0, totalRevenue: 0 });
    const [recentProjects, setRecentProjects] = useState<(Project & { taskCount: number, completedCount: number })[]>([]);
    const [activities, setActivities] = useState<ActivityType[]>([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState('User');
    const [greeting, setGreeting] = useState('Good morning');
    const [unreadCount, setUnreadCount] = useState(0);
    const toast = useToast();
    const navigate = useNavigate();

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

        const hour = new Date().getHours();
        setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

        const loadHeaderData = async () => {
            const profile = await getResolvedProfile();
            if (!profile) return;
            setProfileName(profile.legalName || 'User');

            const lastReadAt = localStorage.getItem(`messages_last_read_at_${profile.id}`) || new Date(0).toISOString();
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .neq('sender_id', profile.id)
                .gt('created_at', lastReadAt);

            if (error) {
                setUnreadCount(0);
                return;
            }
            setUnreadCount(count || 0);
        };

        loadHeaderData();

        // Setup realtime subscriptions for stats updates
        const projectsChannel = supabase.channel('projects-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        const paymentsChannel = supabase.channel('payments-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        const tasksChannel = supabase.channel('tasks-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        return () => {
            projectsChannel.unsubscribe();
            paymentsChannel.unsubscribe();
            tasksChannel.unsubscribe();
        };
    }, []);

    const totalTaskCount = recentProjects.reduce((acc, project) => acc + project.taskCount, 0);
    const completedTaskCount = recentProjects.reduce((acc, project) => acc + project.completedCount, 0);
    const completionRate = totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0;
    const totalTrackedRevenue = stats.totalRevenue + stats.pendingPayments;
    const paidShare = totalTrackedRevenue > 0 ? Math.round((stats.totalRevenue / totalTrackedRevenue) * 100) : 0;
    const pendingShare = 100 - paidShare;

    const statCards = [
        { label: 'Projects', value: stats.projects.toLocaleString(), change: '+12%', trend: 'up', icon: FolderKanban, color: '#3B82F6', delay: 0 },
        { label: 'Tasks Pending', value: (totalTaskCount - completedTaskCount).toLocaleString(), change: '-5%', trend: 'down', icon: CheckSquare, color: '#EF4444', delay: 0.1 },
        { label: 'Messages', value: unreadCount.toLocaleString(), change: '+24%', trend: 'up', icon: MessageSquare, color: '#10B981', delay: 0.2 },
        { label: 'Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, change: '+8%', trend: 'up', icon: CreditCard, color: '#F59E0B', delay: 0.3 },
    ];




    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-16 pb-24 bg-pattern min-h-screen px-8 -mx-8"
        >
            <section className="relative h-[450px] rounded-[4rem] overflow-hidden group shadow-premium mb-20">
                <motion.div
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="absolute inset-0 z-0"
                >
                    <img
                        src="/creative_bg_1.png"
                        alt="Creative Background"
                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-[3s]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/80 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/60 via-transparent to-transparent" />
                </motion.div>

                <div className="relative z-10 h-full p-16 flex flex-col justify-end gap-6">
                    <div className="absolute top-12 right-12 flex gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/notifications')}
                            className="relative bg-white/10 backdrop-blur-2xl border border-white/20 p-5 group hover:bg-white/20 rounded-3xl transition-all"
                            aria-label="Open notifications"
                        >
                            <Bell size={24} className="text-white group-hover:scale-110 transition-transform" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center shadow-lg shadow-rose-500/40 border-2 border-indigo-950">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 1 }}
                    >
                        <span className="px-5 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.4em] mb-4 inline-block">
                            Studio Intelligence
                        </span>
                        <h1 className="text-7xl font-black text-white tracking-tighter leading-tight max-w-3xl">
                            {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-emerald-200">{profileName}</span>
                        </h1>
                        <p className="text-white/70 text-xl font-medium max-w-2xl mt-4 leading-relaxed italic">
                            Elevating your creative resonance and studio synchronization through neural data visualization.
                        </p>
                    </motion.div>

                    <div className="flex gap-6 mt-4">
                        <button className="bg-white text-indigo-950 px-10 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:scale-105 transition-all flex items-center gap-3">
                            <Plus size={18} strokeWidth={4} />
                            Launch Venture
                        </button>
                        <button className="bg-white/10 backdrop-blur-xl border border-white/20 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] hover:bg-white/20 transition-all flex items-center gap-3 font-bold">
                            <Activity size={18} strokeWidth={3} />
                            View Analytics
                        </button>
                    </div>
                </div>

                {/* Decorative floating shapes */}
                <motion.div
                    animate={{ y: [0, -20, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-20 right-40 w-24 h-24 bg-indigo-400/20 backdrop-blur-3xl rounded-full border border-white/10 blur-xl"
                />
                <motion.div
                    animate={{ y: [0, 30, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-40 right-20 w-40 h-40 bg-emerald-400/10 backdrop-blur-3xl rounded-full border border-white/5 blur-2xl"
                />
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {statCards.map((stat, idx) => (
                    <motion.div
                        key={`${stat.label}-${idx}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: stat.delay, duration: 0.5, ease: "easeOut" }}
                        className="bg-white rounded-3xl p-10 border border-black/5 shadow-sm hover:shadow-xl transition-all duration-300 group relative"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-2">{stat.label}</p>
                                <h3 className="text-4xl font-black text-black tracking-tight leading-none mb-3">
                                    {loading ? (
                                        <div className="h-10 w-32 skeleton rounded-xl mt-1" />
                                    ) : (
                                        stat.value
                                    )}
                                </h3>
                                {!loading && (
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[11px] font-black ${stat.trend === 'up' ? 'text-emerald-500' : 'text-rose-500'} flex items-center gap-0.5`}>
                                            {stat.trend === 'up' ? '↑' : '↓'}{stat.change}
                                        </span>
                                        <span className="text-[10px] font-bold text-black/30">vs last 28 days</span>
                                    </div>
                                )}
                            </div>

                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 duration-500"
                                style={{ backgroundColor: `${stat.color}15` }}
                            >
                                <stat.icon size={28} style={{ color: stat.color }} strokeWidth={2.5} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                <div className="xl:col-span-2 glass-card p-12 relative overflow-hidden rounded-[4rem] border-none shadow-premium">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -mr-48 -mt-48 blur-[100px]" />

                    <div className="flex items-center justify-between gap-4 mb-10 relative z-10">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-muted/60">Revenue architecture</p>
                            <h3 className="text-3xl font-black tracking-tighter mt-1">Capital Distribution</h3>
                        </div>
                        <span className="px-6 py-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest">{paidShare}% Harvested</span>
                    </div>

                    <div className="h-4 w-full rounded-full bg-border/20 overflow-hidden flex shadow-inner mb-10">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${paidShare}%` }}
                            transition={{ duration: 2.5, ease: "circOut" }}
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        />
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pendingShare}%` }}
                            transition={{ duration: 2.5, ease: "circOut", delay: 0.5 }}
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 opacity-60"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-8 relative z-10">
                        <div className="rounded-[2.5rem] border border-border/10 p-8 bg-white/40 backdrop-blur-xl shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-text-muted/40">Resolved</p>
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <ArrowUpRight size={16} strokeWidth={3} />
                                </div>
                            </div>
                            <p className="text-4xl font-black tracking-tighter text-text-main">${stats.totalRevenue.toLocaleString()}</p>
                        </div>
                        <div className="rounded-[2.5rem] border border-border/10 p-8 bg-white/40 backdrop-blur-xl shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-text-muted/40">Expected</p>
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <Clock size={16} strokeWidth={3} />
                                </div>
                            </div>
                            <p className="text-4xl font-black tracking-tighter text-text-main">${stats.pendingPayments.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-12 relative overflow-hidden rounded-[4rem] border-none shadow-premium flex flex-col items-center justify-center">
                    <div className="absolute inset-0 opacity-5 pointer-events-none">
                        <img src="/creative_bg_2.png" alt="Card Texture" className="w-full h-full object-cover grayscale" />
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-muted/60 mb-2">Workflow Integrity</p>
                    <h3 className="text-3xl font-black tracking-tighter mb-12">Pulse Level</h3>

                    <div className="relative group">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <div
                            className="w-56 h-56 rounded-full flex items-center justify-center relative z-10 p-2 border-4 border-white/20"
                            style={{
                                background: `conic-gradient(var(--color-primary) ${completionRate * 3.6}deg, rgba(0,0,0,0.05) 0deg)`,
                            }}
                        >
                            <div className="w-full h-full rounded-full bg-white shadow-2xl flex flex-col items-center justify-center border-2 border-border/10">
                                <p className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-primary to-indigo-600">{completionRate}%</p>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted/40 font-black mt-1">Sustained</p>
                            </div>
                        </div>
                    </div>

                    <p className="mt-12 text-sm text-text-muted/60 text-center font-bold px-4 leading-relaxed italic">
                        The current pipeline shows a <span className="text-primary font-black">{completionRate}%</span> optimization across {totalTaskCount} active venture nodes.
                    </p>
                </div>
            </section>

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
                        <button
                            onClick={() => navigate('/settings?tab=logs')}
                            className="secondary-btn w-full mt-12 text-xs font-black uppercase tracking-[0.2em] border-2 shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
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
