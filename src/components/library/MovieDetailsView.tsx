import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Play,
  Copy,
  Archive,
  FolderOpen,
  Trash2,
  Heart,
  Video,
  FileArchive,
  HardDrive,
  Calendar,
  Image as ImageIcon,
  Search,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import { cleanMovieTitle } from "../../../electron/services/libraryService";
import { getMediaUrl } from "../../lib/mediaUrl";
import type { VideoFile } from "../../types/library";
import { getEntryProgress, getVideoProgress } from "../../lib/watchProgress";
import WatchProgressBar from "./WatchProgressBar";
import CoverSearchModal from "./CoverSearchModal";

/**
 * Cinematic Movie Details View Page.
 * Supports:
 * - Huge blurred backdrop gradually fading into background
 * - Elevated foreground poster card with manual "Search / Change Poster" button
 * - Special grouping for "Uncategorized Videos" with per-video search and poster customization
 * - Episodes list with play buttons and metadata
 */

export default function MovieDetailsView() {
  const { t } = useTranslation();
  const {
    activeMovieView,
    openMovieView,
    userData,
    setEntryStatus,
    toggleFavorite,
    playVideo,
    openCopyModal,
    openDecompressModal,
    deleteEntry,
  } = useLibraryStore();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [videoSearchFilter, setVideoSearchFilter] = useState("");

  // Cover search modal state
  const [coverSearchTarget, setCoverSearchTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  if (!activeMovieView) return null;

  const entry = activeMovieView;
  const isUncategorized = !!entry.isUncategorized;

  const data = userData[entry.id] || {
    status: "new",
    progressSeconds: 0,
    durationSeconds: 0,
    isFavorite: false,
  };

  const displayTitle = isUncategorized
    ? "Uncategorized Videos"
    : cleanMovieTitle(entry.name);

  // Poster resolution
  let posterSrc: string | null = null;
  if (entry.coverPath) {
    posterSrc = getMediaUrl(entry.coverPath);
  } else if (data.customPosterUrl) {
    posterSrc = data.customPosterUrl;
  }

  // Filtered and grouped videos for uncategorized or multiple episodes
  const filteredVideos = useMemo(() => {
    if (!videoSearchFilter.trim()) return entry.videoFiles;
    const q = videoSearchFilter.toLowerCase().trim();
    return entry.videoFiles.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        cleanMovieTitle(v.name).toLowerCase().includes(q)
    );
  }, [entry.videoFiles, videoSearchFilter]);

  const handlePlayFirst = () => {
    if (entry.videoFiles.length > 0) {
      playVideo(entry, entry.videoFiles[0]);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteEntry(entry);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
      openMovieView(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto relative bg-background text-foreground flex flex-col select-none animate-in fade-in duration-200">
      {/* Cinematic Blurred Backdrop */}
      <div className="absolute top-0 left-0 right-0 h-96 overflow-hidden pointer-events-none z-0">
        {posterSrc ? (
          <img
            src={posterSrc}
            alt=""
            className="w-full h-full object-cover blur-3xl scale-125 opacity-30 dark:opacity-20"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-b from-primary/10 to-transparent" />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/60 to-background" />
      </div>

      {/* Top Floating Navigation Bar */}
      <div className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between backdrop-blur-md bg-background/50 border-b border-border/40">
        <button
          onClick={() => openMovieView(null)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/80 hover:bg-card border border-border/60 text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs hover:shadow-sm"
        >
          <ArrowLeft size={15} />
          <span>Back to Library</span>
        </button>

        <div className="flex items-center gap-2">
          {!isUncategorized && (
            <>
              <button
                onClick={() => openCopyModal(entry)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/80 hover:bg-card border border-border/60 text-xs font-medium text-foreground transition-colors cursor-pointer"
              >
                <Copy size={14} />
                <span>{t("quick_copy")}</span>
              </button>

              <button
                onClick={() => window.electronAPI?.openInExplorer(entry.folderPath)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/80 hover:bg-card border border-border/60 text-xs font-medium text-foreground transition-colors cursor-pointer"
              >
                <FolderOpen size={14} />
                <span>{t("open_in_explorer")}</span>
              </button>

              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  title={t("delete_entry")}
                >
                  <Trash2 size={16} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-card border border-destructive/40 p-1 rounded-lg">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-2.5 py-1 bg-destructive text-destructive-foreground text-xs font-semibold rounded-md hover:opacity-90 cursor-pointer"
                  >
                    Confirm Trash
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {t("cancel")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area - Expands full width */}
      <div className="relative z-10 px-6 sm:px-10 py-6 w-full space-y-8">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Foreground Poster Card */}
          <div className="w-48 sm:w-56 shrink-0 aspect-2/3 rounded-2xl bg-card border border-border/80 overflow-hidden shadow-2xl relative group">
            {posterSrc ? (
              <img
                src={posterSrc}
                alt={entry.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                <Video size={48} className="opacity-40 mb-2" />
                <span className="text-xs font-medium">{displayTitle}</span>
              </div>
            )}

            {/* Manual Cover Change Button */}
            <button
              onClick={() =>
                setCoverSearchTarget({ id: entry.id, title: displayTitle })
              }
              title="Search or Change Cover Poster"
              className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 py-1.5 bg-black/75 hover:bg-black/90 text-white rounded-lg text-xs font-semibold backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
            >
              <ImageIcon size={13} />
              <span>Change Cover</span>
            </button>

            {/* Favorite Heart Button */}
            {!isUncategorized && (
              <button
                onClick={() => toggleFavorite(entry.id)}
                className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                  data.isFavorite
                    ? "bg-red-500 text-white shadow-md"
                    : "bg-black/50 text-white/80 hover:bg-black/70"
                }`}
              >
                <Heart
                  size={16}
                  className={data.isFavorite ? "fill-white text-white" : ""}
                />
              </button>
            )}
          </div>

          {/* Title & Metadata Info */}
          <div className="flex-1 space-y-4 pt-2">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {!isUncategorized && (
                  <select
                    value={data.status}
                    onChange={(e) => setEntryStatus(entry.id, e.target.value as any)}
                    className="bg-card border border-border rounded-full px-3 py-1 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring cursor-pointer shadow-xs"
                  >
                    <option value="unwatched">⚪ {t("filter_all")}</option>
                    <option value="new">✨ {t("status_new")}</option>
                    <option value="wanna_watch">🔖 {t("status_wanna_watch")}</option>
                    <option value="watching">⏳ {t("status_watching")}</option>
                    <option value="watched">✅ {t("status_watched")}</option>
                  </select>
                )}

                {isUncategorized ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    Standalone Videos
                  </span>
                ) : (
                  entry.archives.length > 0 && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-500">
                      {entry.archives.length} Archives
                    </span>
                  )
                )}

                {entry.hasSubtitles && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    Subtitles
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {displayTitle}
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-mono break-all opacity-80">
                {entry.folderPath}
              </p>
            </div>

            {/* Specs Row */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <HardDrive size={14} className="text-primary" />
                <span>
                  {(entry.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB Total
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Video size={14} className="text-primary" />
                <span>{entry.videoFiles.length} Video(s)</span>
              </div>

              {entry.archives.length > 0 && (
                <div className="flex items-center gap-1.5 text-amber-500">
                  <FileArchive size={14} />
                  <span>{entry.archives.length} Archive(s)</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                <span>{new Date(entry.modifiedTimeMs).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Overall Entry Watch Progress Bar */}
            {!isUncategorized && (() => {
              const entryProg = getEntryProgress(entry, userData);
              if (entryProg.percent <= 0 && !entryProg.isWatched) return null;

              return (
                <div className="max-w-md bg-card/80 border border-border/80 rounded-xl p-3 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold flex items-center gap-1.5">
                      {entryProg.isWatched ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          <span>{t("status_watched")}</span>
                        </span>
                      ) : (
                        <span className="text-primary flex items-center gap-1">
                          <Clock size={13} />
                          <span>{t("status_watching")}</span>
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground font-medium text-[11px]">
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
                    size="sm"
                    rounded="full"
                  />
                </div>
              );
            })()}

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              {entry.videoFiles.length > 0 && (
                <button
                  onClick={handlePlayFirst}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl shadow-lg hover:opacity-90 active:scale-98 transition-all cursor-pointer"
                >
                  <Play size={18} className="fill-current" />
                  <span>{t("play")}</span>
                </button>
              )}

              <button
                onClick={() =>
                  setCoverSearchTarget({ id: entry.id, title: displayTitle })
                }
                className="flex items-center gap-1.5 px-4 py-2.5 bg-secondary hover:bg-accent text-secondary-foreground text-xs font-semibold rounded-xl border border-border transition-colors cursor-pointer"
              >
                <ImageIcon size={15} />
                <span>Search / Set Cover</span>
              </button>

              {entry.archives.length > 0 && (
                <button
                  onClick={() => openDecompressModal(entry)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <Archive size={16} />
                  <span>{t("decompress_all_one_click")}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Folder Content: Unified Episodes & Compressed Archives Section */}
        <div className="space-y-4 pt-4 border-t border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Video size={18} className="text-primary" />
              <span>
                {isUncategorized
                  ? `Standalone Videos (${entry.videoFiles.length})`
                  : `Folder Contents (${entry.videoFiles.length} videos${
                      entry.archives.length > 0 ? `, ${entry.archives.length} archives` : ""
                    })`}
              </span>
            </h2>

            {/* In-view video search */}
            {entry.videoFiles.length > 3 && (
              <div className="relative w-full sm:w-64">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={videoSearchFilter}
                  onChange={(e) => setVideoSearchFilter(e.target.value)}
                  placeholder="Filter items by name..."
                  className="w-full pl-8 pr-3 py-1.5 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Grid of Video Episodes */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredVideos.map((v: VideoFile, idx: number) => {
              const videoTitle = cleanMovieTitle(v.name);
              const videoPoster = userData[v.fullPath]?.customPosterUrl;
              const epProg = getVideoProgress(v.fullPath, userData);

              return (
                <div
                  key={idx}
                  className="group bg-card hover:bg-accent/30 border border-border/70 hover:border-primary/40 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all shadow-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Thumbnail or Index with progress bar overlay */}
                      <div className="relative shrink-0 overflow-hidden rounded-lg">
                        {videoPoster ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-border bg-muted">
                            <img
                              src={videoPoster}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {String(idx + 1).padStart(2, "0")}
                          </div>
                        )}
                        {epProg.percent > 0 && (
                          <WatchProgressBar
                            percent={epProg.percent}
                            isWatched={epProg.isWatched}
                            size="xs"
                            rounded="none"
                            className="absolute bottom-0 left-0 right-0"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {videoTitle}
                          </h4>
                          {epProg.isWatched && (
                            <span className="text-emerald-500 shrink-0" title={t("status_watched")}>
                              <CheckCircle2 size={12} />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {(v.sizeBytes / (1024 * 1024)).toFixed(1)} MB •{" "}
                          {v.extension.replace(".", "").toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() =>
                          setCoverSearchTarget({
                            id: v.fullPath,
                            title: videoTitle,
                          })
                        }
                        title="Set poster for this video"
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <ImageIcon size={14} />
                      </button>

                      <button
                        onClick={() => playVideo(entry, v)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Play size={13} className="fill-current" />
                        <span>{t("play")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Episode Progress Bar & Timing */}
                  {epProg.percent > 0 && (
                    <div className="pt-2 border-t border-border/50 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {epProg.isWatched
                            ? t("status_watched")
                            : epProg.durationSeconds > 0
                            ? `${epProg.formattedProgress} / ${epProg.formattedDuration}`
                            : `${epProg.percent}%`}
                        </span>
                        <span className="font-semibold text-foreground">
                          {epProg.percent}%
                        </span>
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

            {/* Also Display Compressed Archives in the same grid if any */}
            {entry.archives.map((a, i) => (
              <div
                key={`arch_${i}`}
                className="bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <FileArchive size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-foreground truncate">
                      {a.name}
                    </h4>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                      {(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB • ARCHIVE
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => openDecompressModal(entry)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 hover:text-white text-amber-600 dark:text-amber-400 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0"
                >
                  <Archive size={12} />
                  <span>Extract</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Compressed Archives Section (if any) */}
        {entry.archives.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border/60">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                <FileArchive size={16} />
                <span>Compressed Archives ({entry.archives.length})</span>
              </h2>
              <button
                onClick={() => openDecompressModal(entry)}
                className="text-xs text-amber-500 hover:underline font-semibold cursor-pointer"
              >
                {t("decompress_all_one_click")}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entry.archives.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs"
                >
                  <span className="truncate flex-1 pr-2 font-medium text-foreground">
                    {a.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Cover Search & Set Modal */}
      {coverSearchTarget && (
        <CoverSearchModal
          isOpen={true}
          onClose={() => setCoverSearchTarget(null)}
          targetId={coverSearchTarget.id}
          initialTitle={coverSearchTarget.title}
        />
      )}
    </div>
  );
}
