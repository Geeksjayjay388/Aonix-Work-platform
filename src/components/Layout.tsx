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
    ListChecks
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

    const activeStyle = "flex items-center gap-4 p-4 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 transition-all duration-300 transform scale-[1.02]";
    const inactiveStyle = "flex items-center gap-4 p-4 rounded-xl text-muted hover:bg-primary/5 hover:text-primary transition-all duration-300 hover:translate-x-1";

    const SidebarContent = () => (
        <>
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 mb-12 px-2">
                    <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="text-white font-black text-xl italic">A</span>
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black leading-tight tracking-tighter">Aonix</h2>
                        <span className="text-[11px] text-primary/60 font-bold uppercase tracking-[0.2em]">Platform</span>
                    </div>
                </div>

                <nav className="space-y-3 flex-1">
                    <NavLink to="/" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => isActive ? activeStyle : inactiveStyle}>
                        <LayoutDashboard size={22} strokeWidth={2.5} />
                        <span className="font-bold">Dashboard</span>
                    </NavLink>
                    <NavLink to="/clients" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => isActive ? activeStyle : inactiveStyle}>
                        <Users size={22} strokeWidth={2.5} />
                        <span className="font-bold">Clients</span>
                    </NavLink>
                    <NavLink to="/projects" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => isActive ? activeStyle : inactiveStyle}>
                        <FolderKanban size={22} strokeWidth={2.5} />
                        <span className="font-bold">Projects</span>
                    </NavLink>
                    <NavLink to="/tasks" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => isActive ? activeStyle : inactiveStyle}>
                        <ListChecks size={22} strokeWidth={2.5} />
                        <span className="font-bold">Tasks</span>
                    </NavLink>
                    <NavLink to="/payments" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => isActive ? activeStyle : inactiveStyle}>
                        <CreditCard size={22} strokeWidth={2.5} />
                        <span className="font-bold">Payments</span>
                    </NavLink>
                    <NavLink to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => isActive ? activeStyle : inactiveStyle}>
                        <SettingsIcon size={22} strokeWidth={2.5} />
                        <span className="font-bold">Settings</span>
                    </NavLink>
                </nav>

                <div className="mt-auto pt-8 border-t border-border">
                    <div className="bg-primary/5 rounded-2xl p-4 mb-6 border border-primary/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white border-2 border-white shadow-sm">
                                <User size={18} />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold truncate text-text-main">{userEmail?.split('@')[0] || 'User'}</p>
                                <p className="text-[10px] text-muted truncate">{userEmail || 'designer@aonix.com'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={toggleTheme}
                            className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl text-muted hover:bg-white hover:text-primary hover:shadow-sm transition-all duration-300 bg-transparent border border-transparent hover:border-border"
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            <span className="text-[10px] font-bold uppercase tracking-wider">{isDark ? 'Light' : 'Dark'}</span>
                        </button>

                        <button
                            onClick={handleSignOut}
                            className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl text-muted hover:bg-accent/5 hover:text-accent transition-all duration-300 bg-transparent border border-transparent hover:border-accent/10"
                        >
                            <LogOut size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Exit</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex min-h-screen bg-main transition-colors duration-500">
            {/* Desktop Sidebar */}
            <aside className="w-72 glass-card m-6 p-8 hidden lg:flex flex-col fixed top-0 bottom-0 left-0 z-40 border-none shadow-premium">
                <SidebarContent />
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 glass-card m-3 p-4 flex items-center justify-between z-50">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="text-white font-black text-lg italic">A</span>
                    </div>
                    <h2 className="font-extrabold tracking-tight">Aonix</h2>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 hover:bg-primary/5 rounded-xl text-primary transition-colors bg-transparent"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
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
                            className="fixed inset-0 bg-black/40 backdrop-blur-md z-40 lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 bottom-0 left-0 w-80 bg-card p-8 z-50 lg:hidden shadow-2xl border-r border-border"
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 lg:ml-80 p-6 md:p-12 mt-20 lg:mt-0 transition-all duration-500">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;

