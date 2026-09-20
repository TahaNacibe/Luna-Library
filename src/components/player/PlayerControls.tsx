import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Lock,
  Eye,
  Tv,
  Gauge,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Player Controls Component.
 * Features:
 * - Slide seekbar with local scrub state (prevents resets while dragging)
 * - Extended speed rates (0.25x to 4.0x)
 * - Jump controls (-10s, +10s, -30s, +30s)
 * - Volume, mute, fullscreen, always-on-top, and lock screen triggers
 */

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isAlwaysOnTop: boolean;
  isFocusMode: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onJump: (seconds: number) => void;
  onChangeSpeed: (rate: number) => void;
  onChangeVolume: (vol: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleFocusMode: () => void;
  onToggleLock: () => void;
}

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);

  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  volume,
  isMuted,
  isFullscreen,
  isAlwaysOnTop,
  isFocusMode,
  onTogglePlay,
  onSeek,
  onJump,
  onChangeSpeed,
  onChangeVolume,
  onToggleMute,
  onToggleFullscreen,
  onToggleAlwaysOnTop,
  onToggleFocusMode,
  onToggleLock,
}: PlayerControlsProps) {
  const { t } = useTranslation();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Local scrubbing state prevents playback timeupdates from interfering while dragging seekbar
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);

  useEffect(() => {
    if (!isScrubbing) {
      setScrubTime(currentTime);
    }
  }, [currentTime, isScrubbing]);

  // Extended speeds (up to 4x)
  const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setScrubTime(val);
  };

  const handleSliderCommit = () => {
    setIsScrubbing(false);
    onSeek(scrubTime);
  };

  return (
    <div className="p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-2 select-none">
      {/* Slide Seekbar */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-white/90 min-w-10 text-right">
          {formatTime(isScrubbing ? scrubTime : currentTime)}
        </span>

        <div className="relative flex-1 group py-1 flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={isScrubbing ? scrubTime : currentTime}
            onPointerDown={() => setIsScrubbing(true)}
            onChange={handleSliderChange}
            onPointerUp={handleSliderCommit}
            className="w-full h-1.5 bg-white/25 rounded-lg appearance-none cursor-pointer accent-primary group-hover:h-2 transition-all"
          />
        </div>

        <span className="text-[11px] font-mono text-white/70 min-w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Control Buttons Bar */}
      <div className="flex items-center justify-between pt-1">
        {/* Left Side: Playback, Jumps, Volume */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer shadow-xs"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={18} className="fill-current" />
            ) : (
              <Play size={18} className="fill-current ml-0.5" />
            )}
          </button>

          {/* Jump Back 10s */}
          <button
            onClick={() => onJump(-10)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer relative"
            title={t("player_jump_back")}
          >
            <RotateCcw size={16} />
            <span className="text-[9px] absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono">
              10
            </span>
          </button>

          {/* Jump Forward 10s */}
          <button
            onClick={() => onJump(10)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer relative"
            title={t("player_jump_fwd")}
          >
            <RotateCw size={16} />
            <span className="text-[9px] absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono">
              10
            </span>
          </button>

          {/* Jump Back 30s */}
          <button
            onClick={() => onJump(-30)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer hidden sm:flex relative"
            title={t("player_jump_back_30")}
          >
            <RotateCcw size={16} />
            <span className="text-[9px] absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono">
              30
            </span>
          </button>

          {/* Jump Forward 30s */}
          <button
            onClick={() => onJump(30)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer hidden sm:flex relative"
            title={t("player_jump_fwd_30")}
          >
            <RotateCw size={16} />
            <span className="text-[9px] absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono">
              30
            </span>
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5 pl-2">
            <button
              onClick={onToggleMute}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
              className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white hidden sm:block"
            />
          </div>
        </div>

        {/* Right Side: Speed, Floating Window, Lock, Focus, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer"
              title={t("player_speed")}
            >
              <Gauge size={13} />
              <span>{playbackRate}x</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 p-1.5 bg-neutral-900/95 border border-white/20 rounded-xl shadow-2xl backdrop-blur-md grid grid-cols-3 gap-1 z-50 min-w-36">
                {speeds.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onChangeSpeed(s);
                      setShowSpeedMenu(false);
                    }}
                    className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      playbackRate === s
                        ? "bg-primary text-primary-foreground"
                        : "text-white/80 hover:bg-white/20"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Floating Always-on-Top Toggle */}
          <button
            onClick={onToggleAlwaysOnTop}
            title={
              isAlwaysOnTop
                ? t("player_float_window_active")
                : t("player_float_window")
            }
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isAlwaysOnTop
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-white/15 hover:bg-white/25 text-white"
            }`}
          >
            <Tv size={14} />
            <span className="hidden md:inline">{t("player_float_window")}</span>
          </button>

          {/* Watch Only / Focus Mode */}
          <button
            onClick={onToggleFocusMode}
            title={t("player_focus_mode")}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isFocusMode
                ? "bg-primary text-primary-foreground"
                : "hover:bg-white/20 text-white/90 hover:text-white"
            }`}
          >
            <Eye size={17} />
          </button>

          {/* Lock Screen Toggle */}
          <button
            onClick={onToggleLock}
            title={t("player_lock_screen")}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
          >
            <Lock size={17} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? t("player_exit_fullscreen") : t("player_fullscreen")}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}
