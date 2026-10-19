import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Entity, Relation, WorldModel } from '../core/models';
import { WorldState } from '../core/world_state';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RefreshCw, 
  Move, 
  Layers, 
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Hand
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
}

export const GraphView: React.FC<GraphViewProps> = ({
  model,
  visibleLayers,
  onRelationTypeEdit,
  initialPositions,
  onPositionsChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => initialPositions || {});
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasFit, setHasFit] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);

  useEffect(() => {
    onPositionsChange?.(positions);
  }, [positions, onPositionsChange]);

  // Filter entities by visible layer
  const allEntities = Object.values(model.entities);
  const entities = visibleLayers
    ? allEntities.filter(e => !e.layer || visibleLayers.has(e.layer))
    : allEntities;

  const visibleEntityIds = new Set(entities.map(e => e.id));
  const relations = Object.values(model.relations).filter(
    r => visibleEntityIds.has(r.source) && visibleEntityIds.has(r.target)
  );

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

  }, [entities.length]);

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
      minX = Math.min(minX, p.x - NODE_RADIUS - 30);
      maxX = Math.max(maxX, p.x + NODE_RADIUS + 30);
      minY = Math.min(minY, p.y - NODE_RADIUS - 30);
      maxY = Math.max(maxY, p.y + NODE_RADIUS + 30);
    }

    const graphWidth = maxX - minX || 200;
    const graphHeight = maxY - minY || 200;

    const scaleX = (rect.width - 60) / graphWidth;
    const scaleY = (rect.height - 60) / graphHeight;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.6);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setTransform({
      scale: newScale,
      x: rect.width / 2 - centerX * newScale,
      y: rect.height / 2 - centerY * newScale,
    });
  }, [entities, positions]);

  // Fit only after the positions state has been committed. Scheduling fit from the
  // entity-initialization effect can capture stale positions and permanently skip
  // the first fit while marking hasFit=true.
  useEffect(() => {
    if (hasFit || entities.length === 0 || !containerRef.current) return;
    if (!entities.every(entity => positions[entity.id])) return;

    fitToView();
    setHasFit(true);
  }, [entities, positions, hasFit, fitToView]);

  // Move camera by delta (for D-Pad, Arrow keys, etc.)
  const panBy = useCallback((dx: number, dy: number) => {
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  // Center camera at origin (0, 0)
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
        // Trackpad 2-finger scroll or standard wheel scroll (Finger scrolling)
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

  // Touch gesture handler (1-finger pan/node drag, 2-finger pinch-zoom & pan)
  const touchStateRef = useRef<{
    type: 'none' | 'pan' | 'node' | 'pinch';
    nodeId?: string;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
    initialDist?: number;
    initialScale?: number;
    initialMidX?: number;
    initialMidY?: number;
  }>({
    type: 'none',
    startX: 0,
    startY: 0,
    camStartX: 0,
    camStartY: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const target = e.target as HTMLElement | SVGElement;
        const nodeElem = target.closest('[data-node="true"]');
        const badgeElem = target.closest('[data-badge="true"]');

        if (nodeElem) {
          const key = nodeElem.getAttribute('data-node-id');
          if (key) {
            e.preventDefault();
            touchStateRef.current = {
              type: 'node',
              nodeId: key,
              startX: touch.clientX,
              startY: touch.clientY,
              camStartX: transform.x,
              camStartY: transform.y,
            };
            setDraggingNodeId(key);
            return;
          }
        }

        if (!badgeElem) {
          e.preventDefault();
          touchStateRef.current = {
            type: 'pan',
            startX: touch.clientX,
            startY: touch.clientY,
            camStartX: transform.x,
            camStartY: transform.y,
          };
          setIsPanning(true);
        }
      } else if (e.touches.length >= 2) {
        // Pinch-to-zoom with 2 fingers
        e.preventDefault();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;

        touchStateRef.current = {
          type: 'pinch',
          initialDist: dist,
          initialScale: transform.scale,
          initialMidX: midX,
          initialMidY: midY,
          camStartX: transform.x,
          camStartY: transform.y,
          startX: midX,
          startY: midY,
        };
        setIsPanning(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStateRef.current.type === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - touchStateRef.current.startX;
        const dy = touch.clientY - touchStateRef.current.startY;
        setTransform(prev => ({
          ...prev,
          x: touchStateRef.current.camStartX + dx,
          y: touchStateRef.current.camStartY + dy,
        }));
      } else if (touchStateRef.current.type === 'node' && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const nodeId = touchStateRef.current.nodeId;
        if (nodeId) {
          const dx = (touch.clientX - touchStateRef.current.startX) / transform.scale;
          const dy = (touch.clientY - touchStateRef.current.startY) / transform.scale;
          touchStateRef.current.startX = touch.clientX;
          touchStateRef.current.startY = touch.clientY;
          setPositions(prev => ({
            ...prev,
            [nodeId]: {
              x: (prev[nodeId]?.x || 0) + dx,
              y: (prev[nodeId]?.y || 0) + dy,
            },
          }));
        }
      } else if (e.touches.length >= 2 && touchStateRef.current.type === 'pinch') {
        e.preventDefault();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const currentMidX = (t0.clientX + t1.clientX) / 2;
        const currentMidY = (t0.clientY + t1.clientY) / 2;

        if (touchStateRef.current.initialDist && touchStateRef.current.initialScale) {
          const scaleFactor = currentDist / touchStateRef.current.initialDist;
          const newScale = Math.min(
            Math.max(touchStateRef.current.initialScale * scaleFactor, 0.15),
            3.5
          );

          const rect = container.getBoundingClientRect();
          const mouseX = touchStateRef.current.initialMidX! - rect.left;
          const mouseY = touchStateRef.current.initialMidY! - rect.top;

          const panDx = currentMidX - touchStateRef.current.initialMidX!;
          const panDy = currentMidY - touchStateRef.current.initialMidY!;

          setTransform({
            scale: newScale,
            x: mouseX - (mouseX - touchStateRef.current.camStartX) * (newScale / touchStateRef.current.initialScale) + panDx,
            y: mouseY - (mouseY - touchStateRef.current.camStartY) * (newScale / touchStateRef.current.initialScale) + panDy,
          });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchStateRef.current.type = 'none';
        setIsPanning(false);
        setDraggingNodeId(null);
      } else if (e.touches.length === 1 && touchStateRef.current.type === 'pinch') {
        // Switch to single-finger pan
        const touch = e.touches[0];
        touchStateRef.current = {
          type: 'pan',
          startX: touch.clientX,
          startY: touch.clientY,
          camStartX: transform.x,
          camStartY: transform.y,
        };
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [transform.scale, transform.x, transform.y]);

  // Mouse Down - starts panning or node drag
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click (button 1) or right click (button 2) always pans
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      setDragMoved(false);
      return;
    }

    // Left click on background or SVG canvas
    if (e.button === 0) {
      const target = e.target as HTMLElement | SVGElement;
      const isNode = target.closest('[data-node="true"]');
      const isBadge = target.closest('[data-badge="true"]');

      if (!isNode && !isBadge) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        setDragMoved(false);
      }
    }
  };

  // Global window listeners for smooth dragging even outside the container
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
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
        setPositions(prev => ({
          ...prev,
          [draggingNodeId]: {
            x: prev[draggingNodeId].x + dx,
            y: prev[draggingNodeId].y + dy,
          },
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDraggingNodeId(null);
    };

    if (isPanning || draggingNodeId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, panStart, draggingNodeId, positions, transform.scale]);

  // Keyboard navigation for Camera (Arrow keys / WASD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting when user is typing in textarea / input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'textarea' || activeTag === 'input') {
        return;
      }

      const step = e.shiftKey ? 120 : 40;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        panBy(0, step);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        panBy(0, -step);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        panBy(step, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        panBy(-step, 0);
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fitToView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panBy, fitToView]);

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
        // Suppress right-click menu if user was panning with right click
        if (dragMoved) {
          e.preventDefault();
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
        <button
          id="btn-reset-layout"
          onClick={() => {
            // Re-arrange circularly
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
        <span className="text-[11px] text-gray-400 pl-1 font-mono">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>

      {/* Top Right Stats & Legend */}
      <div className="absolute top-3 right-3 z-10 flex items-center space-x-2 bg-[#1C2028]/90 backdrop-blur border border-[#2F3440] px-2.5 py-1 rounded-md text-[11px] text-gray-400 shadow-md">
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
        <span className="text-gray-300 font-mono">{entities.length} nodes, {relations.length} edges</span>
      </div>

      {/* Floating Camera Directional Controller (D-Pad) */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center bg-[#181B22]/90 backdrop-blur border border-[#2A2F3B] p-1.5 rounded-xl shadow-xl">
        <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center space-x-1">
          <Move className="w-2.5 h-2.5 text-sky-400" />
          <span>Camera</span>
        </div>
        <button
          id="btn-cam-up"
          onClick={() => panBy(0, 70)}
          className="w-7 h-7 flex items-center justify-center bg-[#232732] hover:bg-sky-700/60 active:bg-sky-600 text-gray-200 rounded transition-colors"
          title="上へカメラ移動 (↑ / W)"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center space-x-1 my-1">
          <button
            id="btn-cam-left"
            onClick={() => panBy(70, 0)}
            className="w-7 h-7 flex items-center justify-center bg-[#232732] hover:bg-sky-700/60 active:bg-sky-600 text-gray-200 rounded transition-colors"
            title="左へカメラ移動 (← / A)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-cam-reset"
            onClick={fitToView}
            className="w-7 h-7 flex items-center justify-center bg-[#2A303D] hover:bg-sky-600 text-sky-300 hover:text-white rounded transition-colors text-[10px] font-bold"
            title="全体リセット (Fit)"
          >
            FIT
          </button>
          <button
            id="btn-cam-right"
            onClick={() => panBy(-70, 0)}
            className="w-7 h-7 flex items-center justify-center bg-[#232732] hover:bg-sky-700/60 active:bg-sky-600 text-gray-200 rounded transition-colors"
            title="右へカメラ移動 (→ / D)"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          id="btn-cam-down"
          onClick={() => panBy(0, -70)}
          className="w-7 h-7 flex items-center justify-center bg-[#232732] hover:bg-sky-700/60 active:bg-sky-600 text-gray-200 rounded transition-colors"
          title="下へカメラ移動 (↓ / S)"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Pan Hint */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden sm:flex items-center space-x-2 bg-[#181B22]/80 backdrop-blur border border-[#2A2F3B]/60 px-2.5 py-1 rounded text-[11px] text-gray-400 shadow-md">
        <Hand className="w-3 h-3 text-sky-400" />
        <span>1本指/ドラッグでカメラ移動 • 2本指でスクロール/ピンチズーム</span>
      </div>

      {/* SVG Canvas */}
      {entities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-2">
          <Layers className="w-8 h-8 opacity-40" />
          <p className="text-xs">（Codex Syntaxを入力するとここに世界が図になります）</p>
        </div>
      ) : (
        <svg
          id="graph-svg"
          className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Background Grid Pattern */}
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1A1D24" strokeWidth="1" />
            </pattern>
            {/* Arrow Marker */}
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
            </marker>
          </defs>

          {/* Grid Background */}
          <rect id="graph-bg" width="100%" height="100%" fill="url(#grid)" />

          {/* Graph World Group */}
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {relations.map(rel => {
              const srcPos = positions[rel.source];
              const tgtPos = positions[rel.target];
              if (!srcPos || !tgtPos) return null;

              const dx = tgtPos.x - srcPos.x;
              const dy = tgtPos.y - srcPos.y;
              const len = Math.hypot(dx, dy);
              if (len === 0) return null;

              const ux = dx / len;
              const uy = dy / len;

              const startX = srcPos.x + ux * NODE_RADIUS;
              const startY = srcPos.y + uy * NODE_RADIUS;
              const endX = tgtPos.x - ux * (NODE_RADIUS + 4);
              const endY = tgtPos.y - uy * (NODE_RADIUS + 4);

              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              const strokeDasharray = getLineDash(rel.status);
              const strokeColor = rel.status === 'rumor' ? '#9CA3AF' : '#6B7280';

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
                    strokeWidth="2"
                    strokeDasharray={strokeDasharray}
                    markerEnd="url(#arrowhead)"
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
                      x={-((rel.type.length * 7 + 16) / 2)}
                      y="-11"
                      width={rel.type.length * 7 + 16}
                      height="22"
                      rx="11"
                      fill="#1E222A"
                      stroke="#383E4D"
                      strokeWidth="1.2"
                      className="group-hover:stroke-indigo-400 group-hover:fill-[#252A36] transition-colors"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize="11"
                      fontWeight="500"
                      fontFamily="sans-serif"
                    >
                      {rel.type}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Nodes */}
            {entities.map(entity => {
              const pos = positions[entity.id] || { x: 100, y: 100 };
              const color = LAYER_COLORS[entity.type] || LAYER_COLORS.Unknown;
              const isDragging = draggingNodeId === entity.id;

              return (
                <g
                  key={entity.id}
                  data-node="true"
                  data-node-id={entity.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      e.stopPropagation();
                      setDraggingNodeId(entity.id);
                      setDragMoved(false);
                    }
                  }}
                >
                  {/* Shadow / Glow */}
                  <circle
                    r={NODE_RADIUS + 2}
                    fill={color}
                    opacity={isDragging ? "0.35" : "0.15"}
                  />
                  {/* Main Circle */}
                  <circle
                    r={NODE_RADIUS}
                    fill={color}
                    stroke="#1E2128"
                    strokeWidth="2"
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
                    fill="#F1F5F9"
                    fontSize="9.5"
                    fontWeight="500"
                    opacity="0.9"
                    fontFamily="sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {entity.layer ? `${entity.type}:${entity.layer}` : entity.type}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
};
