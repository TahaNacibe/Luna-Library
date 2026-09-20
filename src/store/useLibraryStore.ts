import { create } from "zustand";
import type {
  LibraryFolder,
  MovieEntry,
  EntryUserData,
  WatchStatus,
  FilterStatus,
  SortOption,
  VideoFile,
} from "../types/library";

/**
 * Zustand store managing Luna-Library state:
 * - Persistent saved movie libraries list
 * - Current active library and scanned movie entries (subfolders + root videos)
 * - Persistent watch progress, statuses ('new' | 'wanna_watch' | 'watching' | 'watched'), favorites
 * - Grid density (2 to 6 columns) & Collapsible sidebar state
 * - Full Movie Details View (cinematic hero with episodes list)
 * - Active video player state (playback, speed, always-on-top)
 */

interface LibraryState {
  // Library lists & navigation
  libraries: LibraryFolder[];
  activeLibraryId: string | null;
  entries: MovieEntry[];
  isLoading: boolean;
  error: string | null;

  // Layout & Density
  gridColumns: number;
  isSidebarCollapsed: boolean;
  gridScrollPosition: number;

  // Search & Filtering
  searchQuery: string;
  filterStatus: FilterStatus;
  sortOption: SortOption;

  // Persistent User Metadata per movie entry (keyed by entry id)
  userData: Record<string, EntryUserData>;

  // Movie Details View Page (Cinematic backdrop & episodes view)
  activeMovieView: MovieEntry | null;

  // Modals & Action Targets
  detailsModalEntry: MovieEntry | null;
  decompressModalEntry: MovieEntry | null;
  copyModalEntry: MovieEntry | null;

  // Video Player state
  playingEntry: MovieEntry | null;
  playingVideo: VideoFile | null;
  isAlwaysOnTop: boolean;

  // Actions
  addLibrary: (folderPath: string) => Promise<void>;
  removeLibrary: (id: string) => void;
  setActiveLibrary: (id: string) => void;
  scanActiveLibrary: () => Promise<void>;

  setGridColumns: (cols: number) => void;
  toggleSidebarCollapsed: () => void;
  setGridScrollPosition: (pos: number) => void;

  setSearchQuery: (q: string) => void;
  setFilterStatus: (filter: FilterStatus) => void;
  setSortOption: (sort: SortOption) => void;

  setEntryStatus: (entryId: string, status: WatchStatus) => void;
  toggleFavorite: (entryId: string) => void;
  updatePlaybackProgress: (
    entryId: string,
    progressSeconds: number,
    durationSeconds: number,
    videoPath?: string
  ) => void;
  setEntryPosterUrl: (entryId: string, posterUrl: string) => void;

  openMovieView: (entry: MovieEntry | null) => void;
  openDetailsModal: (entry: MovieEntry | null) => void;
  openDecompressModal: (entry: MovieEntry | null) => void;
  openCopyModal: (entry: MovieEntry | null) => void;

  playVideo: (entry: MovieEntry, video?: VideoFile) => void;
  closePlayer: () => void;
  toggleAlwaysOnTop: () => Promise<void>;
  deleteEntry: (entry: MovieEntry) => Promise<boolean>;
}

// LocalStorage keys
const STORAGE_KEY_LIBRARIES = "luna_libraries_v1";
const STORAGE_KEY_ACTIVE_LIB = "luna_active_lib_v1";
const STORAGE_KEY_USER_DATA = "luna_user_data_v1";
const STORAGE_KEY_GRID_COLS = "luna_grid_columns";
const STORAGE_KEY_SIDEBAR_COLLAPSED = "luna_sidebar_collapsed";

function loadSavedLibraries(): LibraryFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LIBRARIES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadSavedUserData(): Record<string, EntryUserData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_DATA);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadSavedGridColumns(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GRID_COLS);
    return saved ? Math.max(2, Math.min(6, parseInt(saved, 10))) : 4;
  } catch {
    return 4;
  }
}

function loadSavedSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED) === "true";
  } catch {
    return false;
  }
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  libraries: loadSavedLibraries(),
  activeLibraryId: localStorage.getItem(STORAGE_KEY_ACTIVE_LIB) || null,
  entries: [],
  isLoading: false,
  error: null,

  gridColumns: loadSavedGridColumns(),
  isSidebarCollapsed: loadSavedSidebarCollapsed(),
  gridScrollPosition: 0,

  searchQuery: "",
  filterStatus: "all",
  sortOption: "name_asc",

  userData: loadSavedUserData(),

  activeMovieView: null,
  detailsModalEntry: null,
  decompressModalEntry: null,
  copyModalEntry: null,

  playingEntry: null,
  playingVideo: null,
  isAlwaysOnTop: false,

  setGridColumns: (cols: number) => {
    const clamped = Math.max(2, Math.min(8, cols));
    localStorage.setItem(STORAGE_KEY_GRID_COLS, clamped.toString());
    set({ gridColumns: clamped });
  },

  toggleSidebarCollapsed: () => {
    const next = !get().isSidebarCollapsed;
    localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, next.toString());
    set({ isSidebarCollapsed: next });
  },

  setGridScrollPosition: (pos: number) => set({ gridScrollPosition: Math.max(0, pos) }),

  addLibrary: async (folderPath: string) => {
    const existing = get().libraries.find((lib) => lib.path === folderPath);
    if (existing) {
      get().setActiveLibrary(existing.id);
      return;
    }

    const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() || "Movies";
    const newLib: LibraryFolder = {
      id: "lib_" + Date.now(),
      name: folderName,
      path: folderPath,
      createdAt: Date.now(),
    };

    const updated = [...get().libraries, newLib];
    localStorage.setItem(STORAGE_KEY_LIBRARIES, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY_ACTIVE_LIB, newLib.id);

    set({ libraries: updated, activeLibraryId: newLib.id });
    await get().scanActiveLibrary();
  },

  removeLibrary: (id: string) => {
    const updated = get().libraries.filter((l) => l.id !== id);
    const nextActive = updated.length > 0 ? updated[0].id : null;
    localStorage.setItem(STORAGE_KEY_LIBRARIES, JSON.stringify(updated));
    if (nextActive) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_LIB, nextActive);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_LIB);
    }

    set({
      libraries: updated,
      activeLibraryId: nextActive,
      entries: [],
      activeMovieView: null,
    });
    if (nextActive) {
      get().scanActiveLibrary();
    }
  },

  setActiveLibrary: (id: string) => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_LIB, id);
    set({ activeLibraryId: id, activeMovieView: null, gridScrollPosition: 0 });
    get().scanActiveLibrary();
  },

  scanActiveLibrary: async () => {
    const { activeLibraryId, libraries } = get();
    const currentLib = libraries.find((l) => l.id === activeLibraryId);
    if (!currentLib || !window.electronAPI) return;

    set({ isLoading: true, error: null });

    try {
      // Execute the library scan via electron IPC bridge
      const scanned = await window.electronAPI.scanLibraryFolder(currentLib.path);
      const currentUserData = { ...get().userData };
      let userDataChanged = false;

      const isFirstScanForLib = !localStorage.getItem("luna_lib_initialized_" + currentLib.id);
      let knownEntries: Record<string, boolean> = {};
      try {
        const raw = localStorage.getItem("luna_known_entries_v1");
        knownEntries = raw ? JSON.parse(raw) : {};
      } catch {
        knownEntries = {};
      }
      let knownEntriesChanged = false;

      // Ensure every entry has initial user data if not present
      scanned.forEach((entry) => {
        if (!currentUserData[entry.id]) {
          // First scan sets status to neutral "unwatched"; subsequent scans mark unseen items as "new"
          const isBrandNewItem = !isFirstScanForLib && !knownEntries[entry.id];
          currentUserData[entry.id] = {
            status: isBrandNewItem ? "new" : "unwatched",
            progressSeconds: 0,
            durationSeconds: 0,
            isFavorite: false,
          };
          userDataChanged = true;
        } else if (isFirstScanForLib && currentUserData[entry.id].status === "new") {
          // Reset legacy first-scan "new" tags on initial library setup
          currentUserData[entry.id].status = "unwatched";
          userDataChanged = true;
        }

        if (!knownEntries[entry.id]) {
          knownEntries[entry.id] = true;
          knownEntriesChanged = true;
        }
      });

      if (isFirstScanForLib) {
        localStorage.setItem("luna_lib_initialized_" + currentLib.id, "true");
      }
      if (knownEntriesChanged) {
        localStorage.setItem("luna_known_entries_v1", JSON.stringify(knownEntries));
      }

      if (userDataChanged) {
        localStorage.setItem(STORAGE_KEY_USER_DATA, JSON.stringify(currentUserData));
      }

      // Sync active view modals with freshly scanned data so changes appear immediately
      const currentActive = get().activeMovieView;
      const updatedActiveMovieView = currentActive
        ? scanned.find((e) => e.id === currentActive.id) || null
        : null;

      const currentDecompress = get().decompressModalEntry;
      const updatedDecompressEntry = currentDecompress
        ? scanned.find((e) => e.id === currentDecompress.id) || null
        : null;

      const currentDetails = get().detailsModalEntry;
      const updatedDetailsEntry = currentDetails
        ? scanned.find((e) => e.id === currentDetails.id) || null
        : null;

      set({
        entries: scanned,
        userData: currentUserData,
        isLoading: false,
        activeMovieView: updatedActiveMovieView,
        decompressModalEntry: updatedDecompressEntry,
        detailsModalEntry: updatedDetailsEntry,
      });

      // Automatically background fetch online posters
      scanned.forEach(async (entry) => {
        if (!entry.isUncategorized && !entry.coverPath && !currentUserData[entry.id]?.customPosterUrl) {
          try {
            const fetched = await window.electronAPI?.fetchMoviePoster(entry.name);
            if (fetched) {
              get().setEntryPosterUrl(entry.id, fetched);
            }
          } catch (err) {
            console.warn("[store] Error fetching poster for", entry.name, err);
          }
        }

        // Also fetch individual posters for standalone videos in the Uncategorized bundle
        if (entry.isUncategorized) {
          entry.videoFiles.forEach(async (v) => {
            if (!currentUserData[v.fullPath]?.customPosterUrl) {
              try {
                const fetched = await window.electronAPI?.fetchMoviePoster(v.name);
                if (fetched) {
                  get().setEntryPosterUrl(v.fullPath, fetched);
                }
              } catch {
                // Ignore
              }
            }
          });
        }
      });
    } catch (err: any) {
      console.error("[store] Error scanning library:", err);
      set({ isLoading: false, error: err?.message || "Failed to scan folder" });
    }
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setFilterStatus: (filterStatus: FilterStatus) => set({ filterStatus }),
  setSortOption: (sortOption: SortOption) => set({ sortOption }),

  setEntryStatus: (entryId: string, status: WatchStatus) => {
    const current = get().userData;
    const existing = current[entryId] || {
      status: "new",
      progressSeconds: 0,
      durationSeconds: 0,
      isFavorite: false,
    };

    const updated = {
      ...current,
      [entryId]: {
        ...existing,
        status,
        lastWatchedAt: status === "watched" ? Date.now() : existing.lastWatchedAt,
      },
    };

    localStorage.setItem(STORAGE_KEY_USER_DATA, JSON.stringify(updated));
    set({ userData: updated });
  },

  toggleFavorite: (entryId: string) => {
    const current = get().userData;
    const existing = current[entryId] || {
      status: "new",
      progressSeconds: 0,
      durationSeconds: 0,
      isFavorite: false,
    };

    const updated = {
      ...current,
      [entryId]: {
        ...existing,
        isFavorite: !existing.isFavorite,
      },
    };

    localStorage.setItem(STORAGE_KEY_USER_DATA, JSON.stringify(updated));
    set({ userData: updated });
  },

  updatePlaybackProgress: (
    entryId: string,
    progressSeconds: number,
    durationSeconds: number,
    videoPath?: string
  ) => {
    const current = get().userData;
    const existingEntry = current[entryId] || {
      status: "new",
      progressSeconds: 0,
      durationSeconds: 0,
      isFavorite: false,
    };

    let nextStatus: WatchStatus = existingEntry.status;
    const ratio = durationSeconds > 0 ? progressSeconds / durationSeconds : 0;
    if (ratio > 0.9) {
      nextStatus = "watched";
    } else if (progressSeconds > 15 && (nextStatus === "new" || nextStatus === "unwatched" || nextStatus === "wanna_watch")) {
      nextStatus = "watching";
    }

    const updated: Record<string, EntryUserData> = {
      ...current,
      [entryId]: {
        ...existingEntry,
        status: nextStatus,
        progressSeconds,
        durationSeconds,
        lastWatchedAt: Date.now(),
      },
    };

    // If an individual video file / episode path was supplied, update its progress directly
    if (videoPath) {
      const existingVideo = current[videoPath] || {
        status: "new",
        progressSeconds: 0,
        durationSeconds: 0,
        isFavorite: false,
      };

      let videoStatus: WatchStatus = existingVideo.status;
      if (ratio > 0.9) {
        videoStatus = "watched";
      } else if (progressSeconds > 15 && (videoStatus === "new" || videoStatus === "unwatched" || videoStatus === "wanna_watch")) {
        videoStatus = "watching";
      }

      updated[videoPath] = {
        ...existingVideo,
        status: videoStatus,
        progressSeconds,
        durationSeconds,
        lastWatchedAt: Date.now(),
      };
    }

    // Check if entry has multiple videos or is a single video
    const entryObj = get().entries.find((e) => e.id === entryId);
    const isSingleVideo = !entryObj || entryObj.videoFiles.length <= 1;

    updated[entryId] = {
      ...existingEntry,
      status: nextStatus,
      // For single movie, store progress directly; for multi-episode shows, keep separate so episodes don't bleed
      progressSeconds: isSingleVideo ? progressSeconds : existingEntry.progressSeconds,
      durationSeconds: isSingleVideo ? durationSeconds : existingEntry.durationSeconds,
      lastWatchedAt: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY_USER_DATA, JSON.stringify(updated));
    set({ userData: updated });
  },

  setEntryPosterUrl: (entryId: string, posterUrl: string) => {
    const current = get().userData;
    const existing = current[entryId] || {
      status: "new",
      progressSeconds: 0,
      durationSeconds: 0,
      isFavorite: false,
    };

    const updated = {
      ...current,
      [entryId]: {
        ...existing,
        customPosterUrl: posterUrl,
      },
    };

    localStorage.setItem(STORAGE_KEY_USER_DATA, JSON.stringify(updated));
    set({ userData: updated });
  },

  openMovieView: (entry: MovieEntry | null) => set({ activeMovieView: entry }),
  openDetailsModal: (entry: MovieEntry | null) => set({ detailsModalEntry: entry }),
  openDecompressModal: (entry: MovieEntry | null) =>
    set({ decompressModalEntry: entry }),
  openCopyModal: (entry: MovieEntry | null) => set({ copyModalEntry: entry }),

  playVideo: (entry: MovieEntry, video?: VideoFile) => {
    const targetVideo = video || entry.videoFiles[0] || null;
    set({ playingEntry: entry, playingVideo: targetVideo });
  },

  closePlayer: () => {
    if (get().isAlwaysOnTop && window.electronAPI) {
      window.electronAPI.toggleAlwaysOnTop(false);
    }
    set({ playingEntry: null, playingVideo: null, isAlwaysOnTop: false });
  },

  toggleAlwaysOnTop: async () => {
    if (!window.electronAPI) return;
    const nextState = await window.electronAPI.toggleAlwaysOnTop();
    set({ isAlwaysOnTop: nextState });
  },

  deleteEntry: async (entry: MovieEntry) => {
    if (!window.electronAPI) return false;
    const targetPath =
      entry.videoFiles.length === 1 && entry.folderPath === entry.videoFiles[0].fullPath
        ? entry.videoFiles[0].fullPath
        : entry.folderPath;

    const ok = await window.electronAPI.trashEntry(targetPath);
    if (ok) {
      const nextEntries = get().entries.filter((e) => e.id !== entry.id);
      set({
        entries: nextEntries,
        detailsModalEntry: null,
        activeMovieView: null,
      });
    }
    return ok;
  },
}));
