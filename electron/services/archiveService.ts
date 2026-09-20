import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { shell } from "electron";

const execAsync = promisify(exec);

/**
 * Safely removes an archive file after extraction on Windows.
 * Retries if process locks haven't released yet, and falls back to shell.trashItem.
 */
async function safelyRemoveArchiveFile(archivePath: string): Promise<boolean> {
  // Give Windows a brief moment to release process file handles
  await new Promise((resolve) => setTimeout(resolve, 150));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (!fs.existsSync(archivePath)) return true;
      try {
        fs.chmodSync(archivePath, 0o666);
      } catch {
        // Ignore attribute modification error
      }
      fs.unlinkSync(archivePath);
      return true;
    } catch (err) {
      if (attempt === 3) {
        // Fallback to moving to Windows Recycle Bin
        try {
          if (fs.existsSync(archivePath)) {
            await shell.trashItem(archivePath);
            return true;
          }
        } catch (shellErr) {
          console.warn("[archiveService] Failed to remove archive file:", archivePath, err, shellErr);
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }
  return false;
}

/**
 * Service to decompress compressed movie/video archives (.zip, .rar, .7z, .tar, .gz)
 * in one click. Utilizes Windows built-in tar.exe (libarchive) and PowerShell
 * Expand-Archive, ensuring high performance without requiring third-party native binaries.
 */

const ARCHIVE_EXTENSIONS = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".bz2",
]);

/**
 * Finds all archive files inside a directory (shallow or deep).
 */
export function findArchivesInFolder(folderPath: string): string[] {
  const archives: string[] = [];

  function walk(current: string, depth = 0) {
    if (depth > 3) return;
    try {
      const items = fs.readdirSync(current, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(current, item.name);
        if (item.isDirectory()) {
          walk(full, depth + 1);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (ARCHIVE_EXTENSIONS.has(ext)) {
            archives.push(full);
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  walk(folderPath);
  return archives;
}

/**
 * Decompresses a single archive file into its parent directory.
 */
async function decompressSingleArchive(archivePath: string, destinationDir: string): Promise<boolean> {
  const ext = path.extname(archivePath).toLowerCase();

  try {
    // 1. First attempt using Windows built-in tar.exe (supports zip, tar, gz, bz2, and modern formats)
    const tarCmd = `tar.exe -xf "${archivePath}" -C "${destinationDir}"`;
    try {
      await execAsync(tarCmd, { windowsHide: true });
      return true;
    } catch {
      // If tar failed and it's a zip file, try PowerShell Expand-Archive
    }

    if (ext === ".zip") {
      const psCmd = `powershell -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force"`;
      await execAsync(psCmd, { windowsHide: true });
      return true;
    }

    // 2. For .rar or .7z, check if 7-Zip or WinRAR are installed in standard Program Files locations
    const sevenZipPaths = [
      "C:\\Program Files\\7-Zip\\7z.exe",
      "C:\\Program Files (x86)\\7-Zip\\7z.exe",
    ];
    for (const szPath of sevenZipPaths) {
      if (fs.existsSync(szPath)) {
        await execAsync(`"${szPath}" x "${archivePath}" -o"${destinationDir}" -y`, {
          windowsHide: true,
        });
        return true;
      }
    }

    const winRarPaths = [
      "C:\\Program Files\\WinRAR\\UnRAR.exe",
      "C:\\Program Files (x86)\\WinRAR\\UnRAR.exe",
      "C:\\Program Files\\WinRAR\\WinRAR.exe",
    ];
    for (const wrPath of winRarPaths) {
      if (fs.existsSync(wrPath)) {
        await execAsync(`"${wrPath}" x -ibck -o+ "${archivePath}" "${destinationDir}\\"`, {
          windowsHide: true,
        });
        return true;
      }
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
export async function decompressAllInFolder(
  entryFolderPath: string,
  deleteAfterExtraction = false
): Promise<{ success: boolean; message: string; extractedFiles: string[] }> {
  if (!fs.existsSync(entryFolderPath)) {
    return { success: false, message: "Folder does not exist", extractedFiles: [] };
  }

  const archivePaths = findArchivesInFolder(entryFolderPath);
  if (archivePaths.length === 0) {
    return {
      success: true,
      message: "No compressed archives found in this folder.",
      extractedFiles: [],
    };
  }

  const extracted: string[] = [];
  let failureCount = 0;

  for (const archive of archivePaths) {
    const targetDir = path.dirname(archive);
    const ok = await decompressSingleArchive(archive, targetDir);
    if (ok) {
      extracted.push(path.basename(archive));
      // Delete original archive file if requested
      if (deleteAfterExtraction) {
        await safelyRemoveArchiveFile(archive);
      }
    } else {
      failureCount++;
    }
  }

  if (extracted.length > 0) {
    return {
      success: true,
      message: `Successfully decompressed ${extracted.length} archive(s)${
        deleteAfterExtraction ? " and removed original archive(s)" : ""
      }${failureCount > 0 ? ` (${failureCount} failed)` : ""}.`,
      extractedFiles: extracted,
    };
  }

  return {
    success: false,
    message: "Failed to extract archives. Please ensure archive format is supported.",
    extractedFiles: [],
  };
}
