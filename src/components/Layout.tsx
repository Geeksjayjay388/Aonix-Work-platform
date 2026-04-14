import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    FolderKanban,
    CreditCard,
    Plus,
    User,
    ListChecks,
    MessageSquare,
    Menu,
    X,
    LogOut,
    Sun,
    Moon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { getResolvedProfile } from '../lib/profile';
import logoPurple from '../assets/logopurple.png';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDark, setIsDark] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<'dev' | 'designer'>('dev');
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const messagesTableMissingRef = useRef(false);
    const baseTitleRef = useRef((document.title || 'Aonix Platform').replace(/^\(\d+\)\s*/, ''));
    const navigate = useNavigate();

    React.useEffect(() => {
        const loadUserData = async () => {
            const profile = await getResolvedProfile();
            if (!profile) return;
            setCurrentUserId(profile.id);
            setUserName(profile.legalName);
            setUserRole(profile.role);
        };

        loadUserData();

        const savedTheme = localStorage.getItem('theme');
        const startDark = savedTheme === 'dark';
        setIsDark(startDark);
        document.documentElement.setAttribute('data-theme', startDark ? 'dark' : 'light');

        const handleThemeChange = (event: Event) => {
            const customEvent = event as CustomEvent<'light' | 'dark'>;
            setIsDark(customEvent.detail === 'dark');
        };

        // Listen for profile updates
        const handleProfileUpdate = () => {
            const name = localStorage.getItem('profile_legal_name') || localStorage.getItem('profile_name');
            const role = (localStorage.getItem('profile_role') as 'dev' | 'designer') || 'dev';
            setUserName(name);
            setUserRole(role);
        };

        window.addEventListener('theme-change', handleThemeChange);
        window.addEventListener('storage', handleProfileUpdate);
        return () => {
            window.removeEventListener('theme-change', handleThemeChange);
            window.removeEventListener('storage', handleProfileUpdate);
        };
    }, []);

    // Track unread messages
    useEffect(() => {
        if (!currentUserId) return;

        const isMissingMessagesTableError = (error: unknown) => {
            if (!error || typeof error !== 'object') return false;
            const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
            const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
            return code === 'PGRST205' || message.includes('messages');
        };

        const getUnreadCount = async () => {
            if (messagesTableMissingRef.current) return;
            const lastReadAt = localStorage.getItem(`messages_last_read_at_${currentUserId}`) || new Date(0).toISOString();
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .neq('sender_id', currentUserId)
                .gt('created_at', lastReadAt);
            if (error) {
                if (isMissingMessagesTableError(error)) {
                    messagesTableMissingRef.current = true;
                    setUnreadCount(0);
                    return;
                }
                console.error('Error loading unread messages:', error);
                return;
            }
            setUnreadCount(count || 0);
        };

        getUnreadCount();

        const subscription = supabase
            .channel(`unread_${currentUserId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, (payload) => {
                if (messagesTableMissingRef.current) return;
                const message = payload.new as { sender_id?: string };
                if (message.sender_id !== currentUserId) {
                    getUnreadCount();
                }
            })
            .subscribe();

        const handleMessagesRead = () => {
            getUnreadCount();
        };
        window.addEventListener('messages-read', handleMessagesRead);

        return () => {
            window.removeEventListener('messages-read', handleMessagesRead);
            subscription.unsubscribe();
        };
    }, [currentUserId]);

    useEffect(() => {
        document.title = unreadCount > 0
            ? `(${unreadCount}) ${baseTitleRef.current}`
            : baseTitleRef.current;
    }, [unreadCount]);

    const toggleTheme = () => {
        const nextIsDark = !isDark;
        setIsDark(nextIsDark);
        const nextTheme = nextIsDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('theme', nextTheme);
        window.dispatchEvent(new CustomEvent('theme-change', { detail: nextTheme }));
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
        { to: '/messages', icon: MessageSquare, label: 'Messages', badge: unreadCount > 0 ? unreadCount : undefined },
    ];

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className="flex flex-col mb-12 px-2">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Aonix Studios</h2>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Creative Workspace</span>
            </div>

            <nav className="space-y-1 flex-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) =>
                            `flex items-center justify-between group p-3 px-4 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-blue-50/50 text-blue-600'
                                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <div className="flex items-center gap-4">
                                <item.icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
                                <span className={`font-bold text-sm ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>{item.label}</span>
                                {typeof item.badge === 'number' && item.badge > 0 && (
                                    <span className="bg-rose-500 text-white text-[10px] font-black rounded-full px-2 py-0.5 ml-2">
                                        {item.badge}
                                    </span>
                                )}
                            </div>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="mt-auto px-2 pb-6 flex flex-col gap-6">
                <button
                    onClick={() => navigate('/projects?new=true')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200"
                >
                    <Plus size={20} strokeWidth={3} />
                    <span>New Project</span>
                </button>

                <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                        <User className="text-white" size={24} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-slate-800 truncate">{userName || 'Jacob Sterling'}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{userRole === 'designer' ? 'Lead Designer' : 'Lead Developer'}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-4 ml-auto">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen transition-colors duration-500 overflow-hidden relative">
            <div className="mesh-bg" />

            {/* Desktop Sidebar */}
            <aside className="w-80 hidden lg:block p-8 fixed top-0 bottom-0 left-0 z-40 bg-[#F9FAFB] border-r border-slate-100">
                <SidebarContent />
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-20 p-4 flex items-center justify-between z-50">
                <div className="glass-card flex-1 h-full px-6 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                        <img src={logoPurple} alt="Aonix logo" className="w-9 h-9 object-contain" />
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
