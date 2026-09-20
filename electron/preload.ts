import { contextBridge, ipcRenderer } from "electron";
import { WindowAction, MovieEntry, DriveTarget } from "./types";

/**
 * Preload script exposing secure IPC channels to the renderer process.
 */

contextBridge.exposeInMainWorld("electronAPI", {
  controlWindow: (action: WindowAction) => {
    ipcRenderer.send("window-control", action);
  },

  selectDirectory: async (): Promise<string | null> => {
    return ipcRenderer.invoke("select-directory");
  },

  selectImageFile: async (): Promise<string | null> => {
    return ipcRenderer.invoke("select-image-file");
  },

  scanLibraryFolder: async (folderPath: string): Promise<MovieEntry[]> => {
    return ipcRenderer.invoke("scan-library", folderPath);
  },

  fetchMoviePoster: async (title: string): Promise<string | null> => {
    return ipcRenderer.invoke("fetch-poster", title);
  },

  decompressArchives: async (entryFolderPath: string, deleteAfterExtraction?: boolean) => {
    return ipcRenderer.invoke("decompress-archives", entryFolderPath, deleteAfterExtraction);
  },

  listDrives: async (): Promise<DriveTarget[]> => {
    return ipcRenderer.invoke("list-drives");
  },

  copyEntryToDestination: async (sourcePath: string, destinationPath: string) => {
    return ipcRenderer.invoke("copy-entry", sourcePath, destinationPath);
  },

  trashEntry: async (targetPath: string): Promise<boolean> => {
    return ipcRenderer.invoke("trash-entry", targetPath);
  },

  openInExplorer: async (targetPath: string): Promise<void> => {
    return ipcRenderer.invoke("open-in-explorer", targetPath);
  },

  toggleAlwaysOnTop: async (enable?: boolean): Promise<boolean> => {
    return ipcRenderer.invoke("toggle-always-on-top", enable);
  },

  isAlwaysOnTop: async (): Promise<boolean> => {
    return ipcRenderer.invoke("is-always-on-top");
  },

  openFloatingPlayer: async (videoPath: string, title: string, startTime = 0): Promise<void> => {
    return ipcRenderer.invoke("open-floating-player", videoPath, title, startTime);
  },
});
