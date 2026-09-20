/**
 * Electron IPC and domain models for Luna-Library.
 * Defines structures for folders, scanned entries, video files,
 * compressed archives, drive targets, and IPC response channels.
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

export interface CopyProgress {
  copiedBytes: number;
  totalBytes: number;
  percent: number;
  currentFile: string;
}

export type WindowAction = "minimize" | "maximize" | "close";

export interface ElectronAPI {
  controlWindow: (action: WindowAction) => void;
  selectDirectory: () => Promise<string | null>;
  selectImageFile: () => Promise<string | null>;
  scanLibraryFolder: (folderPath: string) => Promise<MovieEntry[]>;
  fetchMoviePoster: (title: string) => Promise<string | null>;
  decompressArchives: (
    entryFolderPath: string,
    deleteAfterExtraction?: boolean
  ) => Promise<{ success: boolean; message: string; extractedFiles: string[] }>;
  listDrives: () => Promise<DriveTarget[]>;
  copyEntryToDestination: (sourcePath: string, destinationPath: string) => Promise<{ success: boolean; error?: string }>;
  trashEntry: (targetPath: string) => Promise<boolean>;
  openInExplorer: (targetPath: string) => Promise<void>;
  toggleAlwaysOnTop: (enable?: boolean) => Promise<boolean>;
  isAlwaysOnTop: () => Promise<boolean>;
  openFloatingPlayer: (videoPath: string, title: string, startTime?: number) => Promise<void>;
}
