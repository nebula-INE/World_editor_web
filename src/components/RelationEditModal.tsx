import React, { useState, useEffect } from 'react';
import { X, Edit3, Sparkles } from 'lucide-react';

interface RelationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  refKey: string;
  currentType: string;
  onConfirm: (refKey: string, oldType: string, newType: string) => void;
}

export const RelationEditModal: React.FC<RelationEditModalProps> = ({
  isOpen,
  onClose,
  refKey,
  currentType,
  onConfirm,
}) => {
  const [newType, setNewType] = useState(currentType);

  useEffect(() => {
    setNewType(currentType);
  }, [currentType, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newType.trim();
    if (!trimmed || trimmed === currentType) {
      onClose();
      return;
    }
    onConfirm(refKey, currentType, trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C2028] border border-[#2F3440] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#15171C] border-b border-[#2F3440] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-semibold text-gray-100">
            <Edit3 className="w-4 h-4 text-indigo-400" />
            <span>Relationを編集 (§10.2 Patch-style Sync)</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-[#252A36]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs text-gray-200">
          <div>
            <div className="text-gray-400 mb-1">対象Relation:</div>
            <div className="font-mono bg-[#14161B] p-2 rounded border border-[#2B2E36] text-sky-300 font-semibold">
              {refKey}
            </div>
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-medium">新しい関係タイプ (Relation Type):</label>
            <input
              type="text"
              autoFocus
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="例: 対立, 所属, 師弟, 友好的"
              className="w-full bg-[#14161B] border border-[#2B2E36] rounded px-3 py-2 text-gray-100 font-mono text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-[#16181E] border border-[#2B2F3B] p-2.5 rounded text-[11px] text-gray-400 leading-relaxed">
            <div className="flex items-center space-x-1 text-indigo-300 font-medium mb-0.5">
              <Sparkles className="w-3 h-3" />
              <span>Non-destructive Text Sync 原則</span>
            </div>
            本文を直接上書きせず、エディタ末尾の <span className="font-mono text-gray-300"># Generated Relations</span> セクションに <span className="font-mono text-gray-300">PATCH</span> ブロックとして追記します。
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#2F3440]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#272B35] hover:bg-[#323744] text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-sm"
            >
              Patchを適用
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
