'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ConfirmationDialog from '@/components/molecules/ConfirmationDialog';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pigName?: string;
}

type ConfirmDialogState = {
  isOpen: boolean;
  action: 'clear-reflections' | 'clear-dream-letters' | 'delete-all-data' | 'delete-account' | null;
  isLoading: boolean;
};

export default function SettingsModal({ isOpen, onClose, pigName }: SettingsModalProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    action: null,
    isLoading: false,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isGuest = status === 'unauthenticated';

  // Sync sound toggle with global state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const muted = localStorage.getItem('leo.ambient.muted') === 'true';
      setSoundEnabled(!muted);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('leo.ambient.muted', (!newValue).toString());
      // Trigger storage event for other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'leo.ambient.muted',
        newValue: (!newValue).toString(),
      }));
    }
  };

  // Show toast notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/start' });
  };

  const handleDeleteAccount = async () => {
    setConfirmDialog({
      isOpen: true,
      action: 'delete-account',
      isLoading: false,
    });
  };

  const handleDownloadData = async () => {
    // TODO: Implement data export
    alert('Data export will be implemented soon');
  };

  const handleDeleteAllData = async () => {
    setConfirmDialog({
      isOpen: true,
      action: 'delete-all-data',
      isLoading: false,
    });
  };

  const handleClearDreamLetters = async () => {
    setConfirmDialog({
      isOpen: true,
      action: 'clear-dream-letters',
      isLoading: false,
    });
  };

  const handleClearReflections = async () => {
    setConfirmDialog({
      isOpen: true,
      action: 'clear-reflections',
      isLoading: false,
    });
  };

  const executeDeleteAction = async () => {
    if (!confirmDialog.action) return;

    setConfirmDialog(prev => ({ ...prev, isLoading: true }));

    try {
      switch (confirmDialog.action) {
        case 'clear-reflections':
          await handleClearReflectionsConfirmed();
          break;
        case 'clear-dream-letters':
          await handleClearDreamLettersConfirmed();
          break;
        case 'delete-all-data':
          await handleDeleteAllDataConfirmed();
          break;
        case 'delete-account':
          await handleDeleteAccountConfirmed();
          break;
      }
    } catch (error) {
      console.error('Delete action failed:', error);
      showToast('Something went wrong while deleting. Please try again in a bit.');
    } finally {
      setConfirmDialog({ isOpen: false, action: null, isLoading: false });
    }
  };

  const handleClearReflectionsConfirmed = async () => {
    const response = await fetch('/api/user/reflections', {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to clear reflections');
    }

    showToast("Done. It's like we never met these memories.");
    
    // Refresh the page to update Living City
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleClearDreamLettersConfirmed = async () => {
    const response = await fetch('/api/user/dream-letters', {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to clear dream letters');
    }

    showToast("Done. It's like we never met these memories.");
    
    // Refresh to update UI
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleDeleteAllDataConfirmed = async () => {
    const response = await fetch('/api/user', {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete all data');
    }

    showToast('Your traces here have been erased. If you ever return, your city will start fresh.');
    
    // Sign out and redirect after a brief delay
    setTimeout(async () => {
      if (!isGuest) {
        await signOut({ redirect: false });
      }
      router.push('/start');
    }, 2000);
  };

  const handleDeleteAccountConfirmed = async () => {
    // For now, delete all data is the same as delete account
    await handleDeleteAllDataConfirmed();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-md max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              style={{
                background: 'linear-gradient(135deg, #FFF9F5 0%, #FFF5F7 50%, #F8F4FB 100%)',
              }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-pink-200/30 flex items-center justify-between">
                <h2 className="text-2xl font-serif italic" style={{ color: '#7D2A4D' }}>
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="text-2xl text-pink-400 hover:text-pink-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-pink-100/50"
                  aria-label="Close settings"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                {/* Account Section */}
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#A67C89' }}>
                    Account
                  </h3>
                  <div className="space-y-2">
                    {!isGuest && session?.user && (
                      <div className="text-sm px-3 py-2 rounded-lg" style={{ color: '#5D2A3A', background: 'rgba(212, 184, 255, 0.1)' }}>
                        Signed in as <span className="font-medium">{session.user.name || session.user.email}</span>
                      </div>
                    )}
                    {!isGuest ? (
                      <>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                          style={{ color: '#5D2A3A' }}
                        >
                          Sign Out
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm text-red-600"
                        >
                          Delete Account
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => router.push('/start')}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                        style={{ color: '#5D2A3A' }}
                      >
                        Sign In with Google
                      </button>
                    )}
                  </div>
                </section>

                {/* Data & Privacy Section */}
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#A67C89' }}>
                    Data & Privacy
                  </h3>
                  <p className="text-xs italic mb-3" style={{ color: '#B49AAA' }}>
                    Your data stays yours. You can delete or download it anytime.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={handleDownloadData}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Download My Data
                    </button>
                    <button
                      onClick={handleDeleteAllData}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Delete All My Data
                    </button>
                    <button
                      onClick={handleClearDreamLetters}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Clear Dream Letters
                    </button>
                    <button
                      onClick={handleClearReflections}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Clear Reflections
                    </button>
                    <div className="border-t border-pink-200/30 my-3" />
                    <button
                      onClick={() => router.push('/terms')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Terms of Service
                    </button>
                    <button
                      onClick={() => router.push('/privacy')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Privacy Policy
                    </button>
                  </div>
                </section>

                {/* Experience Section */}
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#A67C89' }}>
                    Experience
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm" style={{ color: '#5D2A3A' }}>Sound</span>
                      <button
                        onClick={handleSoundToggle}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          soundEnabled ? 'bg-pink-400' : 'bg-gray-300'
                        }`}
                        aria-label={soundEnabled ? 'Sound on' : 'Sound off'}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            soundEnabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 opacity-50">
                      <span className="text-sm" style={{ color: '#5D2A3A' }}>Haptics</span>
                      <button
                        disabled
                        className="relative w-12 h-6 rounded-full bg-gray-200 cursor-not-allowed"
                        aria-label="Haptics (coming soon)"
                      >
                        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 opacity-50">
                      <span className="text-sm" style={{ color: '#5D2A3A' }}>Reduced Motion</span>
                      <button
                        disabled
                        className="relative w-12 h-6 rounded-full bg-gray-200 cursor-not-allowed"
                        aria-label="Reduced Motion (coming soon)"
                      >
                        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full" />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Notifications Section */}
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#A67C89' }}>
                    Notifications
                  </h3>
                  <p className="text-xs italic mb-3" style={{ color: '#B49AAA' }}>
                    Notifications are gentle reminders, never nagging.
                  </p>
                  <div className="space-y-3 opacity-50">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm" style={{ color: '#5D2A3A' }}>Dream Letter Reminder</span>
                      <button
                        disabled
                        className="relative w-12 h-6 rounded-full bg-gray-200 cursor-not-allowed"
                      >
                        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm" style={{ color: '#5D2A3A' }}>Weekly Reflection Reminder</span>
                      <button
                        disabled
                        className="relative w-12 h-6 rounded-full bg-gray-200 cursor-not-allowed"
                      >
                        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm" style={{ color: '#5D2A3A' }}>All Notifications Off</span>
                      <button
                        disabled
                        className="relative w-12 h-6 rounded-full bg-gray-200 cursor-not-allowed"
                      >
                        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full" />
                      </button>
                    </div>
                  </div>
                </section>

                {/* About Section */}
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#A67C89' }}>
                    About QuietDen
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowAboutModal(true)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      What is QuietDen?
                    </button>
                    <div className="text-sm px-3 py-2" style={{ color: '#B49AAA' }}>
                      Version 1.0.0
                    </div>
                    <button
                      onClick={() => window.open('mailto:support@quietden.com', '_blank')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Support / Contact
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Credits
                    </button>
                  </div>
                </section>

                {/* Legal Section */}
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#A67C89' }}>
                    Legal
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => router.push('/terms')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Terms of Service
                    </button>
                    <button
                      onClick={() => router.push('/privacy')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-100/50 transition-colors text-sm"
                      style={{ color: '#5D2A3A' }}
                    >
                      Privacy Policy
                    </button>
                    <button
                      disabled
                      className="w-full text-left px-3 py-2 rounded-lg text-sm opacity-50 cursor-not-allowed"
                      style={{ color: '#5D2A3A' }}
                    >
                      Open-Source Licenses
                    </button>
                  </div>
                  <p className="text-xs italic mt-3" style={{ color: '#B49AAA' }}>
                    QuietDen is a wellbeing experience, not medical advice.
                  </p>
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-pink-200/30">
                <button
                  onClick={onClose}
                  className="w-full px-6 py-3 rounded-full text-white font-medium transition-all hover:shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #D4A5B5 0%, #C98CA5 50%, #B87A9A 100%)',
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>

          {/* About Modal (nested) */}
          {showAboutModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[202] flex items-center justify-center p-4"
              onClick={() => setShowAboutModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-white rounded-2xl p-6 max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-serif italic mb-4" style={{ color: '#7D2A4D' }}>
                  What is QuietDen?
                </h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#5D2A3A' }}>
                  QuietDen is a gentle space for emotional reflection. Share what stirred in you today, 
                  and watch it transform into poetry, music, and moments of quiet understanding.
                </p>
                <p className="text-xs italic mb-4" style={{ color: '#B49AAA' }}>
                  Built with care for your wellbeing, privacy, and inner world.
                </p>
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="w-full px-6 py-2 rounded-full text-white"
                  style={{
                    background: 'linear-gradient(135deg, #D4A5B5 0%, #C98CA5 50%, #B87A9A 100%)',
                  }}
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* Confirmation Dialog */}
          <ConfirmationDialog
            isOpen={confirmDialog.isOpen}
            onClose={() => setConfirmDialog({ isOpen: false, action: null, isLoading: false })}
            onConfirm={executeDeleteAction}
            isLoading={confirmDialog.isLoading}
            title={
              confirmDialog.action === 'clear-reflections'
                ? 'Clear Reflections?'
                : confirmDialog.action === 'clear-dream-letters'
                ? 'Clear Dream Letters?'
                : confirmDialog.action === 'delete-all-data'
                ? 'Delete All Your Data?'
                : 'Delete Account?'
            }
            message={
              confirmDialog.action === 'clear-reflections'
                ? `This will erase all the reflections you've written so far. Your account and ${pigName || 'Pig'} will stay, but your windows will go dark. This cannot be undone.`
                : confirmDialog.action === 'clear-dream-letters'
                ? `This will remove all dream letters you've received so far, and cancel any that are still on their way. Your reflections will stay as they are.`
                : confirmDialog.action === 'delete-all-data'
                ? `This will erase your reflections, dream letters, and profile from QuietDen. Your ${pigName || 'Pig'} will forget everything you ever shared here. This cannot be undone.`
                : `This will delete your account and all associated data. This cannot be undone.`
            }
            requireTypeToConfirm={confirmDialog.action === 'delete-all-data' || confirmDialog.action === 'delete-account'}
            typeToConfirmText="DELETE"
            confirmButtonStyle="destructive"
          />

          {/* Toast Notification */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[302] px-6 py-3 rounded-full shadow-2xl max-w-md text-center"
                style={{
                  background: 'linear-gradient(135deg, #D4A5B5 0%, #C98CA5 50%, #B87A9A 100%)',
                  color: 'white',
                }}
              >
                <p className="text-sm font-medium">{toastMessage}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
