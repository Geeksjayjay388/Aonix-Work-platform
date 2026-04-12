import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Search, Edit2, Trash2, X, AlertTriangle, Mail, Building2, User, Plus } from 'lucide-react';
import type { Client } from '../lib/supabase';
import { logActivity } from '../lib/supabase';
import { useSupabaseQuery, useSupabaseMutation } from '../lib/hooks';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const Clients: React.FC = () => {
    const { data: clients, loading, error, refetch } = useSupabaseQuery<Client>('clients', {
        order: { column: 'created_at', ascending: false }
    });

    const { insert, update, remove, loading: isMutating } = useSupabaseMutation('clients');
    const toast = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', company: '' });
    const [formErrors, setFormErrors] = useState({ name: '', email: '', company: '' });
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; clientId: string | null; clientName: string }>({
        isOpen: false,
        clientId: null,
        clientName: ''
    });

    const validateForm = () => {
        const errors = { name: '', email: '', company: '' };
        let isValid = true;

        if (!formData.name.trim()) {
            errors.name = 'Name is required';
            isValid = false;
        } else if (formData.name.length < 2) {
            errors.name = 'Name must be at least 2 characters';
            isValid = false;
        }

        if (!formData.email.trim()) {
            errors.email = 'Email is required';
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
            isValid = false;
        }

        setFormErrors(errors);
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('Please fix the errors in the form');
            return;
        }

        try {
            const { error: mutationError } = editingClient
                ? await update(editingClient.id, formData)
                : await insert(formData);

            if (mutationError) {
                toast.error(mutationError.message || 'Failed to save client');
                return;
            }

            toast.success(editingClient ? 'Client updated successfully!' : 'Client added successfully!');
            setIsModalOpen(false);
            setEditingClient(null);
            setFormData({ name: '', email: '', company: '' });
            setFormErrors({ name: '', email: '', company: '' });
            refetch();

            logActivity({
                type: 'client',
                action: editingClient ? 'updated' : 'created',
                entity_id: '',
                title: `${editingClient ? 'Updated' : 'Added'} client: ${formData.name}`,
                metadata: { client_name: formData.name, company: formData.company }
            });
        } catch (err) {
            toast.error('An unexpected error occurred');
            console.error('Error saving client:', err);
        }
    };

    const handleDeleteClick = (client: Client) => {
        setDeleteConfirm({
            isOpen: true,
            clientId: client.id,
            clientName: client.name
        });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm.clientId) return;

        try {
            const { error: deleteError } = await remove(deleteConfirm.clientId);
            if (deleteError) {
                toast.error('Failed to delete client');
                return;
            }

            toast.success('Client deleted successfully');
            refetch();
            setDeleteConfirm({ isOpen: false, clientId: null, clientName: '' });
        } catch (err) {
            toast.error('An unexpected error occurred');
            console.error('Error deleting client:', err);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-16 pb-24"
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
                <div className="space-y-1">
                    <h1 className="text-5xl font-extrabold tracking-tighter text-text-main">Partners</h1>
                    <p className="text-muted text-lg font-medium">Coordinate your global network and creative alliances.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto items-center">
                    <div className="relative flex-1 md:w-96 group">
                        <Search className="absolute left-5 top-5 w-5 h-5 text-muted group-focus-within:text-primary transition-all duration-300" />
                        <input
                            type="text"
                            placeholder="Search network..."
                            className="pl-14 py-5 bg-bg-card/70 border-2 border-border/60 focus:border-primary/30 transition-all rounded-[2rem] font-bold text-sm shadow-sm hover:shadow-md"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => { setEditingClient(null); setFormData({ name: '', email: '', company: '' }); setIsModalOpen(true); }}
                        className="premium-btn gap-4 py-5 px-10 rounded-[2rem] shadow-premium grow sm:grow-0"
                    >
                        <UserPlus size={22} strokeWidth={3} />
                        <span className="font-black uppercase tracking-[0.2em] text-[11px]">Enlist Partner</span>
                    </button>
                </div>
            </header>


            {error && (
                <div className="p-6 bg-accent/5 border-2 border-accent/10 rounded-3xl flex items-center gap-4 text-accent text-sm font-black animate-fade-in shadow-sm">
                    <AlertTriangle size={24} />
                    System Error: Failed to synchronize client data. Please verify your connection.
                </div>
            )}

            <div className="glass-card overflow-hidden bg-bg-card/70 backdrop-blur-xl shadow-premium border-none rounded-[3rem] p-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border/40">
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.3em] text-primary/60">Partner Identity</th>
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.3em] text-primary/60">Organization</th>
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.3em] text-primary/60">Communication</th>
                                <th className="px-10 py-8 font-black text-[10px] uppercase tracking-[0.3em] text-primary/60 text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {loading ? (
                                [1, 2, 3, 4].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-10 py-8" colSpan={4}><div className="h-10 bg-border/40 rounded-2xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredClients.length > 0 ? (
                                filteredClients.map(client => (
                                    <tr key={client.id} className="hover:bg-primary/[0.03] transition-all duration-500 group">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-600/10 flex items-center justify-center text-primary font-black text-2xl group-hover:scale-110 transition-all duration-500 shadow-sm border border-border/40">
                                                    {client.name.charAt(0)}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-extrabold text-xl tracking-tighter text-text-main leading-none">{client.name}</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted/60">{client.company || 'Individual'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-3 text-muted font-extrabold text-sm">
                                                <div className="w-8 h-8 rounded-lg bg-border/40 flex items-center justify-center group-hover:text-primary transition-colors">
                                                    <Building2 size={14} strokeWidth={2.5} />
                                                </div>
                                                {client.company || 'Private Entity'}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-3 text-muted font-extrabold text-sm">
                                                <div className="w-8 h-8 rounded-lg bg-border/40 flex items-center justify-center group-hover:text-primary transition-colors">
                                                    <Mail size={14} strokeWidth={2.5} />
                                                </div>
                                                {client.email}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => { setEditingClient(client); setFormData({ name: client.name, email: client.email, company: client.company }); setIsModalOpen(true); }}
                                                    className="w-12 h-12 flex items-center justify-center hover:bg-primary/10 rounded-2xl text-primary bg-bg-card/80 border-2 border-border/40 shadow-sm transition-all hover:border-primary/20"
                                                >
                                                    <Edit2 size={18} strokeWidth={2.5} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(client)}
                                                    className="w-12 h-12 flex items-center justify-center hover:bg-accent/10 rounded-2xl text-accent bg-bg-card/80 border-2 border-border/40 shadow-sm transition-all hover:border-accent/20"
                                                    aria-label={`Delete ${client.name}`}
                                                >
                                                    <Trash2 size={18} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="p-32 text-center" colSpan={4}>
                                        <div className="flex flex-col items-center max-w-sm mx-auto">
                                            <div className="w-24 h-24 bg-bg-card shadow-2xl rounded-[2rem] flex items-center justify-center text-muted/20 mb-10 border border-border/20">
                                                <UserPlus size={48} strokeWidth={1} />
                                            </div>
                                            <h3 className="text-3xl font-extrabold mb-4 tracking-tighter text-text-main">No partners enlisted</h3>
                                            <p className="text-muted font-medium mb-12 leading-relaxed italic">Your professional network is currently idle. Initialize a partnership to expand your reach.</p>
                                            <button
                                                onClick={() => { setEditingClient(null); setFormData({ name: '', email: '', company: '' }); setIsModalOpen(true); }}
                                                className="premium-btn py-5 px-12 rounded-[2rem] shadow-premium"
                                            >
                                                <Plus size={22} strokeWidth={3} />
                                                <span className="font-black uppercase tracking-[0.2em] text-xs">Initiate Relationship</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* Modal */}
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
                                    <h2 className="text-3xl font-black tracking-tight">{editingClient ? 'Edit Partner' : 'New Client'}</h2>
                                    <p className="text-muted text-sm font-medium">Fill in the details below to update your records.</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="bg-primary/5 p-3 rounded-2xl text-muted hover:text-accent hover:bg-accent/5 transition-all"><X size={24} strokeWidth={2.5} /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                        <User size={14} strokeWidth={2.5} />
                                        Complete Legal Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Sebastian Vittel"
                                        value={formData.name}
                                        onChange={(e) => {
                                            setFormData({ ...formData, name: e.target.value });
                                            if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                                        }}
                                        className={`py-4 px-6 rounded-2xl text-lg font-bold ${formErrors.name ? 'border-accent bg-accent/5' : ''}`}
                                        aria-invalid={!!formErrors.name}
                                    />
                                    {formErrors.name && (
                                        <p className="text-accent text-xs font-bold mt-1 pl-2">{formErrors.name}</p>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Building2 size={14} strokeWidth={2.5} />
                                        Corporate Identity
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Aonix Creative Studio"
                                        className="py-4 px-6 rounded-2xl text-lg font-bold"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Mail size={14} strokeWidth={2.5} />
                                        Communication Endpoint
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="contact@entity.com"
                                        value={formData.email}
                                        onChange={(e) => {
                                            setFormData({ ...formData, email: e.target.value });
                                            if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                                        }}
                                        className={`py-4 px-6 rounded-2xl text-lg font-bold ${formErrors.email ? 'border-accent bg-accent/5' : ''}`}
                                        aria-invalid={!!formErrors.email}
                                    />
                                    {formErrors.email && (
                                        <p className="text-accent text-xs font-bold mt-1 pl-2">{formErrors.email}</p>
                                    )}
                                </div>
                                <button type="submit" disabled={isMutating} className="premium-btn w-full py-5 rounded-2xl shadow-premium mt-4 text-sm font-black uppercase tracking-[0.2em]">
                                    {isMutating ? 'Synchronizing...' : (editingClient ? 'Finalize Changes' : 'Initialize Partnership')}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, clientId: null, clientName: '' })}
                onConfirm={handleDeleteConfirm}
                title="Terminate Relationship"
                message={`Are you absolutely certain you want to remove ${deleteConfirm.clientName} from your ecosystem? This action is irreversible.`}
                confirmText="Confirm Deletion"
                cancelText="Retain Client"
                isDangerous
                loading={isMutating}
            />
        </motion.div>
    );
};

export default Clients;
