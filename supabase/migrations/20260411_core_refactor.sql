-- Core refactor migration: profiles, task status, project-threaded messages

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

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS assignee TEXT DEFAULT 'developer' CHECK (assignee IN ('developer', 'web-designer')),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
    ADD COLUMN IF NOT EXISTS project_link TEXT,
    ADD COLUMN IF NOT EXISTS message TEXT;

UPDATE tasks
SET status = CASE WHEN is_completed THEN 'done' ELSE 'todo' END
WHERE status IS NULL;

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

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_project_created_at ON messages (project_id, created_at);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON tasks;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON messages;

CREATE POLICY "Enable all for authenticated users only" ON profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users only" ON tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users only" ON messages FOR ALL USING (auth.role() = 'authenticated');
