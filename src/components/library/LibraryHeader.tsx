import {
  Search,
  X,
  ArrowUpDown,
  Filter,
  Bookmark,
  CheckCircle2,
  Clock,
  Sparkles,
  Heart,
  LayoutGrid,
  PanelLeftOpen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import { FilterStatus, SortOption } from "../../types/library";

/**
 * Library Header Component.
 * Contains:
 * - Search input with quick clear
 * - Grid column density switcher (3, 4, 5, 6 items per row)
 * - Sorting selector
 * - Interactive status filter chips
 */

export default function LibraryHeader() {
  const { t } = useTranslation();
  const {
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    sortOption,
    setSortOption,
    entries,
    userData,
    gridColumns,
    setGridColumns,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
  } = useLibraryStore();

  const filterButtons: { id: FilterStatus; labelKey: string; icon: any }[] = [
    { id: "all", labelKey: "filter_all", icon: Filter },
    { id: "new", labelKey: "filter_new", icon: Sparkles },
    { id: "wanna_watch", labelKey: "filter_wanna_watch", icon: Bookmark },
    { id: "watching", labelKey: "filter_watching", icon: Clock },
    { id: "watched", labelKey: "filter_watched", icon: CheckCircle2 },
    { id: "favorites", labelKey: "filter_favorites", icon: Heart },
  ];

  const getFilterCount = (id: FilterStatus) => {
    if (id === "all") return entries.length;
    if (id === "favorites")
      return entries.filter((e) => userData[e.id]?.isFavorite).length;
    return entries.filter((e) => userData[e.id]?.status === id).length;
  };

  const columnOptions = [3, 4, 5, 6, 7, 8];

  return (
    <div className="p-4 border-b border-border/70 bg-card/30 backdrop-blur-xs space-y-3 shrink-0 select-none">
      {/* Top Controls Row */}
      <div className="flex items-center gap-3">
        {/* Expand sidebar button if collapsed */}
        {isSidebarCollapsed && (
          <button
            onClick={toggleSidebarCollapsed}
            title="Expand Sidebar"
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full pl-9 pr-8 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring transition-shadow"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Right Tools: Grid Density & Sort */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Grid Columns Density Selector */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50">
            <LayoutGrid size={13} className="text-muted-foreground ml-1" />
            <div className="flex items-center gap-0.5">
              {columnOptions.map((cols) => (
                <button
                  key={cols}
                  onClick={() => setGridColumns(cols)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    gridColumns === cols
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={`${cols} columns per row`}
                >
                  {cols}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={13} className="text-muted-foreground" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="name_asc">{t("sort_name_asc")}</option>
              <option value="name_desc">{t("sort_name_desc")}</option>
              <option value="newest">{t("sort_newest")}</option>
              <option value="size">{t("sort_size")}</option>
              <option value="status">{t("sort_status")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Chips Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {filterButtons.map((btn) => {
          const Icon = btn.icon;
          const isActive = filterStatus === btn.id;
          const count = getFilterCount(btn.id);

          return (
            <button
              key={btn.id}
              onClick={() => setFilterStatus(btn.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                size={12}
                className={isActive ? "text-primary-foreground" : ""}
              />
              <span>{t(btn.labelKey)}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background/80 text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
