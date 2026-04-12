import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Moon, Sun, Monitor, Save, LogOut, RefreshCw, Clock4 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Activity } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getResolvedProfile, upsertCurrentUserProfile } from '../lib/profile';

type SettingsSection = 'profile' | 'logs' | 'security' | 'appearance';

const Settings: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialSection = (searchParams.get('tab') as SettingsSection) || 'profile';
    const [user, setUser] = useState<{ email?: string | undefined } | null>(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'light');
    const [legalName, setLegalName] = useState(() => localStorage.getItem('profile_legal_name') || '');
    const [title, setTitle] = useState(() => localStorage.getItem('profile_title') || '');
    const [studio, setStudio] = useState(() => localStorage.getItem('profile_studio') || '');
    const [role, setRole] = useState<'dev' | 'designer'>(() => (localStorage.getItem('profile_role') as 'dev' | 'designer') || 'dev');
    const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    const sectionItems = useMemo(() => ([
        { key: 'profile' as const, label: 'Profile Identity', icon: User },
        { key: 'logs' as const, label: 'Audit Logs', icon: Bell },
        { key: 'security' as const, label: 'Encryption', icon: Shield },
        { key: 'appearance' as const, label: 'Visual Interface', icon: Monitor },
    ]), []);

    const fetchActivities = async () => {
        setLogsLoading(true);
        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            toast.error(`Failed to load logs: ${error.message}`);
            setLogsLoading(false);
            return;
        }

        setActivities(data || []);
        setLogsLoading(false);
    };

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user ? { email: user.email } : null);
            const profile = await getResolvedProfile();
            if (profile) {
                setLegalName(profile.legalName);
                setRole(profile.role);
                setTitle(profile.title);
                setStudio(profile.studio);
            }
            setLoading(false);
        };
        fetchUser();

        const handleThemeChange = (event: Event) => {
            const customEvent = event as CustomEvent<'light' | 'dark'>;
            setTheme(customEvent.detail);
        };

        window.addEventListener('theme-change', handleThemeChange);
        return () => window.removeEventListener('theme-change', handleThemeChange);
    }, [toast]);

    useEffect(() => {
        const tab = searchParams.get('tab') as SettingsSection | null;
        if (tab && ['profile', 'logs', 'security', 'appearance'].includes(tab)) {
            setActiveSection(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        if (activeSection === 'logs') {
            fetchActivities();
        }
    }, [activeSection]);

    const updateTheme = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        window.dispatchEvent(new CustomEvent('theme-change', { detail: newTheme }));
        toast.success(`Theme changed to ${newTheme} mode`);
    };

    const changeSection = (section: SettingsSection) => {
        setActiveSection(section);
        setSearchParams({ tab: section });
    };

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error(`Failed to sign out: ${error.message}`);
            return;
        }
        toast.success('Signed out successfully');
        navigate('/');
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await upsertCurrentUserProfile({
            legalName,
            role,
            title,
            studio,
        });

        localStorage.setItem('profile_legal_name', legalName);
        localStorage.setItem('profile_title', title);
        localStorage.setItem('profile_studio', studio);
        localStorage.setItem('profile_role', role);
        setSaving(false);

        if (error) {
            toast.error(`Failed to save profile: ${error.message}`);
            return;
        }
        toast.success('Settings saved successfully!');
    };

    if (loading) return <div className="p-8 text-center text-muted">Loading settings...</div>;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-12 pb-16"
        >
            <header>
                <h1 className="text-4xl font-black tracking-tight mb-2 text-text-main">System Configuration</h1>
                <p className="text-muted text-lg font-medium">Fine-tune your workspace environment and security protocols.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                <div className="lg:col-span-1 space-y-3">
                    {sectionItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => changeSection(item.key)}
                            className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all duration-300 ${activeSection === item.key ? 'bg-primary text-white shadow-premium scale-[1.02]' : 'hover:bg-primary/5 text-muted hover:text-primary'}`}
                        >
                            <item.icon size={20} strokeWidth={2.5} />
                            <span className="font-semibold text-xs uppercase tracking-widest">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="lg:col-span-3 space-y-10">
                    {activeSection === 'profile' && (
                        <section className="glass-card p-10 space-y-8 bg-white shadow-premium rounded-[32px]">
                            <div className="flex items-center gap-3 border-b border-border pb-6">
                                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                    <User size={20} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-semibold tracking-tight">Personal Identity</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-semibold text-primary uppercase tracking-[0.2em]">Validated Email</label>
                                    <input
                                        type="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="py-4 px-6 rounded-2xl text-lg font-medium bg-primary/[0.02] border-2 border-primary/10 cursor-not-allowed opacity-60"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-semibold text-primary uppercase tracking-[0.2em]">Legal Name *</label>
                                    <input type="text" placeholder="Your name" className="py-4 px-6 rounded-2xl text-lg font-medium" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
                                    <p className="text-[10px] text-muted">Required for messaging</p>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-semibold text-primary uppercase tracking-[0.2em]">Professional Title</label>
                                    <input type="text" placeholder="Creative Director" className="py-4 px-6 rounded-2xl text-lg font-medium" value={title} onChange={(event) => setTitle(event.target.value)} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-semibold text-primary uppercase tracking-[0.2em]">Role</label>
                                    <select value={role} onChange={(e) => setRole(e.target.value as 'dev' | 'designer')} className="py-4 px-6 rounded-2xl text-lg font-medium">
                                        <option value="dev">Developer</option>
                                        <option value="designer">Designer</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-semibold text-primary uppercase tracking-[0.2em]">Studio Association</label>
                                    <input type="text" placeholder="Aonix Media" className="py-4 px-6 rounded-2xl text-lg font-medium" value={studio} onChange={(event) => setStudio(event.target.value)} />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-border mt-10">
                                <button onClick={handleSignOut} className="px-8 py-4 bg-accent/5 text-accent text-[10px] font-semibold uppercase tracking-widest rounded-2xl hover:bg-accent hover:text-white transition-all transform hover:scale-[1.02] flex items-center gap-3 justify-center">
                                    <LogOut size={18} strokeWidth={2.5} />
                                    Terminate Session
                                </button>
                                <button onClick={handleSave} disabled={saving} className="premium-btn px-10 py-4 rounded-2xl shadow-premium uppercase tracking-[0.2em] text-[10px] font-semibold flex items-center gap-3 justify-center">
                                    <Save size={18} strokeWidth={2.5} />
                                    {saving ? 'Compiling...' : 'Synchronize Settings'}
                                </button>
                            </div>
                        </section>
                    )}

                    {activeSection === 'logs' && (
                        <section className="glass-card p-10 space-y-8 bg-white shadow-premium rounded-[32px]">
                            <div className="flex items-center justify-between gap-4 border-b border-border pb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                                        <Bell size={20} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-2xl font-semibold tracking-tight">Audit Logs</h3>
                                </div>
                                <button onClick={fetchActivities} className="secondary-btn flex items-center gap-2 py-2.5 px-4 text-xs uppercase tracking-widest">
                                    <RefreshCw size={14} />
                                    Refresh
                                </button>
                            </div>

                            {logsLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3, 4].map((value) => <div key={value} className="h-16 skeleton rounded-xl" />)}
                                </div>
                            ) : activities.length > 0 ? (
                                <div className="space-y-3">
                                    {activities.map((activity) => (
                                        <div key={activity.id} className="glass-card p-4 bg-white/60 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-semibold">{activity.title}</p>
                                                <p className="text-xs uppercase tracking-widest text-muted mt-1">{activity.type} · {activity.action}</p>
                                            </div>
                                            <div className="text-[11px] text-muted flex items-center gap-1 shrink-0">
                                                <Clock4 size={12} />
                                                {new Date(activity.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-muted bg-primary/5 border border-primary/10 rounded-xl p-4">
                                    No logs found yet. Actions like creating projects, tasks, clients, and payments will appear here.
                                </div>
                            )}
                        </section>
                    )}

                    {activeSection === 'security' && (
                        <section className="glass-card p-10 space-y-8 bg-white shadow-premium rounded-[32px]">
                            <div className="flex items-center gap-3 border-b border-border pb-6">
                                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                                    <Shield size={20} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-semibold tracking-tight">Encryption</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="glass-card p-5 bg-white/60">
                                    <p className="font-semibold">Authenticated access</p>
                                    <p className="text-sm text-muted mt-1">Workspace data is scoped to authenticated Supabase sessions.</p>
                                </div>
                                <div className="glass-card p-5 bg-white/60">
                                    <p className="font-semibold">Audit visibility</p>
                                    <p className="text-sm text-muted mt-1">Operational events are tracked in audit logs for timeline review.</p>
                                </div>
                            </div>
                        </section>
                    )}

                    {activeSection === 'appearance' && (
                        <section className="glass-card p-10 space-y-8 bg-white shadow-premium rounded-[32px]">
                            <div className="flex items-center gap-3 border-b border-border pb-6">
                                <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                                    <Monitor size={20} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-semibold tracking-tight">Visual Interface</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { id: 'light', label: 'Luminous Mode', icon: Sun, description: 'Optimized for high-energy creative sessions' },
                                    { id: 'dark', label: 'Nocturnal Mode', icon: Moon, description: 'Deep focus aesthetics for low-light environments' },
                                ].map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => updateTheme(item.id as 'light' | 'dark')}
                                        className={`flex items-center gap-6 p-8 rounded-3xl border-2 transition-all duration-500 group relative overflow-hidden ${theme === item.id ? 'border-primary bg-primary/[0.02] shadow-premium shadow-primary/10' : 'border-border/60 bg-white hover:border-primary/30 hover:bg-primary/[0.01]'}`}
                                        aria-label={`Set ${item.label} theme`}
                                        aria-pressed={theme === item.id}
                                    >
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${theme === item.id ? 'bg-primary text-white rotate-6' : 'bg-primary/5 text-primary group-hover:rotate-6'}`}>
                                            <item.icon size={32} strokeWidth={2.5} />
                                        </div>
                                        <div className="text-left">
                                            <span className="font-semibold text-lg block tracking-tight">{item.label}</span>
                                            <span className="text-xs font-medium text-muted leading-tight block mt-1">{item.description}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default Settings;
