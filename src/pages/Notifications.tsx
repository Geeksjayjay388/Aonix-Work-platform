import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, MessageSquare, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getResolvedProfile } from '../lib/profile';
import type { Activity as ActivityType } from '../lib/supabase';

type MessageSummary = {
  project_id: string | null;
  sender_name: string;
  created_at: string;
};

const Notifications: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState<MessageSummary[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      const profile = await getResolvedProfile();
      if (!profile) {
        setLoading(false);
        return;
      }

      const lastReadAt = localStorage.getItem(`messages_last_read_at_${profile.id}`) || new Date(0).toISOString();
      const [{ data: messagesData }, { data: activityData }] = await Promise.all([
        supabase
          .from('messages')
          .select('project_id, sender_name, created_at')
          .neq('sender_id', profile.id)
          .gt('created_at', lastReadAt)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('activities')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setUnreadMessages((messagesData || []) as MessageSummary[]);
      setActivities((activityData || []) as ActivityType[]);
      setLoading(false);
    };

    fetchNotifications();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading notifications...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight">Notifications</h1>
        <p className="text-muted">Unread messages and recent system activity.</p>
      </header>

      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-accent" />
          <h2 className="text-xl font-semibold">Unread messages</h2>
        </div>
        {unreadMessages.length === 0 ? (
          <p className="text-sm text-muted">No unread messages.</p>
        ) : (
          <div className="space-y-2">
            {unreadMessages.map((message, index) => (
              <div key={`${message.created_at}-${index}`} className="rounded border border-border p-3 bg-bg-card/70">
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare size={14} className="text-primary" />
                  <span className="font-semibold">{message.sender_name}</span>
                  <span className="text-muted">sent a new message</span>
                </div>
                <p className="text-xs text-muted mt-1">{new Date(message.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-primary" />
          <h2 className="text-xl font-semibold">Recent activity</h2>
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className="rounded border border-border p-3 bg-bg-card/70">
                <p className="font-medium">{activity.title}</p>
                <p className="text-xs text-muted mt-1">{new Date(activity.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
};

export default Notifications;
