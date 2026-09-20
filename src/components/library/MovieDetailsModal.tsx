import { useState } from "react";
import {
  X,
  Play,
  FolderOpen,
  Copy,
  Archive,
  Trash2,
  Heart,
  Video,
  FileArchive,
  HardDrive,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import { cleanMovieTitle } from "../../../electron/services/libraryService";
import { getMediaUrl } from "../../lib/mediaUrl";
import { getEntryProgress, getVideoProgress } from "../../lib/watchProgress";
import WatchProgressBar from "./WatchProgressBar";

/**
 * Movie Details Modal.
 * Shows detailed file composition (all video files, archive files),
 * folder location, size, watch status controls, and action shortcuts.
 */

export default function MovieDetailsModal() {
  const { t } = useTranslation();
  const {
    detailsModalEntry,
    openDetailsModal,
    userData,
    setEntryStatus,
    toggleFavorite,
    playVideo,
    openCopyModal,
    openDecompressModal,
    deleteEntry,
  } = useLibraryStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!detailsModalEntry) return null;

  const entry = detailsModalEntry;
  const data = userData[entry.id] || {
    status: "new",
    progressSeconds: 0,
    durationSeconds: 0,
    isFavorite: false,
  };

  const displayTitle = cleanMovieTitle(entry.name);

  // Cover image
  let coverSrc: string | null = null;
  if (entry.coverPath) {
    coverSrc = getMediaUrl(entry.coverPath);
  } else if (data.customPosterUrl) {
    coverSrc = data.customPosterUrl;
  }

  const handleOpenFolder = () => {
    window.electronAPI?.openInExplorer(entry.folderPath);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteEntry(entry);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="font-bold text-base truncate text-foreground">
              {displayTitle}
            </h2>
            <p className="text-xs text-muted-foreground truncate opacity-80 mt-0.5">
              {entry.folderPath}
            </p>
          </div>
          <button
            onClick={() => openDetailsModal(null)}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Overview Bar */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Poster Thumbnail */}
            <div className="w-28 h-40 shrink-0 rounded-xl bg-muted overflow-hidden border border-border flex items-center justify-center relative shadow-md">
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt={entry.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Video size={32} className="text-muted-foreground/50" />
              )}
            </div>

            {/* Quick Metadata & Controls */}
            <div className="flex-1 space-y-3 w-full">
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Selector */}
                <select
                  value={data.status}
                  onChange={(e) => setEntryStatus(entry.id, e.target.value as any)}
                  className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  <option value="new">{t("status_new")}</option>
                  <option value="wanna_watch">{t("status_wanna_watch")}</option>
                  <option value="watching">{t("status_watching")}</option>
                  <option value="watched">{t("status_watched")}</option>
                </select>

                {/* Favorite Button */}
                <button
                  onClick={() => toggleFavorite(entry.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    data.isFavorite
                      ? "bg-red-500/10 border-red-500/30 text-red-500"
                      : "bg-muted/50 border-input text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Heart
                    size={14}
                    className={data.isFavorite ? "fill-current" : ""}
                  />
                  <span>{data.isFavorite ? t("unmark_favorite") : t("mark_favorite")}</span>
                </button>
              </div>

              {/* Entry Progress Bar */}
              {(() => {
                const entryProg = getEntryProgress(entry, userData);
                if (entryProg.percent <= 0 && !entryProg.isWatched) return null;
                return (
                  <div className="space-y-1 bg-muted/40 p-2.5 rounded-lg border border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        {entryProg.isWatched ? (
                          <span className="text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 size={13} /> {t("status_watched")}
                          </span>
                        ) : (
                          t("status_watching")
                        )}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {entryProg.isMultiEpisode
                          ? t("episodes_watched", {
                              watched: entryProg.watchedEpisodesCount,
                              total: entryProg.totalEpisodesCount,
                            })
                          : `${entryProg.percent}%`}
                      </span>
                    </div>
                    <WatchProgressBar
                      percent={entryProg.percent}
                      isWatched={entryProg.isWatched}
                      size="xs"
                      rounded="full"
                    />
                  </div>
                );
              })()}

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 p-2 rounded-lg border border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <HardDrive size={12} /> Size
                  </span>
                  <p className="font-semibold mt-0.5">
                    {(entry.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </p>
                </div>

                <div className="bg-muted/50 p-2 rounded-lg border border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Calendar size={12} /> Modified
                  </span>
                  <p className="font-semibold mt-0.5">
                    {new Date(entry.modifiedTimeMs).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={handleOpenFolder}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium transition-colors cursor-pointer"
                >
                  <FolderOpen size={14} />
                  <span>{t("open_in_explorer")}</span>
                </button>

                <button
                  onClick={() => openCopyModal(entry)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium transition-colors cursor-pointer"
                >
                  <Copy size={14} />
                  <span>{t("quick_copy")}</span>
                </button>

                {entry.archives.length > 0 && (
                  <button
                    onClick={() => openDecompressModal(entry)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-500 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Archive size={14} />
                    <span>{t("decompress_archives")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Videos List Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Video size={14} />
              <span>Video Files ({entry.videoFiles.length})</span>
            </h4>

            {entry.videoFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-lg">
                {t("no_videos_in_entry")}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {entry.videoFiles.map((v, i) => {
                  const epProg = getVideoProgress(v.fullPath, userData);

                  return (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/40 text-xs transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium truncate">{v.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {(v.sizeBytes / (1024 * 1024)).toFixed(1)} MB • {v.extension.toUpperCase()}
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            openDetailsModal(null);
                            playVideo(entry, v);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0 shadow-2xs"
                        >
                          <Play size={12} className="fill-current" />
                          <span>{t("play")}</span>
                        </button>
                      </div>

                      {/* Episode Progress Bar */}
                      {epProg.percent > 0 && (
                        <div className="space-y-1 pt-1 border-t border-border/30">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>
                              {epProg.isWatched
                                ? t("status_watched")
                                : epProg.durationSeconds > 0
                                ? `${epProg.formattedProgress} / ${epProg.formattedDuration}`
                                : `${epProg.percent}%`}
                            </span>
                            <span className="font-semibold text-foreground">{epProg.percent}%</span>
                          </div>
                          <WatchProgressBar
                            percent={epProg.percent}
                            isWatched={epProg.isWatched}
                            size="xs"
                            rounded="full"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Archive Files Section (if any) */}
          {entry.archives.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileArchive size={14} />
                <span>Compressed Archives ({entry.archives.length})</span>
              </h4>

              <div className="space-y-1 max-h-36 overflow-y-auto">
                {entry.archives.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-foreground"
                  >
                    <span className="truncate flex-1 pr-2">{a.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Delete / Trash Confirmation) */}
        <div className="px-6 py-3 border-t border-border bg-card/60 flex items-center justify-between">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-destructive hover:underline transition-all cursor-pointer"
            >
              <Trash2 size={13} />
              <span>{t("delete_entry")}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive font-medium">
                {t("delete_confirm_title")}
              </span>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-2.5 py-1 bg-destructive text-destructive-foreground text-xs font-semibold rounded-md hover:opacity-90 transition-opacity cursor-pointer"
              >
                {t("delete_confirm_btn")}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 bg-muted text-muted-foreground text-xs rounded-md hover:bg-accent transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
            </div>
          )}

          <button
            onClick={() => openDetailsModal(null)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-accent text-secondary-foreground transition-colors cursor-pointer ml-auto"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
