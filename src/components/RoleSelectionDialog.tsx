import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Code2, Palette } from 'lucide-react';

interface RoleSelectionDialogProps {
  onRoleSelected: (role: 'dev' | 'designer') => void;
}

const RoleSelectionDialog: React.FC<RoleSelectionDialogProps> = ({ onRoleSelected }) => {
  const [selectedRole, setSelectedRole] = useState<'dev' | 'designer' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = async (role: 'dev' | 'designer') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: { role }
        });
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email ?? null,
          role,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        localStorage.setItem('profile_role', role);
        onRoleSelected(role);
      }
    } catch (error) {
      console.error('Error updating role:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="glass-card max-w-md w-full p-8 border-primary/20 shadow-2xl"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black mb-2">Welcome to Aonix Studio</h2>
          <p className="text-muted text-sm">Please select your role to get started</p>
        </div>

        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRole('dev')}
            disabled={loading}
            className={`w-full p-6 rounded-lg border-2 transition-all duration-300 flex items-center gap-4 ${
              selectedRole === 'dev'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            } disabled:opacity-50`}
          >
            <Code2 size={28} className="text-primary flex-shrink-0" />
            <div className="text-left">
              <p className="font-bold text-sm">Developer</p>
              <p className="text-xs text-muted">Build and code</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRole('designer')}
            disabled={loading}
            className={`w-full p-6 rounded-lg border-2 transition-all duration-300 flex items-center gap-4 ${
              selectedRole === 'designer'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            } disabled:opacity-50`}
          >
            <Palette size={28} className="text-primary flex-shrink-0" />
            <div className="text-left">
              <p className="font-bold text-sm">Designer</p>
              <p className="text-xs text-muted">Design and create</p>
            </div>
          </motion.button>
        </div>

        {selectedRole && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => handleRoleSelect(selectedRole)}
            disabled={loading}
            className="w-full mt-6 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Continue'}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
};

export default RoleSelectionDialog;
