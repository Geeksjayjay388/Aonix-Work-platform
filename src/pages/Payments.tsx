import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, X, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
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

    const markAsPaid = async (id: string) => {
        try {
            const { error } = await supabase.from('payments').update({ status: 'paid' }).eq('id', id);
            if (error) {
                toast.error('Failed to update payment status');
                return;
            }

            toast.success('Payment marked as paid!');
            fetchData();
            const payment = payments.find(p => p.id === id);
            if (payment) {
                logActivity({
                    type: 'payment',
                    action: 'updated',
                    entity_id: payment.project_id,
                    title: `Payment paid: $${payment.amount} for ${getProjectName(payment.project_id)}`,
                    metadata: { amount: payment.amount, status: 'paid' }
                });
            }
        } catch (err) {
            toast.error('Failed to update payment');
            console.error('Mark paid error:', err);
        }
    };

    const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown Project';
    const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Unknown Client';

    const getStatusIcon = (status: Payment['status']) => {
        switch (status) {
            case 'paid': return <CheckCircle2 className="text-success" size={16} />;
            case 'overdue': return <AlertCircle className="text-accent" size={16} />;
            default: return <Clock className="text-primary" size={16} />;
        }
    };

    const totalRevenue = payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0);
    const pendingRevenue = payments.filter(p => p.status === 'pending').reduce((acc, p) => acc + p.amount, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-16 pb-24"
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="space-y-1">
                    <h1 className="text-5xl font-extrabold tracking-tight text-text-main">Revenue</h1>
                    <p className="text-muted text-lg font-medium">Monitoring your financial performance and transaction volume.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="premium-btn gap-4 py-5 px-10 rounded-[2rem] shadow-premium"
                >
                    <Plus size={22} strokeWidth={3} />
                    <span className="font-black uppercase tracking-[0.2em] text-[11px]">Record Transaction</span>
                </button>
            </header>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card p-10 flex items-center gap-8 border-l-[16px] border-success bg-white/40 shadow-premium rounded-[3rem] group hover:scale-[1.02] transition-all duration-500"
                >
                    <div className="w-20 h-20 bg-success/10 rounded-[1.5rem] flex items-center justify-center text-success group-hover:bg-success group-hover:text-white transition-all duration-500 shadow-xl shadow-success/10 border border-white/20">
                        <DollarSign size={36} strokeWidth={3} />
                    </div>
                    <div>
                        <p className="text-muted text-[10px] font-black uppercase tracking-[0.25em] mb-2">Accumulated Yield</p>
                        <h3 className="text-5xl font-extrabold tracking-tight text-text-main leading-none">${totalRevenue.toLocaleString()}</h3>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card p-10 flex items-center gap-8 border-l-[16px] border-primary bg-white/40 shadow-premium rounded-[3rem] group hover:scale-[1.02] transition-all duration-500"
                >
                    <div className="w-20 h-20 bg-primary/10 rounded-[1.5rem] flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-xl shadow-primary/10 border border-white/20">
                        <Clock size={36} strokeWidth={3} />
                    </div>
                    <div>
                        <p className="text-muted text-[10px] font-black uppercase tracking-[0.25em] mb-2">Pending Pipeline</p>
                        <h3 className="text-5xl font-extrabold tracking-tight text-text-main leading-none">${pendingRevenue.toLocaleString()}</h3>
                    </div>
                </motion.div>
            </div>

            <div className="glass-card overflow-hidden bg-white/40 backdrop-blur-xl shadow-premium border-none rounded-[3.5rem] p-4">

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-primary/[0.03] border-b border-border">
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.25em] text-primary/60">Creative Venture</th>
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.25em] text-primary/60">Partner Entity</th>
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.25em] text-primary/60">Financial Value</th>
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.25em] text-primary/60">Maturity Date</th>
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.25em] text-primary/60">Resolution Status</th>
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.25em] text-primary/60 text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {loading ? (
                                [1, 2, 3, 4].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-10 py-8" colSpan={6}><div className="h-6 bg-border/40 rounded-xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : payments.length > 0 ? (
                                payments.map(payment => (
                                    <tr key={payment.id} className="hover:bg-primary/[0.01] transition-all duration-300 group">
                                        <td className="px-10 py-8 font-black text-lg tracking-tight text-text-main">{getProjectName(payment.project_id)}</td>
                                        <td className="px-10 py-8 text-muted font-bold">{getClientName(payment.client_id)}</td>
                                        <td className="px-10 py-8 font-black text-primary text-xl tracking-tighter">${payment.amount.toLocaleString()}</td>
                                        <td className="px-10 py-8 text-muted font-bold">{new Date(payment.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                        <td className="px-10 py-8">
                                            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${payment.status === 'paid' ? 'bg-success/10 text-success' : payment.status === 'overdue' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                                                {getStatusIcon(payment.status)}
                                                {payment.status}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            {payment.status !== 'paid' && (
                                                <button
                                                    onClick={() => markAsPaid(payment.id)}
                                                    className="px-6 py-3 bg-success/10 text-success text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-success hover:text-white transition-all shadow-sm"
                                                >
                                                    Finalize Payment
                                                </button>
                                            )}
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
                                            <h3 className="text-2xl font-black mb-3 tracking-tight">No financial records</h3>
                                            <p className="text-muted font-medium mb-10 leading-relaxed italic text-center">Your ledger is currently empty. Transactions will appear here once recorded.</p>
                                            <button
                                                onClick={() => setIsModalOpen(true)}
                                                className="premium-btn py-4 px-10 rounded-2xl shadow-premium"
                                            >
                                                Record Initial Payment
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
                            className="glass-card p-10 w-full max-w-lg shadow-2xl relative overflow-hidden bg-white rounded-[40px] border-none"
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
                                        className="py-4 px-6 rounded-2xl text-lg font-bold bg-white/50 border-2 border-border focus:border-primary/30 transition-all outline-none"
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
                                        className="py-4 px-6 rounded-2xl text-lg font-bold bg-white/50 border-2 border-border focus:border-primary/30 transition-all outline-none"
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
