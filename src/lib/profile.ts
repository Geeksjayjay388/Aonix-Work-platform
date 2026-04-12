import { supabase } from './supabase';
import type { Profile } from './supabase';

export type ResolvedProfile = {
  id: string;
  email: string;
  legalName: string;
  role: 'dev' | 'designer';
  title: string;
  studio: string;
};

const isMissingProfilesTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return code === 'PGRST205' || message.includes('profiles');
};

export const getResolvedProfile = async (): Promise<ResolvedProfile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const fallbackName = localStorage.getItem('profile_legal_name') || localStorage.getItem('profile_name') || user.email?.split('@')[0] || 'User';
  const fallbackRole = (localStorage.getItem('profile_role') as 'dev' | 'designer') || ((user.user_metadata?.role as 'dev' | 'designer') || 'dev');
  const fallbackTitle = localStorage.getItem('profile_title') || '';
  const fallbackStudio = localStorage.getItem('profile_studio') || '';

  if (error && !isMissingProfilesTableError(error)) {
    console.error('Error loading profile:', error);
  }

  const profile = data as Profile | null;
  const resolved: ResolvedProfile = {
    id: user.id,
    email: user.email || profile?.email || '',
    legalName: profile?.legal_name || fallbackName,
    role: (profile?.role as 'dev' | 'designer' | null) || fallbackRole,
    title: profile?.title || fallbackTitle,
    studio: profile?.studio || fallbackStudio,
  };

  localStorage.setItem('profile_legal_name', resolved.legalName);
  localStorage.setItem('profile_role', resolved.role);
  localStorage.setItem('profile_title', resolved.title);
  localStorage.setItem('profile_studio', resolved.studio);

  return resolved;
};

export const upsertCurrentUserProfile = async (values: Omit<ResolvedProfile, 'id' | 'email'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('No authenticated user') };

  const payload = {
    id: user.id,
    email: user.email || null,
    legal_name: values.legalName || null,
    role: values.role,
    title: values.title || null,
    studio: values.studio || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) return { error };
  return { error: null };
};
