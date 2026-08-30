import React from 'react';
import { Candidate } from '../core/indexer';
import { Sparkles, Check, X, HelpCircle, ArrowRight } from 'lucide-react';

interface CandidatePanelProps {
  candidates: Candidate[];
  onAccept: (candidateId: string) => void;
  onIgnore: (candidateId: string) => void;
}

const LEVEL_COLOR = {
  high: '#3B9E56',
  medium: '#C9962C',
  low: '#B04A4A',
};

const LEVEL_BG = {
  high: 'rgba(59, 158, 86, 0.15)',
  medium: 'rgba(201, 150, 44, 0.15)',
  low: 'rgba(176, 74, 74, 0.15)',
};

export const CandidatePanel: React.FC<CandidatePanelProps> = ({
  candidates,
  onAccept,
  onIgnore,
}) => {
  // Sort candidates by confidence descending
  const sortedCandidates = [...candidates].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="h-full flex flex-col bg-[#16181D] border-l border-[#2B2E36] overflow-hidden">
      {/* Header */}
      <div className="h-9 px-3 bg-[#1A1D23] border-b border-[#2B2E36] flex items-center justify-between text-xs text-gray-300">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-medium text-gray-200">Candidate Suggestions</span>
          <span className="text-[11px] text-gray-500 font-mono">
            (§4.3.1 Inline Indexer)
          </span>
        </div>
        {sortedCandidates.length > 0 && (
          <span className="bg-amber-950/80 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-800/60">
            {sortedCandidates.length} 件
          </span>
        )}
      </div>

      {/* Candidate List Container */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {sortedCandidates.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-500 space-y-2">
            <HelpCircle className="w-7 h-7 opacity-30 text-gray-400" />
            <p className="text-xs text-gray-400 leading-relaxed">
              候補はありません。<br />
              本文に自然文（地の文）を書くと、ここに抽出された関係候補が表示されます。
            </p>
          </div>
        ) : (
          sortedCandidates.map(candidate => {
            const color = LEVEL_COLOR[candidate.confidence_level] || '#999999';
            const bg = LEVEL_BG[candidate.confidence_level] || 'rgba(150, 150, 150, 0.1)';

            return (
              <div
                key={candidate.id}
                className="bg-[#21242B] border border-[#2F3440] hover:border-[#3E4554] rounded-lg p-3 space-y-2 transition-colors shadow-sm"
              >
                {/* Headline: Source -> Rel -> Target */}
                <div className="flex items-center space-x-1.5 text-xs text-gray-100 flex-wrap">
                  <span className="font-semibold text-white bg-[#181A20] px-1.5 py-0.5 rounded border border-[#2B2E36]">
                    {candidate.source_name}
                  </span>
                  <div className="flex items-center text-sky-400 text-[11px] font-medium space-x-1">
                    <span>──</span>
                    <span className="bg-sky-950/70 px-1 py-0.5 rounded border border-sky-800/60">{candidate.rel_type}</span>
                    <span>──▶</span>
                  </div>
                  <span className="font-semibold text-white bg-[#181A20] px-1.5 py-0.5 rounded border border-[#2B2E36]">
                    {candidate.target_name}
                  </span>
                </div>

                {/* Metadata badges */}
                <div className="flex items-center space-x-2 text-[11px]">
                  <span
                    className="px-1.5 py-0.5 rounded font-mono font-medium flex items-center space-x-1"
                    style={{ color, backgroundColor: bg }}
                  >
                    <span>●</span>
                    <span>{candidate.confidence_level.toUpperCase()}</span>
                    <span className="opacity-75">({candidate.confidence.toFixed(2)})</span>
                  </span>

                  <span className="text-gray-500 font-mono">line {candidate.line}</span>

                  {candidate.ambiguous && (
                    <span className="text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/50 text-[10px]">
                      ⚠ ambiguous
                    </span>
                  )}
                </div>

                {/* Source text quote */}
                <div className="text-[11px] text-gray-400 bg-[#17191E] p-2 rounded border border-[#282C35] italic leading-relaxed">
                  「{candidate.source_text}」
                </div>

                {/* Accept / Ignore action buttons */}
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => onIgnore(candidate.id)}
                    className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 bg-[#2C303A] hover:bg-[#373C48] rounded transition-colors flex items-center space-x-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Ignore</span>
                  </button>

                  <button
                    onClick={() => onAccept(candidate.id)}
                    className="px-3 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition-colors flex items-center space-x-1 shadow-sm"
                  >
                    <Check className="w-3 h-3" />
                    <span>Accept</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
