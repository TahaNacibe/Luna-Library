/**
 * Type definitions for Luna-Library UI and State.
 * Includes library configuration, user watch progress, sorting, and filter options.
 */

export interface VideoFile {
  name: string;
  relativePath: string;
  fullPath: string;
  sizeBytes: number;
  extension: string;
}

export interface ArchiveFile {
  name: string;
  relativePath: string;
  fullPath: string;
  sizeBytes: number;
  extension: string;
}

export interface MovieEntry {
  id: string;
  name: string;
  folderPath: string;
  coverPath: string | null;
  coverUrl: string | null;
  videoFiles: VideoFile[];
  archives: ArchiveFile[];
  totalSizeBytes: number;
  modifiedTimeMs: number;
  hasSubtitles: boolean;
  isUncategorized?: boolean;
}

export interface DriveTarget {
  mountPath: string;
  label: string;
  isRemovable: boolean;
  freeBytes?: number;
  totalBytes?: number;
}

export type WatchStatus = "new" | "wanna_watch" | "watching" | "watched" | "unwatched";

export interface EntryUserData {
  status: WatchStatus;
  progressSeconds: number;
  durationSeconds: number;
  isFavorite: boolean;
  lastWatchedAt?: number;
  customPosterUrl?: string | null;
}

export interface LibraryFolder {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

export type SortOption =
  | "name_asc"
  | "name_desc"
  | "newest"
  | "size"
  | "status";

export type FilterStatus =
  | "all"
  | "new"
  | "wanna_watch"
  | "watching"
  | "watched"
  | "favorites";

// Global Window interface with Electron API
declare global {
  interface Window {
    electronAPI?: {
      controlWindow: (action: "minimize" | "maximize" | "close") => void;
      selectDirectory: () => Promise<string | null>;
      selectImageFile: () => Promise<string | null>;
      scanLibraryFolder: (folderPath: string) => Promise<MovieEntry[]>;
      fetchMoviePoster: (title: string) => Promise<string | null>;
      decompressArchives: (
        entryFolderPath: string,
        deleteAfterExtraction?: boolean
      ) => Promise<{ success: boolean; message: string; extractedFiles: string[] }>;
      listDrives: () => Promise<DriveTarget[]>;
      copyEntryToDestination: (
        sourcePath: string,
        destinationPath: string
      ) => Promise<{ success: boolean; error?: string }>;
      trashEntry: (targetPath: string) => Promise<boolean>;
      openInExplorer: (targetPath: string) => Promise<void>;
      toggleAlwaysOnTop: (enable?: boolean) => Promise<boolean>;
      isAlwaysOnTop: () => Promise<boolean>;
      openFloatingPlayer: (videoPath: string, title: string, startTime?: number) => Promise<void>;
    };
  }
}
