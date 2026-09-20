import { useState } from "react";
import {
  X,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import { cleanMovieTitle } from "../../../electron/services/libraryService";

/**
 * 1-Click Archive Decompress Modal.
 * Features:
 * - List of archives detected (.zip, .rar, .7z)
 * - Animated progress bar during extraction
 * - Option checkbox to delete compressed archives after successful extraction
 */

export default function DecompressModal() {
  const { t } = useTranslation();
  const {
    decompressModalEntry,
    openDecompressModal,
    scanActiveLibrary,
  } = useLibraryStore();

  const [isExtracting, setIsExtracting] = useState(false);
  const [deleteOriginal, setDeleteOriginal] = useState(true);
  const [progressPercent, setProgressPercent] = useState(0);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  if (!decompressModalEntry) return null;

  const entry = decompressModalEntry;
  const displayTitle = cleanMovieTitle(entry.name);

  const handleDecompressAll = async () => {
    if (!window.electronAPI) return;
    setIsExtracting(true);
    setResultMessage(null);
    setProgressPercent(15);

    // Simulate steady progress steps during child process execution
    const interval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 85) return prev;
        return prev + 15;
      });
    }, 400);

    try {
      const res = await window.electronAPI.decompressArchives(
        entry.folderPath,
        deleteOriginal
      );
      clearInterval(interval);
      setProgressPercent(100);

      setIsSuccess(res.success);
      setResultMessage(res.message);

      if (res.success) {
        await scanActiveLibrary();
        if (deleteOriginal) {
          // Auto close modal smoothly after user sees success message
          setTimeout(() => {
            openDecompressModal(null);
          }, 1600);
        }
      }
    } catch (err: any) {
      clearInterval(interval);
      setIsSuccess(false);
      setResultMessage(err?.message || t("decompress_failed"));
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-2">
            <Archive className="text-amber-500" size={20} />
            <h2 className="font-bold text-base text-foreground">
              {t("decompress_archives")}
            </h2>
          </div>
          <button
            onClick={() => openDecompressModal(null)}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {displayTitle}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("archives_found_desc")}
            </p>
          </div>

          {/* Archives List */}
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {entry.archives.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs"
              >
                <div className="truncate flex-1 pr-2">
                  <span className="font-medium text-foreground">{a.name}</span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                  {(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            ))}
          </div>

          {/* Delete original archive checkbox option */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border/60 text-xs cursor-pointer hover:bg-muted/80 transition-colors">
            <input
              type="checkbox"
              checked={deleteOriginal}
              onChange={(e) => setDeleteOriginal(e.target.checked)}
              disabled={isExtracting}
              className="rounded accent-primary cursor-pointer w-4 h-4"
            />
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <Trash2 size={13} className="text-muted-foreground" />
              <span>Delete compressed archive(s) after successful extraction</span>
            </div>
          </label>

          {/* Decompressing Progress Bar */}
          {isExtracting && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin text-amber-500" />
                  <span>Extracting archives...</span>
                </span>
                <span className="font-mono font-semibold">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Feedback Message */}
          {resultMessage && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                isSuccess
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{resultMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-border bg-card/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openDecompressModal(null)}
            className="px-4 py-2 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors cursor-pointer"
          >
            {t("close")}
          </button>
          <button
            type="button"
            onClick={handleDecompressAll}
            disabled={isExtracting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-all cursor-pointer shadow-xs"
          >
            {isExtracting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{t("decompressing")}</span>
              </>
            ) : (
              <>
                <Archive size={14} />
                <span>{t("decompress_all_one_click")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
