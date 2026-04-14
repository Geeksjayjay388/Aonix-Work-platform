import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Settings, MessageSquare, ExternalLink, RefreshCw, Terminal, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
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

const Messages = () => {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readMarkerKeyRef = useRef<string | null>(null);

  const isMissingMessagesTableError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
    const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
    return code === 'PGRST205' || message.includes('messages');
  };

  const renderMessageContent = (content: string) => {
    const codeRegex = /```([\s\S]*?)```/g;
    const parts = content.split(codeRegex);

    if (parts.length === 1) return <p className="leading-relaxed">{content}</p>;

    return (
      <div className="space-y-4">
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            return (
              <div key={i} className="bg-slate-900 rounded-2xl p-6 font-mono text-xs text-slate-300 relative group overflow-hidden border border-slate-800">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Terminal size={14} className="text-slate-500" />
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed">{part.trim()}</pre>
              </div>
            );
          }
          return part.trim() && <p key={i} className="leading-relaxed">{part}</p>;
        })}
      </div>
    );
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
    <div className="flex bg-white h-[calc(100vh-120px)] rounded-[3rem] overflow-hidden border border-slate-100 shadow-2xl relative">

      {/* 1. Project Sidebar (Left) */}
      <aside className="w-[300px] bg-slate-50 border-r border-slate-100 flex flex-col p-8">
        <nav className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 px-6">Active Projects</h3>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setSelectedProjectId(project.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${selectedProjectId === project.id ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedProjectId === project.id ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                <Briefcase size={16} />
              </div>
              <span className={`text-[11px] font-black uppercase tracking-widest text-left truncate ${selectedProjectId === project.id ? 'text-blue-600' : 'text-slate-400'}`}>
                {project.name.toLowerCase()}
              </span>
            </button>
          ))}
        </nav>

        <div className="space-y-2 pt-8 border-t border-slate-200/50">
          <button className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <Settings size={20} />
            <span className="text-[11px] font-black uppercase tracking-widest text-left">Preferences</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area (Center) */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">

        {/* Internal Header */}
        <header className="h-[100px] border-b border-slate-50 px-10 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <h1 className="text-xl font-black text-slate-800 tracking-tight lowercase">Aonix Ether</h1>
          </div>
        </header>

        {/* Messaging Area Header */}
        <div className="px-10 py-8 flex items-center justify-between bg-white border-b border-slate-50/50">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-slate-800 tracking-tight lowercase">
                {projects.find(p => p.id === selectedProjectId)?.name || 'ether channel'}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{messages.length} messages • Real-time sync active</p>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto px-10 py-10 space-y-12 custom-scrollbar bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <MessageSquare size={80} className="text-slate-200 mb-6" />
                </motion.div>
                <p className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Signal initialization required</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-6 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-[1.25rem] bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
                        <img
                          src={`https://ui-avatars.com/api/?name=${msg.sender_name.replace(' ', '+')}&background=${isMe ? '0ea5e9' : '334155'}&color=fff`}
                          className="w-full h-full object-cover"
                          alt="Avatar"
                        />
                      </div>
                    </div>
                    <div className={`space-y-4 max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col w-full`}>
                      <div className={`flex items-baseline gap-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-sm font-black text-slate-800 tracking-tight">{msg.sender_name} {isMe && '(You)'}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className={`px-10 py-8 rounded-[2.5rem] text-lg font-black border ${isMe
                        ? 'bg-blue-600 text-white border-blue-500 shadow-2xl shadow-blue-100 rounded-tr-sm'
                        : 'bg-slate-50 text-slate-800 border-slate-100 rounded-tl-sm shadow-sm'
                        }`}>
                        {renderMessageContent(msg.content)}
                      </div>

                      {msg.image_url && getDisplayImage(msg) && (
                        <div className="rounded-[2rem] overflow-hidden border border-slate-100 shadow-xl w-full max-w-lg group relative">
                          <img src={getDisplayImage(msg)!} className="w-full h-auto" alt="Asset" onError={() => setFailedImages(prev => ({ ...prev, [msg.id]: true }))} />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-white hover:bg-white/40 transition-all"><ExternalLink size={20} /></button>
                          </div>
                        </div>
                      )}

                      {msg.image_url && failedImages[msg.id] && (
                        <button
                          type="button"
                          onClick={() => retryResolveImage(msg)}
                          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-100 transition-all"
                        >
                          <RefreshCw size={12} className="animate-spin-slow" />
                          Retry Load
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Hub */}
        <div className="px-10 py-10 bg-white border-t border-slate-50">
          <AnimatePresence>
            {imagePreview && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mb-6 flex gap-3 items-end"
              >
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="rounded-2xl max-h-40 border border-slate-200 shadow-lg" />
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-2 hover:bg-rose-600 transition-all shadow-lg border-2 border-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="max-w-4xl mx-auto flex items-center gap-6 p-4 bg-slate-50 border border-slate-100 rounded-[2.5rem] shadow-sm relative group focus-within:bg-white focus-within:shadow-xl transition-all duration-300">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-4 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 transition-all flex-shrink-0 relative group"
              title="Upload image or video"
            >
              <ImageIcon size={20} />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-3 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                Image / Video
              </span>
            </button>
            <button className="p-4 text-slate-300 hover:text-slate-500 transition-all flex-shrink-0">
              <Terminal size={20} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !sending && handleSendMessage()}
              placeholder={`Message # Sprint 4 Design Review...`}
              className="flex-1 bg-transparent border-none text-slate-600 text-sm font-medium placeholder:text-slate-300 outline-none pr-6"
            />
            <button
              onClick={handleSendMessage}
              disabled={sending || (!newMessage.trim() && !imageFile)}
              className="px-10 py-4 bg-blue-600 rounded-[1.5rem] text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {sending ? <RefreshCw className="animate-spin" size={14} /> : 'Send'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;
