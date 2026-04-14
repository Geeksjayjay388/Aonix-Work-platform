import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    ListChecks,
    Calendar,
    ChevronRight,
    ChevronDown,
    MoreHorizontal,
    CheckCircle2,
    Circle,
    X,
    Trash2,
    FolderKanban,
    User
} from 'lucide-react';
import { supabase, logActivity } from '../lib/supabase';
import type { Project, Client, Task } from '../lib/supabase';
import { useToast } from '../components/Toast';

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
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tasks']));

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
        });
    };

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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-12 pb-16"
        >
            {/* Top Bar / Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
                <div>
                    <h1 className="text-5xl font-black tracking-tight text-slate-800 mb-4">Projects</h1>
                    <p className="text-slate-400 text-xl font-bold">Monitor your creative ventures and global alliances.</p>
                </div>
                <button
                    onClick={() => { setFormData({ name: '', description: '', client_id: '', status: 'in-progress' }); setIsModalOpen(true); }}
                    className="px-10 py-5 bg-blue-600 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-blue-300 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <Plus size={18} strokeWidth={3} />
                        <span>Initiate Project</span>
                    </div>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Project List */}
                <div className="lg:col-span-1 space-y-5">
                    {loading ? (
                        <div className="space-y-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-44 bg-slate-50 rounded-[2.5rem] animate-pulse" />
                            ))}
                        </div>
                    ) : projects.length > 0 ? (
                        projects.map(project => (
                            <motion.button
                                key={project.id}
                                whileHover={{ y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedProject(project)}
                                className={`w-full text-left p-10 rounded-[2.5rem] transition-all duration-300 relative overflow-hidden flex flex-col gap-6 ${selectedProject?.id === project.id ? 'bg-white shadow-2xl shadow-blue-500/10 border-2 border-blue-600' : 'bg-white border border-slate-100 hover:border-blue-200'}`}
                            >
                                {selectedProject?.id === project.id && (
                                    <div className="absolute top-0 left-10 h-1.5 w-16 bg-blue-600 rounded-b-full" />
                                )}

                                <div className="flex justify-between items-start">
                                    <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border ${project.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                        {project.status.replace('-', ' ')}
                                    </span>
                                    <div className="p-2 bg-slate-50 rounded-xl text-slate-300">
                                        <Calendar size={14} />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-2xl font-black tracking-tight text-slate-800 leading-tight mb-2">{project.name}</h3>
                                    <p className="text-slate-400 text-sm font-bold line-clamp-2">{project.description}</p>
                                </div>

                                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">Client Network</span>
                                        <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest truncate max-w-[150px]">{getClientName(project.client_id)}</span>
                                    </div>
                                    <div className={`p-2 rounded-xl ${selectedProject?.id === project.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-400'}`}>
                                        <ChevronRight size={18} strokeWidth={3} />
                                    </div>
                                </div>
                            </motion.button>
                        ))
                    ) : (
                        <div className="bg-white p-12 text-center rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
                            <div className="w-20 h-20 rounded-[2rem] bg-blue-50 flex items-center justify-center text-blue-200 mb-8">
                                <FolderKanban size={32} />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight text-slate-800 mb-3">No active projects</h3>
                            <p className="text-slate-400 font-bold mb-8 leading-relaxed">Establish your first creative venture to begin tracking excellence.</p>
                            <button
                                onClick={() => { setFormData({ name: '', description: '', client_id: '', status: 'in-progress' }); setIsModalOpen(true); }}
                                className="px-8 py-4 bg-blue-600 rounded-xl text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                            >
                                Begin Project
                            </button>
                        </div>
                    )}
                </div>

                {/* Project Details & Tasks */}
                <div className="lg:col-span-2">
                    {selectedProject ? (
                        <motion.div
                            key={selectedProject.id}
                            initial={{ opacity: 0, scale: 0.99 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white border border-slate-100 rounded-[3.5rem] p-12 shadow-sm relative overflow-hidden group/folder min-h-[750px] flex flex-col"
                        >
                            {/* Blue Folder Tab */}
                            <div className="absolute top-0 right-12 h-2 w-32 bg-blue-600 rounded-b-full opacity-50 group-hover/folder:opacity-100 transition-opacity" />

                            <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
                                <div className="space-y-4">
                                    <h2 className="text-5xl font-black tracking-tight text-slate-800 leading-tight">
                                        {selectedProject.name}
                                    </h2>
                                    <p className="text-slate-400 text-xl font-bold max-w-xl leading-relaxed">
                                        {selectedProject.description}
                                    </p>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                            <ListChecks size={20} strokeWidth={3} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Milestones</span>
                                            <h4 className="font-black text-sm text-blue-600 uppercase tracking-widest">
                                                {tasks.filter(t => t.is_completed).length}/{tasks.length} DONE
                                            </h4>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col space-y-12">
                                <div className="flex items-center justify-between">
                                    <div
                                        className="flex items-center gap-4 cursor-pointer"
                                        onClick={() => toggleSection('tasks')}
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                            <CheckCircle2 size={24} strokeWidth={3} />
                                        </div>
                                        <h3 className="text-2xl font-black tracking-tight text-slate-800">Task Execution</h3>
                                        <div className="ml-2 p-2 bg-slate-50 rounded-xl text-slate-300">
                                            {expandedSections.has('tasks') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </div>
                                    </div>
                                    <button className="p-3 text-slate-300 hover:text-slate-600 transition-all">
                                        <MoreHorizontal size={24} />
                                    </button>
                                </div>

                                <AnimatePresence initial={false}>
                                    {expandedSections.has('tasks') && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                            animate={{ height: 'auto', opacity: 1, marginTop: 32 }}
                                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                            className="overflow-hidden space-y-8"
                                        >
                                            <form onSubmit={handleAddTask} className="relative group/form">
                                                <input
                                                    type="text"
                                                    placeholder="Define a new milestone..."
                                                    className="w-full pl-8 pr-20 py-6 rounded-[2rem] bg-slate-50 border-none text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all outline-none placeholder:text-slate-300"
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                                />
                                                <button
                                                    type="submit"
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 rounded-xl text-white flex items-center justify-center shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
                                                >
                                                    <Plus size={24} strokeWidth={3} />
                                                </button>
                                            </form>

                                            <div className="space-y-4">
                                                {tasks.length > 0 ? (
                                                    tasks.map((task, idx) => (
                                                        <motion.div
                                                            key={task.id}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: idx * 0.05 }}
                                                            className="flex items-center justify-between p-8 rounded-[2rem] bg-slate-50 border border-slate-100/50 group/task hover:bg-white hover:shadow-xl transition-all duration-300"
                                                        >
                                                            <button
                                                                onClick={() => toggleTask(task)}
                                                                className="flex items-center gap-6 flex-1 text-left"
                                                            >
                                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${task.is_completed ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-200 border-2 border-slate-50'}`}>
                                                                    {task.is_completed ? (
                                                                        <CheckCircle2 size={24} strokeWidth={3} />
                                                                    ) : (
                                                                        <Circle size={24} strokeWidth={3} />
                                                                    )}
                                                                </div>
                                                                <span className={`text-lg font-black tracking-tight transition-all duration-300 ${task.is_completed ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                                                    {task.title}
                                                                </span>
                                                            </button>
                                                            <button
                                                                onClick={() => deleteTask(task.id)}
                                                                className="opacity-0 group-hover/task:opacity-100 p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                            >
                                                                <Trash2 size={20} strokeWidth={2.5} />
                                                            </button>
                                                        </motion.div>
                                                    ))
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                                                            <ListChecks size={40} />
                                                        </div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No active milestones</p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="mt-12 pt-10 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-white">
                                        <User size={22} strokeWidth={3} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">Collaborating Partner</span>
                                        <span className="font-black text-blue-600 text-sm uppercase tracking-widest">
                                            {getClientName(selectedProject.client_id)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-4 w-full sm:w-auto">
                                    <button className="px-8 py-4 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all">Modify</button>
                                    <button className="px-8 py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Finalize</button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-white border border-slate-50 rounded-[3.5rem] p-24 text-center shadow-sm relative overflow-hidden group">
                            <div className="w-24 h-24 rounded-[2.5rem] bg-blue-50 flex items-center justify-center text-blue-100 mb-8 border border-white group-hover:scale-110 transition-all duration-700">
                                <FolderKanban size={48} strokeWidth={1} />
                            </div>
                            <h3 className="text-4xl font-black tracking-tight text-slate-800 mb-4">Project Workbench</h3>
                            <p className="max-w-xs mx-auto text-slate-400 font-bold leading-relaxed">Choose a project from the list to monitor performance and execute milestones.</p>
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
                            className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-3xl font-black tracking-tight text-slate-800">Initiate Project</h2>
                                <button onClick={() => setIsModalOpen(false)} className="bg-slate-50 p-3 rounded-xl text-slate-300 hover:text-slate-600 transition-all"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleCreateProject} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-2">Title of Venture</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Project Odyssey"
                                        className="w-full px-6 py-4 rounded-xl bg-slate-50 border-none text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-2">Detailed Mandate</label>
                                    <textarea
                                        placeholder="Outline the core objectives..."
                                        className="w-full px-6 py-4 rounded-xl bg-slate-50 border-none text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none resize-none"
                                        rows={4}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-2">Strategic Partner</label>
                                    <select
                                        className="w-full px-6 py-4 rounded-xl bg-slate-50 border-none text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none appearance-none"
                                        value={formData.client_id}
                                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Select a client</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.company}</option>)}
                                    </select>
                                </div>
                                <button type="submit" className="w-full py-5 bg-blue-600 rounded-xl text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all mt-4">
                                    Establish Project
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
