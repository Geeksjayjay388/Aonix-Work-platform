import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    FolderKanban,
    CreditCard,
    LogOut,
    Moon,
    Sun,
    Settings as SettingsIcon,
    Menu,
    X,
    User,
    ListChecks,
    ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDark, setIsDark] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const navigate = useNavigate();

    React.useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserEmail(user.email ?? null);
        });
    }, []);

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.setAttribute('data-theme', !isDark ? 'dark' : 'light');
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/clients', icon: Users, label: 'Clients' },
        { to: '/projects', icon: FolderKanban, label: 'Projects' },
        { to: '/tasks', icon: ListChecks, label: 'Tasks' },
        { to: '/payments', icon: CreditCard, label: 'Payments' },
        { to: '/settings', icon: SettingsIcon, label: 'Settings' },
    ];

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 mb-10 px-2 group cursor-pointer">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
                    <span className="text-white font-black text-lg italic z-10">A</span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
                </div>
                <div className="flex flex-col">
                    <h2 className="text-xl font-black leading-none tracking-tighter">Aonix</h2>
                    <span className="text-[10px] text-primary font-extrabold uppercase tracking-[0.3em] mt-1">Studio</span>
                </div>
            </div>

            <nav className="space-y-1.5 flex-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) =>
                            `flex items-center justify-between group p-3.5 rounded-2xl transition-all duration-300 ${isActive
                                ? 'nav-active shadow-glow scale-[1.02]'
                                : 'text-muted hover:bg-primary/5 hover:text-primary hover:translate-x-1'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className="flex items-center gap-4">
                                    <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                                    <span className={`font-bold text-sm ${isActive ? 'tracking-tight' : ''}`}>{item.label}</span>
                                </div>
                                <ChevronRight size={14} className={`opacity-0 group-hover:opacity-40 transition-opacity duration-300`} />
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="mt-auto pt-6">
                <div className="glass-card p-4 mb-4 border-primary/10 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-primary/20 border border-white/20">
                            <User size={18} strokeWidth={2.5} />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-black truncate">{userEmail?.split('@')[0] || 'User'}</p>
                            <p className="text-[10px] text-muted truncate font-medium">{userEmail || 'designer@aonix.com'}</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={toggleTheme}
                        className="flex-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl text-muted hover:bg-glass-bg hover:text-primary hover:shadow-sm border border-transparent hover:border-glass-border transition-all duration-300 bg-transparent group"
                    >
                        {isDark ? <Sun size={18} className="group-hover:rotate-45 transition-transform" /> : <Moon size={18} className="group-hover:-rotate-12 transition-transform" />}
                        <span className="text-[9px] font-black uppercase tracking-widest">{isDark ? 'Light' : 'Dark'}</span>
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="flex-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl text-muted hover:bg-accent/5 hover:text-accent border border-transparent hover:border-accent/10 transition-all duration-300 bg-transparent group"
                    >
                        <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Exit</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen transition-colors duration-500 overflow-hidden relative">
            <div className="mesh-bg" />

            {/* Desktop Sidebar */}
            <aside className="w-72 hidden lg:block p-6 fixed top-0 bottom-0 left-0 z-40">
                <div className="glass-card h-full p-8 shadow-premium overflow-y-auto overflow-x-hidden custom-scrollbar">
                    <SidebarContent />
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-20 p-4 flex items-center justify-between z-50">
                <div className="glass-card flex-1 h-full px-6 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <span className="text-white font-black text-lg italic">A</span>
                        </div>
                        <h2 className="font-extrabold tracking-tighter text-lg">Aonix</h2>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2.5 hover:bg-primary/5 rounded-xl text-primary transition-colors bg-transparent border border-transparent hover:border-primary/10"
                    >
                        {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-2 bottom-2 left-2 w-[calc(100%-1rem)] max-w-sm glass-card p-8 z-50 lg:hidden shadow-2xl border-none"
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 lg:pl-72 min-h-screen transition-all duration-500 overflow-y-auto w-full relative">
                <div className="p-6 md:p-8 lg:p-12 mt-20 lg:mt-0 transition-all duration-500">
                    <div className="max-w-[1600px] mx-auto">
                        {children}
                    </div>
                </div>
            </main>

        </div>
    );
};

export default Layout;


