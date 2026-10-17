import React from 'react';
import { Smartphone, Monitor, Columns, FileCode, Wifi, WifiOff, Sparkles, Sun, Power } from 'lucide-react';

export type ViewMode = 'dual' | 'phone' | 'mirror' | 'code';

interface TopSimulatorBarProps {
  viewMode: ViewMode;
  onSelectViewMode: (mode: ViewMode) => void;
  isSimulatedOffline: boolean;
  onToggleOffline: () => void;
  showGlassReflection: boolean;
  onToggleReflection: () => void;
  isCanvasLit: boolean;
  onToggleCanvasLit: () => void;
  isPowerOn?: boolean;
  onTogglePower?: () => void;
}

export const TopSimulatorBar: React.FC<TopSimulatorBarProps> = ({
  viewMode,
  onSelectViewMode,
  isSimulatedOffline,
  onToggleOffline,
  showGlassReflection,
  onToggleReflection,
  isCanvasLit,
  onToggleCanvasLit,
  isPowerOn = true,
  onTogglePower
}) => {
  return (
    <header className="w-full bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none text-slate-200">
      
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            S
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white leading-tight">
              SmartMirror
            </div>
            <div className="text-[11px] text-slate-400 leading-tight">
              Raspberry Pi 2 • Maps &amp; Voice
            </div>
          </div>
        </a>
      </div>

      {/* View Mode Segmented Switcher */}
      <nav className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800" aria-label="Simulator View Modes">
        <button
          onClick={() => onSelectViewMode('dual')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewMode === 'dual'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Side-by-side Phone Remote and 18.5-inch Smart Mirror"
        >
          <Columns className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dual Live Sync</span>
        </button>

        <button
          onClick={() => onSelectViewMode('phone')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewMode === 'phone'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Phone Controller view at /"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Phone (/)</span>
        </button>

        <button
          onClick={() => onSelectViewMode('mirror')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewMode === 'mirror'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          title="18.5-inch Two-Way Mirror Display at /mirror"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Mirror (/mirror)</span>
        </button>

        <button
          onClick={() => onSelectViewMode('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewMode === 'code'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Download complete Python Flask project for Raspberry Pi"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pi Files &amp; Setup</span>
        </button>
      </nav>

      {/* Simulator Test Controls */}
      <div className="flex items-center gap-2">
        {/* Illuminated Canvas Toggle */}
        <button
          onClick={onToggleCanvasLit}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isCanvasLit
              ? 'bg-amber-950/70 border-amber-800 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
          }`}
          title="Toggle ambient back-lit perimeter canvas illumination"
        >
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">{isCanvasLit ? 'Canvas Lit' : 'Canvas Dim'}</span>
        </button>

        {/* Offline Simulation Toggle */}
        <button
          onClick={onToggleOffline}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isSimulatedOffline
              ? 'bg-amber-950/80 border-amber-800 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
          title="Test how the mirror handles network outages"
        >
          {isSimulatedOffline ? <WifiOff className="w-3.5 h-3.5 text-amber-400" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{isSimulatedOffline ? 'Simulating Offline' : 'LAN + Online'}</span>
        </button>

        {/* SmartMirror Power Toggle */}
        {onTogglePower && (
          <button
            onClick={onTogglePower}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isPowerOn
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-red-950/80 border-red-800 text-red-300 hover:bg-red-900/70 animate-pulse'
            }`}
            title={isPowerOn ? "Switch SmartMirror OFF (Shows 'Have a great day!')" : "Switch SmartMirror ON"}
          >
            <Power className="w-3.5 h-3.5 text-current" />
            <span className="hidden sm:inline">{isPowerOn ? 'Mirror ON' : 'Off ("Have a great day!")'}</span>
          </button>
        )}

        {/* Glass Reflection visualizer toggle */}
        <button
          onClick={onToggleReflection}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            showGlassReflection
              ? 'bg-slate-800 border-slate-700 text-sky-400'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
          }`}
          title="Toggle two-way mirror glass reflection visualization"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Glass Sheen</span>
        </button>
      </div>

    </header>
  );
};
