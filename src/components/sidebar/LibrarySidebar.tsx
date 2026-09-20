import { useState } from "react";
import {
  Folder,
  Plus,
  RefreshCw,
  Trash2,
  Film,
  Bookmark,
  CheckCircle2,
  HardDrive,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import AddLibraryDialog from "./AddLibraryDialog";
import { cleanMovieTitle } from "../../../electron/services/libraryService";
import { getMediaUrl } from "../../lib/mediaUrl";

/**
 * Collapsible Library Sidebar with Tree Navigation.
 * Shows saved movie libraries with collapsible children entries under each library.
 * Supports expanding/collapsing libraries, opening entries directly,
 * switching libraries, and collapsing the sidebar into an icon rail.
 */

export default function LibrarySidebar() {
  const { t } = useTranslation();
  const {
    libraries,
    activeLibraryId,
    setActiveLibrary,
    removeLibrary,
    scanActiveLibrary,
    isLoading,
    entries,
    userData,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
    openMovieView,
    activeMovieView,
  } = useLibraryStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  // Track which libraries have their children items expanded in the tree view
  const [expandedLibraries, setExpandedLibraries] = useState<Record<string, boolean>>({
    [activeLibraryId || ""]: true,
  });

  const toggleLibraryExpanded = (libId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLibraries((prev) => ({
      ...prev,
      [libId]: !prev[libId],
    }));
  };

  // Aggregated counts
  const totalCount = entries.length;
  const wannaWatchCount = entries.filter(
    (e) => userData[e.id]?.status === "wanna_watch"
  ).length;
  const watchedCount = entries.filter(
    (e) => userData[e.id]?.status === "watched"
  ).length;

  // Status dot color helper
  const getStatusDotClass = (entryId: string) => {
    const status = userData[entryId]?.status || "new";
    switch (status) {
      case "watched":
        return "bg-emerald-500";
      case "watching":
        return "bg-blue-500";
      case "wanna_watch":
        return "bg-amber-500";
      case "new":
      default:
        return "bg-purple-400";
    }
  };

  // Collapsed Rail View
  if (isSidebarCollapsed) {
    return (
      <aside className="w-14 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 select-none shrink-0 transition-all">
        {/* Expand Toggle */}
        <button
          onClick={toggleSidebarCollapsed}
          title="Expand Sidebar"
          className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors mb-4 cursor-pointer"
        >
          <PanelLeftOpen size={18} />
        </button>

        {/* Add Library Icon */}
        <button
          onClick={() => setIsAddOpen(true)}
          title={t("add_library")}
          className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity mb-4 cursor-pointer shadow-xs"
        >
          <Plus size={16} />
        </button>

        {/* Library Icons */}
        <div className="flex-1 space-y-2 overflow-y-auto w-full flex flex-col items-center">
          {libraries.map((lib) => {
            const isActive = lib.id === activeLibraryId;
            return (
              <button
                key={lib.id}
                onClick={() => setActiveLibrary(lib.id)}
                title={lib.name}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-sidebar-accent text-primary shadow-xs border border-sidebar-border"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Folder size={17} className={isActive ? "fill-primary/20" : ""} />
              </button>
            );
          })}
        </div>

        <AddLibraryDialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-sidebar border-r border-sidebar-border flex flex-col h-full shrink-0 select-none transition-all duration-200">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-sidebar-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive size={17} className="text-sidebar-foreground/70" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-sidebar-foreground">
            {t("libraries")}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAddOpen(true)}
            title={t("add_library")}
            className="p-1 rounded-md bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground transition-all cursor-pointer shadow-xs"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={toggleSidebarCollapsed}
            title="Collapse Sidebar"
            className="p-1 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>

      {/* Library Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {libraries.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {t("choose_or_add_library")}
            </p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>{t("add_library")}</span>
            </button>
          </div>
        ) : (
          libraries.map((lib) => {
            const isActive = lib.id === activeLibraryId;
            const isExpanded = !!expandedLibraries[lib.id];

            return (
              <div key={lib.id} className="space-y-0.5">
                {/* Library Parent Node */}
                <div
                  onClick={() => setActiveLibrary(lib.id)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs border border-sidebar-border/50"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Expand/Collapse Chevron */}
                    <button
                      type="button"
                      onClick={(e) => toggleLibraryExpanded(lib.id, e)}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </button>

                    <Folder
                      size={15}
                      className={`shrink-0 ${
                        isActive ? "text-primary fill-primary/20" : "text-muted-foreground"
                      }`}
                    />

                    <div className="truncate">
                      <div className="truncate text-xs font-medium">{lib.name}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Item count badge */}
                    {isActive && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background text-muted-foreground font-semibold">
                        {entries.length}
                      </span>
                    )}

                    {/* Delete library */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLibrary(lib.id);
                      }}
                      title={t("remove_library")}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Sub-items: Children Movie Entries under this Library */}
                {isActive && isExpanded && entries.length > 0 && (
                  <div className="ml-5 pl-2 border-l border-sidebar-border/60 space-y-0.5 py-1">
                    {entries.map((item) => {
                      const isSelected = activeMovieView?.id === item.id;
                      const displayTitle = cleanMovieTitle(item.name);
                      const itemCover = item.coverPath
                        ? getMediaUrl(item.coverPath)
                        : userData[item.id]?.customPosterUrl;

                      return (
                        <button
                          key={item.id}
                          onClick={() => openMovieView(item)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors truncate cursor-pointer ${
                            isSelected
                              ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                          }`}
                        >
                          {itemCover ? (
                            <div className="w-4 h-5 rounded-xs overflow-hidden shrink-0 border border-border/60 bg-muted">
                              <img
                                src={itemCover}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            </div>
                          ) : (
                            <Folder size={13} className="text-muted-foreground shrink-0" />
                          )}

                          <span className="truncate flex-1">{displayTitle}</span>

                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSelected
                                ? "bg-primary-foreground"
                                : getStatusDotClass(item.id)
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Clean Bottom Refresh Bar */}
      {activeLibraryId && (
        <div className="p-2.5 border-t border-sidebar-border/50 bg-sidebar/50 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground truncate font-mono">
            {entries.length} items
          </span>
          <button
            onClick={() => scanActiveLibrary()}
            disabled={isLoading}
            title={t("refresh_library")}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-sidebar-accent text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw
              size={12}
              className={isLoading ? "animate-spin text-primary" : ""}
            />
            <span>{t("refresh_library")}</span>
          </button>
        </div>
      )}

      {/* Add Library Dialog Modal */}
      <AddLibraryDialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </aside>
  );
}
