import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ListChecks, Calendar, ChevronRight, CheckCircle2, Circle, X, Trash2, FolderKanban } from 'lucide-react';
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
        >
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Projects</h1>
                    <p className="text-muted">Track your progress and deliverables.</p>
                </div>
                <button
                    onClick={() => { setFormData({ name: '', description: '', client_id: '', status: 'in-progress' }); setIsModalOpen(true); }}
                    className="premium-btn flex items-center gap-2"
                >
                    <Plus size={18} />
                    <span>New Project</span>
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Project List */}
                <div className="lg:col-span-1 space-y-4">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-32 rounded-2xl" />
                            ))}
                        </div>
                    ) : projects.length > 0 ? (
                        projects.map(project => (
                            <button
                                key={project.id}
                                onClick={() => setSelectedProject(project)}
                                className={`w-full text-left p-4 rounded-2xl transition-all border-2 ${selectedProject?.id === project.id ? 'border-primary bg-primary/5 shadow-md' : 'border-transparent glass-card hover:bg-white'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${project.status === 'completed' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                                        {project.status.replace('-', ' ')}
                                    </span>
                                    <Calendar size={14} className="text-muted" />
                                </div>
                                <h3 className="font-bold text-lg mb-1">{project.name}</h3>
                                <p className="text-sm text-muted mb-3 line-clamp-1">{project.description}</p>
                                <div className="flex items-center justify-between mt-4">
                                    <span className="text-xs font-semibold text-primary">{getClientName(project.client_id)}</span>
                                    <ChevronRight size={16} className="text-muted" />
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="glass-card p-8 text-center text-muted flex flex-col items-center">
                            <ListChecks size={64} className="mb-6 opacity-10" />
                            <h3 className="text-xl font-bold mb-2">No Projects Yet</h3>
                            <p className="mb-6">Create your first project to start organizing your work and collaborating with clients.</p>
                            <button
                                onClick={() => { setFormData({ name: '', description: '', client_id: '', status: 'in-progress' }); setIsModalOpen(true); }}
                                className="premium-btn gap-2"
                            >
                                <Plus size={18} />
                                Create First Project
                            </button>
                        </div>
                    )}
                </div>

                {/* Project Details & Tasks */}
                <div className="lg:col-span-2">
                    {selectedProject ? (
                        <motion.div
                            key={selectedProject.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card p-8 min-h-[600px] flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">{selectedProject.name}</h2>
                                    <p className="text-muted">{selectedProject.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2">
                                        <ListChecks size={16} />
                                        {tasks.filter(t => t.is_completed).length}/{tasks.length} Tasks
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="text-primary" size={20} />
                                    Project Checklist
                                </h3>

                                <form onSubmit={handleAddTask} className="flex gap-2 mb-6">
                                    <input
                                        type="text"
                                        placeholder="Add a new task..."
                                        className="flex-1"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                    />
                                    <button type="submit" className="premium-btn px-4"><Plus size={20} /></button>
                                </form>

                                <div className="space-y-3">
                                    {tasks.length > 0 ? (
                                        tasks.map(task => (
                                            <div
                                                key={task.id}
                                                className="flex items-center justify-between p-3 rounded-xl border border-border group hover:border-primary transition-all"
                                            >
                                                <button
                                                    onClick={() => toggleTask(task)}
                                                    className="flex items-center gap-3 flex-1 text-left bg-transparent p-0"
                                                >
                                                    {task.is_completed ? (
                                                        <CheckCircle2 className="text-success" size={20} />
                                                    ) : (
                                                        <Circle className="text-muted" size={20} />
                                                    )}
                                                    <span className={task.is_completed ? 'text-muted line-through' : 'font-medium'}>{task.title}</span>
                                                </button>
                                                <button
                                                    onClick={() => deleteTask(task.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-accent hover:bg-red-50 rounded bg-transparent transition-opacity"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center py-10 text-muted">No tasks defined for this project.</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-border flex justify-between items-center">
                                <div className="text-sm text-muted">
                                    Client: <span className="font-bold text-primary">{getClientName(selectedProject.client_id)}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button className="secondary-btn py-2 px-4 text-sm">Edit Project</button>
                                    <button className="premium-btn py-2 px-4 text-sm">Mark as Finished</button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="glass-card h-full flex flex-col items-center justify-center text-muted p-12 text-center">
                            <FolderKanban size={64} className="mb-6 opacity-10" />
                            <h3 className="text-xl font-bold mb-2">Select a Project</h3>
                            <p>Choose a project from the left to view details and manage tasks.</p>
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
