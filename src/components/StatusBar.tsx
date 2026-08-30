import React from 'react';
import { AlertTriangle, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

interface StatusBarProps {
  entityCount: number;
  relationCount: number;
  candidateCount: number;
  ambiguousCount: number;
  conflictCount: number;
  linterIssueCount: number;
  isTimelineMode: boolean;
  currentTimestamp: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  entityCount,
  relationCount,
  candidateCount,
  ambiguousCount,
  conflictCount,
  linterIssueCount,
  isTimelineMode,
  currentTimestamp,
}) => {
  return (
    <footer className="h-6 bg-[#131519] border-t border-[#23262E] px-3 flex items-center justify-between text-[11px] text-gray-400 select-none font-mono">
      {/* Left items */}
      <div className="flex items-center space-x-4">
        <span>
          Entities: <strong className="text-gray-200">{entityCount}</strong>
        </span>
        <span>
          Relations: <strong className="text-gray-200">{relationCount}</strong>
        </span>
        <span>
          Candidates: <strong className="text-sky-300">{candidateCount}</strong>
        </span>

        {ambiguousCount > 0 && (
          <span className="text-amber-400 flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3 inline" />
            <span>Ambiguous: {ambiguousCount}</span>
          </span>
        )}

        {conflictCount > 0 && (
          <span className="text-red-400 font-bold flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3 inline animate-pulse" />
            <span>Patch Conflicts: {conflictCount}</span>
          </span>
        )}
      </div>

      {/* Right items */}
      <div className="flex items-center space-x-4">
        {isTimelineMode && (
          <span className="text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-800/40">
            Timeline t = {currentTimestamp}
          </span>
        )}

        <span className="flex items-center space-x-1">
          {linterIssueCount === 0 ? (
            <span className="text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Linter Clean</span>
            </span>
          ) : (
            <span className="text-amber-400 flex items-center space-x-1">
              <ShieldAlert className="w-3 h-3" />
              <span>Linter: {linterIssueCount} issue(s)</span>
            </span>
          )}
        </span>
      </div>
    </footer>
  );
};
