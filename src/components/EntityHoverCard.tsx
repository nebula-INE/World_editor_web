import React, { useState, useRef, useEffect } from 'react';
import { User, Shield, Compass, BookOpen, Share2 } from 'lucide-react';
import type { WorldModel, Entity } from '../core/models';
import type { WorldState } from '../core/world_state';
import { getLayerColor } from '../core/layers';

interface EntityHoverCardProps {
  entityName: string;
  worldModel?: WorldModel | WorldState;
  onOpenWiki?: (entityName: string) => void;
  onOpenGraph?: (entityName: string) => void;
  children: React.ReactNode;
}

export const EntityHoverCard: React.FC<EntityHoverCardProps> = ({
  entityName,
  worldModel,
  onOpenWiki,
  onOpenGraph,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<number | null>(null);

  // Resolve entity in model
  const entity: Entity | undefined = React.useMemo(() => {
    if (!worldModel?.entities) return undefined;
    for (const ent of Object.values(worldModel.entities)) {
      if (ent.name === entityName || ent.aliases?.includes(entityName)) {
        return ent;
      }
    }
    return undefined;
  }, [worldModel, entityName]);

  const activeRelations = React.useMemo(() => {
    if (!entity || !worldModel?.relations) return [];
    const list: { targetName: string; type: string; direction: 'outgoing' | 'incoming' }[] = [];
    for (const rel of Object.values(worldModel.relations)) {
      if (rel.source === entity.id) {
        const target = worldModel.entities[rel.target];
        if (target) list.push({ targetName: target.name, type: rel.type, direction: 'outgoing' });
      } else if (rel.target === entity.id) {
        const source = worldModel.entities[rel.source];
        if (source) list.push({ targetName: source.name, type: rel.type, direction: 'incoming' });
      }
    }
    return list;
  }, [entity, worldModel]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        // position above or below
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow > 200 ? rect.bottom + 6 : rect.top - 180;
        const left = Math.min(Math.max(16, rect.left), window.innerWidth - 300);
        setCoords({ top, left });
        setIsOpen(true);
      }
    }, 220);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!entity) {
    return <span>{children}</span>;
  }

  const layerName = entity.layer || '未所属';
  const layerStyle = getLayerColor(layerName);

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-block relative cursor-pointer border-b border-dotted border-cyan-400/50 hover:border-cyan-300 hover:text-cyan-200 transition-colors"
    >
      {children}

      {isOpen && (
        <span
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 9999
          }}
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsOpen(true);
          }}
          onMouseLeave={handleMouseLeave}
          className="block w-72 p-3 bg-neutral-900/95 border border-neutral-700/80 rounded-lg shadow-2xl backdrop-blur-md text-left text-neutral-200 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header row */}
          <span className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-neutral-800">
            <span className="flex items-center gap-1.5 font-semibold text-neutral-100 text-sm truncate">
              <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{entity.name}</span>
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0"
              style={{
                backgroundColor: layerStyle.bgRgba,
                borderColor: layerStyle.borderHex,
                color: layerStyle.textHex
              }}
            >
              {layerName}
            </span>
          </span>

          {/* Type & status */}
          <span className="flex items-center gap-2 text-[11px] text-neutral-400 mb-2">
            <span>種別: {entity.type}</span>
            <span aria-hidden="true">·</span>
            <span>状態: {entity.existence === 'confirmed' ? '活動中' : entity.existence}</span>
          </span>

          {/* Relations overview */}
          {activeRelations.length > 0 ? (
            <span className="block mb-2 space-y-1">
              <span className="text-[10px] text-neutral-400 font-medium block">主要な関係性:</span>
              <span className="flex flex-wrap gap-1">
                {activeRelations.slice(0, 3).map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[10px] text-neutral-300"
                  >
                    <span>{r.targetName}</span>
                    <span className="text-cyan-400">({r.type})</span>
                  </span>
                ))}
              </span>
            </span>
          ) : (
            <span className="block text-[10px] text-neutral-400 italic mb-2">関係性未登録</span>
          )}

          {/* Actions */}
          <span className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/80 text-[10px]">
            {onOpenWiki && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenWiki(entity.name);
                }}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                設定資料
              </button>
            )}
            {onOpenGraph && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenGraph(entity.name);
                }}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Share2 className="w-3 h-3" />
                相関図で確認
              </button>
            )}
          </span>
        </span>
      )}
    </span>
  );
};
