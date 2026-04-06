import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Moon, Sun, Monitor, Save, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';

const Settings: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState('light');
    const toast = useToast();
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setLoading(false);
        };
        fetchUser();

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(currentTheme);
    }, []);

    const updateTheme = (newTheme: string) => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        toast.success(`Theme changed to ${newTheme} mode`);
    };

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
            toast.success('Signed out successfully');
            navigate('/');
        } catch (err) {
            toast.error('Failed to sign out');
        }
    };

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            toast.success('Settings saved successfully!');
        }, 1000);
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
                {/* Navigation */}
                <div className="lg:col-span-1 space-y-3">
                    {[
                        { label: 'Profile Identity', icon: User, active: true },
                        { label: 'Audit Logs', icon: Bell, active: false },
                        { label: 'Encryption', icon: Shield, active: false },
                        { label: 'Visual Interface', icon: Monitor, active: false },
                    ].map(item => (
                        <button
                            key={item.label}
                            className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all duration-300 ${item.active ? 'bg-primary text-white shadow-premium scale-[1.02]' : 'hover:bg-primary/5 text-muted hover:text-primary'}`}
                        >
                            <item.icon size={20} strokeWidth={2.5} />
                            <span className="font-black text-xs uppercase tracking-widest">{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="lg:col-span-3 space-y-10">
                    <section className="glass-card p-10 space-y-8 bg-white shadow-premium rounded-[32px]">
                        <div className="flex items-center gap-3 border-b border-border pb-6">
                            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                <User size={20} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight">Personal Identity</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Validated Email</label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="py-4 px-6 rounded-2xl text-lg font-bold bg-primary/[0.02] border-2 border-primary/10 cursor-not-allowed opacity-60"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Legal Name</label>
                                <input type="text" placeholder="John Doe" className="py-4 px-6 rounded-2xl text-lg font-bold" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Professional Title</label>
                                <input type="text" placeholder="Creative Director" className="py-4 px-6 rounded-2xl text-lg font-bold" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Studio Association</label>
                                <input type="text" placeholder="Aonix Media" className="py-4 px-6 rounded-2xl text-lg font-bold" />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-border mt-10">
                            <button onClick={handleSignOut} className="px-8 py-4 bg-accent/5 text-accent text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-accent hover:text-white transition-all transform hover:scale-[1.02] flex items-center gap-3 justify-center">
                                <LogOut size={18} strokeWidth={2.5} />
                                Terminate Session
                            </button>
                            <button onClick={handleSave} disabled={saving} className="premium-btn px-10 py-4 rounded-2xl shadow-premium uppercase tracking-[0.2em] text-[10px] font-black flex items-center gap-3 justify-center">
                                <Save size={18} strokeWidth={2.5} />
                                {saving ? 'Compiling...' : 'Synchronize Settings'}
                            </button>
                        </div>
                    </section>

                    <section className="glass-card p-10 space-y-8 bg-white shadow-premium rounded-[32px]">
                        <div className="flex items-center gap-3 border-b border-border pb-6">
                            <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                                <Monitor size={20} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight">Visual Interface</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { id: 'light', label: 'Luminous Mode', icon: Sun, description: 'Optimized for high-energy creative sessions' },
                                { id: 'dark', label: 'Nocturnal Mode', icon: Moon, description: 'Deep focus aesthetics for low-light environments' },
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => updateTheme(item.id)}
                                    className={`flex items-center gap-6 p-8 rounded-3xl border-2 transition-all duration-500 group relative overflow-hidden ${theme === item.id ? 'border-primary bg-primary/[0.02] shadow-premium shadow-primary/10' : 'border-border/60 bg-white hover:border-primary/30 hover:bg-primary/[0.01]'}`}
                                    aria-label={`Set ${item.label} theme`}
                                    aria-pressed={theme === item.id}
                                >
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${theme === item.id ? 'bg-primary text-white rotate-6' : 'bg-primary/5 text-primary group-hover:rotate-6'}`}>
                                        <item.icon size={32} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-left">
                                        <span className="font-black text-lg block tracking-tight">{item.label}</span>
                                        <span className="text-xs font-bold text-muted leading-tight block mt-1">{item.description}</span>
                                    </div>
                                    {theme === item.id && (
                                        <div className="absolute top-4 right-4">
                                            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </motion.div>
    );
};

export default Settings;
