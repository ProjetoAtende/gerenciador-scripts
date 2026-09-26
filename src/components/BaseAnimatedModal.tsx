import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BaseAnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  floatingContent?: React.ReactNode;
  /** Classes CSS para o container do conteúdo (ex: max-w-lg, max-w-4xl) */
  contentClassName?: string;
  /** Classes CSS para o overlay/backdrop */
  overlayClassName?: string;
  /** z-index do modal (default: z-[9999]) */
  zIndex?: string;
  /** Se true, não fecha ao clicar no overlay */
  disableOverlayClose?: boolean;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0 },
};

const overlayTransition = { type: 'tween' as const, duration: 0.12, ease: 'easeOut' as const };
const contentTransition = { type: 'tween' as const, duration: 0.15, ease: 'easeOut' as const };

export const BaseAnimatedModal: React.FC<BaseAnimatedModalProps> = ({
  isOpen,
  onClose,
  children,
  floatingContent,
  contentClassName = 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden',
  overlayClassName = '',
  zIndex = 'z-[9999]',
  disableOverlayClose = false,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={overlayTransition}
          className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 p-4 ${overlayClassName}`}
          onClick={disableOverlayClose ? undefined : (e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="relative">
            {floatingContent}
            <motion.div
              key="modal-content"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={contentTransition}
              style={{ willChange: 'opacity, transform' }}
              className={contentClassName}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BaseAnimatedModal;
