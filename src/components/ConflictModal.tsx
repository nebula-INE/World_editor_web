import React, { useState } from 'react';
import { PatchConflict } from '../core/parser';
import { 
  AlertTriangle, 
  X, 
  Check, 
  FileText, 
  GitMerge, 
  ArrowRight, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: PatchConflict[];
  onResolve: (conflict: PatchConflict, action: 'keep_text' | 'apply_patch' | 'merge', mergeValue?: string) => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  onResolve,
}) => {
  const [activeConflictIndex, setActiveConflictIndex] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeText, setMergeText] = useState('');

  if (!isOpen || conflicts.length === 0) return null;

  const currentConflict = conflicts[Math.min(activeConflictIndex, conflicts.length - 1)];

  const handleKeepText = () => {
    onResolve(currentConflict, 'keep_text');
    if (activeConflictIndex >= conflicts.length - 1) {
      setActiveConflictIndex(Math.max(0, conflicts.length - 2));
    }
  };

  const handleApplyPatch = () => {
    onResolve(currentConflict, 'apply_patch');
    if (activeConflictIndex >= conflicts.length - 1) {
      setActiveConflictIndex(Math.max(0, conflicts.length - 2));
    }
  };

  const handleMergeSubmit = () => {
    if (!mergeText.trim()) return;
    onResolve(currentConflict, 'merge', mergeText.trim());
    setIsMerging(false);
    setMergeText('');
    if (activeConflictIndex >= conflicts.length - 1) {
      setActiveConflictIndex(Math.max(0, conflicts.length - 2));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C2028] border border-[#2F3440] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#15171C] border-b border-[#2F3440] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Conflict Resolution (§11 競合解決ダイアログ)</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-[#252A36]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-gray-200">
          {/* Conflict list / pagination */}
          <div className="flex items-center justify-between bg-[#14161B] p-2.5 rounded-lg border border-[#2B2E36]">
            <div className="font-mono text-gray-300 font-semibold">
              Conflict {activeConflictIndex + 1} / {conflicts.length}: <span className="text-amber-400">{currentConflict.ref_key}</span> ({currentConflict.field})
            </div>
            <div className="text-[11px] text-gray-400 font-mono">
              line {currentConflict.line}
            </div>
          </div>

          <p className="text-gray-300 leading-relaxed">
            本文の直接編集とGenerated Patchの両方で値が競合しています。解決方法を選択してください:
          </p>

          {/* Comparison Cards */}
          <div className="grid grid-cols-2 gap-3 font-mono">
            {/* Original in Text */}
            <div className="bg-[#14161B] border border-sky-900/50 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] text-sky-400 font-semibold flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Text (現在の本文値)</span>
              </div>
              <div className="text-sm font-bold text-white bg-[#1A1E26] p-2 rounded border border-[#2B2F3A]">
                {currentConflict.text_value}
              </div>
            </div>

            {/* Patch Value */}
            <div className="bg-[#14161B] border border-amber-900/50 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] text-amber-400 font-semibold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Patch (Canvas編集値)</span>
              </div>
              <div className="text-sm font-bold text-white bg-[#1A1E26] p-2 rounded border border-[#2B2F3A]">
                {currentConflict.patch_value}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 font-mono bg-[#14161B] p-2 rounded border border-[#282C35]">
            ※ Patch作成時点のOriginal想定値: <span className="text-gray-300">"{currentConflict.expected_was}"</span>
          </div>

          {/* Merge Input Mode */}
          {isMerging ? (
            <div className="bg-[#1A1D24] p-3 rounded-lg border border-indigo-900/60 space-y-2">
              <label className="block text-indigo-300 font-semibold text-xs">
                マージ値を入力 (本文をこの値に更新しPatchを削除します):
              </label>
              <input
                type="text"
                autoFocus
                value={mergeText}
                onChange={(e) => setMergeText(e.target.value)}
                placeholder="新しい関係タイプ"
                className="w-full bg-[#14161B] border border-[#2B2E36] rounded px-3 py-1.5 text-gray-100 font-mono outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsMerging(false)}
                  className="px-3 py-1 bg-[#282C36] text-gray-300 rounded hover:bg-[#333844]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMergeSubmit}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                >
                  Apply Merged Value
                </button>
              </div>
            </div>
          ) : (
            /* Action Buttons (Keep Text / Apply Canvas / Merge / Skip) */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <button
                id="btn-keep-text"
                onClick={handleKeepText}
                className="p-2.5 bg-[#202530] hover:bg-[#282F3E] text-sky-300 border border-sky-800/60 rounded-lg flex flex-col items-center justify-center text-center space-y-1 transition-colors"
              >
                <span className="font-semibold text-xs">[Keep Text]</span>
                <span className="text-[10px] text-gray-400">本文を維持 (Patch削除)</span>
              </button>

              <button
                id="btn-apply-patch"
                onClick={handleApplyPatch}
                className="p-2.5 bg-[#2E281F] hover:bg-[#3D3325] text-amber-300 border border-amber-800/60 rounded-lg flex flex-col items-center justify-center text-center space-y-1 transition-colors"
              >
                <span className="font-semibold text-xs">[Apply Canvas]</span>
                <span className="text-[10px] text-gray-400">本文を更新 (Patch削除)</span>
              </button>

              <button
                id="btn-merge-conflict"
                onClick={() => { setIsMerging(true); setMergeText(currentConflict.patch_value); }}
                className="p-2.5 bg-[#252030] hover:bg-[#312940] text-indigo-300 border border-indigo-800/60 rounded-lg flex flex-col items-center justify-center text-center space-y-1 transition-colors"
              >
                <span className="font-semibold text-xs">[Merge]</span>
                <span className="text-[10px] text-gray-400">手動でマージ</span>
              </button>

              <button
                onClick={onClose}
                className="p-2.5 bg-[#1F2228] hover:bg-[#2A2E38] text-gray-300 border border-[#323640] rounded-lg flex flex-col items-center justify-center text-center space-y-1 transition-colors"
              >
                <span className="font-semibold text-xs">[Skip]</span>
                <span className="text-[10px] text-gray-400">後で解決する</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
