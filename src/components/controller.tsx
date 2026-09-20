import {
  Maximize,
  Minus,
  X,
  Sun,
  Moon,
  Globe,
  Film,
} from "lucide-react";
import { ReactNode } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

/**
 * Custom Title Bar Component.
 * Supports window dragging, minimize/maximize/close actions,
 * dynamic theme switcher (Milk White & Deep Gray), and language selector (EN, FR, AR).
 */

export default function CustomTitleBar({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const handleWindow = (action: "minimize" | "maximize" | "close") => {
    window.electronAPI?.controlWindow(action);
  };

  const toggleLanguage = () => {
    const nextLang =
      i18n.language === "en" ? "fr" : i18n.language === "fr" ? "ar" : "en";
    i18n.changeLanguage(nextLang);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="h-screen flex flex-col select-none overflow-hidden bg-background text-foreground">
      {/* Titlebar */}
      <header
        className="h-10 flex items-center justify-between px-3 bg-card border-b border-border/70 z-50 text-xs font-medium"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <Film size={12} />
          </div>
          <span className="font-semibold tracking-wide text-foreground/90">
            {t("app_name")}
          </span>
        </div>

        {/* Quick Tools & Window Controls */}
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            title={t("language")}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <Globe size={13} />
            <span className="uppercase text-[11px] font-semibold">
              {i18n.language}
            </span>
          </button>

          {/* Theme Switcher (Milk White vs Deep Gray) */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? t("theme_light") : t("theme_dark")}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Native Window Buttons */}
          <button
            onClick={() => handleWindow("minimize")}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => handleWindow("maximize")}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Maximize"
          >
            <Maximize size={14} />
          </button>
          <button
            onClick={() => handleWindow("close")}
            className="p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
