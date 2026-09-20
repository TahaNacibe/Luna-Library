import { useRef, useState, useEffect, useCallback } from "react";
import {
  X,
  Film,
  Lock,
  ListVideo,
  PictureInPicture,
  Play,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import PlayerControls from "./PlayerControls";
import { cleanMovieTitle } from "../../../electron/services/libraryService";
import type { VideoFile } from "../../types/library";
import { getMediaUrl } from "../../lib/mediaUrl";
import { getVideoProgress } from "../../lib/watchProgress";
import WatchProgressBar from "../library/WatchProgressBar";

/**
 * Full Suite Video Player Modal.
 * Features:
 * - Slide-Over Episodes SideSheet for choosing other episodes
 * - Floating window triggers (Picture-in-Picture & Always-on-Top)
 * - Safe HTTP 206 byte-range seeking (no resets)
 * - Screen lock with prominent unlock button
 */

export default function VideoPlayerModal() {
  const { t } = useTranslation();
  const {
    playingEntry,
    playingVideo,
    closePlayer,
    playVideo,
    updatePlaybackProgress,
    toggleAlwaysOnTop,
    isAlwaysOnTop,
    userData,
  } = useLibraryStore();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Slide-over SideSheet state for episodes
  const [isSideSheetOpen, setIsSideSheetOpen] = useState(false);
  const [episodeFilter, setEpisodeFilter] = useState("");

  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const hasResumedInitialPos = useRef<boolean>(false);

  useEffect(() => {
    hasResumedInitialPos.current = false;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [playingVideo?.fullPath]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current || !playingEntry || !playingVideo || hasResumedInitialPos.current) return;
    const dur = videoRef.current.duration || 0;
    setDuration(dur);

    const storeData = useLibraryStore.getState().userData;
    const isMultiVideo = playingEntry.videoFiles && playingEntry.videoFiles.length > 1;

    // Check saved progress for the specific video file
    const videoKey = playingVideo.fullPath;
    const epData = storeData[videoKey];
    let saved = epData?.progressSeconds || 0;

    // ONLY fallback to entry-level progress if the entry is a single standalone movie (1 file)
    if (!isMultiVideo && saved === 0) {
      const entryData = storeData[playingEntry.id];
      saved = entryData?.progressSeconds || 0;
    }

    if (saved > 5 && saved < dur - 10) {
      videoRef.current.currentTime = saved;
      setCurrentTime(saved);
    } else {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
    hasResumedInitialPos.current = true;
  };

  // Auto-hide controls on mouse inactivity
  const handleMouseMove = useCallback(() => {
    if (isLocked) return;
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying && !isSideSheetOpen) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, isLocked, isSideSheetOpen]);

  // Video element events
  const handleTimeUpdate = () => {
    if (!videoRef.current || !playingEntry || !playingVideo) return;
    // CRITICAL: Do not record time updates until initial position has been resolved!
    // Prevents uninitialized / previous video timestamps from leaking into new video.
    if (!hasResumedInitialPos.current) return;

    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);

    updatePlaybackProgress(playingEntry.id, cur, dur, playingVideo.fullPath);
  };

  const handleTogglePlay = () => {
    if (!videoRef.current || isLocked) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current || isLocked) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleJump = (seconds: number) => {
    if (!videoRef.current || isLocked) return;
    const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleChangeSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleChangeVolume = (vol: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Trigger floating window (Native PiP + Electron popout)
  const handleTriggerFloatingWindow = async () => {
    if (videoRef.current) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
          return;
        }
      } catch {
        // Fallback to Electron popout window
      }
    }

    if (window.electronAPI && playingVideo && playingEntry) {
      await window.electronAPI.openFloatingPlayer(
        playingVideo.fullPath,
        playingEntry.name,
        videoRef.current?.currentTime || 0
      );
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playingEntry) return;

      if (isLocked) {
        if (e.key.toLowerCase() === "l") {
          setIsLocked(false);
        }
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleJump(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          handleJump(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleChangeVolume(Math.min(1, volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          handleChangeVolume(Math.max(0, volume - 0.1));
          break;
        case "f":
        case "F":
          handleToggleFullscreen();
          break;
        case "m":
        case "M":
          handleToggleMute();
          break;
        case "l":
        case "L":
          setIsLocked(!isLocked);
          break;
        case "t":
        case "T":
          toggleAlwaysOnTop();
          break;
        case "p":
        case "P":
          handleTriggerFloatingWindow();
          break;
        case "Escape":
          if (isSideSheetOpen) {
            setIsSideSheetOpen(false);
          } else if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
          } else {
            closePlayer();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    playingEntry,
    isPlaying,
    volume,
    isMuted,
    isFullscreen,
    isLocked,
    duration,
    isSideSheetOpen,
  ]);

  if (!playingEntry || !playingVideo) return null;

  const displayTitle = cleanMovieTitle(playingEntry.name);
  const mediaUrl = getMediaUrl(playingVideo.fullPath);

  // Filter episodes for SideSheet
  const filteredEpisodes = playingEntry.videoFiles.filter((vf) => {
    if (!episodeFilter.trim()) return true;
    const q = episodeFilter.toLowerCase();
    return vf.name.toLowerCase().includes(q) || cleanMovieTitle(vf.name).toLowerCase().includes(q);
  });

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black flex flex-col select-none overflow-hidden"
    >
      {/* SCREEN LOCKED FLOATING UNLOCK BUTTON */}
      {isLocked && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in duration-200">
          <button
            onClick={() => setIsLocked(false)}
            className="flex items-center gap-2.5 px-6 py-3 bg-primary text-primary-foreground font-bold text-xs rounded-full shadow-2xl backdrop-blur-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white/20 animate-pulse"
          >
            <Lock size={16} />
            <span>{t("player_unlock_screen")}</span>
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-40 p-4 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent transition-opacity duration-300 ${
          showControls && !isFocusMode && !isLocked ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3">
          <Film className="text-primary" size={20} />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              {displayTitle}
            </h2>
            <p className="text-[11px] text-white/70">{playingVideo.name}</p>
          </div>

          {/* Episodes SideSheet Toggle Button */}
          {playingEntry.videoFiles.length > 1 && (
            <button
              onClick={() => setIsSideSheetOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 ml-3 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-white/10 shadow-xs"
            >
              <ListVideo size={14} />
              <span>Episodes ({playingEntry.videoFiles.length})</span>
            </button>
          )}

          {/* Floating Window / PiP Button */}
          <button
            onClick={handleTriggerFloatingWindow}
            title="Pop out Floating Video Window (Picture-in-Picture)"
            className="flex items-center gap-1 px-3 py-1.5 ml-1 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-white/10 shadow-xs"
          >
            <PictureInPicture size={14} />
            <span className="hidden sm:inline">Floating Player</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={closePlayer}
          className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
          title={t("close")}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Video Element */}
      <div
        className="flex-1 flex items-center justify-center relative cursor-pointer"
        onClick={handleTogglePlay}
      >
        <video
          key={playingVideo.fullPath}
          ref={videoRef}
          src={mediaUrl || undefined}
          autoPlay
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            setIsPlaying(false);
            if (playingEntry && playingVideo) {
              updatePlaybackProgress(playingEntry.id, duration, duration, playingVideo.fullPath);
            }
          }}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Bottom Controls Suite */}
      {!isLocked && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-40 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            isAlwaysOnTop={isAlwaysOnTop}
            isFocusMode={isFocusMode}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onJump={handleJump}
            onChangeSpeed={handleChangeSpeed}
            onChangeVolume={handleChangeVolume}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={handleToggleFullscreen}
            onToggleAlwaysOnTop={toggleAlwaysOnTop}
            onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
            onToggleLock={() => setIsLocked(true)}
          />
        </div>
      )}

      {/* SLIDE-OVER EPISODES SIDESHEET */}
      {isSideSheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-80 sm:w-96 bg-neutral-900/98 border-l border-white/15 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* SideSheet Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListVideo size={17} className="text-primary" />
                <h3 className="font-bold text-sm text-white">Episodes & Videos</h3>
              </div>
              <button
                onClick={() => setIsSideSheetOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Filter Input */}
            {playingEntry.videoFiles.length > 5 && (
              <div className="p-3 border-b border-white/10">
                <input
                  type="text"
                  value={episodeFilter}
                  onChange={(e) => setEpisodeFilter(e.target.value)}
                  placeholder="Filter episode list..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs text-white placeholder:text-white/50 focus:outline-hidden"
                />
              </div>
            )}

            {/* Episodes List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredEpisodes.map((vf: VideoFile, idx: number) => {
                const isCurrent = playingVideo.fullPath === vf.fullPath;
                const epTitle = cleanMovieTitle(vf.name);
                const epPoster = userData[vf.fullPath]?.customPosterUrl;
                const epProg = getVideoProgress(vf.fullPath, userData);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      playVideo(playingEntry, vf);
                      setIsSideSheetOpen(false);
                    }}
                    className={`flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-primary/20 text-primary-foreground border-primary/50 shadow-md font-semibold"
                        : "bg-white/5 hover:bg-white/10 border-white/5 text-white/90 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Thumbnail or Index */}
                      {epPoster ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/20 bg-black">
                          <img src={epPoster} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "bg-white/10 text-white/70"
                          }`}
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">{epTitle}</p>
                        <p
                          className={`text-[10px] truncate mt-0.5 ${
                            isCurrent ? "text-primary/90 font-medium" : "text-white/50"
                          }`}
                        >
                          {(vf.sizeBytes / (1024 * 1024)).toFixed(1)} MB •{" "}
                          {vf.extension.replace(".", "").toUpperCase()}
                        </p>
                      </div>

                      {isCurrent ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground shrink-0">
                          Playing
                        </span>
                      ) : epProg.isWatched ? (
                        <span className="text-[10px] font-semibold flex items-center gap-1 text-emerald-400 shrink-0">
                          <CheckCircle2 size={12} />
                          <span>Watched</span>
                        </span>
                      ) : (
                        <Play size={14} className="text-white/40 shrink-0" />
                      )}
                    </div>

                    {/* Progress Bar under episode in side sheet */}
                    {epProg.percent > 0 && (
                      <div className="mt-2 pt-1 border-t border-white/10">
                        <WatchProgressBar
                          percent={epProg.percent}
                          isWatched={epProg.isWatched}
                          size="xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
