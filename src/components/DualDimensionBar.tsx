import React, { useState } from 'react';
import {
  Layers,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { getLayerColor } from '../core/layers';
import type { Event } from '../core/events';

interface DualDimensionBarProps {
  // Layer Dimension Props
  allLayers: string[];
  visibleLayers: Set<string>;
  onToggleLayer: (layer: string) => void;
  onSetAllLayersVisible: () => void;
  onSelectOnlyLayer: (layer: string) => void;
  entityCountByLayer: Record<string, number>;
  onAddCustomLayer: (newLayerName: string) => void;

  // Timeline / Worldline Dimension Props
  timelineMode: boolean;
  onToggleTimelineMode: (enabled: boolean) => void;
  timestamp: number;
  onTimestampChange: (ts: number) => void;
  events: Event[];
  onOpenAddEventModal: () => void;
}

export const DualDimensionBar: React.FC<DualDimensionBarProps> = ({
  allLayers,
  visibleLayers,
  onToggleLayer,
  onSetAllLayersVisible,
  onSelectOnlyLayer,
  entityCountByLayer,
  onAddCustomLayer,
  timelineMode,
  onToggleTimelineMode,
  timestamp,
  onTimestampChange,
  events,
  onOpenAddEventModal
}) => {
  const [isAddingLayer, setIsAddingLayer] = useState(false);
  const [newLayerInput, setNewLayerInput] = useState('');

  const isAllLayersVisible = allLayers.every(l => visibleLayers.has(l));

  // Event timestamps for stepping
  const eventTimestamps = Array.from(new Set(events.map(e => e.timestamp))).sort((a, b) => a - b);

  const handleStepTimeline = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      const prev = eventTimestamps.filter(ts => ts < timestamp);
      if (prev.length > 0) {
        onTimestampChange(prev[prev.length - 1]);
      } else {
        onTimestampChange(Math.max(-50, timestamp - 1));
      }
    } else {
      const next = eventTimestamps.filter(ts => ts > timestamp);
      if (next.length > 0) {
        onTimestampChange(next[0]);
      } else {
        onTimestampChange(Math.min(50, timestamp + 1));
      }
    }
  };

  const handleConfirmAddLayer = () => {
    const trimmed = newLayerInput.trim();
    if (trimmed) {
      onAddCustomLayer(trimmed);
      setNewLayerInput('');
      setIsAddingLayer(false);
    }
  };

  return (
    <div className="bg-[#15171C] border-b border-[#262932] px-3 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs select-none shadow-sm z-20">
      {/* ========================================================= */}
      {/* Axis A: 所属レイヤー (Layer Dimension)                     */}
      {/* ========================================================= */}
      <div className="flex items-center space-x-2 flex-1 min-w-[320px] overflow-x-auto py-0.5">
        <div className="flex items-center space-x-1.5 text-gray-300 font-semibold shrink-0 mr-1">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="tracking-wide">所属レイヤー</span>
        </div>

        {/* All Layers Filter Button */}
        <button
          onClick={onSetAllLayersVisible}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0 ${
            isAllLayersVisible
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-[#1E222A] text-gray-400 hover:text-gray-200 border border-[#2F333E]'
          }`}
          title="すべてのレイヤーを表示"
        >
          すべて
        </button>

        {/* Individual Layer Toggle Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {allLayers.map(layer => {
            const isVisible = visibleLayers.has(layer);
            const color = getLayerColor(layer);
            const count = entityCountByLayer[layer] ?? 0;

            return (
              <button
                key={layer}
                onClick={() => onToggleLayer(layer)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onSelectOnlyLayer(layer);
                }}
                className={`group flex items-center space-x-1.5 px-2 py-0.5 rounded border text-[11px] font-medium transition-all shrink-0 ${
                  isVisible
                    ? 'border-opacity-80 bg-opacity-25'
                    : 'border-[#2A2E37] bg-[#171920] text-gray-500 opacity-60 hover:opacity-90'
                }`}
                style={{
                  borderColor: isVisible ? color.hex : undefined,
                  backgroundColor: isVisible ? color.bgRgba : undefined,
                  color: isVisible ? color.textHex : undefined
                }}
                title={`クリック: 切り替え / 右クリック: 「${layer}」のみ単独表示 (所属: ${count}件)`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color.hex }}
                />
                <span>{layer}</span>
                <span
                  className={`text-[9px] font-mono px-1 rounded-full ${
                    isVisible ? 'bg-black/30' : 'bg-transparent text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add Custom Layer Button / Inline Form */}
        {isAddingLayer ? (
          <div className="flex items-center space-x-1 shrink-0 bg-[#1e222b] border border-emerald-600/60 rounded px-1.5 py-0.5">
            <input
              type="text"
              autoFocus
              value={newLayerInput}
              onChange={e => setNewLayerInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirmAddLayer();
                if (e.key === 'Escape') setIsAddingLayer(false);
              }}
              placeholder="新レイヤー名（例: 現実界）"
              className="w-28 bg-transparent text-[11px] text-white focus:outline-none"
            />
            <button
              onClick={handleConfirmAddLayer}
              className="text-emerald-400 hover:text-emerald-300 p-0.5"
              title="追加"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsAddingLayer(false)}
              className="text-gray-400 hover:text-gray-200 p-0.5"
              title="キャンセル"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingLayer(true)}
            className="flex items-center space-x-1 rounded border border-dashed border-[#343844] bg-[#1a1c22] px-1.5 py-0.5 text-[11px] text-gray-400 hover:text-emerald-300 hover:border-emerald-600/60 hover:bg-[#1e232c] transition-colors shrink-0"
            title="カスタムレイヤー名を追加（現実界・異界・表社会など自由に追加可能）"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span>レイヤー追加</span>
          </button>
        )}
      </div>

      {/* Vertical separator */}
      <div className="h-5 w-[1px] bg-[#272B35] hidden lg:block" />

      {/* ========================================================= */}
      {/* Axis B: 世界線・時間軸 (Worldline / Timeline Dimension)    */}
      {/* ========================================================= */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="flex items-center space-x-1.5 text-gray-300 font-semibold shrink-0">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span className="tracking-wide">世界線 (Timeline)</span>
        </div>

        {/* Timeline Mode Switch */}
        <label className="flex items-center space-x-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={timelineMode}
            onChange={e => onToggleTimelineMode(e.target.checked)}
            className="rounded bg-[#111317] border-gray-600 text-sky-500 focus:ring-0"
          />
          <span className={timelineMode ? 'text-sky-300 font-medium' : 'text-gray-400'}>
            レンズ有効
          </span>
          {timelineMode && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </label>

        {/* Scrubber & Controls */}
        <div className="flex items-center space-x-1.5 bg-[#1b1e26] border border-[#2b2f3a] rounded px-2 py-0.5">
          <button
            onClick={() => handleStepTimeline('prev')}
            disabled={!timelineMode}
            className="p-0.5 text-gray-400 hover:text-white disabled:opacity-30"
            title="前のEventまたはt-1へ"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            value={timestamp}
            disabled={!timelineMode}
            onChange={e => onTimestampChange(parseInt(e.target.value, 10))}
            className="w-16 sm:w-24 accent-sky-500 bg-[#121418] h-1.5 rounded appearance-none cursor-pointer disabled:opacity-30"
          />

          <span className="font-mono text-[11px] font-bold text-sky-400 min-w-[42px] text-center">
            t = {timestamp}
          </span>

          <button
            onClick={() => handleStepTimeline('next')}
            disabled={!timelineMode}
            className="p-0.5 text-gray-400 hover:text-white disabled:opacity-30"
            title="次のEventまたはt+1へ"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onTimestampChange(0)}
            disabled={!timelineMode || timestamp === 0}
            className="p-0.5 text-gray-400 hover:text-sky-400 disabled:opacity-20 ml-0.5"
            title="t=0にリセット"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Event Badge / Add Event shortcut */}
        <button
          onClick={onOpenAddEventModal}
          className="flex items-center space-x-1 rounded bg-[#20242e] border border-[#323642] px-2 py-0.5 text-[11px] text-gray-300 hover:text-sky-300 hover:border-sky-600/60 transition-colors"
          title="歴史的イベント（生死・所属変更など）を追加"
        >
          <span className="text-sky-400 font-mono font-bold">{events.length}</span>
          <span className="text-gray-400">Events</span>
          <Plus className="w-2.5 h-2.5 text-sky-400" />
        </button>
      </div>
    </div>
  );
};
export default DualDimensionBar;
