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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-12 pb-16"
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-text-main mb-2">Dashboard</h1>
                    <p className="text-muted text-lg font-medium">Welcome back, let's see how your studio is performing today.</p>
                </div>
                <div className="flex gap-4">
                    <button className="premium-btn group shadow-premium">
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        <span>New Project</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                {[
                    { label: 'Active Projects', value: stats.projects, icon: FolderKanban, bgColor: 'bg-primary/10', textColor: 'text-primary', delay: 0 },
                    { label: 'Total Clients', value: stats.totalClients, icon: Users, bgColor: 'bg-secondary/10', textColor: 'text-secondary', delay: 0.1 },
                    { label: 'Pending Amount', value: `$${stats.pendingPayments.toLocaleString()}`, icon: CreditCard, bgColor: 'bg-warning/10', textColor: 'text-warning', delay: 0.2 },
                    { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: CreditCard, bgColor: 'bg-success/10', textColor: 'text-success', delay: 0.3 },
                ].map((stat) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: stat.delay, duration: 0.5 }}
                        className="glass-card p-8 group transition-all duration-500"
                    >
                        <div className={`w-14 h-14 rounded-2xl ${stat.bgColor} flex items-center justify-center ${stat.textColor} mb-6 group-hover:scale-110 transition-transform duration-500`}>
                            <stat.icon size={26} strokeWidth={2.5} />
                        </div>
                        <p className="text-muted text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                        <h3 className="text-3xl font-black mt-2 tracking-tighter">
                            {loading ? (
                                <div className="h-9 w-24 skeleton bg-border/40 rounded-lg mt-1" />
                            ) : (
                                stat.value
                            )}
                        </h3>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Recent Projects */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="glass-card p-10 bg-white shadow-premium">
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                    <FolderKanban size={20} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-black tracking-tight">Recent Projects</h3>
                            </div>
                            <button className="text-primary font-bold text-sm hover:translate-x-1 transition-transform p-2 bg-transparent flex items-center gap-1 group">
                                View Full Portfolio
                                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-28 skeleton rounded-2xl" />
                                    ))}
                                </div>
                            ) : recentProjects.length > 0 ? recentProjects.map(proj => (
                                <div key={proj.id} className="flex items-center justify-between p-6 rounded-3xl border border-border/60 hover:border-primary/20 hover:bg-primary/[0.01] hover:shadow-lg transition-all duration-500 group">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/30 transition-all duration-500">
                                            <FolderKanban size={24} strokeWidth={2.5} />
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-black text-xl tracking-tight">{proj.name}</h4>
                                            <div className="flex items-center gap-6">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${proj.status === 'completed' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                                                    {proj.status}
                                                </span>
                                                <div className="flex items-center gap-3 w-40">
                                                    <div className="flex-1 h-2 bg-border/60 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${proj.taskCount > 0 ? (proj.completedCount / proj.taskCount) * 100 : 0}%` }}
                                                            transition={{ duration: 1, delay: 0.5 }}
                                                            className="h-full bg-primary"
                                                        />
                                                    </div>
                                                    <span className="text-xs font-black text-text-main">{proj.taskCount > 0 ? Math.round((proj.completedCount / proj.taskCount) * 100) : 0}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-muted group-hover:text-primary group-hover:bg-primary/10 transition-all duration-300">
                                        <ChevronRight size={24} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-20 bg-main/30 rounded-3xl border-2 border-dashed border-border flex flex-col items-center">
                                    <FolderKanban size={48} className="text-border mb-4" />
                                    <h4 className="font-bold text-lg">No projects active</h4>
                                    <p className="text-muted max-w-xs mx-auto mt-2 font-medium leading-relaxed">Your creative pipeline is waiting. Ready to start something amazing?</p>
                                    <button className="premium-btn mt-8">Create New Project</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="space-y-8">
                    <div className="glass-card p-10 shadow-premium">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                                <Activity size={20} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight">Timeline</h3>
                        </div>
                        <div className="space-y-8 relative before:absolute before:left-[23px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60 before:rounded-full">
                            {activities.map((activity, i) => {
                                const Icon = activity.type === 'project' ? FolderKanban : activity.type === 'payment' ? CreditCard : activity.type === 'task' ? Activity : Users;
                                const color = activity.type === 'project' ? 'text-primary' : activity.type === 'payment' ? 'text-success' : activity.type === 'task' ? 'text-accent' : 'text-secondary';
                                const bgColor = activity.type === 'project' ? 'bg-primary/10' : activity.type === 'payment' ? 'bg-success/10' : activity.type === 'task' ? 'bg-accent/10' : 'bg-secondary/10';
                                return (
                                    <motion.div
                                        key={activity.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 + (i * 0.1) }}
                                        className="relative flex gap-6 pl-12"
                                    >
                                        <div className={`absolute left-0 w-12 h-12 rounded-2xl ${bgColor} border-2 border-white shadow-sm flex items-center justify-center z-10 ${color}`}>
                                            <Icon size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="pt-1">
                                            <p className="text-base font-bold leading-tight text-text-main group-hover:text-primary transition-colors">{activity.title}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <p className="text-xs font-bold text-muted/60 uppercase tracking-widest">{new Date(activity.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                                                <span className="w-1 h-1 bg-border rounded-full" />
                                                <p className="text-[10px] font-black uppercase tracking-widest bg-border/40 px-2 py-0.5 rounded text-muted">{activity.type}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                        <button className="secondary-btn w-full mt-12 text-xs font-black uppercase tracking-widest border-2">
                            View Activity Logs
                        </button>
                    </div>

                    <div className="glass-card p-10 bg-gradient-to-br from-primary to-indigo-600 border-none shadow-premium relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:rotate-12 transition-transform duration-700">
                            <ArrowUpRight size={120} strokeWidth={3} />
                        </div>
                        <div className="relative z-10 text-white">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-8 border border-white/20">
                                <ArrowUpRight size={28} strokeWidth={3} />
                            </div>
                            <h4 className="text-2xl font-black tracking-tight mb-4 leading-tight">Elevate Your Studio Performance</h4>
                            <p className="text-sm font-medium text-white/80 mb-8 leading-relaxed">Get access to custom reports, advanced AI insights, and unlimited cloud storage.</p>
                            <button className="w-full bg-white text-primary font-black text-xs py-4 rounded-2xl shadow-xl shadow-black/10 hover:bg-indigo-50 transition-colors uppercase tracking-widest">Upgrade to Platinum</button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default Dashboard;

