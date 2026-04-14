import React, { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Mail, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import logoPurple from '../assets/logopurple.png';

export const Auth: React.FC<{ onSession: (session: Session | null) => void }> = ({ onSession }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data, error } = isLogin
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });

        if (error) {
            setError(error.message);
        } else {
            onSession(data.session);
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-main">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8 w-full max-w-md"
            >
                <div className="flex flex-col items-center mb-8">
                    <img src={logoPurple} alt="Aonix logo" className="w-14 h-14 rounded-xl object-cover mb-4 shadow-sm" />
                    <h1 className="text-2xl font-bold mb-1">Aonix Platform</h1>
                    <p className="text-muted text-sm">{isLogin ? 'Sign in to your account' : 'Create your account'}</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold mb-2">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-5 h-5 text-muted" />
                            <input
                                type="email"
                                placeholder="name@company.com"
                                className="pl-10"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-muted" />
                            <input
                                type="password"
                                placeholder="Enter your password"
                                className="pl-10"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-accent text-sm bg-accent/5 p-3 rounded-lg border border-accent/20">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-3.5 px-7 rounded-sm font-semibold tracking-tight flex items-center justify-center gap-3 overflow-hidden relative transition-all duration-200 hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-muted text-sm">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-primary font-semibold hover:underline bg-transparent p-0"
                        >
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Auth;
