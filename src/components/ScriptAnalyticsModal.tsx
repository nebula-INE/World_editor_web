import React, { useState, useMemo } from 'react';
import {
  X,
  BarChart2,
  Users,
  Grid,
  FileText,
  PieChart,
  Copy,
  Check,
  Layers,
  Clock,
  MessageSquare,
  User
} from 'lucide-react';
import type { AxralStoryV1 } from '../core/story';
import { computeScriptAnalytics, type ScriptAnalyticsResult } from '../core/script-analytics';
import { getLayerColor } from '../core/layers';
import { getPovColor } from '../core/pov';

interface ScriptAnalyticsModalProps {
  story: AxralStoryV1;
  onClose: () => void;
}

export const ScriptAnalyticsModal: React.FC<ScriptAnalyticsModalProps> = ({ story, onClose }) => {
  const [activeTab, setActiveTab] = useState<'cast' | 'matrix' | 'layers' | 'pov'>('cast');
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => computeScriptAnalytics(story), [story]);

  const povStats = useMemo(() => {
    const map = new Map<string, { count: number; wordCount: number; scenes: string[] }>();
    let totalScenes = 0;
    story.chapters.forEach(ch => {
      ch.scenes.forEach(sc => {
        totalScenes++;
        const pov = (sc as any).pov_character_id || '三人称客観';
        const cur = map.get(pov) || { count: 0, wordCount: 0, scenes: [] };
        const words = sc.blocks.reduce((sum, b) => sum + (b.text?.length || 0), 0);
        cur.count++;
        cur.wordCount += words;
        cur.scenes.push(sc.title);
        map.set(pov, cur);
      });
    });

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      wordCount: data.wordCount,
      scenes: data.scenes,
      percentage: totalScenes > 0 ? Math.round((data.count / totalScenes) * 100) : 0
    })).sort((a, b) => b.count - a.count);
  }, [story]);

  const handleCopySummary = () => {
    const text = [
      `【${story.title}】 執筆統計レポート`,
      `総文字数: ${stats.totalCharsNoSpaces.toLocaleString()} 文字 (空白込み ${stats.totalCharsWithSpaces.toLocaleString()} 文字)`,
      `総行数: ${stats.totalLines.toLocaleString()} 行 / 総ブロック: ${stats.totalBlocks} 件`,
      `シーン数: ${stats.totalScenes} シーン (${stats.totalChapters} 幕/章)`,
      `セリフ比率: ${stats.dialogueRatio}% (セリフ: ${stats.dialogueChars.toLocaleString()}字 / ト書き・地: ${(stats.directionChars + stats.proseChars).toLocaleString()}字)`,
      '',
      '■ キャスト別発言シェア:',
      ...stats.speakers.map(s => `・${s.name}: ${s.percentage}% (${s.charCount.toLocaleString()}字, ${s.lineCount}台詞, ${s.scenesCount}シーン)`),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121620] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161b28]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                執筆統計＆キャスト分析ダッシュボード
              </h2>
              <p className="text-xs text-slate-400">
                『{story.title}』の文字量、台詞比率、話者シェア、シーン登場マトリクス
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="統計要約をクリップボードにコピー"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'コピー完了' : 'サマリーコピー'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 border-b border-slate-800/80 bg-[#131824]/60">
          <div className="bg-[#181f30] border border-slate-800 p-3.5 rounded-xl">
            <div className="text-xs text-slate-400 font-medium mb-1">総文字数（空白除外）</div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats.totalCharsNoSpaces.toLocaleString()}
              <span className="text-xs font-normal text-slate-400 ml-1.5">字</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              空白込み: {stats.totalCharsWithSpaces.toLocaleString()} 字
            </div>
          </div>

          <div className="bg-[#181f30] border border-slate-800 p-3.5 rounded-xl">
            <div className="text-xs text-slate-400 font-medium mb-1">台詞比率</div>
            <div className="text-2xl font-bold text-indigo-400 tracking-tight flex items-baseline gap-1">
              {stats.dialogueRatio}%
              <span className="text-xs font-normal text-slate-400">({stats.dialogueChars.toLocaleString()}字)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              ト書き・地の文: {(stats.directionChars + stats.proseChars).toLocaleString()} 字
            </div>
          </div>

          <div className="bg-[#181f30] border border-slate-800 p-3.5 rounded-xl">
            <div className="text-xs text-slate-400 font-medium mb-1">登場キャスト数</div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              {stats.speakers.length}
              <span className="text-xs font-normal text-slate-400 ml-1.5">名</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              台詞ブロック総計: {stats.speakers.reduce((sum, s) => sum + s.lineCount, 0)} 件
            </div>
          </div>

          <div className="bg-[#181f30] border border-slate-800 p-3.5 rounded-xl">
            <div className="text-xs text-slate-400 font-medium mb-1">構成規模</div>
            <div className="text-2xl font-bold text-amber-400 tracking-tight">
              {stats.totalScenes}
              <span className="text-xs font-normal text-slate-400 ml-1.5">シーン</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats.totalChapters} 幕/章 ・ {stats.totalLines} 行
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-800 px-6 bg-[#141926]">
          <button
            onClick={() => setActiveTab('cast')}
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'cast'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            キャスト発言シェア ({stats.speakers.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'matrix'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-4 h-4" />
            シーン×キャスト登場マトリクス ({stats.totalScenes}シーン)
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'layers'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            世界層（レイヤー）別シーン分布
          </button>
          <button
            onClick={() => setActiveTab('pov')}
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'pov'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            視点（POV）別シーン占有率 ({povStats.length})
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: CAST SHARE */}
          {activeTab === 'cast' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>セリフ文字数シェア順ランキング</span>
                <span>全台詞文字数: {stats.dialogueChars.toLocaleString()} 字</span>
              </div>

              {stats.speakers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  まだセリフが記述されていません。
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.speakers.map((spk, idx) => (
                    <div
                      key={spk.name}
                      className="bg-[#171e2e] border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-mono">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-100 text-sm">
                            {spk.name}
                          </span>
                          <span className="text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                            {spk.scenesCount} シーンに登場
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-indigo-400 font-mono">
                            {spk.percentage}%
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({spk.charCount.toLocaleString()} 字 / {spk.lineCount} 台詞)
                          </span>
                        </div>
                      </div>

                      {/* Share progress bar */}
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800/80">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(2, spk.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCENE X CAST MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                どのシーンにどの登場人物が出現（発言）しているかを俯瞰できます。
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#141926]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#182030] border-b border-slate-800 text-slate-300">
                      <th className="p-2.5 pl-4 font-semibold sticky left-0 bg-[#182030] z-10 w-52 min-w-[200px]">
                        シーン / 幕
                      </th>
                      <th className="p-2.5 text-center font-semibold w-24">レイヤー</th>
                      <th className="p-2.5 text-center font-semibold w-16">時点</th>
                      <th className="p-2.5 text-right font-semibold w-20">文字数</th>
                      <th className="p-2.5 text-right font-semibold w-20 pr-4">セリフ密度</th>
                      {stats.uniqueSpeakersList.map(name => (
                        <th
                          key={name}
                          className="p-2.5 text-center font-semibold border-l border-slate-800 max-w-[100px] truncate"
                          title={name}
                        >
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {stats.sceneMatrix.map((sc, i) => (
                      <tr key={sc.sceneId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-2.5 pl-4 sticky left-0 bg-[#141926] z-10 font-medium text-slate-200">
                          <div className="truncate max-w-[190px]" title={`${sc.chapterTitle} - ${sc.sceneTitle}`}>
                            <span className="text-slate-500 mr-1.5">S{i + 1}</span>
                            {sc.sceneTitle}
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                            style={{
                              borderColor: getLayerColor(sc.layer).borderHex,
                              color: getLayerColor(sc.layer).hex,
                              backgroundColor: getLayerColor(sc.layer).bgRgba
                            }}
                          >
                            {sc.layer}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-400">
                          t={sc.timestamp}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-300">
                          {sc.totalChars.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-mono pr-4 text-slate-400">
                          <span className={sc.dialogueDensity > 60 ? 'text-indigo-400 font-semibold' : 'text-slate-400'}>
                            {sc.dialogueDensity}%
                          </span>
                        </td>
                        {stats.uniqueSpeakersList.map(name => {
                          const appears = sc.speakers.has(name);
                          return (
                            <td
                              key={name}
                              className={`p-2.5 text-center border-l border-slate-800/80 ${
                                appears ? 'bg-indigo-950/30' : ''
                              }`}
                            >
                              {appears ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs">
                                  ●
                                </span>
                              ) : (
                                <span className="text-slate-700">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LAYER BREAKDOWN */}
          {activeTab === 'layers' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                各シーンがどの世界層（レイヤー）を舞台に展開しているかの集計です。
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(stats.layerBreakdown).map(([layerName, count]) => {
                  const pct = stats.totalScenes > 0 ? Math.round((count / stats.totalScenes) * 100) : 0;
                  const colorTheme = getLayerColor(layerName);
                  const color = colorTheme.hex;
                  return (
                    <div
                      key={layerName}
                      className="bg-[#171e2e] border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
                      style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-slate-100 flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          レイヤー: {layerName}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {count} シーン ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800/80">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: color
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: POV Breakdown */}
          {activeTab === 'pov' && (
            <div className="space-y-4">
              <div className="bg-[#161d2b] border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-slate-200">
                    視点（Point of View）別シーン占有率
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    どのキャラクターの視点で物語が語られているかの比率と執筆文字量
                  </p>
                </div>
                <div className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-800">
                  総シーン: {stats.totalScenes}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {povStats.map((item) => {
                  const povStyle = getPovColor(item.name);
                  return (
                    <div
                      key={item.name}
                      className="bg-[#171e2e] border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
                      style={{ borderLeftColor: povStyle.color, borderLeftWidth: '4px' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-100 flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: povStyle.color }}
                          />
                          視点: {item.name}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {item.count} シーン ({item.percentage}%)
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mb-2">
                        総執筆文字数: <span className="font-mono text-slate-200 font-semibold">{item.wordCount.toLocaleString()}</span> 字
                      </div>

                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800/80 mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: povStyle.color
                          }}
                        />
                      </div>

                      <div className="text-[10px] text-slate-500 truncate">
                        主なシーン: {item.scenes.slice(0, 3).join(' / ')}
                        {item.scenes.length > 3 ? ` など他${item.scenes.length - 3}件` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#161b28] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
