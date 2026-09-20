import { useEffect } from "react";
import { useLibraryStore } from "../store/useLibraryStore";
import LibrarySidebar from "../components/sidebar/LibrarySidebar";
import LibraryHeader from "../components/library/LibraryHeader";
import MovieGrid from "../components/library/MovieGrid";
import MovieDetailsView from "../components/library/MovieDetailsView";
import MovieDetailsModal from "../components/library/MovieDetailsModal";
import DecompressModal from "../components/library/DecompressModal";
import QuickCopyModal from "../components/library/QuickCopyModal";
import VideoPlayerModal from "../components/player/VideoPlayerModal";

/**
 * Main Application View for Luna-Library.
 * Coordinates:
 * - Collapsible Library Sidebar with tree view entries
 * - Main workspace with permanent Grid mount (preserves scroll & filters)
 * - Cinematic Movie Details View overlay
 * - Video Player and Action Modals
 */

export default function MainPage() {
  const { activeLibraryId, scanActiveLibrary, activeMovieView } = useLibraryStore();

  useEffect(() => {
    if (activeLibraryId) {
      scanActiveLibrary();
    }
  }, [activeLibraryId]);

  return (
    <div className="flex-1 flex overflow-hidden w-full h-full bg-background text-foreground relative">
      {/* Left Library Navigation Sidebar */}
      <LibrarySidebar />

      {/* Main Workspace: Keeps Header and Grid mounted to preserve scroll position and filters */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background relative">
        <LibraryHeader />
        <MovieGrid />

        {/* Cinematic Movie Details View Overlay */}
        {activeMovieView && (
          <div className="absolute inset-0 z-30 flex flex-col bg-background animate-in fade-in duration-150">
            <MovieDetailsView />
          </div>
        )}
      </div>

      {/* Action Modals */}
      <MovieDetailsModal />
      <DecompressModal />
      <QuickCopyModal />
      <VideoPlayerModal />
    </div>
  );
}
