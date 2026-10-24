import React, { useState, useRef, useEffect } from 'react';
import { 
  FolderOpen, 
  Save, 
  Download, 
  AlertTriangle, 
  FileCode, 
  Sparkles, 
  RotateCcw,
  BookOpen,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveProject: () => void;
  onExportJson: () => void;
  onResolveConflicts: () => void;
  conflictCount: number;
  onInsertTemplate: (template: string) => void;
  onResetSample: () => void;
  onOpenStoryAuthoring: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenFile,
  onSaveFile,
  onSaveProject,
  onExportJson,
  onResolveConflicts,
  conflictCount,
  onInsertTemplate,
  onResetSample,
  onOpenStoryAuthoring,
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [patchesMenuOpen, setPatchesMenuOpen] = useState(false);
  const [templatesMenuOpen, setTemplatesMenuOpen] = useState(false);

  const fileMenuRef = useRef<HTMLDivElement>(null);
  const patchesMenuRef = useRef<HTMLDivElement>(null);
  const templatesMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setFileMenuOpen(false);
      }
      if (patchesMenuRef.current && !patchesMenuRef.current.contains(event.target as Node)) {
        setPatchesMenuOpen(false);
      }
      if (templatesMenuRef.current && !templatesMenuRef.current.contains(event.target as Node)) {
        setTemplatesMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-12 bg-[#181B20] border-b border-[#2B2E36] px-4 flex items-center justify-between select-none z-30">
      {/* Left: Branding & Menus */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 mr-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-sky-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
            A
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="font-semibold text-sm tracking-wide text-white">Axral WorldCode</span>
            <span className="text-[11px] text-gray-400 font-mono hidden sm:inline-block">MVP1 (Explicit Text → Graph)</span>
          </div>
        </div>

        {/* File Menu */}
        <div className="relative" ref={fileMenuRef}>
          <button
            id="file-menu-button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="px-2.5 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#252830] rounded flex items-center space-x-1 transition-colors"
          >
            <span>File</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          {fileMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-[#1F2228] border border-[#323640] rounded shadow-xl py-1 text-xs z-50">
              <button
                id="menu-open-file"
                onClick={() => { onOpenFile(); setFileMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-[#2A2E38] flex items-center space-x-2"
              >
                <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                <span>Open Codex Text / Project...</span>
              </button>
              <button
                id="menu-save-file"
                onClick={() => { onSaveFile(); setFileMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-[#2A2E38] flex items-center space-x-2"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save Codex Text (.txt / .md)</span>
              </button>
              <button
                id="menu-save-project"
                onClick={() => { onSaveProject(); setFileMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-[#2A2E38] flex items-center space-x-2"
              >
                <Save className="w-3.5 h-3.5 text-indigo-400" />
                <span>Save Axral Project (.axral.json)</span>
              </button>
              <div className="border-t border-[#323640] my-1" />
              <button
                id="menu-export-json"
                onClick={() => { onExportJson(); setFileMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-[#2A2E38] flex items-center space-x-2"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Export Canonical Data (JSON)...</span>
              </button>
            </div>
          )}
        </div>

        {/* Patches Menu */}
        <div className="relative" ref={patchesMenuRef}>
          <button
            id="patches-menu-button"
            onClick={() => setPatchesMenuOpen(!patchesMenuOpen)}
            className={`px-2.5 py-1 text-xs rounded flex items-center space-x-1 transition-colors ${
              conflictCount > 0 
                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50 hover:bg-amber-900/60' 
                : 'text-gray-300 hover:text-white hover:bg-[#252830]'
            }`}
          >
            {conflictCount > 0 && <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />}
            <span>Patches</span>
            {conflictCount > 0 && (
              <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {conflictCount}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          {patchesMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-[#1F2228] border border-[#323640] rounded shadow-xl py-1 text-xs z-50">
              <button
                id="menu-resolve-conflicts"
                onClick={() => { onResolveConflicts(); setPatchesMenuOpen(false); }}
                className="w-full px-3 py-2 text-left text-gray-200 hover:bg-[#2A2E38] flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Resolve Conflicts...</span>
                </div>
                {conflictCount > 0 && (
                  <span className="text-[10px] text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                    {conflictCount} 件
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Quick Insert Templates */}
        <div className="relative" ref={templatesMenuRef}>
          <button
            id="templates-menu-button"
            onClick={() => setTemplatesMenuOpen(!templatesMenuOpen)}
            className="px-2.5 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#252830] rounded flex items-center space-x-1 transition-colors"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Templates</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          {templatesMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-[#1F2228] border border-[#323640] rounded shadow-xl py-1 text-xs z-50">
              <div className="px-3 py-1 text-[10px] text-gray-400 uppercase font-semibold">Insert Codex Syntax</div>
              <button
                onClick={() => { onInsertTemplate('[名前:Character:Su-ken]'); setTemplatesMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-[#2A2E38] font-mono text-[11px]"
              >
                [名前:型:Layer] (Entity宣言)
              </button>
              <button
                onClick={() => { onInsertTemplate('[A:Character] -> [B:Organization] : 所属'); setTemplatesMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-[#2A2E38] font-mono text-[11px]"
              >
                [A:型] -&gt; [B:型] : 関係 (明示Relation)
              </button>
              <button
                onClick={() => { onInsertTemplate('A -> B : 対立'); setTemplatesMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-[#2A2E38] font-mono text-[11px]"
              >
                A -&gt; B : 関係 (Shorthand)
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        id="menu-open-story-authoring"
        onClick={onOpenStoryAuthoring}
        className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold text-indigo-200 hover:text-white bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/70 rounded shadow-sm transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
        <span>台本・シナリオ執筆</span>
      </button>

      {/* Right: Quick actions */}
      <div className="flex items-center space-x-2">
        <button
          id="btn-reset-sample"
          onClick={onResetSample}
          className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#252830] rounded flex items-center space-x-1 transition-colors"
          title="サンプルテキストに戻す"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="hidden sm:inline">Reset Sample</span>
        </button>
      </div>
    </header>
  );
};
