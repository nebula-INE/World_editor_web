import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, ArrowRight, ShieldAlert, Sparkles, X } from 'lucide-react';
import type { Event as WorldEvent } from '../core/events';
import type { WorldStateEngine } from '../core/world_state';

interface TimelineDiffNoticeProps {
  currentTimestamp: number;
  engine?: WorldStateEngine | null;
  events?: WorldEvent[];
}

export const TimelineDiffNotice: React.FC<TimelineDiffNoticeProps> = ({
  currentTimestamp,
  engine,
  events = []
}) => {
  const [prevTime, setPrevTime] = useState(currentTimestamp);
  const [diffItems, setDiffItems] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (currentTimestamp === prevTime) return;

    // Detect events occurring between min(prev, curr) and max(prev, curr)
    const minT = Math.min(prevTime, currentTimestamp);
    const maxT = Math.max(prevTime, currentTimestamp);

    const relevantEvents = events.filter(e => e.timestamp > minT && e.timestamp <= maxT);

    const changes: string[] = [];
    relevantEvents.forEach(ev => {
      ev.effects.forEach(eff => {
        if (eff.kind === 'entity_existence') {
          changes.push(
            `エンティティ [${eff.target_id || '対象'}] の生存状態が「${eff.payload.existence}」に変化`
          );
        } else if (eff.kind === 'entity_attribute' && eff.payload.layer) {
          changes.push(
            `エンティティ [${eff.target_id || '対象'}] がレイヤー「${eff.payload.layer}」へ移動`
          );
        } else if (eff.kind === 'relation_add') {
          changes.push(
            `関係性追加: [${eff.payload.source}] → [${eff.payload.target}] (${eff.payload.type})`
          );
        } else if (eff.kind === 'relation_end') {
          changes.push(
            `関係性解消: [${eff.payload.source}] と [${eff.payload.target}] の関係が終了`
          );
        }
      });
    });

    if (changes.length > 0) {
      setDiffItems(changes);
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }

    setPrevTime(currentTimestamp);
  }, [currentTimestamp, prevTime, events]);

  if (!isVisible || diffItems.length === 0) return null;

  return (
    <div className="fixed bottom-12 right-6 z-40 max-w-md bg-neutral-900/95 border border-cyan-500/40 rounded-lg p-3.5 shadow-2xl backdrop-blur-md text-xs text-neutral-200 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-neutral-800">
        <div className="flex items-center gap-1.5 font-semibold text-cyan-400">
          <Clock className="w-4 h-4" />
          <span>世界線の変動検知 (t={currentTimestamp})</span>
        </div>
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="text-neutral-400 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {diffItems.slice(0, 4).map((d, i) => (
          <div key={i} className="flex items-start gap-1.5 text-neutral-300">
            <span className="text-cyan-400 font-bold">·</span>
            <span>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
