import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    ListChecks,
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-[calc(100vh-120px)] flex flex-col relative overflow-hidden"
        >
            {/* Immersive Background */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-500/5 blur-[100px] rounded-full" />
            </div>

            <div className="flex flex-1 gap-12 min-h-0">
                {/* Project Selector - The "Orbital" Column */}
                <div className="w-24 flex flex-col items-center py-4 gap-6 custom-scrollbar overflow-y-auto no-scrollbar">
                    <button
                        onClick={() => { setFormData({ name: '', description: '', client_id: '', status: 'in-progress' }); setIsModalOpen(true); }}
                        className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 hover:scale-110 active:scale-95 transition-all group shrink-0"
                    >
                        <Plus size={28} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
                    </button>

                    <div className="w-10 h-0.5 bg-slate-100/50 shrink-0" />

                    {loading ? (
                        <div className="space-y-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-16 h-16 rounded-full bg-slate-50 animate-pulse" />
                            ))}
                        </div>
                    ) : projects.map((project, idx) => (
                        <motion.button
                            key={project.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSelectedProject(project)}
                            className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 group shrink-0 ${selectedProject?.id === project.id ? 'bg-white shadow-[0_0_40px_rgba(37,99,235,0.15)] ring-4 ring-blue-600' : 'bg-white border border-slate-100 hover:border-blue-200 shadow-sm'}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedProject?.id === project.id ? 'text-blue-600' : 'text-slate-300 group-hover:text-blue-400'}`}>
                                <FolderKanban size={24} strokeWidth={selectedProject?.id === project.id ? 2.5 : 2} />
                            </div>

                            {/* Tooltip-like label on hover */}
                            <div className="absolute left-20 px-4 py-2 bg-white shadow-2xl rounded-xl opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 border border-slate-50">
                                <span className="text-[11px] font-black tracking-widest text-slate-800 uppercase">{project.name}</span>
                            </div>

                            {/* Active indicator */}
                            {selectedProject?.id === project.id && (
                                <div className="absolute inset-0 rounded-full animate-ping bg-blue-600/10 -z-10" />
                            )}
                        </motion.button>
                    ))}
                </div>

                {/* Creative Workbench */}
                <div className="flex-1 flex flex-col min-w-0">
                    <AnimatePresence mode="wait">
                        {selectedProject ? (
                            <motion.div
                                key={selectedProject.id}
                                initial={{ opacity: 0, scale: 0.98, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.98, x: -20 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="flex-1 flex flex-col gap-8 bg-white/70 backdrop-blur-3xl border border-white rounded-[4rem] p-16 shadow-[0_32px_128px_-32px_rgba(0,0,0,0.06)] relative overflow-hidden group/workbench"
                            >
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/10 blur-[100px] rounded-full -mr-48 -mt-48" />

                                <header className="relative flex flex-col md:flex-row justify-between items-start gap-12">
                                    <div className="space-y-6 flex-1">
                                        <div className="flex items-center gap-4">
                                            <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${selectedProject.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'}`}>
                                                {selectedProject.status}
                                            </span>
                                            <div className="h-0.5 w-12 bg-slate-100" />
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Project Sequence #{selectedProject.id.slice(0, 4)}</span>
                                        </div>
                                        <h1 className="text-7xl font-black tracking-[ -0.04em] text-slate-800 leading-[0.9]">
                                            {selectedProject.name}
                                        </h1>
                                        <p className="text-xl font-bold text-slate-400 max-w-2xl leading-relaxed">
                                            {selectedProject.description}
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-end gap-4">
                                        <div className="flex items-center gap-3 bg-white p-2 pr-6 rounded-full shadow-sm border border-slate-50">
                                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                <User size={20} strokeWidth={2.5} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Partner</span>
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{getClientName(selectedProject.client_id)}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-all">
                                                <MoreHorizontal size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </header>

                                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-16 mt-12 min-h-0">
                                    {/* Task Module */}
                                    <div className="lg:col-span-8 flex flex-col min-h-0">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-lg">
                                                    <ListChecks size={20} />
                                                </div>
                                                <h3 className="text-2xl font-black tracking-tight text-slate-800">Milestone Sequence</h3>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-4">
                                            <form onSubmit={handleAddTask} className="sticky top-0 z-10 bg-gradient-to-b from-white via-white/90 to-transparent pb-8">
                                                <div className="relative group">
                                                    <input
                                                        type="text"
                                                        placeholder="Define the next milestone..."
                                                        className="w-full pl-10 pr-20 py-8 rounded-[2.5rem] bg-white border-2 border-slate-50 text-base font-bold shadow-xl shadow-slate-200/20 focus:border-blue-600 focus:ring-0 transition-all outline-none placeholder:text-slate-300 placeholder:font-black placeholder:uppercase placeholder:tracking-widest placeholder:text-[10px]"
                                                        value={newTaskTitle}
                                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                                    />
                                                    <button
                                                        type="submit"
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 bg-slate-800 rounded-[1.25rem] text-white flex items-center justify-center hover:bg-blue-600 transition-all active:scale-90"
                                                    >
                                                        <Plus size={32} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </form>

                                            <div className="space-y-4">
                                                {tasks.map((task, idx) => (
                                                    <motion.div
                                                        key={task.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.05 + 0.2 }}
                                                        className="group flex items-center justify-between p-8 rounded-[2.5rem] bg-white border border-slate-50 hover:shadow-2xl hover:shadow-slate-200/50 hover:scale-[1.01] transition-all duration-500"
                                                    >
                                                        <div className="flex items-center gap-8 flex-1">
                                                            <button
                                                                onClick={() => toggleTask(task)}
                                                                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${task.is_completed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-200 group-hover:bg-white group-hover:border-2 group-hover:border-blue-600'}`}
                                                            >
                                                                {task.is_completed ? (
                                                                    <CheckCircle2 size={24} strokeWidth={3} />
                                                                ) : (
                                                                    <Circle size={24} strokeWidth={2.5} className="group-hover:text-blue-600" />
                                                                )}
                                                            </button>
                                                            <span className={`text-xl font-black tracking-tight ${task.is_completed ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                                                {task.title}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => deleteTask(task.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-4 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                                                        >
                                                            <Trash2 size={20} strokeWidth={2.5} />
                                                        </button>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats & Tools Module */}
                                    <div className="lg:col-span-4 space-y-8">
                                        <div className="bg-slate-50/50 rounded-[3rem] p-10 space-y-8 border border-white">
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Execution Pulse</h4>
                                                <div className="flex items-end gap-3 h-12">
                                                    {[40, 70, 45, 90, 65, 80, 50, 85].map((h, i) => (
                                                        <motion.div
                                                            key={i}
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${h}%` }}
                                                            transition={{ delay: i * 0.1, duration: 1, repeat: Infinity, repeatType: "reverse" }}
                                                            className="flex-1 bg-blue-600/20 rounded-t-sm"
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <h5 className="text-4xl font-black tracking-tighter text-slate-800">
                                                            {tasks.length > 0 ? Math.round((tasks.filter(t => t.is_completed).length / tasks.length) * 100) : 0}%
                                                        </h5>
                                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Operational Depth</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-sm font-black text-emerald-500 uppercase tracking-tighter">On Track</span>
                                                        <span className="text-[9px] font-bold text-slate-400">Current Velocity</span>
                                                    </div>
                                                </div>
                                                <div className="h-4 bg-white rounded-full overflow-hidden border border-slate-100 p-1">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.is_completed).length / tasks.length) * 100 : 0}%` }}
                                                        transition={{ duration: 2, ease: "circOut" }}
                                                        className="h-full bg-blue-600 rounded-full shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <button className="flex flex-col items-center justify-center gap-4 p-8 bg-blue-600 rounded-[2.5rem] text-white shadow-xl shadow-blue-200 hover:scale-[1.02] transition-all">
                                                <Plus size={24} strokeWidth={3} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Expand</span>
                                            </button>
                                            <button className="flex flex-col items-center justify-center gap-4 p-8 bg-white rounded-[2.5rem] text-slate-800 border border-slate-100 hover:bg-slate-50 transition-all">
                                                <CheckCircle2 size={24} strokeWidth={3} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Finalize</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex-1 flex flex-col items-center justify-center text-center space-y-12"
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-blue-600/10 blur-[80px] rounded-full animate-pulse" />
                                    <div className="w-48 h-48 rounded-[4rem] bg-white flex items-center justify-center text-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] border border-slate-50 relative z-10 group cursor-pointer hover:rotate-12 transition-transform duration-700">
                                        <FolderKanban size={80} strokeWidth={1} className="group-hover:text-blue-600 transition-colors duration-500" />
                                    </div>
                                </div>
                                <div className="space-y-4 max-w-sm">
                                    <h3 className="text-5xl font-black tracking-tight text-slate-800">Horizon Empty</h3>
                                    <p className="text-lg font-bold text-slate-400 leading-relaxed">
                                        Select a project node from the orbital selector to activate the creative workbench.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                            className="bg-white p-12 rounded-[3.5rem] w-full max-w-lg shadow-2xl border border-slate-100 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
                            <div className="flex justify-between items-center mb-12">
                                <h2 className="text-4xl font-black tracking-tighter text-slate-800 leading-none">Initiate <br />Venture</h2>
                                <button onClick={() => setIsModalOpen(false)} className="bg-slate-50 p-4 rounded-2xl text-slate-300 hover:text-slate-600 transition-all"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleCreateProject} className="space-y-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Title of Venture</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Project Odyssey"
                                        className="w-full px-8 py-6 rounded-[1.5rem] bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Detailed Mandate</label>
                                    <textarea
                                        placeholder="Outline the core objectives..."
                                        className="w-full px-8 py-6 rounded-[1.5rem] bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none resize-none"
                                        rows={4}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    ></textarea>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Strategic Partner</label>
                                    <div className="relative">
                                        <select
                                            className="w-full px-8 py-6 rounded-[1.5rem] bg-slate-50 border-none text-base font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none appearance-none"
                                            value={formData.client_id}
                                            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Select a partner</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.company}</option>)}
                                        </select>
                                        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-6 bg-blue-600 rounded-[1.5rem] text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all mt-4">
                                    Establish Project Node
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export const ProjectsExport = Projects;
export default Projects;
