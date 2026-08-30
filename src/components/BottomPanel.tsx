import React, { useState } from 'react';
import { Event } from '../core/events';
import { LintIssue, Severity } from '../core/linter';
import { LAYER_HIERARCHY } from '../core/models';
import { 
  Clock, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  ChevronUp,
  ChevronDown,
  Layers
} from 'lucide-react';

interface BottomPanelProps {
  // Timeline props
  timelineMode: boolean;
  onToggleTimelineMode: (enabled: boolean) => void;
  timestamp: number;
  onTimestampChange: (ts: number) => void;
  events: Event[];
  onAddEvent: () => void;
  onDeleteEvent: (eventId: string) => void;
  selectedEventId: string | null;
  onSelectEventId: (eventId: string | null) => void;
  changeSummary: string;
  visibleLayers: Set<string>;
  onToggleLayer: (layer: string) => void;

  // Linter props
  lintIssues: LintIssue[];
  onJumpToLine: (line: number) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  timelineMode,
  onToggleTimelineMode,
  timestamp,
  onTimestampChange,
  events,
  onAddEvent,
  onDeleteEvent,
  selectedEventId,
  onSelectEventId,
  changeSummary,
  visibleLayers,
  onToggleLayer,
  lintIssues,
  onJumpToLine,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'linter'>('timeline');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const warningCount = lintIssues.filter(i => i.severity === 'warning').length;

  return (
    <div className="bg-[#181B20] border-t border-[#2B2E36] flex flex-col z-20 shadow-lg">
      {/* Tab Bar / Header */}
      <div className="h-9 px-3 bg-[#15171C] border-b border-[#2B2E36] flex items-center justify-between text-xs select-none">
        <div className="flex items-center space-x-1">
          {/* Timeline Tab Button */}
          <button
            id="tab-timeline"
            onClick={() => { setActiveTab('timeline'); setIsCollapsed(false); }}
            className={`px-3 py-1.5 rounded-t font-medium flex items-center space-x-1.5 transition-colors ${
              activeTab === 'timeline' && !isCollapsed
                ? 'bg-[#181B20] text-sky-400 border-t-2 border-sky-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E222A]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Timeline Lens (Phase 3, §14)</span>
            {timelineMode && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Linter Tab Button */}
          <button
            id="tab-linter"
            onClick={() => { setActiveTab('linter'); setIsCollapsed(false); }}
            className={`px-3 py-1.5 rounded-t font-medium flex items-center space-x-1.5 transition-colors ${
              activeTab === 'linter' && !isCollapsed
                ? 'bg-[#181B20] text-amber-400 border-t-2 border-amber-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E222A]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Worldbuilding Linter (Phase 4, §15)</span>
            {lintIssues.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                warningCount > 0 
                  ? 'bg-amber-950 text-amber-400 border border-amber-800' 
                  : 'bg-blue-950 text-blue-400 border border-blue-800'
              }`}>
                {lintIssues.length}
              </span>
            )}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#21252D] rounded transition-colors"
          title={isCollapsed ? "展開する" : "折りたたむ"}
        >
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Tab Contents */}
      {!isCollapsed && (
        <div className="h-56 p-3 overflow-y-auto">
          {activeTab === 'timeline' ? (
            <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs text-gray-200">
              {/* Left Column: Timeline Scrubber & Summary */}
              <div className="space-y-2.5 bg-[#1C2028] p-3 rounded-lg border border-[#2F3440] flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 font-medium cursor-pointer">
                    <input
                      id="timeline-mode-checkbox"
                      type="checkbox"
                      checked={timelineMode}
                      onChange={(e) => onToggleTimelineMode(e.target.checked)}
                      className="rounded bg-[#14161B] border-gray-600 text-sky-500 focus:ring-0"
                    />
                    <span className={timelineMode ? 'text-sky-300' : 'text-gray-300'}>
                      Timeline State を表示する (Phase 3)
                    </span>
                  </label>
                  <span className="font-mono text-xs bg-[#14161B] px-2 py-0.5 rounded border border-[#2F3440] text-sky-400 font-bold">
                    t = {timestamp}
                  </span>
                </div>

                {/* Scrubber Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                    <span>-50</span>
                    <span>0</span>
                    <span>+50</span>
                  </div>
                  <input
                    id="timeline-scrubber-slider"
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={timestamp}
                    disabled={!timelineMode}
                    onChange={(e) => onTimestampChange(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-500 bg-[#14161B] h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
                  />
                </div>

                {/* Change Summary */}
                <div className="flex-1 flex flex-col space-y-1">
                  <span className="text-[11px] text-gray-400 font-medium">Change Summary (Before → After, §14):</span>
                  <div className="flex-1 bg-[#14161B] border border-[#282C35] p-2 rounded text-[11px] font-mono text-gray-300 overflow-y-auto whitespace-pre-wrap">
                    {changeSummary || "この時点で発生するEventの変化がここに表示されます"}
                  </div>
                </div>
              </div>

              {/* Middle Column: Layer Slider */}
              <div className="bg-[#1C2028] p-3 rounded-lg border border-[#2F3440] flex flex-col space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-200">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Layer Slider (§13)</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  グラフに表示する世界観レイヤーをフィルタリングします:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {LAYER_HIERARCHY.map(layer => {
                    const checked = visibleLayers.has(layer);
                    return (
                      <label
                        key={layer}
                        className={`flex items-center space-x-2 p-2 rounded border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#181B22] border-emerald-800/60 text-emerald-300'
                            : 'bg-[#14161B] border-[#2A2E38] text-gray-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleLayer(layer)}
                          className="rounded bg-[#111317] border-gray-600 text-emerald-500 focus:ring-0"
                        />
                        <span className="font-mono text-xs">{layer}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Events List & Management */}
              <div className="bg-[#1C2028] p-3 rounded-lg border border-[#2F3440] flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-200">Registered Events</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      id="btn-add-event"
                      onClick={onAddEvent}
                      className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] flex items-center space-x-1 transition-colors shadow-sm"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Event...</span>
                    </button>
                    <button
                      id="btn-delete-event"
                      onClick={() => selectedEventId && onDeleteEvent(selectedEventId)}
                      disabled={!selectedEventId}
                      className="px-2 py-1 bg-[#2C303A] hover:bg-red-900/60 text-gray-300 hover:text-red-200 disabled:opacity-40 rounded text-[11px] flex items-center space-x-1 transition-colors"
                      title="選択したEventを削除"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Events scroll list */}
                <div className="flex-1 bg-[#14161B] border border-[#282C35] rounded overflow-y-auto p-1 space-y-1">
                  {events.length === 0 ? (
                    <div className="p-3 text-center text-gray-500 text-[11px]">
                      Eventが登録されていません
                    </div>
                  ) : (
                    events
                      .slice()
                      .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
                      .map(ev => {
                        const isSelected = selectedEventId === ev.id;
                        return (
                          <div
                            key={ev.id}
                            onClick={() => onSelectEventId(isSelected ? null : ev.id)}
                            className={`p-1.5 rounded cursor-pointer text-[11px] font-mono flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-sky-950 border border-sky-700 text-sky-200'
                                : 'hover:bg-[#1E222A] text-gray-300'
                            }`}
                          >
                            <span>t={ev.timestamp} [{ev.type}]</span>
                            {ev.is_snapshot_point && (
                              <span className="text-amber-400 text-[10px] font-bold">★snapshot</span>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Linter Tab Content */
            <div className="h-full flex flex-col space-y-1.5">
              <div className="text-[11px] text-gray-400">
                世界観ルールの検証結果です。行をクリックするとエディタの該当箇所へジャンプします。
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 bg-[#14161B] p-2 rounded-lg border border-[#282C35]">
                {lintIssues.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-emerald-400 space-x-2 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>問題は見つかりませんでした ✓ (All consistency rules pass)</span>
                  </div>
                ) : (
                  lintIssues.map((issue, idx) => {
                    const isWarning = issue.severity === 'warning';
                    return (
                      <div
                        key={idx}
                        onClick={() => issue.line && onJumpToLine(issue.line)}
                        className={`p-2 rounded flex items-start space-x-2 text-xs transition-colors cursor-pointer ${
                          isWarning
                            ? 'bg-amber-950/20 border border-amber-900/40 hover:bg-amber-950/40 text-amber-200'
                            : 'bg-blue-950/20 border border-blue-900/40 hover:bg-blue-950/40 text-blue-200'
                        }`}
                      >
                        {isWarning ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        )}

                        <div className="flex-1 font-mono text-[11.5px]">
                          <span className="font-bold mr-1.5">[{issue.code}]</span>
                          <span>{issue.message}</span>
                        </div>

                        {issue.line && (
                          <span className="bg-[#1C2028] px-2 py-0.5 rounded border border-[#2F3440] text-[10px] font-mono text-gray-400 shrink-0">
                            line {issue.line}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
