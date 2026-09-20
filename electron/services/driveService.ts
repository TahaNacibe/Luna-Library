import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { shell } from "electron";
import { DriveTarget } from "../types";

const execAsync = promisify(exec);

/**
 * Service to manage system drives, USB removable media detection,
 * file copy operations, and safe deletion to the Recycle Bin.
 */

/**
 * Lists mounted drives on the Windows system.
 * Identifies removable/USB drives and available disk letters.
 */
export async function listSystemDrives(): Promise<DriveTarget[]> {
  const drives: DriveTarget[] = [];

  try {
    // Query Windows volumes using PowerShell for accurate drive types and labels
    const psScript = `Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, DriveType, FreeSpace, Size | ConvertTo-Json`;
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`, {
      windowsHide: true,
    });

    if (stdout && stdout.trim()) {
      let parsed = JSON.parse(stdout.trim());
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }

      for (const disk of parsed) {
        if (!disk.DeviceID) continue;
        const driveLetter = `${disk.DeviceID}\\`;
        // DriveType 2 is Removable (USB flash), 3 is Fixed (Local disk), 4 is Network
        const isRemovable = disk.DriveType === 2;
        const label = disk.VolumeName || (isRemovable ? "USB Drive" : "Local Disk");

        drives.push({
          mountPath: driveLetter,
          label: `${label} (${disk.DeviceID})`,
          isRemovable,
          freeBytes: disk.FreeSpace ? Number(disk.FreeSpace) : undefined,
          totalBytes: disk.Size ? Number(disk.Size) : undefined,
        });
      }
    }
  } catch (err) {
    console.error("[driveService] Error querying drives via PowerShell:", err);

    // Fallback: test standard Windows drive letters A to Z
    const letters = "DEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (const l of letters) {
      const p = `${l}:\\`;
      try {
        if (fs.existsSync(p)) {
          drives.push({
            mountPath: p,
            label: `Drive (${l}:)`,
            isRemovable: l !== "C",
          });
        }
      } catch {
        // Not accessible
      }
    }
  }

  return drives;
}

/**
 * Recursively copies a folder and its contents to a destination directory.
 */
export async function copyFolderRecursive(
  sourceDir: string,
  destinationParentDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!fs.existsSync(sourceDir)) {
      return { success: false, error: "Source folder does not exist" };
    }
    if (!fs.existsSync(destinationParentDir)) {
      fs.mkdirSync(destinationParentDir, { recursive: true });
    }

    const folderName = path.basename(sourceDir);
    const targetDir = path.join(destinationParentDir, folderName);

    // Use robocopy for fast, robust Windows file copying
    const robocopyCmd = `robocopy "${sourceDir}" "${targetDir}" /E /R:1 /W:1 /MT:8`;
    try {
      await execAsync(robocopyCmd, { windowsHide: true });
      return { success: true };
    } catch (rcError: any) {
      // Robocopy returns exit codes 0-7 for success/successful copies
      if (rcError && rcError.code <= 7) {
        return { success: true };
      }
      // If robocopy failed with higher error code, fallback to node fs.cp
    }

    // Node built-in recursive copy fallback
    await fs.promises.cp(sourceDir, targetDir, { recursive: true });
    return { success: true };
  } catch (err: any) {
    console.error("[driveService] Copy failed:", err);
    return { success: false, error: err?.message || "Failed to copy folder" };
  }
}

/**
 * Moves an item safely to the Windows Recycle Bin.
 */
export async function trashEntry(targetPath: string): Promise<boolean> {
  try {
    if (fs.existsSync(targetPath)) {
      await shell.trashItem(targetPath);
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
export async function openInExplorer(targetPath: string): Promise<void> {
  try {
    if (fs.existsSync(targetPath)) {
      await shell.openPath(targetPath);
    }
  } catch (err) {
    console.error("[driveService] Error opening path:", err);
  }
}
