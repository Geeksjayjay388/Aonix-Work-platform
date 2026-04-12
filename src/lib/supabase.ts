import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Client = {
  id: string;
  name: string;
  email: string;
  company: string;
  created_at: string;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  created_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  assignee?: 'developer' | 'web-designer';
  status?: 'todo' | 'in-progress' | 'done';
  project_link?: string | null;
  message?: string | null;
  is_completed: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  legal_name: string | null;
  role: 'dev' | 'designer' | null;
  title: string | null;
  studio: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  project_id: string;
  client_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  due_date: string;
  created_at: string;
};

export type Activity = {
  id: string;
  user_id: string;
  type: 'project' | 'task' | 'client' | 'payment';
  action: 'created' | 'updated' | 'deleted' | 'completed';
  entity_id: string;
  title: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const logActivity = async (activity: Omit<Activity, 'id' | 'user_id' | 'created_at'>) => {
  const { error } = await supabase.from('activities').insert([activity]);
  if (error) console.error('Error logging activity:', error);
};
