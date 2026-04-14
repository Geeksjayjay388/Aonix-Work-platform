import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    Palette,
    Search,
    FolderKanban,
    ListChecks,
    RefreshCw,
    Bell,
    Settings,
    MoreHorizontal,
    Filter,
    Terminal,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project, Task } from '../lib/supabase';
import { useToast } from '../components/Toast';

type TaskAssignee = 'developer' | 'web-designer';

type TaskExtras = {
    assignee: TaskAssignee;
    status: 'todo' | 'in-progress' | 'done';
    projectLink: string;
    message: string;
};

const TASK_EXTRAS_STORAGE_KEY = 'task_extras_v1';

const getTaskExtrasFromStorage = (): Record<string, TaskExtras> => {
    const raw = localStorage.getItem(TASK_EXTRAS_STORAGE_KEY);
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw) as Record<string, Partial<TaskExtras>>;
        return Object.entries(parsed).reduce<Record<string, TaskExtras>>((acc, [taskId, value]) => {
            acc[taskId] = {
                assignee: value.assignee === 'web-designer' ? 'web-designer' : 'developer',
                status: value.status === 'in-progress' ? 'in-progress' : value.status === 'done' ? 'done' : 'todo',
                projectLink: typeof value.projectLink === 'string' ? value.projectLink : '',
                message: typeof value.message === 'string' ? value.message : '',
            };
            return acc;
        }, {});
    } catch {
        return {};
    }
};

const saveTaskExtrasToStorage = (taskExtras: Record<string, TaskExtras>) => {
    localStorage.setItem(TASK_EXTRAS_STORAGE_KEY, JSON.stringify(taskExtras));
};

const Tasks: React.FC = () => {
    const [tasks, setTasks] = useState<(Task & { project_name: string })[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [taskExtras, setTaskExtras] = useState<Record<string, TaskExtras>>(() => getTaskExtrasFromStorage());
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newProjectId, setNewProjectId] = useState('');
    const [newAssignee, setNewAssignee] = useState<TaskAssignee>('developer');
    const [newStatus, setNewStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
    const [newProjectLink, setNewProjectLink] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [creating, setCreating] = useState(false);
    const toast = useToast();

    const toggleProjectExpansion = (projectId: string) => {
        setExpandedProjects(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) {
                next.delete(projectId);
            } else {
                next.add(projectId);
            }
            return next;
        });
    };

    const fetchData = async () => {
        setLoading(true);
        const [{ data: taskData, error: taskError }, { data: projectData, error: projectError }] = await Promise.all([
            supabase.from('tasks').select('*').order('created_at', { ascending: false }),
            supabase.from('projects').select('*').order('created_at', { ascending: false }),
        ]);

        if (taskError) {
            toast.error(`Failed to load tasks: ${taskError.message}`);
            setLoading(false);
            return;
        }

        if (projectError) {
            toast.error(`Failed to load projects: ${projectError.message}`);
            setLoading(false);
            return;
        }

        setProjects(projectData || []);

        if (taskData && projectData) {
            const enrichedTasks = taskData.map((task) => ({
                ...task,
                project_name: projectData.find((project) => project.id === task.project_id)?.name || 'Unknown Project'
            }));
            setTasks(enrichedTasks);
        } else {
            setTasks([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleTask = async (task: Task) => {
        const nextCompleted = !task.is_completed;
        const nextStatus = nextCompleted ? 'done' : 'todo';
        const { error } = await supabase.from('tasks').update({ is_completed: nextCompleted, status: nextStatus }).eq('id', task.id);
        if (error) {
            toast.error(`Failed to update task: ${error.message}`);
            return;
        }
        fetchData();
    };

    const saveFallbackExtras = (taskId: string) => {
        const nextExtras = {
            ...taskExtras,
            [taskId]: {
                assignee: newAssignee,
                status: newStatus,
                projectLink: newProjectLink.trim(),
                message: newMessage.trim(),
            },
        };
        setTaskExtras(nextExtras);
        saveTaskExtrasToStorage(nextExtras);
    };

    const handleCreateTask = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newTitle.trim() || !newProjectId) {
            toast.error('Task title and project are required.');
            return;
        }

        setCreating(true);
        const { error } = await supabase
            .from('tasks')
            .insert([
                {
                    title: newTitle.trim(),
                    project_id: newProjectId,
                    assignee: newAssignee,
                    status: newStatus,
                    project_link: newProjectLink.trim() || null,
                    message: newMessage.trim() || null,
                    is_completed: newStatus === 'done',
                },
            ])
            .select('id')
            .single();

        if (error) {
            const { data: fallbackTask, error: fallbackError } = await supabase
                .from('tasks')
                .insert([
                    {
                        title: newTitle.trim(),
                        project_id: newProjectId,
                        is_completed: false,
                    },
                ])
                .select('*')
                .single();

            if (fallbackError) {
                setCreating(false);
                toast.error(`Failed to create task: ${fallbackError.message}`);
                return;
            }

            saveFallbackExtras(fallbackTask.id);
            setCreating(false);
            toast.success('Task added');
            setNewTitle('');
            setNewProjectId('');
            setNewAssignee('developer');
            setNewStatus('todo');
            setNewProjectLink('');
            setNewMessage('');
            fetchData();
            return;
        }

        setNewTitle('');
        setNewProjectId('');
        setNewAssignee('developer');
        setNewStatus('todo');
        setNewProjectLink('');
        setNewMessage('');
        setCreating(false);
        toast.success('Task added');
        fetchData();
    };

    const filteredTasks = tasks.filter((task) => {
        const extras = taskExtras[task.id];
        const assignee = task.assignee || extras?.assignee || '';
        const message = task.message || extras?.message || '';
        return task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            assignee.toLowerCase().includes(searchTerm.toLowerCase()) ||
            message.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const getTaskStatus = (task: Task) => {
        const extras = taskExtras[task.id];
        if (task.status) return task.status;
        if (extras?.status) return extras.status;
        return task.is_completed ? 'done' : 'todo';
    };


    const groupedTasks = filteredTasks.reduce<Record<string, {
        projectId: string;
        projectName: string;
        projectLink: string;
        designer: (Task & { project_name: string })[];
        developer: (Task & { project_name: string })[];
    }>>((acc, task) => {
        const extras = taskExtras[task.id];
        const taskAssignee = task.assignee || extras?.assignee || 'developer';
        const taskProjectLink = task.project_link || extras?.projectLink || '';
        const key = task.project_id || 'unknown-project';

        if (!acc[key]) {
            acc[key] = {
                projectId: key,
                projectName: task.project_name,
                projectLink: taskProjectLink,
                designer: [],
                developer: [],
            };
        }

        if (!acc[key].projectLink && taskProjectLink) {
            acc[key].projectLink = taskProjectLink;
        }

        if (taskAssignee === 'web-designer') {
            acc[key].designer.push(task);
        } else {
            acc[key].developer.push(task);
        }

        return acc;
    }, {});

    const sortedTaskGroups = Object.values(groupedTasks).sort((a, b) => a.projectName.localeCompare(b.projectName));

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-12 pb-16"
        >
            {/* Top Bar / Clean Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
                <div className="relative flex-1 max-w-2xl group w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search tasks, teams, or assets..."
                        className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-2xl text-sm font-medium shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
                <div className="flex items-center gap-6">
                    <button className="p-4 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all relative">
                        <Bell size={24} />
                        <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-50" />
                    </button>
                    <button className="p-4 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all">
                        <Settings size={24} />
                    </button>
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <span className="text-xs font-black uppercase">OP</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                <div>
                    <h1 className="text-5xl font-black tracking-tight text-slate-800 mb-4">Task Board</h1>
                    <p className="text-slate-400 text-xl font-bold">Orchestrate the precision of every deliverable.</p>
                </div>
            </div>

            {/* Assign New Task Hub */}
            <section className="bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-[3rem] p-12 border border-blue-100/50 shadow-xl shadow-blue-500/5">
                <div className="flex items-center gap-6 mb-12">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                        <ListChecks size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-slate-800">Assign New Task</h2>
                    </div>
                </div>

                <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1">
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Task Title</label>
                        <input
                            type="text"
                            placeholder="Briefly define objective..."
                            className="w-full px-8 py-5 bg-white border-none rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none placeholder:text-slate-300"
                            value={newTitle}
                            onChange={(event) => setNewTitle(event.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Project Meta</label>
                        <select
                            className="w-full px-8 py-5 bg-white border-none rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none appearance-none cursor-pointer text-slate-400"
                            value={newProjectId}
                            onChange={(event) => setNewProjectId(event.target.value)}
                        >
                            <option value="">Select project</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Lane Track</label>
                        <select
                            className="w-full px-8 py-5 bg-white border-none rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none appearance-none cursor-pointer"
                            value={newAssignee}
                            onChange={(event) => setNewAssignee(event.target.value as TaskAssignee)}
                        >
                            <option value="web-designer">DESIGNER TRACK</option>
                            <option value="developer">DEVELOPER TRACK</option>
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Message & Notes</label>
                        <textarea
                            placeholder="Explain the nuance of this task..."
                            className="w-full px-8 py-8 bg-white border-none rounded-[2rem] text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none min-h-[160px] resize-none placeholder:text-slate-300"
                            value={newMessage}
                            onChange={(event) => setNewMessage(event.target.value)}
                        />
                    </div>
                    <div className="md:col-span-3 flex justify-end mt-4">
                        <button
                            type="submit"
                            className="px-12 py-5 bg-blue-600 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-blue-300 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            disabled={creating}
                        >
                            {creating ? <RefreshCw className="animate-spin" size={18} /> : 'Submit Task'}
                        </button>
                    </div>
                </form>
            </section>

            <div className="grid grid-cols-1 gap-16">
                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map((value) => (
                            <div key={value} className="h-64 skeleton rounded-[3rem]" />
                        ))}
                    </div>
                ) : sortedTaskGroups.length > 0 ? (
                    sortedTaskGroups.map((group) => {
                        const isExpanded = expandedProjects.has(group.projectId);
                        return (
                            <section key={group.projectId} className="bg-white border border-slate-100 rounded-[3.5rem] p-12 shadow-sm relative overflow-hidden group/folder">
                                {/* Folder Ear/Tab */}
                                <div className="absolute top-0 left-12 h-2 w-32 bg-blue-600 rounded-b-full opacity-50 transition-opacity group-hover/folder:opacity-100" />

                                <div className="flex items-center justify-between">
                                    <div
                                        className="flex items-center gap-6 cursor-pointer"
                                        onClick={() => toggleProjectExpansion(group.projectId)}
                                    >
                                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                                            <FolderKanban size={28} className="text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-black tracking-tight text-slate-800">
                                                {group.projectName}
                                            </h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                                                {group.designer.length + group.developer.length} Active Deliverables
                                            </p>
                                        </div>
                                        <div className="ml-4 p-2 bg-slate-50 rounded-xl text-slate-400 group-hover/folder:text-blue-600 transition-colors">
                                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button className="flex items-center gap-3 px-6 py-3 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                                            <Filter size={14} /> Filter
                                        </button>
                                        <button className="p-3 text-slate-300 hover:text-slate-600 transition-all"><MoreHorizontal size={24} /></button>
                                    </div>
                                </div>

                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                            animate={{ height: 'auto', opacity: 1, marginTop: 48 }}
                                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-4">
                                                {[
                                                    { title: 'Designer Track', tasks: group.designer, icon: Palette, color: 'cyan' },
                                                    { title: 'Developer Track', tasks: group.developer, icon: Terminal, color: 'indigo' },
                                                ].map((lane) => (
                                                    <div key={lane.title} className="space-y-8">
                                                        <div className={`flex items-center justify-between px-6 py-4 bg-${lane.color}-50/50 rounded-2xl`}>
                                                            <div className="flex items-center gap-4">
                                                                <lane.icon size={18} className={`text-${lane.color}-600`} />
                                                                <h4 className={`text-[11px] font-black uppercase tracking-[0.2em] text-${lane.color}-600`}>{lane.title}</h4>
                                                            </div>
                                                            <span className={`px-4 py-1.5 bg-white text-[10px] font-black text-${lane.color}-600 rounded-lg uppercase tracking-widest shadow-sm`}>{lane.tasks.length} Active</span>
                                                        </div>

                                                        <div className="space-y-6 min-h-[200px]">
                                                            {lane.tasks.length === 0 ? (
                                                                <div className="h-48 border-2 border-dashed border-slate-50 rounded-[2.5rem] flex items-center justify-center text-[10px] font-black text-slate-200 uppercase tracking-widest bg-slate-50/20">No active deliverables</div>
                                                            ) : lane.tasks.map((task) => {
                                                                const extras = taskExtras[task.id];
                                                                const taskMessage = task.message || extras?.message || '';
                                                                const status = getTaskStatus(task);

                                                                return (
                                                                    <motion.div
                                                                        key={task.id}
                                                                        layout
                                                                        className="bg-slate-50 border border-slate-100/50 p-10 rounded-[2.5rem] hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group/card"
                                                                    >
                                                                        <div className="space-y-6">
                                                                            <div className="flex justify-between items-start">
                                                                                <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${status === 'done' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                                    status === 'in-progress' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                                        'bg-rose-50 text-rose-500 border-rose-100'
                                                                                    }`}>
                                                                                    {status.replace('-', ' ')}
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => toggleTask(task)}
                                                                                    className="p-2 opacity-0 group-hover/card:opacity-100 text-slate-300 hover:text-blue-600 transition-all transition-opacity"
                                                                                >
                                                                                    <CheckCircle2 size={24} />
                                                                                </button>
                                                                            </div>

                                                                            <div className="space-y-3">
                                                                                <h5 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{task.title}</h5>
                                                                                {taskMessage && (
                                                                                    <p className="text-slate-400 text-sm font-bold leading-relaxed line-clamp-2">{taskMessage}</p>
                                                                                )}
                                                                            </div>

                                                                            <div className="pt-8 border-t border-slate-100/50 flex items-center justify-between">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className={`w-10 h-10 rounded-xl bg-${lane.color}-100 flex items-center justify-center text-${lane.color}-600 shadow-sm font-black text-[10px] uppercase`}>
                                                                                        {task.assignee === 'web-designer' ? 'DS' : 'DV'}
                                                                                    </div>
                                                                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                                                                        {task.assignee === 'web-designer' ? 'Designer' : 'Developer'}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
                                                                                    {new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </section>
                        );
                    })
                ) : (
                    <div className="bg-white p-24 text-center rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
                        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-200 mb-8">
                            <ListChecks size={64} strokeWidth={1} />
                        </div>
                        <h3 className="text-4xl font-black tracking-tight text-slate-800 mb-4">Empty Archives</h3>
                        <p className="text-slate-400 font-bold max-w-sm mx-auto leading-relaxed">No project folders detected. Initiate a new task above.</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default Tasks;
