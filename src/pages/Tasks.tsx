import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Circle,
    Search,
    Calendar,
    FolderKanban,
    ListChecks,
    Link2,
    MessageSquare,
    UserRoundPlus
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
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [newTitle, setNewTitle] = useState('');
    const [newProjectId, setNewProjectId] = useState('');
    const [newAssignee, setNewAssignee] = useState<TaskAssignee>('developer');
    const [newStatus, setNewStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
    const [newProjectLink, setNewProjectLink] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [creating, setCreating] = useState(false);
    const toast = useToast();

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
        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            assignee.toLowerCase().includes(searchTerm.toLowerCase()) ||
            message.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' ||
            (filter === 'completed' && task.is_completed) ||
            (filter === 'pending' && !task.is_completed);
        return matchesSearch && matchesFilter;
    });

    const getTaskStatus = (task: Task) => {
        const extras = taskExtras[task.id];
        if (task.status) return task.status;
        if (extras?.status) return extras.status;
        return task.is_completed ? 'done' : 'todo';
    };

    const updateTaskStatus = async (task: Task, status: 'todo' | 'in-progress' | 'done') => {
        const { error } = await supabase
            .from('tasks')
            .update({ status, is_completed: status === 'done' })
            .eq('id', task.id);

        if (error) {
            const extras = taskExtras[task.id];
            const fallbackExtras = {
                ...taskExtras,
                [task.id]: {
                    assignee: extras?.assignee || task.assignee || 'developer',
                    status,
                    projectLink: extras?.projectLink || task.project_link || '',
                    message: extras?.message || task.message || '',
                },
            };
            setTaskExtras(fallbackExtras);
            saveTaskExtrasToStorage(fallbackExtras);
        }
        fetchData();
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
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                    <h1 className="text-4xl font-semibold tracking-tight mb-2">Task Board</h1>
                    <p className="text-muted text-lg font-normal">Create, assign, and track work across your project team.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-4 top-4 w-5 h-5 text-muted group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter by task or project..."
                            className="pl-12 py-4 bg-white/50 border-2 border-border focus:border-primary/30 transition-all rounded-lg"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                    <div className="flex bg-white/50 border-2 border-border p-1.5 rounded-lg">
                        {(['all', 'pending', 'completed'] as const).map((value) => (
                            <button
                                key={value}
                                onClick={() => setFilter(value)}
                                className={`px-6 py-2.5 rounded-md text-[10px] font-semibold uppercase tracking-widest transition-all ${filter === value ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-muted hover:text-primary hover:bg-primary/5'}`}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <section className="glass-card p-8 bg-white space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <UserRoundPlus size={20} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold">Create Team Task</h2>
                        <p className="text-sm text-muted">Assign to developer or web designer, then attach links and notes.</p>
                    </div>
                </div>

                <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs text-muted mb-2 uppercase tracking-widest font-medium">Task title</label>
                        <input
                            type="text"
                            placeholder="Build contact form validation"
                            value={newTitle}
                            onChange={(event) => setNewTitle(event.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-2 uppercase tracking-widest font-medium">Project</label>
                        <select value={newProjectId} onChange={(event) => setNewProjectId(event.target.value)}>
                            <option value="">Select project</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-2 uppercase tracking-widest font-medium">Assignee</label>
                        <select value={newAssignee} onChange={(event) => setNewAssignee(event.target.value as TaskAssignee)}>
                            <option value="developer">Developer</option>
                            <option value="web-designer">Web Designer</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-2 uppercase tracking-widest font-medium">Status</label>
                        <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as 'todo' | 'in-progress' | 'done')}>
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="done">Done</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-2 uppercase tracking-widest font-medium">Project link</label>
                        <input
                            type="url"
                            placeholder="https://..."
                            value={newProjectLink}
                            onChange={(event) => setNewProjectLink(event.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-2 uppercase tracking-widest font-medium">Message</label>
                        <input
                            type="text"
                            placeholder="Any handoff notes"
                            value={newMessage}
                            onChange={(event) => setNewMessage(event.target.value)}
                        />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="premium-btn" disabled={creating}>
                            {creating ? 'Adding...' : 'Add Task'}
                        </button>
                    </div>
                </form>
            </section>

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3, 4, 5].map((value) => (
                            <div key={value} className="h-28 skeleton rounded-lg" />
                        ))}
                    </div>
                ) : sortedTaskGroups.length > 0 ? (
                    sortedTaskGroups.map((group) => (
                        <section key={group.projectId} className="glass-card p-6 md:p-8 bg-bg-card/80 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
                                <div>
                                    <h3 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                                        <FolderKanban size={22} className="text-primary" />
                                        {group.projectName}
                                    </h3>
                                    <p className="text-xs uppercase tracking-widest text-muted mt-2">
                                        Designer tasks on the left, developer tasks on the right
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    {group.projectLink && (
                                        <a
                                            href={group.projectLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 text-primary hover:underline text-xs uppercase tracking-widest"
                                        >
                                            <Link2 size={14} />
                                            Project link
                                        </a>
                                    )}
                                    <span className="badge badge-warning">Designer {group.designer.length}</span>
                                    <span className="badge badge-primary">Developer {group.developer.length}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {[
                                    { title: 'Designer', tasks: group.designer },
                                    { title: 'Developer', tasks: group.developer },
                                ].map((lane) => (
                                    <div key={lane.title} className="space-y-3">
                                        <h4 className="text-sm font-semibold uppercase tracking-widest text-muted">{lane.title}</h4>
                                        {(['todo', 'in-progress', 'done'] as const).map((status) => {
                                            const laneTasks = lane.tasks.filter((task) => getTaskStatus(task) === status);
                                            return (
                                                <div
                                                    key={status}
                                                    className="rounded-lg border border-border bg-bg-card/60 p-3"
                                                    onDragOver={(event) => event.preventDefault()}
                                                    onDrop={(event) => {
                                                        event.preventDefault();
                                                        const taskId = event.dataTransfer.getData('text/plain');
                                                        const target = lane.tasks.find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
                                                        if (target) updateTaskStatus(target, status);
                                                    }}
                                                >
                                                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                                                        {status === 'todo' ? 'To Do' : status === 'in-progress' ? 'In Progress' : 'Done'}
                                                    </div>
                                                    {laneTasks.length === 0 ? (
                                                        <div className="text-xs text-muted py-2">No tasks</div>
                                                    ) : laneTasks.map((task) => {
                                                        const extras = taskExtras[task.id];
                                                        const taskMessage = task.message || extras?.message || '';
                                                        return (
                                                            <div
                                                                key={task.id}
                                                                draggable
                                                                onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
                                                                className={`mb-2 last:mb-0 p-3 rounded-lg border cursor-grab active:cursor-grabbing ${task.is_completed ? 'border-success/30 bg-success/5' : 'border-border bg-bg-card/80'}`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <button
                                                                        onClick={() => toggleTask(task)}
                                                                        className="p-1 hover:bg-primary/5 rounded-full transition-all bg-transparent mt-0.5"
                                                                    >
                                                                        {task.is_completed ? (
                                                                            <CheckCircle2 className="text-success" size={20} strokeWidth={2.5} />
                                                                        ) : (
                                                                            <Circle className="text-border hover:text-primary" size={20} strokeWidth={2.5} />
                                                                        )}
                                                                    </button>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`font-semibold text-sm ${task.is_completed ? 'line-through text-muted' : 'text-text-main'}`}>
                                                                            {task.title}
                                                                        </p>
                                                                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted mt-2">
                                                                            <Calendar size={12} />
                                                                            {new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                        </div>
                                                                        {taskMessage && (
                                                                            <div className="mt-2 flex items-start gap-2 text-xs text-muted">
                                                                                <MessageSquare size={12} className="mt-0.5" />
                                                                                <p>{taskMessage}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))
                ) : (
                    <div className="glass-card p-20 text-center bg-bg-card/70 border-none rounded-lg shadow-premium flex flex-col items-center">
                        <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center text-primary/10 mb-8">
                            <ListChecks size={64} strokeWidth={1} />
                        </div>
                        <h3 className="text-3xl font-semibold tracking-tight mb-4 text-text-main">No Tasks Yet</h3>
                        <p className="text-muted font-normal max-w-sm mx-auto leading-relaxed">Add your first task above and assign it to your developer or web designer.</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default Tasks;
