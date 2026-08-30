import React, { useState } from 'react';
import { X, Calendar, Plus } from 'lucide-react';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    timestamp: number;
    type: string;
    isSnapshotPoint: boolean;
    effectKind: string;
    target: string;
    value: string;
  }) => void;
  entityNames: string[];
  relationRefs: string[];
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  entityNames,
  relationRefs,
}) => {
  const [timestamp, setTimestamp] = useState<number>(0);
  const [type, setType] = useState<string>('Event');
  const [isSnapshotPoint, setIsSnapshotPoint] = useState<boolean>(false);
  const [effectKind, setEffectKind] = useState<string>('entity_existence');
  const [target, setTarget] = useState<string>(entityNames[0] || '');
  const [value, setValue] = useState<string>('dead');

  if (!isOpen) return null;

  const targetList = effectKind === 'entity_existence' ? entityNames : relationRefs;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    onAdd({
      timestamp,
      type: type.trim() || 'Event',
      isSnapshotPoint,
      effectKind,
      target,
      value: value.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C2028] border border-[#2F3440] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#15171C] border-b border-[#2F3440] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-semibold text-gray-100">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>Event を追加</span>
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
            <label className="block text-gray-400 mb-1 font-medium">Timestamp:</label>
            <input
              type="number"
              value={timestamp}
              onChange={(e) => setTimestamp(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-[#14161B] border border-[#2B2E36] rounded px-3 py-1.5 text-gray-100 font-mono outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-medium">Type:</label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="例: Tear, Chapter, MajorEvent, 自由入力も可"
              className="w-full bg-[#14161B] border border-[#2B2E36] rounded px-3 py-1.5 text-gray-100 outline-none focus:border-sky-500"
            />
          </div>

          <label className="flex items-center space-x-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isSnapshotPoint}
              onChange={(e) => setIsSnapshotPoint(e.target.checked)}
              className="rounded bg-[#14161B] border-gray-600 text-amber-500 focus:ring-0"
            />
            <span className="text-gray-300">Snapshot Point にする (§9.1.1)</span>
          </label>

          <div>
            <label className="block text-gray-400 mb-1 font-medium">Effect kind:</label>
            <select
              value={effectKind}
              onChange={(e) => {
                const kind = e.target.value;
                setEffectKind(kind);
                if (kind === 'entity_existence') {
                  setTarget(entityNames[0] || '');
                  setValue('dead');
                } else {
                  setTarget(relationRefs[0] || '');
                  setValue('confirmed');
                }
              }}
              className="w-full bg-[#14161B] border border-[#2B2E36] rounded px-3 py-1.5 text-gray-100 outline-none focus:border-sky-500"
            >
              <option value="entity_existence">entity_existence (存在・生死)</option>
              <option value="relation_status">relation_status (関係の確からしさ)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-medium">対象 (Target):</label>
            {targetList.length === 0 ? (
              <p className="text-[11px] text-amber-400 italic">
                利用可能な対象がありません。まず本文にEntityまたはRelationを記述してください。
              </p>
            ) : (
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-[#14161B] border border-[#2B2E36] rounded px-3 py-1.5 text-gray-100 font-mono outline-none focus:border-sky-500"
              >
                {targetList.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-medium">新しい値 (New Value):</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={effectKind === 'entity_existence' ? '例: dead / confirmed' : 'confirmed / hypothetical / rumor'}
              className="w-full bg-[#14161B] border border-[#2B2E36] rounded px-3 py-1.5 text-gray-100 font-mono outline-none focus:border-sky-500"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#2F3440]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#272B35] hover:bg-[#323744] text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={targetList.length === 0}
              className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Eventを追加</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
