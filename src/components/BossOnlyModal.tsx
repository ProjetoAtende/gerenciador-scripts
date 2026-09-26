import React from 'react';
import { useBossOnlyModal } from '../hooks/useBossOnlyModal';
import { BossOnlyContent } from './BossOnlyContent';

interface BossOnlyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BossOnlyModal: React.FC<BossOnlyModalProps> = ({ isOpen, onClose }) => {
  const h = useBossOnlyModal({ isOpen, onClose });

  if (!isOpen) return null;

  return <BossOnlyContent {...h} />;
};

export default BossOnlyModal;
