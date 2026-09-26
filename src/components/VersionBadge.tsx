// src/components/VersionBadge.tsx

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useVersions } from '../hooks/useVersions';
import { ChangelogModal } from './ChangelogModal';

interface VersionBadgeProps {
  userId: string | null;
}

export const VersionBadge = ({ userId }: VersionBadgeProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { currentVersion, versions } = useVersions({ userId });

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={handleOpenModal}
          className="relative p-2 rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-400"
          title={`Versão ${currentVersion}`}
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-medium hidden sm:inline">
              v{currentVersion}
            </span>
          </div>
        </button>
      </div>

      <ChangelogModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        versions={versions}
        currentVersion={currentVersion}
      />
    </>
  );
};
