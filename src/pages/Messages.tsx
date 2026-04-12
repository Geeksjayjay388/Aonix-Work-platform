import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getResolvedProfile } from '../lib/profile';

interface Message {
  id: string;
  sender_id: string;
  sender_email: string;
  sender_name: string;
  sender_role: string;
  project_id?: string | null;
  receiver_id?: string | null;
  content: string;
  image_url?: string;
  created_at: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  email: string;
  legal_name: string;
  role: 'dev' | 'designer';
}

const Messages: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [messagesUnavailable, setMessagesUnavailable] = useState<string | null>(null);
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectUnreadCounts, setProjectUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readMarkerKeyRef = useRef<string | null>(null);

  const isMissingMessagesTableError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
    const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
    return code === 'PGRST205' || message.includes('messages');
  };

  const getSenderColor = (senderId: string) => {
    const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b'];
    const hash = senderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palette[hash % palette.length];
  };

  const getStoragePathFromImageRef = (imageRef: string) => {
    if (!imageRef) return null;
    if (!imageRef.startsWith('http')) return imageRef;

    try {
      const url = new URL(imageRef);
      const match = url.pathname.match(/\/object\/(?:public|sign)\/message-images\/(.+)$/);
      if (!match || !match[1]) return null;
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  };

  const markMessagesAsRead = () => {
    if (!readMarkerKeyRef.current) return;
    localStorage.setItem(readMarkerKeyRef.current, new Date().toISOString());
    window.dispatchEvent(new CustomEvent('messages-read'));
  };

  const getDisplayImage = (message: Message) => {
    if (!message.image_url) return null;
    if (message.image_url.startsWith('http') || message.image_url.startsWith('data:')) {
      return message.image_url;
    }
    return resolvedImageUrls[message.id] || null;
  };

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const profile = await getResolvedProfile();
        if (profile) {
          setCurrentUser({
            id: profile.id,
            email: profile.email || '',
            legal_name: profile.legalName,
            role: profile.role
          });

          setProfileIncomplete(!profile.legalName);
          readMarkerKeyRef.current = `messages_last_read_at_${profile.id}`;
          markMessagesAsRead();
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading projects:', error);
        return;
      }

      const projectList = (data || []) as ProjectOption[];
      setProjects(projectList);
      if (projectList.length > 0) {
        setSelectedProjectId(prev => prev || projectList[0].id);
      }
    };

    fetchProjects();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || projects.length === 0) return;

    const loadProjectUnreadCounts = async () => {
      const lastReadAt = localStorage.getItem(`messages_last_read_at_${currentUser.id}`) || new Date(0).toISOString();
      const { data, error } = await supabase
        .from('messages')
        .select('project_id, sender_id, created_at')
        .neq('sender_id', currentUser.id)
        .gt('created_at', lastReadAt);

      if (error) {
        console.error('Error loading project unread counts:', error);
        return;
      }

      const counts: Record<string, number> = {};
      for (const project of projects) counts[project.id] = 0;
      (data || []).forEach((row: { project_id?: string | null }) => {
        if (!row.project_id) return;
        counts[row.project_id] = (counts[row.project_id] || 0) + 1;
      });
      setProjectUnreadCounts(counts);
    };

    loadProjectUnreadCounts();
  }, [currentUser, projects, messages.length]);

  // Fetch messages
  useEffect(() => {
    if (!currentUser || !selectedProjectId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('created_at', { ascending: true });

      if (error) {
        if (isMissingMessagesTableError(error)) {
          setMessagesUnavailable('Messages table not found in Supabase. Run the SQL schema update to enable chat.');
          setMessages([]);
        } else {
          console.error('Error loading messages:', error);
        }
        return;
      }

      setMessagesUnavailable(null);
      if (data) setMessages(data);
    };
    fetchMessages();

    if (messagesUnavailable) return;

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`project_messages_${selectedProjectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `project_id=eq.${selectedProjectId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = payload.new as Message;
          setMessages(prev => prev.some(msg => msg.id === incoming.id) ? prev : [...prev, incoming]);
          if (incoming.sender_id !== currentUser.id) {
            playNotificationSound();
            showNotification(`New message from ${incoming.sender_name}`);
          }
          markMessagesAsRead();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, selectedProjectId, messagesUnavailable]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const playNotificationSound = () => {
    try {
      const audioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audioCtor) return;
      const audioContext = new audioCtor();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      console.log('Audio notification failed (may be blocked by browser)');
    }
  };

  const showNotification = (message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Aonix Messages', { body: message });
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    markMessagesAsRead();
  }, [currentUser, messages.length]);

  useEffect(() => {
    const resolveImages = async () => {
      const nextResolved: Record<string, string> = {};

      await Promise.all(messages.map(async (msg) => {
        if (!msg.image_url) return;

        const storagePath = getStoragePathFromImageRef(msg.image_url);
        if (!storagePath) {
          nextResolved[msg.id] = msg.image_url;
          return;
        }

        const { data, error } = await supabase.storage
          .from('message-images')
          .createSignedUrl(storagePath, 60 * 60);

        if (error || !data?.signedUrl) {
          nextResolved[msg.id] = msg.image_url;
          return;
        }
        nextResolved[msg.id] = data.signedUrl;
      }));

      setResolvedImageUrls(prev => ({ ...prev, ...nextResolved }));
    };

    resolveImages();
  }, [messages]);

  const retryResolveImage = async (msg: Message) => {
    if (!msg.image_url) return;
    const storagePath = getStoragePathFromImageRef(msg.image_url);
    if (!storagePath) return;

    const { data, error } = await supabase.storage
      .from('message-images')
      .createSignedUrl(storagePath, 60 * 60);

    if (error || !data?.signedUrl) return;
    setResolvedImageUrls(prev => ({ ...prev, [msg.id]: data.signedUrl }));
    setFailedImages(prev => ({ ...prev, [msg.id]: false }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `messages/${fileName}`;

    const { error } = await supabase.storage
      .from('message-images')
      .upload(filePath, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    return filePath;
  };

  const handleSendMessage = async () => {
    if (!currentUser || !selectedProjectId || (!newMessage.trim() && !imageFile)) return;

    setSending(true);
    try {
      const previewAtSend = imagePreview;
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
        sender_id: currentUser.id,
        sender_email: currentUser.email,
        sender_name: currentUser.legal_name,
        sender_role: currentUser.role,
        project_id: selectedProjectId,
        content: newMessage || '',
        image_url: imageUrl
        })
        .select('*')
        .single();

      if (error) {
        if (isMissingMessagesTableError(error)) {
          setMessagesUnavailable('Messages table not found in Supabase. Run the SQL schema update to enable chat.');
        } else {
          console.error('Send error:', error);
        }
        return;
      }

      if (data) {
        const inserted = data as Message;
        if (previewAtSend && inserted.image_url) {
          setResolvedImageUrls(prev => ({ ...prev, [inserted.id]: previewAtSend }));
        }
        setMessages(prev => prev.some(msg => msg.id === inserted.id) ? prev : [...prev, inserted]);
      }

      setNewMessage('');
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse" />
          <p className="text-muted">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Unable to load user data</p>
      </div>
    );
  }

  if (profileIncomplete) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 text-center max-w-md"
        >
          <div className="w-16 h-16 bg-warning/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-warning" />
          </div>
          <h3 className="text-xl font-bold mb-2">Profile Incomplete</h3>
          <p className="text-muted text-sm mb-6">
            Please add your legal name to your profile before you can access the messaging feature.
          </p>
          <Link
            to="/settings?tab=profile"
            className="inline-block bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors"
          >
            Complete Profile
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      <div className="glass-card p-6 flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border pb-4 mb-4">
          <h2 className="text-2xl font-bold">Team Messages</h2>
          <p className="text-sm text-muted mt-1">Conversations are grouped by project</p>
          <div className="mt-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="max-w-sm"
              disabled={projects.length === 0}
            >
              {projects.length === 0 ? (
                <option value="">No projects available</option>
              ) : (
                projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {projectUnreadCounts[project.id] > 0
                      ? `${project.name} (${projectUnreadCounts[project.id]})`
                      : project.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        {messagesUnavailable && (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            {messagesUnavailable}
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 space-y-4">
          <AnimatePresence>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted">
                  {selectedProjectId ? 'No messages in this project yet. Start a conversation!' : 'Select a project to view messages.'}
                </p>
              </div>
            ) : (
              messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-xs lg:max-w-md">
                    <div
                      className="rounded-lg border p-3 text-text-main"
                      style={{
                        backgroundColor: `${getSenderColor(msg.sender_id)}1A`,
                        borderColor: `${getSenderColor(msg.sender_id)}66`
                      }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                          style={{ backgroundColor: getSenderColor(msg.sender_id) }}
                        >
                          {msg.sender_id === currentUser.id ? 'You' : msg.sender_name}
                        </span>
                        <span className="text-[10px] font-semibold uppercase text-muted">{msg.sender_role}</span>
                      </div>
                      {msg.image_url && getDisplayImage(msg) && (
                        <img
                          src={getDisplayImage(msg)!}
                          alt="Message"
                          className="rounded mb-2 max-w-full max-h-64"
                          onError={() => setFailedImages(prev => ({ ...prev, [msg.id]: true }))}
                        />
                      )}
                      {msg.image_url && failedImages[msg.id] && (
                        <button
                          type="button"
                          onClick={() => retryResolveImage(msg)}
                          className="mb-2 inline-flex items-center gap-2 rounded px-2 py-1 text-xs bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20"
                        >
                          <RefreshCw size={12} />
                          Retry image
                        </button>
                      )}
                      {msg.image_url && !getDisplayImage(msg) && (
                        <div className="rounded mb-2 px-3 py-2 text-xs bg-bg-card/70 border border-border text-muted">
                          Loading image...
                        </div>
                      )}
                      {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                      <p className="text-xs mt-1 text-muted">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img src={imagePreview} alt="Preview" className="rounded-lg max-h-32 border border-border" />
            <button
              onClick={() => {
                setImageFile(null);
                setImagePreview(null);
              }}
              className="absolute -top-2 -right-2 bg-accent text-white rounded-full p-1 hover:bg-accent/90"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || !!messagesUnavailable || !selectedProjectId}
            className="p-3 rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <ImageIcon size={20} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !sending && handleSendMessage()}
            placeholder="Type a message..."
            disabled={sending || !!messagesUnavailable || !selectedProjectId}
            className="flex-1 px-4 py-2 rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !!messagesUnavailable || !selectedProjectId || (!newMessage.trim() && !imageFile)}
            className="p-3 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Messages;
