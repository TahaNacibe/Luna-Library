import { useState, useEffect } from "react";
import {
  X,
  Usb,
  HardDrive,
  FolderOpen,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import { DriveTarget } from "../../types/library";
import { cleanMovieTitle } from "../../../electron/services/libraryService";

/**
 * Quick Copy Modal.
 * Detects USB and system drives, allows picking any custom target folder,
 * and performs fast asynchronous copying of the movie folder.
 */

export default function QuickCopyModal() {
  const { t } = useTranslation();
  const { copyModalEntry, openCopyModal } = useLibraryStore();

  const [drives, setDrives] = useState<DriveTarget[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>("");
  const [isLoadingDrives, setIsLoadingDrives] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<{ success: boolean; msg: string } | null>(
    null
  );

  useEffect(() => {
    if (copyModalEntry) {
      loadDrives();
      setCopyResult(null);
      setSelectedDestination("");
    }
  }, [copyModalEntry]);

  const loadDrives = async () => {
    if (!window.electronAPI) return;
    setIsLoadingDrives(true);
    try {
      const list = await window.electronAPI.listDrives();
      setDrives(list);
      // Auto-select first removable USB drive if found
      const usb = list.find((d) => d.isRemovable);
      if (usb) {
        setSelectedDestination(usb.mountPath);
      } else if (list.length > 0) {
        setSelectedDestination(list[0].mountPath);
      }
    } finally {
      setIsLoadingDrives(false);
    }
  };

  const handlePickCustomFolder = async () => {
    if (!window.electronAPI) return;
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      setSelectedDestination(path);
    }
  };

  const handleExecuteCopy = async () => {
    if (!copyModalEntry || !selectedDestination || !window.electronAPI) return;

    setIsCopying(true);
    setCopyResult(null);

    try {
      const res = await window.electronAPI.copyEntryToDestination(
        copyModalEntry.folderPath,
        selectedDestination
      );
      if (res.success) {
        setCopyResult({
          success: true,
          msg: t("copy_completed", { path: selectedDestination }),
        });
      } else {
        setCopyResult({
          success: false,
          msg: res.error || t("copy_failed"),
        });
      }
    } catch (err: any) {
      setCopyResult({
        success: false,
        msg: err?.message || t("copy_failed"),
      });
    } finally {
      setIsCopying(false);
    }
  };

  if (!copyModalEntry) return null;

  const displayTitle = cleanMovieTitle(copyModalEntry.name);

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-2">
            <Copy className="text-primary" size={20} />
            <h2 className="font-bold text-base text-foreground">
              {t("quick_copy")}
            </h2>
          </div>
          <button
            onClick={() => openCopyModal(null)}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <span className="text-xs text-muted-foreground">Source Movie:</span>
            <h3 className="text-sm font-semibold text-foreground truncate">
              {displayTitle}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Size: {(copyModalEntry.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
            </span>
          </div>

          {/* Drives List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground">
                {t("target_drive")}
              </label>
              <button
                type="button"
                onClick={loadDrives}
                disabled={isLoadingDrives}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RefreshCw
                  size={11}
                  className={isLoadingDrives ? "animate-spin text-primary" : ""}
                />
                <span>{t("refresh_drives")}</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {drives.map((drive) => {
                const isSelected = selectedDestination === drive.mountPath;
                return (
                  <div
                    key={drive.mountPath}
                    onClick={() => setSelectedDestination(drive.mountPath)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary text-foreground font-semibold shadow-xs"
                        : "bg-muted/40 border-border/60 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {drive.isRemovable ? (
                        <Usb
                          size={18}
                          className={isSelected ? "text-primary" : "text-amber-500"}
                        />
                      ) : (
                        <HardDrive
                          size={18}
                          className={isSelected ? "text-primary" : "text-muted-foreground"}
                        />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{drive.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {drive.isRemovable ? t("removable_drive") : t("local_drive")}
                        </p>
                      </div>
                    </div>

                    {drive.freeBytes && drive.totalBytes && (
                      <span className="text-[11px] text-muted-foreground">
                        {(drive.freeBytes / (1024 * 1024 * 1024)).toFixed(0)} GB free
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom Destination Picker */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePickCustomFolder}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-input rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors cursor-pointer"
              >
                <FolderOpen size={14} />
                <span>{t("select_destination")}</span>
              </button>
            </div>
          </div>

          {/* Current Target Path */}
          {selectedDestination && (
            <div className="bg-muted/50 p-2.5 rounded-lg border border-border/50 text-xs">
              <span className="text-muted-foreground">Selected Path: </span>
              <span className="font-mono font-medium text-foreground">
                {selectedDestination}
              </span>
            </div>
          )}

          {/* Feedback Result */}
          {copyResult && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                copyResult.success
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}
            >
              {copyResult.success ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{copyResult.msg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-card/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openCopyModal(null)}
            className="px-4 py-2 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors cursor-pointer"
          >
            {t("close")}
          </button>
          <button
            type="button"
            onClick={handleExecuteCopy}
            disabled={!selectedDestination || isCopying}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-all cursor-pointer shadow-xs"
          >
            {isCopying ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{t("copying")}</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>{t("copy_to_usb")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
