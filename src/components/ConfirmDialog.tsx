import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  loading = false,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-card p-10 w-full max-w-lg shadow-2xl relative overflow-hidden bg-white rounded-[40px] border-none"
            role="dialog"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
          >
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary to-indigo-600" />

            <div className="flex items-start gap-6 mb-10">
              <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center flex-shrink-0 shadow-sm transition-colors ${isDangerous ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
                }`}>
                {isDangerous ? (
                  <AlertTriangle size={32} strokeWidth={2.5} />
                ) : (
                  <AlertTriangle size={32} strokeWidth={2.5} className="rotate-180" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <h2 id="confirm-dialog-title" className="text-3xl font-black tracking-tight text-text-main">
                  {title}
                </h2>
                <p id="confirm-dialog-description" className="text-muted text-lg font-medium leading-relaxed italic">
                  {message}
                </p>
              </div>
              <button
                onClick={onClose}
                className="bg-primary/5 p-3 rounded-2xl text-muted hover:text-accent hover:bg-accent/5 transition-all outline-none"
                aria-label="Close dialog"
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-end mt-4">
              <button
                onClick={onClose}
                className="px-8 py-4 bg-primary/5 text-muted text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary/10 hover:text-primary transition-all order-2 sm:order-1"
                disabled={loading}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-premium hover:scale-[1.02] active:scale-[0.98] order-1 sm:order-2 ${isDangerous
                    ? 'bg-accent text-white hover:bg-accent/90'
                    : 'premium-btn'
                  }`}
              >
                {loading ? 'Processing...' : confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
