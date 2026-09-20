import { useState } from "react";
import {
  Play,
  Heart,
  Archive,
  Copy,
  Info,
  CheckCircle2,
  Bookmark,
  Clock,
  Sparkles,
  Film,
  FolderSync,
  Image as ImageIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MovieEntry } from "../../types/library";
import { useLibraryStore } from "../../store/useLibraryStore";
import { cleanMovieTitle } from "../../../electron/services/libraryService";
import { getMediaUrl } from "../../lib/mediaUrl";
import { getEntryProgress } from "../../lib/watchProgress";
import WatchProgressBar from "./WatchProgressBar";
import CoverSearchModal from "./CoverSearchModal";

/**
 * Movie Card Component.
 * Supports standard movie folders and Uncategorized Standalone video bundles.
 * Provides on-hover quick actions, status indicators, and watch progress bar.
 */

interface MovieCardProps {
  entry: MovieEntry;
}

export default function MovieCard({ entry }: MovieCardProps) {
  const { t } = useTranslation();
  const {
    userData,
    toggleFavorite,
    playVideo,
    openMovieView,
    openDetailsModal,
    openDecompressModal,
    openCopyModal,
  } = useLibraryStore();

  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);

  const isUncategorized = !!entry.isUncategorized;
  const data = userData[entry.id] || {
    status: "new",
    progressSeconds: 0,
    durationSeconds: 0,
    isFavorite: false,
  };

  // Resolve cover
  let coverSrc: string | null = null;
  if (entry.coverPath) {
    coverSrc = getMediaUrl(entry.coverPath);
  } else if (data.customPosterUrl) {
    coverSrc = data.customPosterUrl;
  }

  // Calculate comprehensive watch progress
  const entryProg = getEntryProgress(entry, userData);

  const displayTitle = isUncategorized
    ? "Uncategorized Videos"
    : cleanMovieTitle(entry.name);
  const hasArchives = entry.archives.length > 0;
  const hasVideos = entry.videoFiles.length > 0;

  return (
    <>
      <div
        onClick={() => openMovieView(entry)}
        className="group relative bg-card rounded-xl border border-border/80 overflow-hidden shadow-xs hover:shadow-xl hover:border-primary/50 transition-all duration-300 flex flex-col cursor-pointer"
      >
        {/* Poster Media Box */}
        <div className="relative aspect-2/3 w-full bg-muted/60 overflow-hidden flex items-center justify-center select-none">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={entry.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : isUncategorized ? (
            <div className="flex flex-col items-center justify-center text-primary p-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
                <FolderSync size={28} className="text-primary" />
              </div>
              <span className="text-xs font-bold px-2">Uncategorized</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {entry.videoFiles.length} standalone video(s)
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-3 text-center">
              <Film size={34} className="mb-2 opacity-40" />
              <span className="text-[11px] font-medium line-clamp-2 px-2">
                {displayTitle}
              </span>
            </div>
          )}

          {/* Top Badges */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
            <div className="pointer-events-auto">
              {isUncategorized ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground shadow-xs">
                  <span>{entry.videoFiles.length} Videos</span>
                </span>
              ) : (
                <>
                  {entryProg.isWatched && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/90 text-white backdrop-blur-xs shadow-xs">
                      <CheckCircle2 size={10} />
                      <span>{t("status_watched")}</span>
                    </span>
                  )}
                  {!entryProg.isWatched && (data.status === "watching" || entryProg.percent > 0) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/90 text-white backdrop-blur-xs shadow-xs">
                      <Clock size={10} />
                      <span>
                        {entryProg.isMultiEpisode
                          ? `${entryProg.watchedEpisodesCount}/${entryProg.totalEpisodesCount}`
                          : `${entryProg.percent}%`}
                      </span>
                    </span>
                  )}
                  {!entryProg.isWatched && entryProg.percent === 0 && data.status === "wanna_watch" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/90 text-white backdrop-blur-xs shadow-xs">
                      <Bookmark size={10} />
                      <span>{t("status_wanna_watch")}</span>
                    </span>
                  )}
                  {!entryProg.isWatched && entryProg.percent === 0 && data.status === "new" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/85 text-white backdrop-blur-xs shadow-xs">
                      <Sparkles size={10} />
                      <span>{t("status_new")}</span>
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Archive Badge */}
            {hasArchives && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDecompressModal(entry);
                }}
                title={t("archives_detected", { count: entry.archives.length })}
                className="pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-600/90 hover:bg-amber-600 text-white shadow-xs backdrop-blur-xs transition-colors cursor-pointer"
              >
                <Archive size={10} />
                <span>{entry.archives.length} ZIP</span>
              </button>
            )}
          </div>

          {/* Favorite Button */}
          {!isUncategorized && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(entry.id);
              }}
              title={data.isFavorite ? t("unmark_favorite") : t("mark_favorite")}
              className={`absolute top-2 right-2 z-10 p-1.5 rounded-full backdrop-blur-xs transition-all cursor-pointer ${
                data.isFavorite
                  ? "bg-red-500/90 text-white shadow-xs"
                  : "bg-black/40 text-white/80 hover:bg-black/60 opacity-0 group-hover:opacity-100"
              }`}
              style={{ right: hasArchives ? "auto" : "0.5rem", left: hasArchives ? "auto" : undefined }}
            >
              <Heart
                size={13}
                className={data.isFavorite ? "fill-white text-white" : ""}
              />
            </button>
          )}

          {/* Hover Overlay with Action Buttons */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3 p-4">
            {hasVideos && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playVideo(entry);
                }}
                title={t("play")}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play size={20} className="ml-0.5 fill-current" />
              </button>
            )}

            <div className="flex items-center gap-1.5 pt-1">
              {!isUncategorized && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openCopyModal(entry);
                  }}
                  title={t("quick_copy")}
                  className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                >
                  <Copy size={14} />
                </button>
              )}

              {/* Set Cover Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCoverModalOpen(true);
                }}
                title="Search or Set Poster"
                className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
              >
                <ImageIcon size={14} />
              </button>

              {!isUncategorized && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetailsModal(entry);
                  }}
                  title={t("details")}
                  className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                >
                  <Info size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar on poster */}
          {!isUncategorized && entryProg.percent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 z-10">
              <WatchProgressBar
                percent={entryProg.percent}
                isWatched={entryProg.isWatched}
                size="xs"
                rounded="none"
              />
            </div>
          )}
        </div>

        {/* Entry Info Section */}
        <div className="p-3 flex-1 flex flex-col justify-between">
          <div>
            <h3
              title={entry.name}
              className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors"
            >
              {displayTitle}
            </h3>
            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
              {entry.videoFiles.length > 0
                ? `${entry.videoFiles.length} file(s)`
                : "Folder"}
              {entry.hasSubtitles && ` • Subtitles`}
            </p>

            {/* Entry Progress Summary & Bar */}
            {!isUncategorized && entryProg.percent > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate pr-1">
                    {entryProg.isMultiEpisode
                      ? t("episodes_watched", {
                          watched: entryProg.watchedEpisodesCount,
                          total: entryProg.totalEpisodesCount,
                        })
                      : t("percent_watched", { percent: entryProg.percent })}
                  </span>
                  <span className="font-semibold text-foreground shrink-0">
                    {entryProg.percent}%
                  </span>
                </div>
                <WatchProgressBar
                  percent={entryProg.percent}
                  isWatched={entryProg.isWatched}
                  size="xs"
                  rounded="full"
                />
              </div>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="capitalize">
              {isUncategorized
                ? "Collection"
                : entryProg.isWatched
                ? t("status_watched")
                : data.status.replace("_", " ")}
            </span>
            <span>{(entry.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
          </div>
        </div>
      </div>

      {/* Cover Search Modal */}
      {isCoverModalOpen && (
        <CoverSearchModal
          isOpen={true}
          onClose={() => setIsCoverModalOpen(false)}
          targetId={entry.id}
          initialTitle={displayTitle}
        />
      )}
    </>
  );
}
