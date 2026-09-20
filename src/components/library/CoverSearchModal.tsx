import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  Image as ImageIcon,
  FolderOpen,
  Link,
  Check,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";
import { cleanMovieTitle } from "../../../electron/services/libraryService";
import { getMediaUrl } from "../../lib/mediaUrl";

/**
 * Cover Search & Set Modal.
 * Allows users to:
 * 1. Search online posters dynamically from Wikipedia, TVMaze, etc.
 * 2. Paste a direct image web link
 * 3. Pick a local image file from the computer (.jpg, .png, .webp)
 * Saves the selected poster into persistent user state.
 */

interface CoverSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  initialTitle: string;
}

export default function CoverSearchModal({
  isOpen,
  onClose,
  targetId,
  initialTitle,
}: CoverSearchModalProps) {
  const { t } = useTranslation();
  const { setEntryPosterUrl } = useLibraryStore();

  const [activeTab, setActiveTab] = useState<"search" | "url" | "local">("search");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [selectedPoster, setSelectedPoster] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cleaned = cleanMovieTitle(initialTitle);
      setSearchTerm(cleaned);
      setSelectedPoster(null);
      setManualUrl("");
      performSearch(cleaned);
    }
  }, [isOpen, initialTitle]);

  // Search online posters via multiple endpoints
  const performSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    const results: string[] = [];

    try {
      // 1. Wikipedia PageImages search
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query + " film"
      )}&gsrlimit=4&prop=pageimages&pilicense=any&pithumbsize=600&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        const data = await wikiRes.json();
        if (data?.query?.pages) {
          Object.values(data.query.pages).forEach((page: any) => {
            if (page?.thumbnail?.source) {
              results.push(page.thumbnail.source);
            }
          });
        }
      }

      // 2. TVMaze search
      const tvUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
      const tvRes = await fetch(tvUrl);
      if (tvRes.ok) {
        const data = await tvRes.json();
        if (Array.isArray(data)) {
          data.slice(0, 3).forEach((item: any) => {
            const img = item.show?.image?.original || item.show?.image?.medium;
            if (img && !results.includes(img)) {
              results.push(img);
            }
          });
        }
      }

      // 3. Fallback to electron backend fetch
      if (results.length === 0 && window.electronAPI) {
        const fetched = await window.electronAPI.fetchMoviePoster(query);
        if (fetched) results.push(fetched);
      }

      setSearchResults(results);
    } catch (err) {
      console.error("[CoverSearch] Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickLocalImage = async () => {
    if (!window.electronAPI) return;
    const localPath = await window.electronAPI.selectImageFile();
    if (localPath) {
      const mediaUrl = getMediaUrl(localPath);
      if (mediaUrl) {
        setSelectedPoster(mediaUrl);
      }
    }
  };

  const handleSave = () => {
    const finalUrl = selectedPoster || (manualUrl.trim() ? manualUrl.trim() : null);
    if (finalUrl) {
      setEntryPosterUrl(targetId, finalUrl);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/60">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-primary" size={18} />
            <h3 className="font-semibold text-sm text-foreground">
              Choose or Search Cover Artwork
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-border/50 text-xs">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "search"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Online Search
          </button>
          <button
            onClick={() => setActiveTab("local")}
            className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "local"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            From Computer
          </button>
          <button
            onClick={() => setActiveTab("url")}
            className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "url"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Direct Link
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: ONLINE SEARCH */}
          {activeTab === "search" && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  performSearch(searchTerm);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search movie or series title..."
                    className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer shadow-xs"
                >
                  {isSearching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
                </button>
              </form>

              {/* Results Gallery */}
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 size={24} className="animate-spin text-primary mb-2" />
                  <span className="text-xs">Searching theatrical posters...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No posters found. Try editing the keywords or use a direct link.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {searchResults.map((url, i) => {
                    const isSelected = selectedPoster === url;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedPoster(url)}
                        className={`relative aspect-2/3 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/40 scale-98 shadow-md"
                            : "border-border/60 hover:border-primary/50 hover:scale-102"
                        }`}
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOCAL FILE */}
          {activeTab === "local" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                <FolderOpen size={32} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Pick an Image from Your Computer
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Supports JPG, PNG, WEBP, and GIF
                </p>
              </div>
              <button
                type="button"
                onClick={handlePickLocalImage}
                className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-border"
              >
                Browse File...
              </button>

              {selectedPoster && selectedPoster.startsWith("media:") && (
                <div className="pt-2">
                  <div className="w-24 aspect-2/3 rounded-lg overflow-hidden border-2 border-primary mx-auto shadow-md">
                    <img
                      src={selectedPoster}
                      alt="Selected local preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] text-emerald-500 font-medium mt-1 block">
                    Local image selected
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIRECT URL */}
          {activeTab === "url" && (
            <div className="space-y-4 py-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Direct Image Web Address (URL)
                </label>
                <div className="relative">
                  <Link
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => {
                      setManualUrl(e.target.value);
                      setSelectedPoster(e.target.value);
                    }}
                    placeholder="https://example.com/poster.jpg"
                    className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {manualUrl && (
                <div className="text-center pt-2">
                  <div className="w-24 aspect-2/3 rounded-lg overflow-hidden border border-border mx-auto bg-muted">
                    <img
                      src={manualUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-card/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors cursor-pointer"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedPoster && !manualUrl}
            className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer shadow-xs"
          >
            Apply Poster
          </button>
        </div>
      </div>
    </div>
  );
}
