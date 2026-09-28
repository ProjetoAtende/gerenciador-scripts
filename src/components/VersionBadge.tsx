// src/components/VersionBadge.tsx

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useVersions } from '../hooks/useVersions';
import { ChangelogModal } from './ChangelogModal';

/** Reative para exibir o badge de versão e o changelog na home. */
export const VERSION_BADGE_ENABLED = false;

interface VersionBadgeProps {
  userId: string | null;
}

export const VersionBadge = ({ userId }: VersionBadgeProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { currentVersion, versions } = useVersions({ userId });

  if (!VERSION_BADGE_ENABLED) {
    return null;
  }

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
          className="relative p-2 rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
          aria-label={`Versão ${currentVersion}, abrir changelog`}
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
