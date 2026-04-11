import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Message {
  id: string;
  sender_id: string;
  sender_email: string;
  sender_name: string;
  sender_role: string;
  receiver_id?: string | null;
  content: string;
  image_url?: string;
  created_at: string;
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

  const markMessagesAsRead = () => {
    if (!readMarkerKeyRef.current) return;
    localStorage.setItem(readMarkerKeyRef.current, new Date().toISOString());
    window.dispatchEvent(new CustomEvent('messages-read'));
  };

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const legalName = localStorage.getItem('profile_legal_name')?.trim() || '';
          const localRole = localStorage.getItem('profile_role');
          const metadataRole = user.user_metadata?.role as 'dev' | 'designer' | undefined;
          const resolvedRole: 'dev' | 'designer' = localRole === 'designer' || localRole === 'dev'
            ? localRole
            : (metadataRole === 'designer' || metadataRole === 'dev' ? metadataRole : 'dev');

          setCurrentUser({
            id: user.id,
            email: user.email || '',
            legal_name: legalName,
            role: resolvedRole
          });

          setProfileIncomplete(!legalName);
          readMarkerKeyRef.current = `messages_last_read_at_${user.id}`;
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

  // Fetch messages
  useEffect(() => {
    if (!currentUser) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
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
      .channel('all_messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
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
  }, [currentUser, messagesUnavailable]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    } catch (e) {
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

    const { data } = supabase.storage
      .from('message-images')
      .getPublicUrl(filePath);

    return data?.publicUrl || null;
  };

  const handleSendMessage = async () => {
    if (!currentUser || (!newMessage.trim() && !imageFile)) return;

    setSending(true);
    try {
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
          <p className="text-sm text-muted mt-1">All messages from your team</p>
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
                <p className="text-muted">No messages yet. Start a conversation!</p>
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
                      className="rounded-lg border p-3"
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
                      {msg.image_url && (
                        <img src={msg.image_url} alt="Message" className="rounded mb-2 max-w-full max-h-64" />
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
            disabled={sending || !!messagesUnavailable}
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
            disabled={sending || !!messagesUnavailable}
            className="flex-1 px-4 py-2 rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !!messagesUnavailable || (!newMessage.trim() && !imageFile)}
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
