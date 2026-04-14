import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, X, Search, Wallet, ClipboardCheck, MoreHorizontal, BarChart3, ArrowRight } from 'lucide-react';
import { supabase, logActivity } from '../lib/supabase';
import type { Payment, Project, Client } from '../lib/supabase';
import { useToast } from '../components/Toast';

const Payments: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ project_id: '', client_id: '', amount: 0, status: 'pending' as Payment['status'], due_date: '' });
    const toast = useToast();

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: payData, error: payError } = await supabase.from('payments').select('*').order('due_date', { ascending: true });
            const { data: projData, error: projError } = await supabase.from('projects').select('*');
            const { data: clientData, error: clientError } = await supabase.from('clients').select('*');

            if (payError || projError || clientError) {
                toast.error('Failed to load payments');
                return;
            }

            if (payData) setPayments(payData);
            if (projData) setProjects(projData);
            if (clientData) setClients(clientData);
        } catch (err) {
            toast.error('An unexpected error occurred');
            console.error('Payments error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreatePayment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.project_id || !formData.client_id) {
            toast.error('Please select both project and client');
            return;
        }

        if (formData.amount <= 0) {
            toast.error('Amount must be greater than 0');
            return;
        }

        try {
            const { error } = await supabase.from('payments').insert([formData]);
            if (error) {
                toast.error('Failed to record payment');
                return;
            }

            toast.success('Payment recorded successfully!');
            setIsModalOpen(false);
            setFormData({ project_id: '', client_id: '', amount: 0, status: 'pending', due_date: '' });
            fetchData();
            logActivity({
                type: 'payment',
                action: 'created',
                entity_id: formData.project_id,
                title: `Recorded payment: $${formData.amount} for ${getProjectName(formData.project_id)}`,
                metadata: { amount: formData.amount, project_id: formData.project_id }
            });
        } catch (err) {
            toast.error('An unexpected error occurred');
            console.error('Create payment error:', err);
        }
    };

    const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown Project';
    const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Unknown Client';

    const totalRevenue = payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0);
    const pendingRevenue = payments.filter(p => p.status === 'pending').reduce((acc, p) => acc + p.amount, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-16 pb-24"
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 mb-16">
                <div className="space-y-1">
                    <h1 className="text-6xl font-black tracking-tight text-slate-800 leading-none">Revenue</h1>
                    <p className="text-slate-400 text-lg font-medium max-w-2xl">
                        Orchestrating financial flow across all creative ventures and partnerships.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto items-center">
                    <div className="relative flex-1 md:w-[400px] group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" opacity={0.6} />
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all rounded-full font-medium text-sm text-slate-600 placeholder:text-slate-400 placeholder:font-normal"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-3 px-8 py-4 bg-blue-600 rounded-2xl hover:bg-blue-700 text-white font-bold transition-all shadow-xl shadow-blue-200 group grow sm:grow-0"
                    >
                        <Plus size={18} strokeWidth={3} />
                        <span className="font-black uppercase tracking-widest text-[11px]">Record Transaction</span>
                    </button>
                </div>
            </header>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-8 p-10 bg-slate-50 border border-slate-100 rounded-[2.5rem] group hover:bg-white hover:shadow-xl transition-all duration-500"
                >
                    <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <Wallet size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-1">Accumulated Yield</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-black text-slate-800 tracking-tight">${Math.floor(totalRevenue).toLocaleString()}</span>
                            <span className="text-xl font-bold text-blue-300">.{(totalRevenue % 1).toFixed(2).split('.')[1]}</span>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-8 p-10 bg-slate-50 border border-slate-100 rounded-[2.5rem] group hover:bg-white hover:shadow-xl transition-all duration-500"
                >
                    <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                        <ClipboardCheck size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em] mb-1">Pending Pipeline</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-black text-slate-800 tracking-tight">${Math.floor(pendingRevenue).toLocaleString()}</span>
                            <span className="text-xl font-bold text-blue-300">.{(pendingRevenue % 1).toFixed(2).split('.')[1]}</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden mb-16">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50">
                                <th className="px-10 py-6 font-bold text-[10px] uppercase tracking-[0.2em] text-blue-300">Creative Venture</th>
                                <th className="px-10 py-6 font-bold text-[10px] uppercase tracking-[0.2em] text-blue-300">Partner Entity</th>
                                <th className="px-10 py-6 font-bold text-[10px] uppercase tracking-[0.2em] text-blue-300">Financial Value</th>
                                <th className="px-10 py-6 font-bold text-[10px] uppercase tracking-[0.2em] text-blue-300">Maturity Date</th>
                                <th className="px-10 py-6 font-bold text-[10px] uppercase tracking-[0.2em] text-blue-300">Resolution</th>
                                <th className="px-10 py-6 font-bold text-[10px] uppercase tracking-[0.2em] text-blue-300 text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3, 4].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-10 py-12" colSpan={6}><div className="h-10 bg-border/20 rounded-3xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : payments.length > 0 ? (
                                payments.map(payment => (
                                    <tr key={payment.id} className="hover:bg-slate-50 transition-all duration-300 group">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100/50">
                                                    {getProjectName(payment.project_id).charAt(0).toLowerCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-lg text-slate-800 leading-tight">
                                                        {getProjectName(payment.project_id).toLowerCase()}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">AX-2024-{payment.id.slice(0, 3).toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className="text-slate-500 font-bold text-sm">{getClientName(payment.client_id)}</span>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className="font-bold text-slate-800 text-lg">${payment.amount.toLocaleString()}.00</span>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className="text-slate-400 font-bold text-sm">
                                                {new Date(payment.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className={`inline-flex px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${payment.status === 'paid' ? 'bg-blue-50 text-blue-500 border border-blue-100' : 'bg-rose-50 text-rose-500 border border-rose-100'}`}>
                                                {payment.status === 'paid' ? 'PAID' : 'PENDING'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                                                <MoreHorizontal size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="p-32 text-center" colSpan={6}>
                                        <div className="flex flex-col items-center max-w-sm mx-auto">
                                            <div className="w-24 h-24 bg-primary/5 rounded-[32px] flex items-center justify-center text-primary/20 mb-8">
                                                <DollarSign size={48} strokeWidth={1} />
                                            </div>
                                            <h3 className="text-3xl font-black mb-4 tracking-tight text-slate-900">No financial records</h3>
                                            <p className="text-slate-400 font-medium mb-12 leading-relaxed italic text-center">Your ledger is currently empty. Transactions will appear here once recorded.</p>
                                            <button
                                                onClick={() => setIsModalOpen(true)}
                                                className="flex items-center gap-3 px-10 py-5 bg-white border-2 border-slate-900 rounded-2xl hover:bg-slate-50 transition-all shadow-[6px_6px_0px_#111827] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                                            >
                                                <Plus size={20} className="text-slate-900" strokeWidth={3} />
                                                <span className="font-black uppercase tracking-widest text-xs text-slate-900">Record Initial Payment</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-blue-50/50 border border-blue-100/50 rounded-[2.5rem] p-10 flex items-center justify-between group">
                    <div className="space-y-4 max-w-sm">
                        <h4 className="text-2xl font-black text-slate-800 tracking-tight">Financial Mastery</h4>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            Detailed fiscal reporting for the fiscal year 2024 is now available for download.
                        </p>
                        <button className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest pt-2 group-hover:gap-4 transition-all" type="button">
                            Generate Report <ArrowRight size={14} strokeWidth={3} />
                        </button>
                    </div>
                    <div className="w-24 h-24 bg-blue-100/50 rounded-2xl flex items-center justify-center text-blue-300">
                        <BarChart3 size={48} strokeWidth={1.5} />
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="glass-card p-10 w-full max-w-lg shadow-2xl relative overflow-hidden bg-bg-card rounded-[40px] border-none"
                        >
                            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary to-indigo-600" />
                            <div className="flex justify-between items-center mb-10">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black tracking-tight">Financial Input</h2>
                                    <p className="text-muted text-sm font-medium">Register a new transaction in your studio records.</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="bg-primary/5 p-3 rounded-2xl text-muted hover:text-accent hover:bg-accent/5 transition-all"><X size={24} strokeWidth={2.5} /></button>
                            </div>
                            <form onSubmit={handleCreatePayment} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Creative Venture</label>
                                    <select
                                        className="py-4 px-6 rounded-2xl text-lg font-bold bg-bg-card/70 border-2 border-border focus:border-primary/30 transition-all outline-none"
                                        value={formData.project_id}
                                        onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Select an active venture</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Partner Entity</label>
                                    <select
                                        className="py-4 px-6 rounded-2xl text-lg font-bold bg-bg-card/70 border-2 border-border focus:border-primary/30 transition-all outline-none"
                                        value={formData.client_id}
                                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Identify client partner</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Value ($)</label>
                                        <input
                                            type="number"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                                            className="py-4 px-6 rounded-2xl text-lg font-bold"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Maturity</label>
                                        <input
                                            type="date"
                                            value={formData.due_date}
                                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                            className="py-4 px-6 rounded-2xl text-lg font-bold"
                                            required
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="premium-btn w-full py-5 rounded-2xl shadow-premium mt-4 text-sm font-black uppercase tracking-[0.2em]">
                                    Initialize Transaction
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default Payments;
