//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let path = require("path");
path = __toESM(path);
let fs = require("fs");
fs = __toESM(fs);
let stream = require("stream");
let https = require("https");
https = __toESM(https);
let http = require("http");
http = __toESM(http);
let child_process = require("child_process");
let util = require("util");
//#region electron/services/libraryService.ts
/**
* Service responsible for scanning library directories and parsing movie folders.
* It identifies:
* 1. Subdirectory movie entries (with their internal videos, archives, and cover.jpg)
* 2. Standalone root video files directly in the library folder (e.g. Inception.mp4)
*/
var VIDEO_EXTENSIONS = new Set([
	".mp4",
	".mkv",
	".webm",
	".avi",
	".mov",
	".m4v",
	".wmv",
	".flv",
	".ts",
	".m2ts"
]);
var ARCHIVE_EXTENSIONS$1 = new Set([
	".zip",
	".rar",
	".7z",
	".tar",
	".gz",
	".bz2"
]);
var SUBTITLE_EXTENSIONS = new Set([
	".srt",
	".vtt",
	".sub",
	".ass"
]);
var COVER_PATTERNS = [
	"cover.jpg",
	"cover.png",
	"cover.jpeg",
	"cover.webp",
	"poster.jpg",
	"poster.png",
	"poster.jpeg",
	"folder.jpg",
	"folder.png",
	"backdrop.jpg",
	"front.jpg"
];
/**
* Normalizes title by removing release tags, resolutions, and brackets.
*/
function cleanMovieTitle(rawName) {
	let name = rawName.replace(/\.[^/.]+$/, "");
	name = name.replace(/[\._]/g, " ");
	name = name.replace(/\b(1080p|720p|2160p|4k|uhd|bluray|bdrip|webrip|web-dl|x264|x265|hevc|aac|dts|yify|rarbg|eztv|extended|remastered)\b/gi, "");
	name = name.replace(/\[.*?\]|\(.*?\)/g, " ").trim();
	name = name.replace(/\s+/g, " ").trim();
	return name || rawName;
}
/**
* Scans a folder recursively up to 4 levels deep to find videos and archives.
*/
function scanFolderDeep(baseDir, currentDir, depth = 0) {
	const result = {
		videos: [],
		archives: [],
		hasSubtitles: false,
		coverPath: null,
		totalSize: 0
	};
	if (depth > 4) return result;
	try {
		const items = fs.default.readdirSync(currentDir, { withFileTypes: true });
		if (!result.coverPath) for (const pattern of COVER_PATTERNS) {
			const matchingItem = items.find((it) => it.isFile() && it.name.toLowerCase() === pattern);
			if (matchingItem) {
				result.coverPath = path.default.join(currentDir, matchingItem.name);
				break;
			}
		}
		for (const item of items) {
			const fullPath = path.default.join(currentDir, item.name);
			const relativePath = path.default.relative(baseDir, fullPath);
			if (item.isDirectory()) {
				const sub = scanFolderDeep(baseDir, fullPath, depth + 1);
				result.videos.push(...sub.videos);
				result.archives.push(...sub.archives);
				result.totalSize += sub.totalSize;
				if (sub.hasSubtitles) result.hasSubtitles = true;
				if (!result.coverPath && sub.coverPath) result.coverPath = sub.coverPath;
			} else if (item.isFile()) try {
				const stat = fs.default.statSync(fullPath);
				result.totalSize += stat.size;
				const ext = path.default.extname(item.name).toLowerCase();
				if (VIDEO_EXTENSIONS.has(ext)) result.videos.push({
					name: item.name,
					relativePath,
					fullPath,
					sizeBytes: stat.size,
					extension: ext
				});
				else if (ARCHIVE_EXTENSIONS$1.has(ext)) result.archives.push({
					name: item.name,
					relativePath,
					fullPath,
					sizeBytes: stat.size,
					extension: ext
				});
				else if (SUBTITLE_EXTENSIONS.has(ext)) result.hasSubtitles = true;
				if (!result.coverPath && [
					".jpg",
					".jpeg",
					".png",
					".webp"
				].includes(ext)) {
					const lowerName = item.name.toLowerCase();
					if (lowerName.includes("cover") || lowerName.includes("poster") || lowerName.includes("folder")) result.coverPath = fullPath;
				}
			} catch {}
		}
	} catch (err) {
		console.error(`[libraryService] Failed to read directory ${currentDir}:`, err);
	}
	return result;
}
/**
* Main scanner function.
* Scans the root directory:
* 1. Parses subdirectories as movie folders.
* 2. Parses standalone video files located directly in the root of the library folder.
*/
async function scanLibraryDirectory(libraryPath) {
	if (!fs.default.existsSync(libraryPath)) throw new Error(`Directory not found: ${libraryPath}`);
	const entries = [];
	const dirItems = fs.default.readdirSync(libraryPath, { withFileTypes: true });
	for (const item of dirItems) {
		if (!item.isDirectory()) continue;
		if (item.name.startsWith(".") || item.name.startsWith("$")) continue;
		const entryFolderPath = path.default.join(libraryPath, item.name);
		let stat;
		try {
			stat = fs.default.statSync(entryFolderPath);
		} catch {
			continue;
		}
		const { videos, archives, hasSubtitles, coverPath, totalSize } = scanFolderDeep(entryFolderPath, entryFolderPath, 0);
		let finalCoverPath = coverPath;
		if (!finalCoverPath) try {
			const imgItem = fs.default.readdirSync(entryFolderPath, { withFileTypes: true }).find((f) => f.isFile() && [
				".jpg",
				".jpeg",
				".png",
				".webp"
			].includes(path.default.extname(f.name).toLowerCase()));
			if (imgItem) finalCoverPath = path.default.join(entryFolderPath, imgItem.name);
		} catch {}
		entries.push({
			id: Buffer.from(entryFolderPath).toString("base64url"),
			name: item.name,
			folderPath: entryFolderPath,
			coverPath: finalCoverPath,
			coverUrl: null,
			videoFiles: videos,
			archives,
			totalSizeBytes: totalSize,
			modifiedTimeMs: stat.mtimeMs,
			hasSubtitles
		});
	}
	const rootFiles = dirItems.filter((it) => it.isFile());
	const standaloneVideos = [];
	let rootTotalSize = 0;
	let rootLatestMtime = 0;
	let hasRootSubtitles = false;
	for (const item of rootFiles) {
		const ext = path.default.extname(item.name).toLowerCase();
		if (!VIDEO_EXTENSIONS.has(ext)) continue;
		const fullPath = path.default.join(libraryPath, item.name);
		try {
			const stat = fs.default.statSync(fullPath);
			rootTotalSize += stat.size;
			if (stat.mtimeMs > rootLatestMtime) rootLatestMtime = stat.mtimeMs;
			const baseNameWithoutExt = path.default.basename(item.name, ext).toLowerCase();
			if (rootFiles.some((f) => {
				const fExt = path.default.extname(f.name).toLowerCase();
				return SUBTITLE_EXTENSIONS.has(fExt) && path.default.basename(f.name, fExt).toLowerCase() === baseNameWithoutExt;
			})) hasRootSubtitles = true;
			standaloneVideos.push({
				name: item.name,
				relativePath: item.name,
				fullPath,
				sizeBytes: stat.size,
				extension: ext
			});
		} catch {}
	}
	if (standaloneVideos.length > 0) {
		standaloneVideos.sort((a, b) => a.name.localeCompare(b.name, void 0, {
			numeric: true,
			sensitivity: "base"
		}));
		entries.push({
			id: Buffer.from(path.default.join(libraryPath, "__uncategorized__")).toString("base64url"),
			name: "Uncategorized Videos",
			folderPath: libraryPath,
			coverPath: null,
			coverUrl: null,
			videoFiles: standaloneVideos,
			archives: [],
			totalSizeBytes: rootTotalSize,
			modifiedTimeMs: rootLatestMtime || Date.now(),
			hasSubtitles: hasRootSubtitles,
			isUncategorized: true
		});
	}
	return entries.sort((a, b) => {
		if (a.isUncategorized) return -1;
		if (b.isUncategorized) return 1;
		return a.name.localeCompare(b.name, void 0, {
			numeric: true,
			sensitivity: "base"
		});
	});
}
//#endregion
//#region electron/services/posterService.ts
/**
* Service to automatically fetch movie & video posters online when no local cover exists.
* Uses:
* 1. Wikipedia PageImages API (with pilicense=any & pithumbsize=600 for official theatrical posters)
* 2. TVMaze Singlesearch API (for series and shows)
* 3. Fallback DuckDuckGo / Open Search
* All endpoints require no private API key and provide high-resolution artwork.
*/
var posterCache = /* @__PURE__ */ new Map();
/**
* Helper to perform HTTPS/HTTP GET and return JSON response.
*/
function httpGetJson(url) {
	return new Promise((resolve) => {
		const req = (url.startsWith("https") ? https.default : http.default).get(url, {
			headers: {
				"User-Agent": "LunaLibrary/1.0 (https://github.com/Luna-Library; movie-posters@luna.app)",
				Accept: "application/json"
			},
			timeout: 7e3
		}, (res) => {
			if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
				resolve(null);
				return;
			}
			let data = "";
			res.on("data", (chunk) => data += chunk);
			res.on("end", () => {
				try {
					resolve(JSON.parse(data));
				} catch {
					resolve(null);
				}
			});
		});
		req.on("error", () => resolve(null));
		req.on("timeout", () => {
			req.destroy();
			resolve(null);
		});
	});
}
/**
* Fetches theatrical movie poster from Wikipedia PageImages API.
* Uses generator=search with 'film' keyword and pilicense=any to find promotional posters.
*/
async function fetchFromWikipedia(cleanedTitle) {
	try {
		const data = await httpGetJson(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanedTitle + " film")}&gsrlimit=1&prop=pageimages&pilicense=any&pithumbsize=600&format=json`);
		if (data?.query?.pages) {
			const firstPage = Object.values(data.query.pages)[0];
			if (firstPage?.thumbnail?.source) return firstPage.thumbnail.source;
		}
	} catch {}
	return null;
}
/**
* Fetches poster image from TVMaze API (ideal for TV shows & series).
*/
async function fetchFromTVMaze(cleanedTitle) {
	try {
		const data = await httpGetJson(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanedTitle)}`);
		if (data?.image?.original) return data.image.original;
		if (data?.image?.medium) return data.image.medium;
	} catch {}
	return null;
}
/**
* Secondary search on Wikipedia without the 'film' suffix for general entries or documentaries.
*/
async function fetchFromWikipediaGeneral(cleanedTitle) {
	try {
		const data = await httpGetJson(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanedTitle)}&gsrlimit=1&prop=pageimages&pilicense=any&pithumbsize=600&format=json`);
		if (data?.query?.pages) {
			const firstPage = Object.values(data.query.pages)[0];
			if (firstPage?.thumbnail?.source) return firstPage.thumbnail.source;
		}
	} catch {}
	return null;
}
/**
* Main poster resolver.
* Cleans the folder/entry name, checks memory cache, and queries providers.
*/
async function fetchMoviePoster(title) {
	const cleaned = cleanMovieTitle(title);
	if (!cleaned) return null;
	if (posterCache.has(cleaned)) return posterCache.get(cleaned) || null;
	let poster = await fetchFromWikipedia(cleaned);
	if (!poster) poster = await fetchFromTVMaze(cleaned);
	if (!poster) poster = await fetchFromWikipediaGeneral(cleaned);
	posterCache.set(cleaned, poster);
	return poster;
}
//#endregion
//#region electron/services/archiveService.ts
var execAsync$1 = (0, util.promisify)(child_process.exec);
/**
* Safely removes an archive file after extraction on Windows.
* Retries if process locks haven't released yet, and falls back to shell.trashItem.
*/
async function safelyRemoveArchiveFile(archivePath) {
	await new Promise((resolve) => setTimeout(resolve, 150));
	for (let attempt = 1; attempt <= 3; attempt++) try {
		if (!fs.default.existsSync(archivePath)) return true;
		try {
			fs.default.chmodSync(archivePath, 438);
		} catch {}
		fs.default.unlinkSync(archivePath);
		return true;
	} catch (err) {
		if (attempt === 3) try {
			if (fs.default.existsSync(archivePath)) {
				await electron.shell.trashItem(archivePath);
				return true;
			}
		} catch (shellErr) {
			console.warn("[archiveService] Failed to remove archive file:", archivePath, err, shellErr);
		}
		else await new Promise((resolve) => setTimeout(resolve, 200));
	}
	return false;
}
/**
* Service to decompress compressed movie/video archives (.zip, .rar, .7z, .tar, .gz)
* in one click. Utilizes Windows built-in tar.exe (libarchive) and PowerShell
* Expand-Archive, ensuring high performance without requiring third-party native binaries.
*/
var ARCHIVE_EXTENSIONS = new Set([
	".zip",
	".rar",
	".7z",
	".tar",
	".gz",
	".bz2"
]);
/**
* Finds all archive files inside a directory (shallow or deep).
*/
function findArchivesInFolder(folderPath) {
	const archives = [];
	function walk(current, depth = 0) {
		if (depth > 3) return;
		try {
			const items = fs.default.readdirSync(current, { withFileTypes: true });
			for (const item of items) {
				const full = path.default.join(current, item.name);
				if (item.isDirectory()) walk(full, depth + 1);
				else if (item.isFile()) {
					const ext = path.default.extname(item.name).toLowerCase();
					if (ARCHIVE_EXTENSIONS.has(ext)) archives.push(full);
				}
			}
		} catch {}
	}
	walk(folderPath);
	return archives;
}
/**
* Decompresses a single archive file into its parent directory.
*/
async function decompressSingleArchive(archivePath, destinationDir) {
	const ext = path.default.extname(archivePath).toLowerCase();
	try {
		const tarCmd = `tar.exe -xf "${archivePath}" -C "${destinationDir}"`;
		try {
			await execAsync$1(tarCmd, { windowsHide: true });
			return true;
		} catch {}
		if (ext === ".zip") {
			await execAsync$1(`powershell -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force"`, { windowsHide: true });
			return true;
		}
		for (const szPath of ["C:\\Program Files\\7-Zip\\7z.exe", "C:\\Program Files (x86)\\7-Zip\\7z.exe"]) if (fs.default.existsSync(szPath)) {
			await execAsync$1(`"${szPath}" x "${archivePath}" -o"${destinationDir}" -y`, { windowsHide: true });
			return true;
		}
		for (const wrPath of [
			"C:\\Program Files\\WinRAR\\UnRAR.exe",
			"C:\\Program Files (x86)\\WinRAR\\UnRAR.exe",
			"C:\\Program Files\\WinRAR\\WinRAR.exe"
		]) if (fs.default.existsSync(wrPath)) {
			await execAsync$1(`"${wrPath}" x -ibck -o+ "${archivePath}" "${destinationDir}\\"`, { windowsHide: true });
			return true;
		}
		return false;
	} catch (err) {
		console.error(`[archiveService] Error extracting ${archivePath}:`, err);
		return false;
	}
}
/**
* 1-Click Batch Decompressor for a movie folder.
* Finds all archives and decompresses each into the folder, then optionally deletes the compressed archives.
*/
async function decompressAllInFolder(entryFolderPath, deleteAfterExtraction = false) {
	if (!fs.default.existsSync(entryFolderPath)) return {
		success: false,
		message: "Folder does not exist",
		extractedFiles: []
	};
	const archivePaths = findArchivesInFolder(entryFolderPath);
	if (archivePaths.length === 0) return {
		success: true,
		message: "No compressed archives found in this folder.",
		extractedFiles: []
	};
	const extracted = [];
	let failureCount = 0;
	for (const archive of archivePaths) if (await decompressSingleArchive(archive, path.default.dirname(archive))) {
		extracted.push(path.default.basename(archive));
		if (deleteAfterExtraction) await safelyRemoveArchiveFile(archive);
	} else failureCount++;
	if (extracted.length > 0) return {
		success: true,
		message: `Successfully decompressed ${extracted.length} archive(s)${deleteAfterExtraction ? " and removed original archive(s)" : ""}${failureCount > 0 ? ` (${failureCount} failed)` : ""}.`,
		extractedFiles: extracted
	};
	return {
		success: false,
		message: "Failed to extract archives. Please ensure archive format is supported.",
		extractedFiles: []
	};
}
//#endregion
//#region electron/services/driveService.ts
var execAsync = (0, util.promisify)(child_process.exec);
/**
* Service to manage system drives, USB removable media detection,
* file copy operations, and safe deletion to the Recycle Bin.
*/
/**
* Lists mounted drives on the Windows system.
* Identifies removable/USB drives and available disk letters.
*/
async function listSystemDrives() {
	const drives = [];
	try {
		const { stdout } = await execAsync(`powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, DriveType, FreeSpace, Size | ConvertTo-Json"`, { windowsHide: true });
		if (stdout && stdout.trim()) {
			let parsed = JSON.parse(stdout.trim());
			if (!Array.isArray(parsed)) parsed = [parsed];
			for (const disk of parsed) {
				if (!disk.DeviceID) continue;
				const driveLetter = `${disk.DeviceID}\\`;
				const isRemovable = disk.DriveType === 2;
				const label = disk.VolumeName || (isRemovable ? "USB Drive" : "Local Disk");
				drives.push({
					mountPath: driveLetter,
					label: `${label} (${disk.DeviceID})`,
					isRemovable,
					freeBytes: disk.FreeSpace ? Number(disk.FreeSpace) : void 0,
					totalBytes: disk.Size ? Number(disk.Size) : void 0
				});
			}
		}
	} catch (err) {
		console.error("[driveService] Error querying drives via PowerShell:", err);
		const letters = "DEFGHIJKLMNOPQRSTUVWXYZ".split("");
		for (const l of letters) {
			const p = `${l}:\\`;
			try {
				if (fs.default.existsSync(p)) drives.push({
					mountPath: p,
					label: `Drive (${l}:)`,
					isRemovable: l !== "C"
				});
			} catch {}
		}
	}
	return drives;
}
/**
* Recursively copies a folder and its contents to a destination directory.
*/
async function copyFolderRecursive(sourceDir, destinationParentDir) {
	try {
		if (!fs.default.existsSync(sourceDir)) return {
			success: false,
			error: "Source folder does not exist"
		};
		if (!fs.default.existsSync(destinationParentDir)) fs.default.mkdirSync(destinationParentDir, { recursive: true });
		const folderName = path.default.basename(sourceDir);
		const targetDir = path.default.join(destinationParentDir, folderName);
		const robocopyCmd = `robocopy "${sourceDir}" "${targetDir}" /E /R:1 /W:1 /MT:8`;
		try {
			await execAsync(robocopyCmd, { windowsHide: true });
			return { success: true };
		} catch (rcError) {
			if (rcError && rcError.code <= 7) return { success: true };
		}
		await fs.default.promises.cp(sourceDir, targetDir, { recursive: true });
		return { success: true };
	} catch (err) {
		console.error("[driveService] Copy failed:", err);
		return {
			success: false,
			error: err?.message || "Failed to copy folder"
		};
	}
}
/**
* Moves an item safely to the Windows Recycle Bin.
*/
async function trashEntry(targetPath) {
	try {
		if (fs.default.existsSync(targetPath)) {
			await electron.shell.trashItem(targetPath);
			return true;
		}
		return false;
	} catch (err) {
		console.error("[driveService] Error moving to trash:", err);
		return false;
	}
}
/**
* Opens a folder or file in the native Windows Explorer.
*/
async function openInExplorer(targetPath) {
	try {
		if (fs.default.existsSync(targetPath)) await electron.shell.openPath(targetPath);
	} catch (err) {
		console.error("[driveService] Error opening path:", err);
	}
}
//#endregion
//#region electron/main.ts
/**
* Luna-Library Electron Main Process.
* Features:
* - Native HTTP 206 Partial Content streaming for smooth video scrubbing & jumping
* - Window controls & always-on-top management
* - IPC handlers for library scanning, poster retrieval, archive decompression, and drive copy
*/
electron.protocol.registerSchemesAsPrivileged([{
	scheme: "media",
	privileges: {
		standard: true,
		secure: true,
		supportFetchAPI: true,
		corsEnabled: true,
		stream: true
	}
}]);
var isDev = process.env.NODE_ENV === "development" || !electron.app.isPackaged;
var win = null;
function getMimeType(filePath) {
	switch (path.default.extname(filePath).toLowerCase()) {
		case ".mp4":
		case ".m4v": return "video/mp4";
		case ".webm": return "video/webm";
		case ".mkv": return "video/x-matroska";
		case ".avi": return "video/x-msvideo";
		case ".mov": return "video/quicktime";
		case ".jpg":
		case ".jpeg": return "image/jpeg";
		case ".png": return "image/png";
		case ".webp": return "image/webp";
		case ".gif": return "image/gif";
		case ".srt": return "text/plain";
		case ".vtt": return "text/vtt";
		default: return "application/octet-stream";
	}
}
function createWindow() {
	win = new electron.BrowserWindow({
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
			preload: path.default.join(__dirname, "preload.js"),
			webSecurity: true
		}
	});
	win.once("ready-to-show", () => win?.show());
	win.loadURL(isDev ? "http://localhost:5173" : `file://${path.default.join(__dirname, "../dist-vite/index.html")}`).catch((err) => {
		console.error("[MAIN] loadURL failed:", err);
		win?.show();
	});
	win.on("closed", () => {
		win = null;
	});
}
electron.app.whenReady().then(() => {
	electron.protocol.handle("media", async (request) => {
		try {
			let targetPath = new URL(request.url).searchParams.get("path");
			if (!targetPath) {
				let raw = decodeURIComponent(request.url.replace(/^media:\/\/(local\/)?/, ""));
				if (raw.startsWith("/")) raw = raw.slice(1);
				if (/^[a-zA-Z]\//.test(raw)) raw = raw[0] + ":" + raw.slice(1);
				targetPath = raw;
			}
			if (!targetPath || !fs.default.existsSync(targetPath)) return new Response("Media not found", { status: 404 });
			const totalSize = fs.default.statSync(targetPath).size;
			const mimeType = getMimeType(targetPath);
			const rangeHeader = request.headers.get("range");
			if (rangeHeader) {
				const parts = rangeHeader.replace(/bytes=/, "").split("-");
				const start = parseInt(parts[0], 10);
				const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
				const chunkSize = end - start + 1;
				const nodeStream = fs.default.createReadStream(targetPath, {
					start,
					end
				});
				const webStream = stream.Readable.toWeb(nodeStream);
				return new Response(webStream, {
					status: 206,
					headers: {
						"Content-Range": `bytes ${start}-${end}/${totalSize}`,
						"Accept-Ranges": "bytes",
						"Content-Length": chunkSize.toString(),
						"Content-Type": mimeType
					}
				});
			}
			const nodeStream = fs.default.createReadStream(targetPath);
			const webStream = stream.Readable.toWeb(nodeStream);
			return new Response(webStream, {
				status: 200,
				headers: {
					"Accept-Ranges": "bytes",
					"Content-Length": totalSize.toString(),
					"Content-Type": mimeType
				}
			});
		} catch (err) {
			console.error("[MAIN] Media streaming protocol error:", err);
			return new Response("Media stream error", { status: 500 });
		}
	});
	createWindow();
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.on("window-control", (_event, action) => {
	switch (action) {
		case "minimize":
			win?.minimize();
			break;
		case "maximize":
			if (win?.isMaximized()) win.unmaximize();
			else win?.maximize();
			break;
		case "close":
			win?.close();
			break;
	}
});
electron.ipcMain.handle("select-directory", async () => {
	if (!win) return null;
	const result = await electron.dialog.showOpenDialog(win, {
		title: "Select Movies Library Folder",
		properties: ["openDirectory"]
	});
	if (result.canceled || result.filePaths.length === 0) return null;
	return result.filePaths[0];
});
electron.ipcMain.handle("select-image-file", async () => {
	if (!win) return null;
	const result = await electron.dialog.showOpenDialog(win, {
		title: "Select Poster Image",
		properties: ["openFile"],
		filters: [{
			name: "Images",
			extensions: [
				"jpg",
				"jpeg",
				"png",
				"webp",
				"gif"
			]
		}]
	});
	if (result.canceled || result.filePaths.length === 0) return null;
	return result.filePaths[0];
});
electron.ipcMain.handle("scan-library", async (_event, folderPath) => {
	return await scanLibraryDirectory(folderPath);
});
electron.ipcMain.handle("fetch-poster", async (_event, title) => {
	return await fetchMoviePoster(title);
});
electron.ipcMain.handle("decompress-archives", async (_event, entryFolderPath, deleteAfterExtraction) => {
	return await decompressAllInFolder(entryFolderPath, deleteAfterExtraction);
});
electron.ipcMain.handle("list-drives", async () => {
	return await listSystemDrives();
});
electron.ipcMain.handle("copy-entry", async (_event, sourcePath, destinationPath) => {
	return await copyFolderRecursive(sourcePath, destinationPath);
});
electron.ipcMain.handle("trash-entry", async (_event, targetPath) => {
	return await trashEntry(targetPath);
});
electron.ipcMain.handle("open-in-explorer", async (_event, targetPath) => {
	return await openInExplorer(targetPath);
});
electron.ipcMain.handle("toggle-always-on-top", async (_event, enable) => {
	if (!win) return false;
	const current = win.isAlwaysOnTop();
	const next = typeof enable === "boolean" ? enable : !current;
	win.setAlwaysOnTop(next, "screen-saver");
	return win.isAlwaysOnTop();
});
electron.ipcMain.handle("is-always-on-top", async () => {
	return win?.isAlwaysOnTop() || false;
});
var floatPlayerWin = null;
electron.ipcMain.handle("open-floating-player", async (_event, videoPath, title, startTime = 0) => {
	if (floatPlayerWin) {
		floatPlayerWin.focus();
		return;
	}
	floatPlayerWin = new electron.BrowserWindow({
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
			preload: path.default.join(__dirname, "preload.js")
		}
	});
	const queryParam = `?float=1&path=${encodeURIComponent(videoPath)}&title=${encodeURIComponent(title)}&time=${startTime}`;
	const floatUrl = isDev ? `http://localhost:5173/#/float${queryParam}` : `file://${path.default.join(__dirname, "../dist-vite/index.html")}#/float${queryParam}`;
	floatPlayerWin.loadURL(floatUrl);
	floatPlayerWin.on("closed", () => {
		floatPlayerWin = null;
	});
});
//#endregion
