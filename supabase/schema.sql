-- Aonix Platform Database Schema

-- Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    company TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'in-progress' CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    legal_name TEXT,
    role TEXT CHECK (role IN ('dev', 'designer')),
    title TEXT,
    studio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assignee TEXT DEFAULT 'developer' CHECK (assignee IN ('developer', 'web-designer')),
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
    project_link TEXT,
    message TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done'));
UPDATE tasks SET status = CASE WHEN is_completed THEN 'done' ELSE 'todo' END WHERE status IS NULL;

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL DEFAULT auth.uid(),
    sender_email TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('dev', 'designer')),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    content TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_project_created_at ON messages (project_id, created_at);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Update these for production)
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON clients;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON projects;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON tasks;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON payments;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON messages;
CREATE POLICY "Enable all for authenticated users only" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users only" ON projects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users only" ON profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users only" ON tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users only" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users only" ON messages FOR ALL USING (auth.role() = 'authenticated');

-- Activities Table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID DEFAULT auth.uid(),
    type TEXT NOT NULL, -- 'project', 'task', 'client', 'payment'
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'completed'
    entity_id UUID,
    title TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON activities;
CREATE POLICY "Enable all for authenticated users only" ON activities FOR ALL USING (auth.role() = 'authenticated');
