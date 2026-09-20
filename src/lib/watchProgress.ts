import type { MovieEntry, EntryUserData } from "../types/library";

/**
 * Watch Progress Calculation Utilities.
 * 
 * Provides unified, mathematically sound progress calculation for both individual
 * video files (episodes) and parent movie/series entries. Supports single-file movies,
 * multi-episode folder structures, and uncategorized standalone video collections.
 */

export interface EpisodeProgress {
  percent: number;
  isWatched: boolean;
  isWatching: boolean;
  progressSeconds: number;
  durationSeconds: number;
  formattedProgress: string;
  formattedDuration: string;
}

export interface EntryProgress {
  percent: number;
  isWatched: boolean;
  isWatching: boolean;
  watchedEpisodesCount: number;
  totalEpisodesCount: number;
  isMultiEpisode: boolean;
}

/**
 * Format total seconds into a readable clock representation (MM:SS or H:MM:SS).
 */
export function formatSeconds(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const floored = Math.floor(seconds);
  const hrs = Math.floor(floored / 3600);
  const mins = Math.floor((floored % 3600) / 60);
  const secs = floored % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Calculate the watch progress for a single video file / episode.
 * Inspects persistent user metadata keyed by the video file's absolute path.
 */
export function getVideoProgress(
  videoPath: string,
  userData: Record<string, EntryUserData>
): EpisodeProgress {
  const data = userData[videoPath];
  if (!data) {
    return {
      percent: 0,
      isWatched: false,
      isWatching: false,
      progressSeconds: 0,
      durationSeconds: 0,
      formattedProgress: "0:00",
      formattedDuration: "0:00",
    };
  }

  const { progressSeconds = 0, durationSeconds = 0, status } = data;
  const isWatchedByStatus = status === "watched";
  const ratio = durationSeconds > 0 ? progressSeconds / durationSeconds : 0;
  const isWatchedByRatio = ratio >= 0.9;
  const isWatched = isWatchedByStatus || isWatchedByRatio;

  let percent = 0;
  if (isWatched) {
    percent = 100;
  } else if (durationSeconds > 0) {
    percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  }

  const isWatching = !isWatched && (status === "watching" || progressSeconds > 15 || percent > 0);

  return {
    percent,
    isWatched,
    isWatching,
    progressSeconds,
    durationSeconds,
    formattedProgress: formatSeconds(progressSeconds),
    formattedDuration: formatSeconds(durationSeconds),
  };
}

/**
 * Calculate the overall watch progress of a movie or series entry.
 * 
 * For multi-episode entries, calculates the collective percentage and count of
 * finished episodes. For single-video entries, resolves both entry-level and
 * file-level progress smoothly.
 */
export function getEntryProgress(
  entry: MovieEntry,
  userData: Record<string, EntryUserData>
): EntryProgress {
  const videoCount = entry.videoFiles ? entry.videoFiles.length : 0;
  const isMultiEpisode = videoCount > 1;
  const entryData = userData[entry.id];
  const isExplicitlyWatched = entryData?.status === "watched";

  // Case 1: Multiple episodes in folder
  if (isMultiEpisode) {
    let sumPercent = 0;
    let watchedEpisodesCount = 0;

    for (const video of entry.videoFiles) {
      // Check video path progress first; if not present, check if entry itself was marked watched
      const epProgress = getVideoProgress(video.fullPath, userData);
      if (epProgress.isWatched || isExplicitlyWatched) {
        sumPercent += 100;
        watchedEpisodesCount++;
      } else {
        sumPercent += epProgress.percent;
      }
    }

    const avgPercent = videoCount > 0 ? Math.round(sumPercent / videoCount) : 0;
    const isWatched = isExplicitlyWatched || (videoCount > 0 && watchedEpisodesCount === videoCount);
    const isWatching = !isWatched && (entryData?.status === "watching" || sumPercent > 0);

    return {
      percent: isWatched ? 100 : avgPercent,
      isWatched,
      isWatching,
      watchedEpisodesCount,
      totalEpisodesCount: videoCount,
      isMultiEpisode: true,
    };
  }

  // Case 2: Single video file entry
  if (videoCount === 1) {
    const singleVideo = entry.videoFiles[0];
    const epProgress = getVideoProgress(singleVideo.fullPath, userData);

    // If entry-level metadata has progress (from earlier versions or direct updates)
    let percent = epProgress.percent;
    let isWatched = isExplicitlyWatched || epProgress.isWatched;

    if (!isWatched && percent === 0 && entryData && entryData.durationSeconds > 0) {
      const entryRatio = entryData.progressSeconds / entryData.durationSeconds;
      if (entryRatio >= 0.9) {
        isWatched = true;
        percent = 100;
      } else {
        percent = Math.min(100, Math.round(entryRatio * 100));
      }
    }

    const isWatching = !isWatched && (entryData?.status === "watching" || percent > 0 || epProgress.isWatching);

    return {
      percent: isWatched ? 100 : percent,
      isWatched,
      isWatching,
      watchedEpisodesCount: isWatched ? 1 : 0,
      totalEpisodesCount: 1,
      isMultiEpisode: false,
    };
  }

  // Case 3: Empty entry (e.g. only archives or placeholder)
  const isWatched = isExplicitlyWatched;
  return {
    percent: isWatched ? 100 : 0,
    isWatched,
    isWatching: !isWatched && entryData?.status === "watching",
    watchedEpisodesCount: 0,
    totalEpisodesCount: 0,
    isMultiEpisode: false,
  };
}
