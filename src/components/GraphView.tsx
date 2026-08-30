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
  Edit3,
  Compass
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
}

export const GraphView: React.FC<GraphViewProps> = ({
  model,
  visibleLayers,
  onRelationTypeEdit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasFit, setHasFit] = useState(false);

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

    if (!hasFit && containerRef.current && entities.length > 0) {
      setTimeout(() => fitToView(), 50);
      setHasFit(true);
    }
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

  // Mouse / Wheel Handlers for Pan & Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.2), 3);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform({
      scale: newScale,
      x: mouseX - (mouseX - transform.x) * (newScale / transform.scale),
      y: mouseY - (mouseY - transform.y) * (newScale / transform.scale),
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'graph-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    } else if (draggingNodeId && positions[draggingNodeId]) {
      const dx = (e.movementX) / transform.scale;
      const dy = (e.movementY) / transform.scale;
      setPositions(prev => ({
        ...prev,
        [draggingNodeId]: {
          x: prev[draggingNodeId].x + dx,
          y: prev[draggingNodeId].y + dy,
        },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const getLineDash = (status: string) => {
    if (status === 'hypothetical') return '6 4';
    if (status === 'rumor') return '2 4';
    return undefined; // solid line for confirmed
  };

  return (
    <div
      ref={containerRef}
      id="graph-view-container"
      className="h-full w-full bg-[#111317] relative overflow-hidden select-none flex flex-col"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Graph Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center space-x-1.5 bg-[#1C2028]/90 backdrop-blur border border-[#2F3440] p-1 rounded-md shadow-lg text-xs text-gray-300">
        <span className="px-2 py-0.5 font-medium text-gray-200 border-r border-[#2F3440] flex items-center space-x-1">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Graph Canvas</span>
        </span>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))}
          className="p-1 hover:bg-[#2A2F3B] hover:text-white rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.2) }))}
          className="p-1 hover:bg-[#2A2F3B] hover:text-white rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={fitToView}
          className="p-1 hover:bg-[#2A2F3B] hover:text-white rounded transition-colors"
          title="Fit into view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
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
          title="Reset circular layout"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] text-gray-500 pl-1">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>

      {/* Legend & Stats Overlay */}
      <div className="absolute top-3 right-3 z-10 flex items-center space-x-2 bg-[#1C2028]/90 backdrop-blur border border-[#2F3440] px-2.5 py-1 rounded-md text-[11px] text-gray-400">
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

      {/* SVG Canvas */}
      {entities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-2">
          <Layers className="w-8 h-8 opacity-40" />
          <p className="text-xs">（Codex Syntaxを入力するとここに世界が図になります）</p>
        </div>
      ) : (
        <svg
          id="graph-svg"
          className="w-full h-full cursor-grab active:cursor-grabbing"
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
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNodeId(entity.id);
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
