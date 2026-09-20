import { app, BrowserWindow, ipcMain, dialog, protocol } from "electron";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { scanLibraryDirectory } from "./services/libraryService";
import { fetchMoviePoster } from "./services/posterService";
import { decompressAllInFolder } from "./services/archiveService";
import {
  listSystemDrives,
  copyFolderRecursive,
  trashEntry,
  openInExplorer,
} from "./services/driveService";

/**
 * Main Electron process entry point for Luna-Library.
 */
 * Luna-Library Electron Main Process.
 * Features:
 * - Native HTTP 206 Partial Content streaming for smooth video scrubbing & jumping
 * - Window controls & always-on-top management
 * - IPC handlers for library scanning, poster retrieval, archive decompression, and drive copy
 */

// Register privileged custom scheme 'media'
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let win: BrowserWindow | null = null;

// MIME type helper for video and images
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    case ".mov":
      return "video/quicktime";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".srt":
      return "text/plain";
    case ".vtt":
      return "text/vtt";
    default:
      return "application/octet-stream";
  }
}

//================ CREATE WINDOW =================//
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minHeight: 600,
    minWidth: 880,
    frame: false,
    show: false,
    backgroundColor: "#0d0e10",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: true,
    },
  });

  win.once("ready-to-show", () => win?.show());

  win
    .loadURL(
      isDev
        ? "http://localhost:5173"
        : `file://${path.join(__dirname, "../dist-vite/index.html")}`
    )
    .catch((err) => {
      console.error("[MAIN] loadURL failed:", err);
      win?.show();
    });

  win.on("closed", () => {
    win = null;
  });
}

//================ APP LIFECYCLE & PROTOCOLS =================//
app.whenReady().then(() => {
  // Handle media:// protocol with HTTP 206 Partial Content Range streaming
  protocol.handle("media", async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      let targetPath = parsedUrl.searchParams.get("path");

      if (!targetPath) {
        let raw = decodeURIComponent(request.url.replace(/^media:\/\/(local\/)?/, ""));
        if (raw.startsWith("/")) raw = raw.slice(1);
        if (/^[a-zA-Z]\//.test(raw)) {
          raw = raw[0] + ":" + raw.slice(1);
        }
        targetPath = raw;
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        return new Response("Media not found", { status: 404 });
      }

      const stat = fs.statSync(targetPath);
      const totalSize = stat.size;
      const mimeType = getMimeType(targetPath);
      const rangeHeader = request.headers.get("range");

      // If client requests specific byte range (standard for HTML5 video seeking)
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        const nodeStream = fs.createReadStream(targetPath, { start, end });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

        return new Response(webStream, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Content-Type": mimeType,
          },
        });
      }

      // If no Range header, stream whole file
      const nodeStream = fs.createReadStream(targetPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new Response(webStream, {
        status: 200,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": totalSize.toString(),
          "Content-Type": mimeType,
        },
      });
    } catch (err) {
      console.error("[MAIN] Media streaming protocol error:", err);
      return new Response("Media stream error", { status: 500 });
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

//================ IPC HANDLERS =================//

ipcMain.on("window-control", (_event, action) => {
  switch (action) {
    case "minimize":
      win?.minimize();
      break;
    case "maximize":
      if (win?.isMaximized()) {
        win.unmaximize();
      } else {
        win?.maximize();
      }
      break;
    case "close":
      win?.close();
      break;
  }
});

ipcMain.handle("select-directory", async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: "Select Movies Library Folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// Select local image file dialog (for setting custom poster)
ipcMain.handle("select-image-file", async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: "Select Poster Image",
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle("scan-library", async (_event, folderPath: string) => {
  return await scanLibraryDirectory(folderPath);
});

ipcMain.handle("fetch-poster", async (_event, title: string) => {
  return await fetchMoviePoster(title);
});

ipcMain.handle("decompress-archives", async (_event, entryFolderPath: string, deleteAfterExtraction?: boolean) => {
  return await decompressAllInFolder(entryFolderPath, deleteAfterExtraction);
});

ipcMain.handle("list-drives", async () => {
  return await listSystemDrives();
});

ipcMain.handle("copy-entry", async (_event, sourcePath: string, destinationPath: string) => {
  return await copyFolderRecursive(sourcePath, destinationPath);
});

ipcMain.handle("trash-entry", async (_event, targetPath: string) => {
  return await trashEntry(targetPath);
});

ipcMain.handle("open-in-explorer", async (_event, targetPath: string) => {
  return await openInExplorer(targetPath);
});

ipcMain.handle("toggle-always-on-top", async (_event, enable?: boolean) => {
  if (!win) return false;
  const current = win.isAlwaysOnTop();
  const next = typeof enable === "boolean" ? enable : !current;
  win.setAlwaysOnTop(next, "screen-saver");
  return win.isAlwaysOnTop();
});

ipcMain.handle("is-always-on-top", async () => {
  return win?.isAlwaysOnTop() || false;
});

// Floating pop-out mini player window
let floatPlayerWin: BrowserWindow | null = null;
ipcMain.handle("open-floating-player", async (_event, videoPath: string, title: string, startTime = 0) => {
  if (floatPlayerWin) {
    floatPlayerWin.focus();
    return;
  }

  floatPlayerWin = new BrowserWindow({
    width: 520,
    height: 300,
    minWidth: 320,
    minHeight: 180,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    backgroundColor: "#000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const queryParam = `?float=1&path=${encodeURIComponent(videoPath)}&title=${encodeURIComponent(title)}&time=${startTime}`;
  const floatUrl = isDev
    ? `http://localhost:5173/#/float${queryParam}`
    : `file://${path.join(__dirname, "../dist-vite/index.html")}#/float${queryParam}`;

  floatPlayerWin.loadURL(floatUrl);
  floatPlayerWin.on("closed", () => {
    floatPlayerWin = null;
  });
});
