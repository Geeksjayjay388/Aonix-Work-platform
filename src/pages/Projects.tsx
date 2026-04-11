import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ListChecks, Calendar, ChevronRight, CheckCircle2, Circle, X, Trash2, FolderKanban, User } from 'lucide-react';
import { supabase, logActivity } from '../lib/supabase';
import type { Project, Client, Task } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Skeleton } from '../components/Skeleton';

const Projects: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const toast = useToast();

    const [formData, setFormData] = useState({ name: '', description: '', client_id: '', status: 'in-progress' as Project['status'] });
    const [newTaskTitle, setNewTaskTitle] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: projData, error: projError } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
            const { data: clientData, error: clientError } = await supabase.from('clients').select('*');

            if (projError || clientError) {
                toast.error('Failed to load projects');
                return;
            }

            if (projData) setProjects(projData);
            if (clientData) setClients(clientData);
        } catch (err) {
            toast.error('An unexpected error occurred');
            console.error('Projects error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTasks = async (projectId: string) => {
        const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
        if (data) setTasks(data);
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedProject) fetchTasks(selectedProject.id);
    }, [selectedProject]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Project name is required');
            return;
        }

        if (!formData.client_id) {
            toast.error('Please select a client');
            return;
        }

        try {
            const { error } = await supabase.from('projects').insert([formData]);
            if (error) {
                toast.error('Failed to create project');
                return;
            }

            toast.success('Project created successfully!');
            setIsModalOpen(false);
            setFormData({ name: '', description: '', client_id: '', status: 'in-progress' });
            fetchData();
            logActivity({
                type: 'project',
                action: 'created',
                entity_id: '',
                title: `Created project: ${formData.name}`,
                metadata: { project_name: formData.name }
            });
        } catch (err) {
            toast.error('An unexpected error occurred');
            console.error('Create project error:', err);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject || !newTaskTitle.trim()) {
            toast.warning('Please enter a task title');
            return;
        }

        try {
            const { error } = await supabase.from('tasks').insert([{ project_id: selectedProject.id, title: newTaskTitle, is_completed: false }]);
            if (error) {
                toast.error('Failed to add task');
                return;
            }

            toast.success('Task added!');
            setNewTaskTitle('');
            fetchTasks(selectedProject.id);
            logActivity({
                type: 'task',
                action: 'created',
                entity_id: selectedProject.id,
                title: `Added task: ${newTaskTitle} to ${selectedProject.name}`,
                metadata: { project_id: selectedProject.id, task_title: newTaskTitle }
            });
        } catch (err) {
            toast.error('Failed to add task');
            console.error('Add task error:', err);
        }
    };

    const toggleTask = async (task: Task) => {
        const { error } = await supabase.from('tasks').update({ is_completed: !task.is_completed }).eq('id', task.id);
        if (!error && selectedProject) {
            fetchTasks(selectedProject.id);
            logActivity({
                type: 'task',
                action: !task.is_completed ? 'completed' : 'updated',
                entity_id: selectedProject.id,
                title: `${!task.is_completed ? 'Completed' : 'Reopened'} task: ${task.title}`,
                metadata: { project_id: selectedProject.id, task_id: task.id, is_completed: !task.is_completed }
            });
        }
    };

    const deleteTask = async (id: string) => {
        const task = tasks.find(t => t.id === id);

        try {
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (error) {
                toast.error('Failed to delete task');
                return;
            }

            toast.success('Task deleted');
            if (selectedProject) {
                fetchTasks(selectedProject.id);
                if (task) {
                    logActivity({
                        type: 'task',
                        action: 'deleted',
                        entity_id: selectedProject.id,
                        title: `Deleted task: ${task.title} from ${selectedProject.name}`,
                        metadata: { project_id: selectedProject.id, task_title: task.title }
                    });
                }
            }
        } catch (err) {
            toast.error('Failed to delete task');
            console.error('Delete task error:', err);
        }
    };

    const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Unknown Client';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-16 pb-24"
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-5xl font-extrabold tracking-tighter text-text-main">Projects</h1>
                    <p className="text-muted text-lg font-medium">Monitoring your creative workflow and deliverables.</p>
                </div>
                <button
                    onClick={() => { setFormData({ name: '', description: '', client_id: '', status: 'in-progress' }); setIsModalOpen(true); }}
                    className="premium-btn flex items-center gap-3"
                >
                    <Plus size={20} strokeWidth={2.5} />
                    <span>Initiate Project</span>
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Project List */}
                <div className="lg:col-span-1 space-y-5">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-40 rounded-[2rem]" />
                            ))}
                        </div>
                    ) : projects.length > 0 ? (
                        projects.map(project => (
                            <motion.button
                                key={project.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedProject(project)}
                                className={`w-full text-left p-6 rounded-[2rem] transition-all duration-500 border-2 ${selectedProject?.id === project.id ? 'border-primary bg-primary/[0.03] shadow-premium shadow-primary/10' : 'border-transparent glass-card hover:bg-white hover:shadow-xl'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`badge ${project.status === 'completed' ? 'badge-success' : 'badge-primary'}`}>
                                        {project.status.replace('-', ' ')}
                                    </span>
                                    <div className="w-8 h-8 rounded-full bg-border/40 flex items-center justify-center text-muted">
                                        <Calendar size={14} strokeWidth={2.5} />
                                    </div>
                                </div>
                                <h3 className="font-extrabold text-2xl tracking-tighter mb-2 leading-none">{project.name}</h3>
                                <p className="text-sm text-muted mb-6 line-clamp-2 font-medium leading-relaxed">{project.description}</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted/60 mb-0.5">Client</span>
                                        <span className="text-xs font-black text-primary truncate max-w-[150px]">{getClientName(project.client_id)}</span>
                                    </div>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${selectedProject?.id === project.id ? 'bg-primary text-white' : 'bg-primary/5 text-primary'}`}>
                                        <ChevronRight size={18} strokeWidth={3} />
                                    </div>
                                </div>
                            </motion.button>
                        ))
                    ) : (
                        <div className="glass-card p-12 text-center text-muted flex flex-col items-center border-2 border-dashed">
                            <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center text-muted mb-8 border border-border/20">
                                <FolderKanban size={32} strokeWidth={2} />
                            </div>
                            <h3 className="text-2xl font-extrabold tracking-tighter mb-3">No active projects</h3>
                            <p className="mb-8 font-medium leading-relaxed">Establish your first creative venture to begin tracking excellence.</p>
                            <button
                                onClick={() => { setFormData({ name: '', description: '', client_id: '', status: 'in-progress' }); setIsModalOpen(true); }}
                                className="premium-btn gap-3"
                            >
                                <Plus size={20} strokeWidth={2.5} />
                                <span>Begin Project</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Project Details & Tasks */}
                <div className="lg:col-span-2">
                    {selectedProject ? (
                        <motion.div
                            key={selectedProject.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-card p-12 min-h-[750px] flex flex-col relative overflow-hidden group/detail"
                        >
                            <div className="absolute top-0 right-0 p-12 text-primary opacity-[0.03] group-hover/detail:rotate-12 transition-transform duration-1000">
                                <FolderKanban size={240} strokeWidth={3} />
                            </div>

                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
                                <div className="space-y-3">
                                    <h2 className="text-4xl font-extrabold tracking-tighter leading-none">{selectedProject.name}</h2>
                                    <p className="text-muted text-lg font-medium max-w-xl leading-relaxed">{selectedProject.description}</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="glass-card px-5 py-3 border-primary/20 flex items-center gap-3 bg-white/40">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <ListChecks size={18} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">Milestones</span>
                                            <span className="font-extrabold text-sm text-primary">{tasks.filter(t => t.is_completed).length}/{tasks.length} Completed</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 flex-1 flex flex-col space-y-8">
                                <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success">
                                        <CheckCircle2 size={18} strokeWidth={2.5} />
                                    </div>
                                    Task Execution
                                </h3>

                                <form onSubmit={handleAddTask} className="flex gap-4 group/form">
                                    <input
                                        type="text"
                                        placeholder="Define a new milestone..."
                                        className="flex-1 px-6 py-4 rounded-2xl glass-card border-border hover:border-primary/30 focus:border-primary transition-all duration-300 font-bold"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                    />
                                    <button type="submit" className="premium-btn px-6 aspect-square p-0 shrink-0 shadow-lg group">
                                        <Plus size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
                                    </button>
                                </form>

                                <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                    {tasks.length > 0 ? (
                                        tasks.map((task, idx) => (
                                            <motion.div
                                                key={task.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="flex items-center justify-between p-5 rounded-2xl border border-border/60 glass-card bg-white/30 backdrop-blur-md group/task hover:border-primary/20 hover:bg-white/60 transition-all duration-300 shadow-sm"
                                            >
                                                <button
                                                    onClick={() => toggleTask(task)}
                                                    className="flex items-center gap-4 flex-1 text-left bg-transparent p-0 group/check"
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${task.is_completed ? 'bg-success/10 text-success' : 'bg-border/40 text-muted group-hover/check:bg-primary/10 group-hover/check:text-primary backdrop-blur-none border border-transparent group-hover/check:border-primary/20'}`}>
                                                        {task.is_completed ? (
                                                            <CheckCircle2 size={22} strokeWidth={3} />
                                                        ) : (
                                                            <Circle size={22} strokeWidth={3} />
                                                        )}
                                                    </div>
                                                    <span className={`font-bold transition-all duration-300 ${task.is_completed ? 'text-muted/60 line-through' : 'text-text-main text-lg tracking-tight'}`}>{task.title}</span>
                                                </button>
                                                <button
                                                    onClick={() => deleteTask(task.id)}
                                                    className="opacity-0 group-hover/task:opacity-100 p-2 text-muted hover:text-accent hover:bg-accent/5 rounded-xl bg-transparent transition-all"
                                                >
                                                    <Trash2 size={20} strokeWidth={2.5} />
                                                </button>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                                            <ListChecks size={48} strokeWidth={2} />
                                            <p className="font-extrabold text-lg tracking-tight">No milestones defined.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative z-10 mt-10 pt-8 border-t border-border/60 flex flex-col sm:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/5 border-2 border-white flex items-center justify-center text-primary shadow-lg overflow-hidden">
                                        <User size={18} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted/60 leading-none">Collaborating with</span>
                                        <span className="font-black text-primary text-sm tracking-tight">{getClientName(selectedProject.client_id)}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <button className="secondary-btn py-3 px-6 text-xs flex-1 sm:flex-none uppercase tracking-widest font-black shadow-sm">Modify</button>
                                    <button className="premium-btn py-3 px-6 text-xs flex-1 sm:flex-none uppercase tracking-widest font-black shadow-lg">Finalize</button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="glass-card h-full flex flex-col items-center justify-center text-muted p-20 text-center border-none shadow-premium min-h-[650px] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-primary/[0.01] pointer-events-none" />
                            <div className="w-24 h-24 rounded-[2rem] bg-white shadow-2xl flex items-center justify-center text-muted/20 mb-8 border border-border/20 group-hover:scale-110 transition-transform duration-700">
                                <FolderKanban size={48} strokeWidth={1} />
                            </div>
                            <h3 className="text-3xl font-extrabold tracking-tighter text-text-main mb-3">Project Selection Required</h3>
                            <p className="max-w-xs mx-auto font-medium leading-relaxed">Choose a project from your workbench to monitor performance and execute milestones.</p>
                        </div>
                    )}
                </div>
            </div>


            {/* New Project Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass-card p-6 w-full max-w-md shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">New Project</h2>
                                <button onClick={() => setIsModalOpen(false)} className="bg-transparent p-1 text-muted hover:text-main"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleCreateProject} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Project Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Description</label>
                                    <textarea
                                        className="w-full p-3 rounded-xl border border-border bg-white text-main"
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Client</label>
                                    <select
                                        className="w-full p-3 rounded-xl border border-border bg-white text-main outline-none focus:border-primary"
                                        value={formData.client_id}
                                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Select a client</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
                                    </select>
                                </div>
                                <button type="submit" className="premium-btn w-full mt-2">
                                    Create Project
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default Projects;
