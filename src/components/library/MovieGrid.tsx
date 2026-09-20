import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { Film, SearchX, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import MovieCard from "./MovieCard";
import { cleanMovieTitle } from "../../../electron/services/libraryService";

/**
 * Responsive Movie Grid.
 * Dynamically adjusts column density (3 to 6 items per row) based on user preference.
 * Preserves and restores exact scroll position when returning from item details pages.
 */

export default function MovieGrid() {
  const { t } = useTranslation();
  const {
    entries,
    searchQuery,
    filterStatus,
    sortOption,
    userData,
    isLoading,
    activeLibraryId,
    scanActiveLibrary,
    gridColumns,
    activeMovieView,
    gridScrollPosition,
    setGridScrollPosition,
  } = useLibraryStore();

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(gridScrollPosition);
  const isTransitioningRef = useRef(false);
  const prevActiveMovieView = useRef(activeMovieView);

  // Restore scroll position reliably
  const restoreScroll = useCallback((targetPos: number) => {
    if (!gridRef.current || targetPos <= 0) return;
    gridRef.current.scrollTop = targetPos;

    // Double frame application ensures browser paints at exact position after overlay unmounts
    requestAnimationFrame(() => {
      if (gridRef.current) gridRef.current.scrollTop = targetPos;
      requestAnimationFrame(() => {
        if (gridRef.current) gridRef.current.scrollTop = targetPos;
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 80);
      });
    });
  }, []);

  // Track scroll position changes
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isTransitioningRef.current && !activeMovieView) {
      const top = e.currentTarget.scrollTop;
      scrollPosRef.current = top;
      setGridScrollPosition(top);
    }
  };

  // Restore scroll position when returning from movie details view to the library grid
  useEffect(() => {
    if (prevActiveMovieView.current && !activeMovieView) {
      isTransitioningRef.current = true;
      const target = gridScrollPosition || scrollPosRef.current;
      restoreScroll(target);
    }
    prevActiveMovieView.current = activeMovieView;
  }, [activeMovieView, gridScrollPosition, restoreScroll]);

  // Initial mount restoration
  useEffect(() => {
    if (gridScrollPosition > 0 && gridRef.current) {
      restoreScroll(gridScrollPosition);
    }
  }, []);

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((entry) => {
        const cleaned = cleanMovieTitle(entry.name).toLowerCase();
        return entry.name.toLowerCase().includes(q) || cleaned.includes(q);
      });
    }

    // Status filter
    if (filterStatus !== "all") {
      if (filterStatus === "favorites") {
        result = result.filter((entry) => userData[entry.id]?.isFavorite);
      } else {
        result = result.filter((entry) => {
          const status = userData[entry.id]?.status || "new";
          return status === filterStatus;
        });
      }
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOption === "name_asc") {
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      }
      if (sortOption === "name_desc") {
        return b.name.localeCompare(a.name, undefined, { numeric: true });
      }
      if (sortOption === "newest") {
        return b.modifiedTimeMs - a.modifiedTimeMs;
      }
      if (sortOption === "size") {
        return b.totalSizeBytes - a.totalSizeBytes;
      }
      if (sortOption === "status") {
        const statusOrder: Record<string, number> = {
          watching: 1,
          wanna_watch: 2,
          new: 3,
          watched: 4,
        };
        const aStatus = userData[a.id]?.status || "new";
        const bStatus = userData[b.id]?.status || "new";
        return (statusOrder[aStatus] || 99) - (statusOrder[bStatus] || 99);
      }
      return 0;
    });

    return result;
  }, [entries, searchQuery, filterStatus, sortOption, userData]);

  // Dynamic grid class based on user chosen density
  const getGridClass = () => {
    switch (gridColumns) {
      case 3:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
      case 5:
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
      case 6:
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
      case 7:
        return "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";
      case 8:
        return "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8";
      case 4:
      default:
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";
    }
  };

  // Only show full-screen loader on empty library initial load
  if (isLoading && entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <RefreshCw size={28} className="text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">
          {t("scan_now")}...
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Scanning directory and checking covers...
        </p>
      </div>
    );
  }

  if (!activeLibraryId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4 text-muted-foreground">
          <Film size={32} />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {t("no_library_selected")}
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
          {t("choose_or_add_library")}
        </p>
      </div>
    );
  }

  if (filteredEntries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3 text-muted-foreground">
          <SearchX size={28} />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {t("no_entries_found")}
        </h3>
        <p className="text-xs text-muted-foreground max-w-xs mt-1">
          {t("try_adjusting_search")}
        </p>
        <button
          onClick={() => scanActiveLibrary()}
          className="mt-4 px-3.5 py-1.5 bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium rounded-lg transition-colors cursor-pointer"
        >
          {t("refresh_library")}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-5 relative"
    >
      {/* Subtle syncing indicator when re-scanning an already populated library */}
      {isLoading && entries.length > 0 && (
        <div className="sticky top-2 float-right z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/90 border border-border text-[11px] text-muted-foreground shadow-md backdrop-blur-xs animate-in fade-in duration-200">
          <RefreshCw size={11} className="text-primary animate-spin" />
          <span>Syncing...</span>
        </div>
      )}

      <div className={`grid ${getGridClass()} gap-4`}>
        {filteredEntries.map((entry) => (
          <MovieCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
