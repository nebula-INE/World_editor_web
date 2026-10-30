import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Entity, Relation, WorldModel } from '../core/models';
import { WorldState } from '../core/world_state';
import { getLayerColor, isCrossLayerRelation } from '../core/layers';
import { computeLayerSwimlaneLayout } from '../core/layout-engine';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RefreshCw, 
  Move, 
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Search,
  X,
  Plus,
  LayoutGrid,
  Trash2,
  Edit3,
  Layers
} from 'lucide-react';

const NODE_RADIUS = 34;

const LAYER_COLORS: Record<string, string> = {
  Character: '#5B8DEF',
  Organization: '#E0A73C',
  Location: '#5FB878',
  Unknown: '#9AA0A6',
};

interface GraphViewProps {
  model: WorldModel | WorldState;
  visibleLayers?: Set<string> | null;
  onRelationTypeEdit: (refKey: string, oldType: string) => void;
  initialPositions?: Record<string, { x: number; y: number }>;
  onPositionsChange?: (positions: Record<string, { x: number; y: number }>) => void;
  onAddEntity?: (name: string, type: string, layer?: string) => void;
  onUpdateEntityLayer?: (entityName: string, newLayer: string) => void;
  onDeleteEntity?: (entityName: string) => void;
  allLayers?: string[];
}

export const GraphView: React.FC<GraphViewProps> = ({
  model,
  visibleLayers,
  onRelationTypeEdit,
  initialPositions,
  onPositionsChange,
  onAddEntity,
  onUpdateEntityLayer,
  onDeleteEntity,
  allLayers = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => initialPositions || {});
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasFit, setHasFit] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);

  // Search & Focus state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Multi-selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    entity: Entity | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    entity: null,
  });

  // Add Node Modal state
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [addNodeData, setAddNodeData] = useState({
    name: '',
    type: 'Character',
    layer: allLayers[0] || 'Su-ken',
  });

  useEffect(() => {
    onPositionsChange?.(positions);
  }, [positions, onPositionsChange]);

  // Filter entities by visible layer
  const allEntities = Object.values(model.entities);
  const entities = visibleLayers
    ? allEntities.filter(e => !e.layer || visibleLayers.has(e.layer))
    : allEntities;

  const visibleEntityIds = new Set(entities.map(e => e.id));
  const entityIdsKey = JSON.stringify(entities.map(entity => entity.id));
  const relations = Object.values(model.relations).filter(
    r => visibleEntityIds.has(r.source) && visibleEntityIds.has(r.target)
  );

  // Calculate layer grouping bounding boxes
  const layerBounds = useMemo<Record<string, { minX: number; maxX: number; minY: number; maxY: number; count: number }>>(() => {
    const groups: Record<string, { minX: number; maxX: number; minY: number; maxY: number; count: number }> = {};
    for (const ent of entities) {
      const pos = positions[ent.id];
      if (!pos) continue;
      const layer = ent.layer || '未分類';
      if (!groups[layer]) {
        groups[layer] = { minX: pos.x, maxX: pos.x, minY: pos.y, maxY: pos.y, count: 1 };
      } else {
        const g = groups[layer];
        g.minX = Math.min(g.minX, pos.x);
        g.maxX = Math.max(g.maxX, pos.x);
        g.minY = Math.min(g.minY, pos.y);
        g.maxY = Math.max(g.maxY, pos.y);
        g.count++;
      }
    }
    return groups;
  }, [entities, positions]);

  // Search matches
  const matchedEntities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return entities.filter(e => 
      e.name.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      (e.layer && e.layer.toLowerCase().includes(q))
    );
  }, [entities, searchQuery]);

  const matchedEntityIds = useMemo(() => new Set(matchedEntities.map(e => e.id)), [matchedEntities]);

  // Focus on specific entity
  const focusOnEntity = useCallback((entityId: string) => {
    const pos = positions[entityId];
    if (!pos || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const targetScale = Math.max(transform.scale, 1.25);
    setTransform({
      scale: targetScale,
      x: rect.width / 2 - pos.x * targetScale,
      y: rect.height / 2 - pos.y * targetScale,
    });
    setSelectedNodeIds(new Set([entityId]));
  }, [positions, transform.scale]);

  // Initialize or update circular positions for newly added entities
  useEffect(() => {
    if (entities.length === 0) return;

    setPositions(prev => {
      const next = { ...prev };
      let changed = false;
      const unpositioned = entities.filter(e => !next[e.id]);

      if (unpositioned.length > 0) {
        changed = true;
        const total = entities.length;
        const radius = Math.max(160, 60 * total);
        const cx = radius + 100;
        const cy = radius + 100;

        entities.forEach((entity, i) => {
          if (!next[entity.id]) {
            const angle = (2 * Math.PI * i) / total;
            next[entity.id] = {
              x: cx + radius * Math.cos(angle),
              y: cy + radius * Math.sin(angle),
            };
          }
        });
      }

      return changed ? next : prev;
    });

  }, [entityIdsKey]);

  // Fit to View Calculation
  const fitToView = useCallback(() => {
    if (!containerRef.current || entities.length === 0) {
      setTransform({ scale: 1, x: 0, y: 0 });
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const posList = entities.map(e => positions[e.id]).filter(Boolean);
    if (posList.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of posList) {
      minX = Math.min(minX, p.x - NODE_RADIUS - 40);
      maxX = Math.max(maxX, p.x + NODE_RADIUS + 40);
      minY = Math.min(minY, p.y - NODE_RADIUS - 40);
      maxY = Math.max(maxY, p.y + NODE_RADIUS + 40);
    }

    const contentW = Math.max(maxX - minX, 100);
    const contentH = Math.max(maxY - minY, 100);

    const pad = 60;
    const availW = Math.max(rect.width - pad * 2, 100);
    const availH = Math.max(rect.height - pad * 2, 100);

    const scale = Math.min(Math.min(availW / contentW, availH / contentH), 1.5);
    const targetScale = Math.max(scale, 0.2);

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setTransform({
      scale: targetScale,
      x: rect.width / 2 - midX * targetScale,
      y: rect.height / 2 - midY * targetScale,
    });
  }, [entities, positions]);

  // Auto-fit on initial render
  useEffect(() => {
    if (!hasFit && entities.length > 0 && Object.keys(positions).length >= entities.length) {
      fitToView();
      setHasFit(true);
    }
  }, [entities.length, positions, hasFit, fitToView]);

  // Apply Layer Swimlane Auto Alignment
  const handleAutoAlignByLayer = useCallback(() => {
    const layerNames = allLayers.length > 0 ? allLayers : Array.from(new Set(entities.map(e => e.layer).filter(Boolean) as string[]));
    const newPositions = computeLayerSwimlaneLayout(entities, layerNames, {
      nodeRadius: NODE_RADIUS,
      laneOrientation: 'horizontal',
    });
    setPositions(prev => ({ ...prev, ...newPositions }));
    setTimeout(() => fitToView(), 40);
  }, [entities, allLayers, fitToView]);

  // Panning helper
  const panBy = useCallback((dx: number, dy: number) => {
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  // Center Camera
  const centerCamera = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTransform(prev => ({
      ...prev,
      x: rect.width / 2,
      y: rect.height / 2,
    }));
  }, []);

  // Native non-passive Wheel & Trackpad gesture handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch-to-zoom or Ctrl + Wheel zoom
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        setTransform(prev => {
          const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.15), 3.5);
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          return {
            scale: newScale,
            x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
            y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
          };
        });
      } else {
        // Trackpad 2-finger scroll or standard wheel scroll
        setTransform(prev => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // Global key listener for Ctrl+F search & Arrow pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }

      const step = e.shiftKey ? 80 : 35;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        panBy(0, step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        panBy(0, -step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        panBy(step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        panBy(-step, 0);
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fitToView();
      } else if (e.key === 'Escape') {
        setContextMenu({ visible: false, x: 0, y: 0, entity: null });
        setSelectedNodeIds(new Set());
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panBy, fitToView]);

  // Mouse Down - starts panning, node drag, or rubberband selection
  const handleMouseDown = (e: React.MouseEvent) => {
    // Close context menu on any mouse down
    if (contextMenu.visible) {
      setContextMenu({ visible: false, x: 0, y: 0, entity: null });
    }

    // Middle click (button 1) or right click (button 2) always pans
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      setDragMoved(false);
      return;
    }

    // Left click on background
    if (e.button === 0) {
      const target = e.target as HTMLElement | SVGElement;
      const isNode = target.closest('[data-node="true"]');
      const isBadge = target.closest('[data-badge="true"]');

      if (!isNode && !isBadge) {
        if (e.shiftKey) {
          // Shift + Click on background starts rubberband box selection
          setSelectionBox({
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
          });
          setDragMoved(false);
        } else {
          // Standard pan
          setIsPanning(true);
          setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
          setDragMoved(false);
          setSelectedNodeIds(new Set());
        }
      }
    }
  };

  // Global window listeners for smooth dragging and box selection
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (selectionBox) {
        setSelectionBox(prev => prev ? ({ ...prev, currentX: e.clientX, currentY: e.clientY }) : null);
        return;
      }

      if (isPanning) {
        setDragMoved(true);
        setTransform(prev => ({
          ...prev,
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        }));
      } else if (draggingNodeId && positions[draggingNodeId]) {
        setDragMoved(true);
        const dx = e.movementX / transform.scale;
        const dy = e.movementY / transform.scale;

        setPositions(prev => {
          const next = { ...prev };
          // If the dragged node is part of a multi-selection, move ALL selected nodes together!
          if (selectedNodeIds.has(draggingNodeId) && selectedNodeIds.size > 1) {
            selectedNodeIds.forEach(id => {
              if (next[id]) {
                next[id] = {
                  x: next[id].x + dx,
                  y: next[id].y + dy,
                };
              }
            });
          } else {
            next[draggingNodeId] = {
              x: next[draggingNodeId].x + dx,
              y: next[draggingNodeId].y + dy,
            };
          }
          return next;
        });
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (selectionBox && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const boxLeft = Math.min(selectionBox.startX, selectionBox.currentX) - rect.left;
        const boxRight = Math.max(selectionBox.startX, selectionBox.currentX) - rect.left;
        const boxTop = Math.min(selectionBox.startY, selectionBox.currentY) - rect.top;
        const boxBottom = Math.max(selectionBox.startY, selectionBox.currentY) - rect.top;

        // Convert box coordinates to SVG world space
        const worldLeft = (boxLeft - transform.x) / transform.scale;
        const worldRight = (boxRight - transform.x) / transform.scale;
        const worldTop = (boxTop - transform.y) / transform.scale;
        const worldBottom = (boxBottom - transform.y) / transform.scale;

        const newSelected = new Set<string>();
        entities.forEach(ent => {
          const pos = positions[ent.id];
          if (pos && pos.x >= worldLeft && pos.x <= worldRight && pos.y >= worldTop && pos.y <= worldBottom) {
            newSelected.add(ent.id);
          }
        });

        setSelectedNodeIds(newSelected);
        setSelectionBox(null);
      }

      setIsPanning(false);
      setDraggingNodeId(null);
    };

    if (isPanning || draggingNodeId || selectionBox) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, draggingNodeId, positions, panStart, transform, selectionBox, selectedNodeIds, entities]);

  const getLineDash = (status: string) => {
    if (status === 'hypothetical') return '6 4';
    if (status === 'rumor') return '2 4';
    return undefined; // solid line for confirmed
  };

  return (
    <div
      ref={containerRef}
      id="graph-view-container"
      tabIndex={0}
      style={{ touchAction: 'none' }}
      className="h-full w-full bg-[#111317] relative overflow-hidden select-none flex flex-col focus:outline-none"
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        if (dragMoved) {
          e.preventDefault();
        }
      }}
      onDoubleClick={(e) => {
        // Double click on canvas background opens add entity modal
        const target = e.target as HTMLElement | SVGElement;
        if (!target.closest('[data-node="true"]') && !target.closest('[data-badge="true"]')) {
          setIsAddNodeOpen(true);
        }
      }}
    >
      {/* Top Left Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center space-x-1.5 bg-[#1C2028]/90 backdrop-blur border border-[#2F3440] p-1 rounded-md shadow-lg text-xs text-gray-300">
        <span className="px-2 py-0.5 font-medium text-gray-200 border-r border-[#2F3440] flex items-center space-x-1">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Graph Canvas</span>
        </span>

        <button
          id="btn-zoom-in"
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3.5) }))}
          className="p-1 hover:bg-[#2A2F3B] hover:text-white rounded transition-colors"
          title="Zoom In (Ctrl + Wheel Up)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          id="btn-zoom-out"
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.15) }))}
          className="p-1 hover:bg-[#2A2F3B] hover:text-white rounded transition-colors"
          title="Zoom Out (Ctrl + Wheel Down)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          id="btn-fit-view"
          onClick={fitToView}
          className="p-1 hover:bg-[#2A2F3B] hover:text-white rounded transition-colors"
          title="全体表示 (Fit into view)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          id="btn-center-camera"
          onClick={centerCamera}
          className="p-1 hover:bg-[#2A2F3B] hover:text-white rounded transition-colors"
          title="カメラを中心(0,0)にリセット"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>

        <span className="h-3 w-[1px] bg-[#2F3440]" />

        {/* Layer Swimlane Auto-Align Button */}
        <button
          id="btn-auto-align-layer"
          onClick={handleAutoAlignByLayer}
          className="flex items-center space-x-1 px-1.5 py-1 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/40 rounded transition-colors"
          title="所属レイヤーごとに帯状スイムレーンへ自動整列"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-medium">レイヤー整列</span>
        </button>

        <button
          id="btn-reset-layout"
          onClick={() => {
            const total = entities.length;
            const radius = Math.max(160, 60 * total);
            const cx = radius + 100;
            const cy = radius + 100;
            const next: Record<string, { x: number; y: number }> = {};
            entities.forEach((entity, i) => {
              const angle = (2 * Math.PI * i) / total;
              next[entity.id] = {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
              };
            });
            setPositions(next);
            setTimeout(() => fitToView(), 30);
          }}
          className="p-1 hover:bg-[#2A2F3B] hover:text-white rounded transition-colors"
          title="円形レイアウト再配置"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Quick Add Node Button */}
        {onAddEntity && (
          <button
            id="btn-quick-add-node"
            onClick={() => setIsAddNodeOpen(true)}
            className="flex items-center space-x-1 px-1.5 py-1 bg-[#252A36] hover:bg-[#2F3646] text-sky-300 border border-[#3A4254] rounded transition-colors"
            title="キャンバスに新しいエンティティを追加"
          >
            <Plus className="w-3 h-3 text-sky-400" />
            <span className="text-[11px]">ノード追加</span>
          </button>
        )}

        <span className="text-[11px] text-gray-400 pl-1 font-mono">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>

      {/* Top Right: Search & Stats Bar */}
      <div className="absolute top-3 right-3 z-10 flex items-center space-x-2">
        {/* Search Input / Button */}
        <div className="relative">
          {isSearchOpen ? (
            <div className="flex items-center bg-[#181B22]/95 border border-indigo-500/80 rounded-lg px-2.5 py-1 shadow-2xl text-xs space-x-1.5 animate-fadeIn">
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && matchedEntities.length > 0) {
                    focusOnEntity(matchedEntities[0].id);
                  } else if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }
                }}
                placeholder="ノード名・レイヤー・種別..."
                className="bg-transparent border-none text-white text-xs outline-none w-48 placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <span className="text-[10px] text-gray-400 font-mono">
                {matchedEntities.length}/{entities.length}
              </span>
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="p-0.5 text-gray-400 hover:text-gray-200"
                title="閉じる (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="flex items-center space-x-1.5 bg-[#1C2028]/90 hover:bg-[#252A36] backdrop-blur border border-[#2F3440] px-2.5 py-1 rounded-md text-xs text-gray-300 shadow-md transition-colors"
              title="ノードを検索 (Ctrl + F)"
            >
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <span>検索</span>
              <kbd className="text-[10px] bg-[#14161C] border border-[#2F3440] rounded px-1 text-gray-400 font-mono">
                Ctrl+F
              </kbd>
            </button>
          )}

          {/* Search Results Dropdown */}
          {isSearchOpen && searchQuery.trim() !== '' && matchedEntities.length > 0 && (
            <div className="absolute top-full right-0 mt-1.5 w-64 max-h-56 overflow-y-auto bg-[#181B22]/95 border border-[#2F3440] rounded-lg shadow-2xl p-1 z-30 divide-y divide-[#252A36]">
              {matchedEntities.slice(0, 10).map(ent => {
                const layerCol = getLayerColor(ent.layer);
                return (
                  <button
                    key={ent.id}
                    onClick={() => focusOnEntity(ent.id)}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#252A36] rounded text-xs flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LAYER_COLORS[ent.type] || '#9AA0A6' }} />
                      <span className="font-semibold text-gray-100">{ent.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded" style={{ backgroundColor: layerCol.bgRgba, color: layerCol.textHex }}>
                      {ent.layer || '未分類'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-2 bg-[#1C2028]/90 backdrop-blur border border-[#2F3440] px-2.5 py-1 rounded-md text-[11px] text-gray-400 shadow-md">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#5B8DEF]" />
            <span>Char</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#E0A73C]" />
            <span>Org</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#5FB878]" />
            <span>Loc</span>
          </span>
          <span className="text-gray-600">|</span>
          <span className="flex items-center space-x-1 text-purple-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span>越境関係</span>
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-300 font-mono">
            {selectedNodeIds.size > 0 ? (
              <span className="text-sky-400 font-semibold">{selectedNodeIds.size} 選択中</span>
            ) : (
              `${entities.length} nodes, ${relations.length} edges`
            )}
          </span>
        </div>
      </div>

      {/* Floating Camera Directional Controller (D-Pad) */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center bg-[#181B22]/90 backdrop-blur border border-[#2A2F3B] p-1.5 rounded-xl shadow-xl">
        <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center space-x-1">
          <Move className="w-2.5 h-2.5 text-sky-400" />
          <span>Pan</span>
        </div>
        <button
          onClick={() => panBy(0, 50)}
          className="p-1 hover:bg-[#252A36] text-gray-300 hover:text-white rounded"
          title="上へスクロール (ArrowUp)"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center space-x-1 my-0.5">
          <button
            onClick={() => panBy(50, 0)}
            className="p-1 hover:bg-[#252A36] text-gray-300 hover:text-white rounded"
            title="左へスクロール (ArrowLeft)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={centerCamera}
            className="p-1 bg-[#20242D] hover:bg-sky-600/30 text-sky-400 rounded"
            title="中央に戻す"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => panBy(-50, 0)}
            className="p-1 hover:bg-[#252A36] text-gray-300 hover:text-white rounded"
            title="右へスクロール (ArrowRight)"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => panBy(0, -50)}
          className="p-1 hover:bg-[#252A36] text-gray-300 hover:text-white rounded"
          title="下へスクロール (ArrowDown)"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        id="graph-canvas-svg"
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{
          backgroundColor: '#111317',
          backgroundImage: 'radial-gradient(circle, #222631 1px, transparent 1px)',
          backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      >
        <defs>
          {/* Standard relation marker */}
          <marker
            id="arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#6B7280" />
          </marker>
          {/* Cross-layer purple relation marker */}
          <marker
            id="arrowhead-cross"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#a855f7" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Layer Group Enclosure Boxes */}
          {Object.entries(layerBounds).map(([layerName, bounds]) => {
            const padX = NODE_RADIUS + 30;
            const padY = NODE_RADIUS + 32;
            const boxX = bounds.minX - padX;
            const boxY = bounds.minY - padY;
            const boxW = Math.max(bounds.maxX - bounds.minX + padX * 2, 100);
            const boxH = Math.max(bounds.maxY - bounds.minY + padY * 2, 90);
            const color = getLayerColor(layerName);

            return (
              <g key={`layer-box-${layerName}`} className="pointer-events-none">
                <rect
                  x={boxX}
                  y={boxY}
                  width={boxW}
                  height={boxH}
                  rx="16"
                  fill={color.bgRgba}
                  stroke={color.hex}
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  opacity="0.85"
                />
                <g transform={`translate(${boxX + 14}, ${boxY + 18})`}>
                  <rect
                    x="-6"
                    y="-12"
                    width={layerName.length * 8 + 36}
                    height="18"
                    rx="9"
                    fill="#181B22"
                    stroke={color.hex}
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  <text
                    x="4"
                    y="1"
                    fill={color.textHex}
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="sans-serif"
                  >
                    {layerName} ({bounds.count})
                  </text>
                </g>
              </g>
            );
          })}

          {/* Relations (Edges) */}
          {relations.map(rel => {
            const srcPos = positions[rel.source];
            const tgtPos = positions[rel.target];
            if (!srcPos || !tgtPos) return null;

            const srcEntity = model.entities[rel.source];
            const tgtEntity = model.entities[rel.target];
            const isCrossLayer = isCrossLayerRelation(srcEntity?.layer, tgtEntity?.layer);

            const dx = tgtPos.x - srcPos.x;
            const dy = tgtPos.y - srcPos.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 1) return null;

            const ux = dx / dist;
            const uy = dy / dist;

            const startX = srcPos.x + ux * (NODE_RADIUS + 4);
            const startY = srcPos.y + uy * (NODE_RADIUS + 4);
            const endX = tgtPos.x - ux * (NODE_RADIUS + 4);
            const endY = tgtPos.y - uy * (NODE_RADIUS + 4);

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            const strokeDasharray = isCrossLayer ? '6 4' : getLineDash(rel.status);
            const strokeColor = isCrossLayer ? '#c084fc' : rel.status === 'rumor' ? '#9CA3AF' : '#6B7280';
            const strokeWidth = isCrossLayer ? '2.5' : '2';
            const markerEnd = isCrossLayer ? 'url(#arrowhead-cross)' : 'url(#arrowhead)';

            const badgeLabel = rel.type;
            const badgeWidth = badgeLabel.length * 7 + 18;
            const badgeFill = isCrossLayer ? '#221530' : '#1E222A';
            const badgeStroke = isCrossLayer ? '#a855f7' : '#383E4D';
            const badgeTextColor = isCrossLayer ? '#f3e8ff' : '#E2E8F0';

            return (
              <g key={rel.id} className="group">
                {/* Invisible thick line for easier clicking/hover */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="transparent"
                  strokeWidth="16"
                />
                {/* Visible Edge Line */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  markerEnd={markerEnd}
                />

                {/* Relation Label Badge */}
                <g
                  data-badge="true"
                  transform={`translate(${midX}, ${midY})`}
                  className="cursor-pointer"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (rel.ref_key) {
                      onRelationTypeEdit(rel.ref_key, rel.type);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (rel.ref_key) {
                      onRelationTypeEdit(rel.ref_key, rel.type);
                    }
                  }}
                >
                  <rect
                    x={-(badgeWidth / 2)}
                    y="-11"
                    width={badgeWidth}
                    height="22"
                    rx="11"
                    fill={badgeFill}
                    stroke={badgeStroke}
                    strokeWidth={isCrossLayer ? "1.5" : "1.2"}
                    className="group-hover:stroke-indigo-400 group-hover:fill-[#252A36] transition-colors"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={badgeTextColor}
                    fontSize="11"
                    fontWeight={isCrossLayer ? "600" : "500"}
                    fontFamily="sans-serif"
                  >
                    {badgeLabel}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Nodes */}
          {entities.map(entity => {
            const pos = positions[entity.id] || { x: 100, y: 100 };
            const typeColor = LAYER_COLORS[entity.type] || LAYER_COLORS.Unknown;
            const layerColor = getLayerColor(entity.layer);
            const isDragging = draggingNodeId === entity.id;
            const isSelected = selectedNodeIds.has(entity.id);
            const isMatch = matchedEntityIds.has(entity.id);
            const isDimmed = searchQuery.trim() !== '' && !isMatch;

            return (
              <g
                key={entity.id}
                data-node="true"
                data-node-id={entity.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                opacity={isDimmed ? 0.25 : 1}
                className="cursor-grab active:cursor-grabbing transition-opacity duration-150"
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    e.stopPropagation();
                    setDraggingNodeId(entity.id);
                    setDragMoved(false);

                    if (e.shiftKey) {
                      // Toggle selection
                      setSelectedNodeIds(prev => {
                        const next = new Set(prev);
                        if (next.has(entity.id)) next.delete(entity.id);
                        else next.add(entity.id);
                        return next;
                      });
                    } else if (!selectedNodeIds.has(entity.id)) {
                      setSelectedNodeIds(new Set([entity.id]));
                    }
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    entity,
                  });
                  setSelectedNodeIds(new Set([entity.id]));
                }}
              >
                {/* Search Match Halo */}
                {isMatch && (
                  <circle
                    r={NODE_RADIUS + 10}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    className="animate-spin"
                  />
                )}

                {/* Multi-Selection Accent Ring */}
                {isSelected && (
                  <circle
                    r={NODE_RADIUS + 6}
                    fill="none"
                    stroke="#60A5FA"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                )}

                {/* Shadow / Layer-themed Glow */}
                <circle
                  r={NODE_RADIUS + 4}
                  fill={layerColor.hex}
                  opacity={isDragging ? "0.45" : "0.22"}
                />
                {/* Main Circle */}
                <circle
                  r={NODE_RADIUS}
                  fill={typeColor}
                  stroke={layerColor.hex}
                  strokeWidth={entity.layer ? "2.5" : "1.5"}
                  strokeDasharray={entity.layer ? undefined : "3 3"}
                  className="transition-transform duration-75"
                />
                {/* Entity Name */}
                <text
                  x="0"
                  y="-4"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="12.5"
                  fontWeight="700"
                  fontFamily="sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {entity.name}
                </text>
                {/* Entity Type / Layer */}
                <text
                  x="0"
                  y="12"
                  textAnchor="middle"
                  fill={layerColor.textHex}
                  fontSize="9.5"
                  fontWeight="600"
                  opacity="0.95"
                  fontFamily="sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {entity.layer || entity.type}
                </text>
              </g>
            );
          })}
        </g>

        {/* Rubberband Box Selection in Screen Coordinates */}
        {selectionBox && (
          <rect
            x={Math.min(selectionBox.startX, selectionBox.currentX) - (containerRef.current?.getBoundingClientRect().left || 0)}
            y={Math.min(selectionBox.startY, selectionBox.currentY) - (containerRef.current?.getBoundingClientRect().top || 0)}
            width={Math.abs(selectionBox.currentX - selectionBox.startX)}
            height={Math.abs(selectionBox.currentY - selectionBox.startY)}
            fill="rgba(99, 102, 241, 0.15)"
            stroke="#818CF8"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}
      </svg>

      {/* Node Right-Click Context Menu */}
      {contextMenu.visible && contextMenu.entity && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-[#181B22] border border-[#2F3440] rounded-xl shadow-2xl p-1.5 min-w-[200px] text-xs space-y-1 animate-fadeIn"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-[#2A2F3B] flex items-center justify-between">
            <span className="font-bold text-white">{contextMenu.entity.name}</span>
            <span className="text-[10px] text-gray-400 font-mono">{contextMenu.entity.type}</span>
          </div>

          <div className="py-1">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center space-x-1">
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>所属レイヤーを変更</span>
            </div>
            <div className="max-h-36 overflow-y-auto px-1 space-y-0.5">
              {(allLayers.length > 0 ? allLayers : ['Su-ken', 'Kan-ken', '現実界', '異界']).map(layer => {
                const isCurrentLayer = contextMenu.entity?.layer === layer;
                return (
                  <button
                    key={layer}
                    onClick={() => {
                      if (contextMenu.entity && onUpdateEntityLayer) {
                        onUpdateEntityLayer(contextMenu.entity.name, layer);
                      }
                      setContextMenu({ visible: false, x: 0, y: 0, entity: null });
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded flex items-center justify-between text-xs transition-colors ${
                      isCurrentLayer
                        ? 'bg-indigo-950 text-indigo-300 font-semibold'
                        : 'text-gray-300 hover:bg-[#252A36]'
                    }`}
                  >
                    <span>{layer}</span>
                    {isCurrentLayer && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {onDeleteEntity && (
            <div className="pt-1 border-t border-[#2A2F3B]">
              <button
                onClick={() => {
                  if (contextMenu.entity && onDeleteEntity) {
                    onDeleteEntity(contextMenu.entity.name);
                  }
                  setContextMenu({ visible: false, x: 0, y: 0, entity: null });
                }}
                className="w-full text-left px-2.5 py-1.5 text-rose-400 hover:bg-rose-950/40 rounded flex items-center space-x-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ノードを削除</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Add Node Modal */}
      {isAddNodeOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#1C2028] border border-[#2F3440] rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-[#2F3440]">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-sky-400" />
                <span>新しいノード（エンティティ）を追加</span>
              </h3>
              <button
                onClick={() => setIsAddNodeOpen(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">名前 / 識別子</label>
                <input
                  type="text"
                  autoFocus
                  value={addNodeData.name}
                  onChange={e => setAddNodeData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例: Alice, 魔法騎士団, 首都"
                  className="w-full bg-[#14161C] border border-[#2F3440] rounded px-3 py-1.5 text-white outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">種別 (Type)</label>
                <select
                  value={addNodeData.type}
                  onChange={e => setAddNodeData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-[#14161C] border border-[#2F3440] rounded px-3 py-1.5 text-white outline-none focus:border-sky-500"
                >
                  <option value="Character">Character (キャラクター)</option>
                  <option value="Organization">Organization (組織・勢力)</option>
                  <option value="Location">Location (場所・拠点)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">所属レイヤー (Layer)</label>
                <div className="flex space-x-1.5">
                  <select
                    value={addNodeData.layer}
                    onChange={e => setAddNodeData(prev => ({ ...prev, layer: e.target.value }))}
                    className="flex-1 bg-[#14161C] border border-[#2F3440] rounded px-3 py-1.5 text-white outline-none focus:border-sky-500"
                  >
                    {(allLayers.length > 0 ? allLayers : ['Su-ken', 'Kan-ken', '現実界', '異界']).map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={addNodeData.layer}
                    onChange={e => setAddNodeData(prev => ({ ...prev, layer: e.target.value }))}
                    placeholder="自由入力"
                    className="w-24 bg-[#14161C] border border-[#2F3440] rounded px-2 py-1.5 text-white outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[#2F3440]">
              <button
                type="button"
                onClick={() => setIsAddNodeOpen(false)}
                className="px-3 py-1.5 bg-[#252A36] text-gray-300 hover:bg-[#2E3544] rounded text-xs"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  if (addNodeData.name.trim() && onAddEntity) {
                    onAddEntity(addNodeData.name.trim(), addNodeData.type, addNodeData.layer.trim() || undefined);
                    setIsAddNodeOpen(false);
                    setAddNodeData({ name: '', type: 'Character', layer: allLayers[0] || 'Su-ken' });
                  }
                }}
                disabled={!addNodeData.name.trim()}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold rounded text-xs shadow-md"
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
