import fs from "fs";
import path from "path";
import { MovieEntry, VideoFile, ArchiveFile } from "../types";

/**
 * Service responsible for scanning library directories and parsing movie folders.
 * It identifies:
 * 1. Subdirectory movie entries (with their internal videos, archives, and cover.jpg)
 * 2. Standalone root video files directly in the library folder (e.g. Inception.mp4)
 */

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".webm",
  ".avi",
  ".mov",
  ".m4v",
  ".wmv",
  ".flv",
  ".ts",
  ".m2ts",
]);

const ARCHIVE_EXTENSIONS = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".bz2",
]);

const SUBTITLE_EXTENSIONS = new Set([
  ".srt",
  ".vtt",
  ".sub",
  ".ass",
]);

const COVER_PATTERNS = [
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
  "front.jpg",
];

/**
 * Normalizes title by removing release tags, resolutions, and brackets.
 */
export function cleanMovieTitle(rawName: string): string {
  // Strip file extension if present
  let name = rawName.replace(/\.[^/.]+$/, "");
  name = name.replace(/[\._]/g, " ");
  // Remove common scene tags: 1080p, 720p, 2160p, 4k, bluray, x264, web-dl, etc.
  name = name.replace(
    /\b(1080p|720p|2160p|4k|uhd|bluray|bdrip|webrip|web-dl|x264|x265|hevc|aac|dts|yify|rarbg|eztv|extended|remastered)\b/gi,
    ""
  );
  // Remove year in parentheses e.g. (2023) or brackets [2023]
  name = name.replace(/\[.*?\]|\(.*?\)/g, " ").trim();
  // Collapse whitespace
  name = name.replace(/\s+/g, " ").trim();
  return name || rawName;
}

/**
 * Scans a folder recursively up to 4 levels deep to find videos and archives.
 */
function scanFolderDeep(
  baseDir: string,
  currentDir: string,
  depth = 0
): {
  videos: VideoFile[];
  archives: ArchiveFile[];
  hasSubtitles: boolean;
  coverPath: string | null;
  totalSize: number;
} {
  const result = {
    videos: [] as VideoFile[],
    archives: [] as ArchiveFile[],
    hasSubtitles: false,
    coverPath: null as string | null,
    totalSize: 0,
  };

  if (depth > 4) return result;

  try {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });

    // Check for standard cover files at current level
    if (!result.coverPath) {
      for (const pattern of COVER_PATTERNS) {
        const matchingItem = items.find(
          (it) => it.isFile() && it.name.toLowerCase() === pattern
        );
        if (matchingItem) {
          result.coverPath = path.join(currentDir, matchingItem.name);
          break;
        }
      }
    }

    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (item.isDirectory()) {
        const sub = scanFolderDeep(baseDir, fullPath, depth + 1);
        result.videos.push(...sub.videos);
        result.archives.push(...sub.archives);
        result.totalSize += sub.totalSize;
        if (sub.hasSubtitles) result.hasSubtitles = true;
        if (!result.coverPath && sub.coverPath) result.coverPath = sub.coverPath;
      } else if (item.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          result.totalSize += stat.size;

          const ext = path.extname(item.name).toLowerCase();

          if (VIDEO_EXTENSIONS.has(ext)) {
            result.videos.push({
              name: item.name,
              relativePath,
              fullPath,
              sizeBytes: stat.size,
              extension: ext,
            });
          } else if (ARCHIVE_EXTENSIONS.has(ext)) {
            result.archives.push({
              name: item.name,
              relativePath,
              fullPath,
              sizeBytes: stat.size,
              extension: ext,
            });
          } else if (SUBTITLE_EXTENSIONS.has(ext)) {
            result.hasSubtitles = true;
          }

          // Fallback image detection if any .jpg/.png has "cover" or "poster" in name
          if (!result.coverPath && [".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
            const lowerName = item.name.toLowerCase();
            if (
              lowerName.includes("cover") ||
              lowerName.includes("poster") ||
              lowerName.includes("folder")
            ) {
              result.coverPath = fullPath;
            }
          }
        } catch {
          // Ignore individual file errors
        }
      }
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
export async function scanLibraryDirectory(libraryPath: string): Promise<MovieEntry[]> {
  if (!fs.existsSync(libraryPath)) {
    throw new Error(`Directory not found: ${libraryPath}`);
  }

  const entries: MovieEntry[] = [];
  const dirItems = fs.readdirSync(libraryPath, { withFileTypes: true });

  // 1. Process Subdirectories as Movie Entries
  for (const item of dirItems) {
    if (!item.isDirectory()) continue;
    if (item.name.startsWith(".") || item.name.startsWith("$")) continue;

    const entryFolderPath = path.join(libraryPath, item.name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(entryFolderPath);
    } catch {
      continue;
    }

    const { videos, archives, hasSubtitles, coverPath, totalSize } = scanFolderDeep(
      entryFolderPath,
      entryFolderPath,
      0
    );

    // If no cover image pattern matched, pick the first image in the folder
    let finalCoverPath = coverPath;
    if (!finalCoverPath) {
      try {
        const rootItems = fs.readdirSync(entryFolderPath, { withFileTypes: true });
        const imgItem = rootItems.find(
          (f) =>
            f.isFile() &&
            [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(f.name).toLowerCase())
        );
        if (imgItem) {
          finalCoverPath = path.join(entryFolderPath, imgItem.name);
        }
      } catch {
        // Ignore
      }
    }

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
      hasSubtitles,
    });
  }

  // 2. Group Standalone Video Files in the Root Directory into an Uncategorized entry
  const rootFiles = dirItems.filter((it) => it.isFile());
  const standaloneVideos: VideoFile[] = [];
  let rootTotalSize = 0;
  let rootLatestMtime = 0;
  let hasRootSubtitles = false;

  for (const item of rootFiles) {
    const ext = path.extname(item.name).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(libraryPath, item.name);
    try {
      const stat = fs.statSync(fullPath);
      rootTotalSize += stat.size;
      if (stat.mtimeMs > rootLatestMtime) rootLatestMtime = stat.mtimeMs;

      const baseNameWithoutExt = path.basename(item.name, ext).toLowerCase();
      const hasSub = rootFiles.some((f) => {
        const fExt = path.extname(f.name).toLowerCase();
        return (
          SUBTITLE_EXTENSIONS.has(fExt) &&
          path.basename(f.name, fExt).toLowerCase() === baseNameWithoutExt
        );
      });
      if (hasSub) hasRootSubtitles = true;

      standaloneVideos.push({
        name: item.name,
        relativePath: item.name,
        fullPath,
        sizeBytes: stat.size,
        extension: ext,
      });
    } catch {
      // Ignore
    }
  }

  if (standaloneVideos.length > 0) {
    standaloneVideos.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );

    entries.push({
      id: Buffer.from(path.join(libraryPath, "__uncategorized__")).toString("base64url"),
      name: "Uncategorized Videos",
      folderPath: libraryPath,
      coverPath: null,
      coverUrl: null,
      videoFiles: standaloneVideos,
      archives: [],
      totalSizeBytes: rootTotalSize,
      modifiedTimeMs: rootLatestMtime || Date.now(),
      hasSubtitles: hasRootSubtitles,
      isUncategorized: true,
    });
  }

  // Sort subfolders alphabetically, keeping Uncategorized at top or bottom cleanly
  return entries.sort((a, b) => {
    if (a.isUncategorized) return -1;
    if (b.isUncategorized) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}
