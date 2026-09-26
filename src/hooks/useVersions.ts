// src/hooks/useVersions.ts

import { CHANGELOG, getCurrentVersionNumber, Version } from '../types/Version';

interface UseVersionsOptions {
  userId: string | null;
}

interface UseVersionsReturn {
  currentVersion: string;
  versions: Version[];
}

export const useVersions = ({ userId: _userId }: UseVersionsOptions): UseVersionsReturn => {
  const currentVersion = getCurrentVersionNumber();
  const versions = CHANGELOG;

  return {
    currentVersion,
    versions
  };
};
