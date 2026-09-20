let electron = require("electron");
//#region electron/preload.ts
/**
* Preload script exposing secure IPC channels to the renderer process.
*/
electron.contextBridge.exposeInMainWorld("electronAPI", {
	controlWindow: (action) => {
		electron.ipcRenderer.send("window-control", action);
	},
	selectDirectory: async () => {
		return electron.ipcRenderer.invoke("select-directory");
	},
	selectImageFile: async () => {
		return electron.ipcRenderer.invoke("select-image-file");
	},
	scanLibraryFolder: async (folderPath) => {
		return electron.ipcRenderer.invoke("scan-library", folderPath);
	},
	fetchMoviePoster: async (title) => {
		return electron.ipcRenderer.invoke("fetch-poster", title);
	},
	decompressArchives: async (entryFolderPath, deleteAfterExtraction) => {
		return electron.ipcRenderer.invoke("decompress-archives", entryFolderPath, deleteAfterExtraction);
	},
	listDrives: async () => {
		return electron.ipcRenderer.invoke("list-drives");
	},
	copyEntryToDestination: async (sourcePath, destinationPath) => {
		return electron.ipcRenderer.invoke("copy-entry", sourcePath, destinationPath);
	},
	trashEntry: async (targetPath) => {
		return electron.ipcRenderer.invoke("trash-entry", targetPath);
	},
	openInExplorer: async (targetPath) => {
		return electron.ipcRenderer.invoke("open-in-explorer", targetPath);
	},
	toggleAlwaysOnTop: async (enable) => {
		return electron.ipcRenderer.invoke("toggle-always-on-top", enable);
	},
	isAlwaysOnTop: async () => {
		return electron.ipcRenderer.invoke("is-always-on-top");
	},
	openFloatingPlayer: async (videoPath, title, startTime = 0) => {
		return electron.ipcRenderer.invoke("open-floating-player", videoPath, title, startTime);
	}
});
//#endregion
