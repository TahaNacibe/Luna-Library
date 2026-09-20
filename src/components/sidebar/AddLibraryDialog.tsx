import React, { useState } from "react";
import { FolderPlus, FolderOpen, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../store/useLibraryStore";

/**
 * Add Library Dialog component.
 * Allows picking a movie folder on the local machine using the native directory selector.
 */

interface AddLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddLibraryDialog({ isOpen, onClose }: AddLibraryDialogProps) {
  const { t } = useTranslation();
  const { addLibrary } = useLibraryStore();
  const [selectedPath, setSelectedPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePickDirectory = async () => {
    if (!window.electronAPI) return;
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      setSelectedPath(path);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPath) return;

    setIsSubmitting(true);
    try {
      await addLibrary(selectedPath);
      setSelectedPath("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FolderPlus className="text-primary" size={20} />
            <h2 className="font-semibold text-base">{t("add_library")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("select_folder")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={selectedPath}
                placeholder="E:\Movies or C:\Users\Videos..."
                className="flex-1 bg-muted/60 border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handlePickDirectory}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <FolderOpen size={16} />
                <span>Browse</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("choose_or_add_library")}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!selectedPath || isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              {isSubmitting ? t("decompressing") : t("add_library")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
