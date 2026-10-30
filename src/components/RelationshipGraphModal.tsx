import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Share2,
  Users,
  Shield,
  Layers,
  Filter,
  Search,
  Clock,
  ChevronRight,
  Sparkles,
  Maximize2,
  Minimize2,
  Info
} from 'lucide-react';
import type { WorldModel, Entity, Relation } from '../core/models';
import type { WorldState, WorldStateEngine } from '../core/world_state';
import { getLayerColor } from '../core/layers';

interface RelationshipGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldModel: WorldModel | WorldState;
  engine?: WorldStateEngine | null;
  currentTimestamp?: number;
  onSelectEntity?: (name: string) => void;
  onOpenWiki?: (name: string) => void;
  initialFocusedEntity?: string | null;
}

const RELATION_COLOR_MAP: Record<string, { stroke: string; text: string; bg: string }> = {
  '友好': { stroke: '#10b981', text: '#34d399', bg: 'rgba(16, 185, 129, 0.15)' },
  '親愛': { stroke: '#10b981', text: '#34d399', bg: 'rgba(16, 185, 129, 0.15)' },
  '同盟': { stroke: '#06b6d4', text: '#22d3ee', bg: 'rgba(6, 182, 212, 0.15)' },
  '所属': { stroke: '#6366f1', text: '#818cf8', bg: 'rgba(99, 102, 241, 0.15)' },
  '主従': { stroke: '#6366f1', text: '#818cf8', bg: 'rgba(99, 102, 241, 0.15)' },
  '敵対': { stroke: '#f43f5e', text: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)' },
  '対立': { stroke: '#f43f5e', text: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)' },
  'ライバル': { stroke: '#f59e0b', text: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)' },
  '恋愛': { stroke: '#ec4899', text: '#f472b6', bg: 'rgba(236, 72, 153, 0.15)' },
  '師弟': { stroke: '#8b5cf6', text: '#a78bfa', bg: 'rgba(139, 92, 246, 0.15)' },
  '契約': { stroke: '#0ea5e9', text: '#38bdf8', bg: 'rgba(14, 165, 233, 0.15)' }
};

export const RelationshipGraphModal: React.FC<RelationshipGraphModalProps> = ({
  isOpen,
  onClose,
  worldModel,
  engine,
  currentTimestamp = 0,
  onSelectEntity,
  onOpenWiki,
  initialFocusedEntity
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layerFilter, setLayerFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTime, setActiveTime] = useState<number>(currentTimestamp);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Compute model at activeTime if engine is available
  const activeModel = useMemo<WorldModel | WorldState>(() => {
    if (engine && activeTime !== undefined) {
      return engine.stateAt(activeTime);
    }
    return worldModel;
  }, [engine, activeTime, worldModel]);

  const entities = useMemo(() => Object.values(activeModel.entities || {}), [activeModel]);
  const relations = useMemo(() => Object.values(activeModel.relations || {}), [activeModel]);

  // Set initial focus
  useEffect(() => {
    if (initialFocusedEntity) {
      const match = entities.find(e => e.name === initialFocusedEntity || e.aliases?.includes(initialFocusedEntity));
      if (match) setSelectedEntityId(match.id);
    } else if (entities.length > 0 && !selectedEntityId) {
      setSelectedEntityId(entities[0].id);
    }
  }, [initialFocusedEntity, entities]);

  // Node layout calculation (Circle or Force-oriented based on index)
  const nodeLayout = useMemo(() => {
    const layout: Record<string, { x: number; y: number; entity: Entity }> = {};
    const filtered = entities.filter(e => {
      if (layerFilter !== 'all' && e.layer !== layerFilter) return false;
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (searchQuery.trim() && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    const count = filtered.length;
    const centerX = 420;
    const centerY = 320;
    const radius = Math.min(260, Math.max(140, count * 35));

    filtered.forEach((e, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      layout[e.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        entity: e
      };
    });

    return layout;
  }, [entities, layerFilter, typeFilter, searchQuery]);

  // Selected Entity details
  const selectedEntity = entities.find(e => e.id === selectedEntityId);

  // Active relations for selected entity
  const selectedEntityRelations = useMemo(() => {
    if (!selectedEntityId) return [];
    return relations.filter(r => r.source === selectedEntityId || r.target === selectedEntityId);
  }, [relations, selectedEntityId]);

  // Factions / Organizations list
  const factions = useMemo(() => {
    return entities.filter(e => e.type === 'Organization' || e.type === 'Faction');
  }, [entities]);

  // All distinct layers
  const allLayers = useMemo(() => {
    const s = new Set<string>();
    entities.forEach(e => {
      if (e.layer) s.add(e.layer);
    });
    return Array.from(s);
  }, [entities]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                <span>人物・勢力ダイナミック相関図</span>
                <span className="text-xs text-neutral-400 font-normal">
                  · 時間軸 t={activeTime} における勢力図
                </span>
              </h2>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="人物・勢力を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-md pl-8 pr-3 py-1 text-xs text-neutral-200 outline-none focus:border-cyan-500 w-44"
              />
            </div>

            <select
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-md px-2.5 py-1 text-xs text-neutral-300 outline-none focus:border-cyan-500"
            >
              <option value="all">全レイヤー</option>
              {allLayers.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Timeline Slider Ribbon (Dynamic World Time) */}
        {engine && (
          <div className="px-6 py-2.5 bg-neutral-950/40 border-b border-neutral-800/80 flex items-center gap-4 text-xs text-neutral-300">
            <div className="flex items-center gap-2 shrink-0 font-medium">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>時間軸 $t$:</span>
              <span className="font-mono text-cyan-400 font-bold tabular-nums">t={activeTime}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={activeTime}
              onChange={(e) => setActiveTime(Number(e.target.value))}
              className="flex-1 accent-cyan-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
            />
            <span className="text-[11px] text-neutral-400 shrink-0">
              スライダーを動かすと各時点の関係性・生存状況に動的更新されます
            </span>
          </div>
        )}

        {/* Main Content: Graph Canvas + Side Inspector */}
        <div className="flex-1 flex overflow-hidden">
          {/* SVG Canvas Area */}
          <div className="flex-1 relative bg-neutral-950/90 overflow-hidden select-none">
            <svg
              className="w-full h-full"
              viewBox="0 0 840 640"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
                </marker>
                {Object.entries(RELATION_COLOR_MAP).map(([type, colors]) => (
                  <marker
                    key={type}
                    id={`arrow-${type}`}
                    viewBox="0 0 10 10"
                    refX="20"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill={colors.stroke} />
                  </marker>
                ))}
              </defs>

              {/* Grid Background */}
              <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#graph-grid)" />

              {/* Relations (Edges) */}
              {relations.map((rel) => {
                const sourceNode = nodeLayout[rel.source];
                const targetNode = nodeLayout[rel.target];
                if (!sourceNode || !targetNode) return null;

                const isConnectedToSelected =
                  rel.source === selectedEntityId || rel.target === selectedEntityId;
                const style = RELATION_COLOR_MAP[rel.type] || {
                  stroke: '#71717a',
                  text: '#a1a1aa',
                  bg: 'rgba(113, 113, 122, 0.15)'
                };

                const midX = (sourceNode.x + targetNode.x) / 2;
                const midY = (sourceNode.y + targetNode.y) / 2;

                return (
                  <g key={rel.id} className="transition-opacity duration-200">
                    <line
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={style.stroke}
                      strokeWidth={isConnectedToSelected ? 2.5 : 1.2}
                      strokeOpacity={selectedEntityId ? (isConnectedToSelected ? 0.95 : 0.2) : 0.65}
                      strokeDasharray={rel.type === '契約' || rel.type === '同盟' ? '4 3' : undefined}
                      markerEnd={`url(#arrow-${rel.type})`}
                    />
                    {/* Relation label badge */}
                    <g
                      transform={`translate(${midX}, ${midY})`}
                      opacity={selectedEntityId ? (isConnectedToSelected ? 1 : 0.2) : 0.85}
                    >
                      <rect
                        x="-24"
                        y="-9"
                        width="48"
                        height="18"
                        rx="4"
                        fill="#171717"
                        stroke={style.stroke}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="600"
                        fill={style.text}
                      >
                        {rel.type}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Entity Nodes */}
              {Object.values(nodeLayout).map(({ x, y, entity }) => {
                const isSelected = entity.id === selectedEntityId;
                const layer = entity.layer || 'Su-ken';
                const layerStyle = getLayerColor(layer);
                const isOrg = entity.type === 'Organization' || entity.type === 'Faction';

                return (
                  <g
                    key={entity.id}
                    transform={`translate(${x}, ${y})`}
                    onClick={() => setSelectedEntityId(entity.id)}
                    className="cursor-pointer transition-transform duration-150"
                  >
                    {/* Selected glow */}
                    {isSelected && (
                      <circle
                        r={isOrg ? 32 : 26}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        className="animate-spin"
                        style={{ animationDuration: '10s' }}
                      />
                    )}

                    {/* Node Base */}
                    {isOrg ? (
                      <rect
                        x="-24"
                        y="-24"
                        width="48"
                        height="48"
                        rx="8"
                        fill="#18181b"
                        stroke={isSelected ? '#06b6d4' : layerStyle.borderHex}
                        strokeWidth={isSelected ? 2 : 1.5}
                      />
                    ) : (
                      <circle
                        r="20"
                        fill="#18181b"
                        stroke={isSelected ? '#06b6d4' : layerStyle.borderHex}
                        strokeWidth={isSelected ? 2 : 1.5}
                      />
                    )}

                    {/* Inner Icon / Letter */}
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fontSize={isOrg ? '11' : '12'}
                      fontWeight="bold"
                      fill={layerStyle.textHex}
                    >
                      {entity.name.slice(0, 1)}
                    </text>

                    {/* Node Name Label */}
                    <text
                      x="0"
                      y={isOrg ? 36 : 32}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={isSelected ? '#ffffff' : '#d4d4d8'}
                      className="select-none"
                    >
                      {entity.name}
                    </text>

                    {/* Layer indicator */}
                    <text
                      x="0"
                      y={isOrg ? 48 : 44}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#71717a"
                      className="select-none font-mono"
                    >
                      {layer}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Quick Legend at bottom left */}
            <div className="absolute bottom-4 left-4 p-3 bg-neutral-900/90 border border-neutral-800 rounded-lg text-xs space-y-1.5 backdrop-blur-md">
              <span className="text-[10px] text-neutral-400 font-semibold block uppercase tracking-wider">
                関係性の種別
              </span>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-0.5 bg-emerald-500 rounded" />
                  友好·親愛
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-0.5 bg-rose-500 rounded" />
                  敵対·対立
                </span>
                <span className="flex items-center gap-1 text-indigo-400">
                  <span className="w-2 h-0.5 bg-indigo-500 rounded" />
                  所属·主従
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-0.5 bg-amber-500 rounded" />
                  ライバル
                </span>
              </div>
            </div>
          </div>

          {/* Side Inspector Panel */}
          <div className="w-80 border-l border-neutral-800 bg-neutral-900/95 flex flex-col p-5 overflow-y-auto">
            {selectedEntity ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="pb-4 border-b border-neutral-800">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-lg font-bold text-neutral-100 truncate">
                      {selectedEntity.name}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded border font-mono shrink-0"
                      style={{
                        backgroundColor: getLayerColor(selectedEntity.layer || 'Su-ken').bgRgba,
                        borderColor: getLayerColor(selectedEntity.layer || 'Su-ken').borderHex,
                        color: getLayerColor(selectedEntity.layer || 'Su-ken').textHex
                      }}
                    >
                      {selectedEntity.layer || '未所属'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>種別: {selectedEntity.type}</span>
                    <span aria-hidden="true">·</span>
                    <span>状態: {selectedEntity.existence}</span>
                  </div>
                </div>

                {/* Aliases */}
                {selectedEntity.aliases && selectedEntity.aliases.length > 0 && (
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-1">別名・通称:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedEntity.aliases.map((a, i) => (
                        <span key={i} className="text-xs bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Relations List */}
                <div>
                  <span className="text-xs font-semibold text-neutral-300 block mb-2">
                    アクティブな関係性 ({selectedEntityRelations.length}件)
                  </span>
                  {selectedEntityRelations.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">関係性が定義されていません。</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedEntityRelations.map((r) => {
                        const isSource = r.source === selectedEntity.id;
                        const otherId = isSource ? r.target : r.source;
                        const otherEntity = entities.find(e => e.id === otherId);
                        const otherName = otherEntity?.name || otherId;
                        const relStyle = RELATION_COLOR_MAP[r.type] || {
                          stroke: '#71717a',
                          text: '#a1a1aa',
                          bg: 'rgba(113,113,122,0.1)'
                        };

                        return (
                          <div
                            key={r.id}
                            onClick={() => setSelectedEntityId(otherId)}
                            className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 hover:border-neutral-700 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ backgroundColor: relStyle.bg, color: relStyle.text }}
                              >
                                {r.type}
                              </span>
                              <span className="text-neutral-200 font-medium">{otherName}</span>
                            </div>
                            <span className="text-[10px] text-neutral-400">
                              {isSource ? '→' : '←'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="pt-4 border-t border-neutral-800 space-y-2">
                  {onOpenWiki && (
                    <button
                      type="button"
                      onClick={() => onOpenWiki(selectedEntity.name)}
                      className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Info className="w-3.5 h-3.5 text-cyan-400" />
                      <span>設定資料集 (Wiki) で詳細を読む</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-400 text-xs">
                <Users className="w-8 h-8 text-neutral-600 mb-2" />
                <p>ノードをクリックすると関係性の詳細が表示されます。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
