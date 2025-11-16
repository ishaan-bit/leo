'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonStyle?: 'destructive' | 'primary';
  requireTypeToConfirm?: boolean; // For extra safety on dangerous actions
  typeToConfirmText?: string; // e.g., "DELETE"
  isLoading?: boolean;
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Yes, delete',
  cancelText = 'Cancel',
  confirmButtonStyle = 'destructive',
  requireTypeToConfirm = false,
  typeToConfirmText = 'DELETE',
  isLoading = false,
}: ConfirmationDialogProps) {
  const [typedText, setTypedText] = useState('');

  const canConfirm = requireTypeToConfirm
    ? typedText === typeToConfirmText && !isLoading
    : !isLoading;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await onConfirm();
    setTypedText(''); // Reset for next time
  };

  const handleClose = () => {
    if (isLoading) return; // Prevent closing while loading
    setTypedText('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300]"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[301] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-sm rounded-2xl shadow-2xl p-6"
              style={{
                background: 'linear-gradient(135deg, #FFF9F5 0%, #FFF5F7 100%)',
              }}
            >
              {/* Title */}
              <h3 className="text-xl font-serif italic mb-4" style={{ color: '#7D2A4D' }}>
                {title}
              </h3>

              {/* Message */}
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#5D2A3A' }}>
                {message}
              </p>

              {/* Type-to-confirm input (optional) */}
              {requireTypeToConfirm && (
                <div className="mb-6">
                  <label className="block text-xs mb-2" style={{ color: '#A67C89' }}>
                    Type <span className="font-mono font-bold">{typeToConfirmText}</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-4 py-2 rounded-lg border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: '#5D2A3A' }}
                    placeholder={typeToConfirmText}
                    autoFocus
                  />
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm" style={{ color: '#A67C89' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-pink-300 border-t-pink-600 rounded-full"
                  />
                  <span>Deleting...</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(212, 184, 255, 0.2)',
                    color: '#7D2A4D',
                  }}
                >
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className={`flex-1 px-4 py-3 rounded-full text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    confirmButtonStyle === 'destructive'
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                      : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700'
                  }`}
                >
                  {confirmText}
                </button>
              </div>

              {/* Footer note for destructive actions */}
              {confirmButtonStyle === 'destructive' && (
                <p className="text-xs italic mt-4 text-center" style={{ color: '#B49AAA' }}>
                  This action cannot be undone.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
