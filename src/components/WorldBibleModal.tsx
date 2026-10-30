import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Search,
  Download,
  Copy,
  Check,
  Printer,
  Layers,
  Users,
  MapPin,
  Clock,
  Sparkles,
  ExternalLink,
  Shield,
  FileCode
} from 'lucide-react';
import type { WorldModel } from '../core/models';
import type { WorldState } from '../core/world_state';
import type { Event as WorldEvent } from '../core/events';
import type { AxralStoryV1 } from '../core/story';
import {
  buildWorldBibleData,
  generateWorldBibleMarkdown,
  generateWorldBibleHtml,
  type WorldBibleData
} from '../core/world-bible-exporter';
import { triggerFileDownload } from '../core/story-export';
import { getLayerColor } from '../core/layers';

interface WorldBibleModalProps {
  worldModel: WorldModel | WorldState;
  story?: AxralStoryV1 | null;
  events?: WorldEvent[];
  allLayers?: string[];
  onClose: () => void;
}

export const WorldBibleModal: React.FC<WorldBibleModalProps> = ({
  worldModel,
  story,
  events = [],
  allLayers = ['Su-ken', 'Kan-ken', 'An-ken', 'Ki-ken'],
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'characters' | 'lore' | 'timeline'>('characters');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const bibleData = useMemo(() => {
    return buildWorldBibleData(worldModel, story, events, allLayers);
  }, [worldModel, story, events, allLayers]);

  // Copy Markdown
  const handleCopyMarkdown = () => {
    const md = generateWorldBibleMarkdown(bibleData);
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Markdown file
  const handleDownloadMarkdown = () => {
    const md = generateWorldBibleMarkdown(bibleData);
    const filename = `${bibleData.title.replace(/[\s/\\?%*:|"<>]/g, '_')}_world_bible.md`;
    triggerFileDownload(filename, md, 'text/markdown;charset=utf-8');
  };

  // Download standalone styled HTML file
  const handleDownloadHtml = () => {
    const html = generateWorldBibleHtml(bibleData);
    const filename = `${bibleData.title.replace(/[\s/\\?%*:|"<>]/g, '_')}_world_bible.html`;
    triggerFileDownload(filename, html, 'text/html;charset=utf-8');
  };

  // Print view
  const handlePrint = () => {
    const html = generateWorldBibleHtml(bibleData);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };

  // Search filter
  const q = searchQuery.toLowerCase().trim();
  const filterEntity = (ent: { name: string; type: string; layer: string; aliases: string[] }) => {
    if (!q) return true;
    return (
      ent.name.toLowerCase().includes(q) ||
      ent.type.toLowerCase().includes(q) ||
      ent.layer.toLowerCase().includes(q) ||
      ent.aliases.some(a => a.toLowerCase().includes(q))
    );
  };

  const characters = (bibleData.categorizedEntities['登場人物・キャラクター'] || []).filter(filterEntity);
  const factions = (bibleData.categorizedEntities['勢力・組織'] || []).filter(filterEntity);
  const locations = (bibleData.categorizedEntities['舞台・領域・場所'] || []).filter(filterEntity);
  const items = (bibleData.categorizedEntities['アイテム・遺物'] || []).filter(filterEntity);
  const concepts = (bibleData.categorizedEntities['概念・現象・法則'] || []).filter(filterEntity);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#11151f] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#151a26]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                世界設定資料集 (World Bible Wiki)
              </h2>
              <p className="text-xs text-slate-400">
                『{bibleData.title}』の世界観、レイヤー構造、名鑑、年代記の統合事典
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Markdown形式でクリップボードにコピー"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'コピー完了' : 'MDコピー'}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Markdownファイル (.md) をダウンロード"
            >
              <Download className="w-3.5 h-3.5" />
              .md保存
            </button>

            <button
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white flex items-center gap-1.5 transition-colors shadow-sm"
              title="単体閲覧用HTMLファイル (.html) を保存"
            >
              <FileCode className="w-3.5 h-3.5" />
              HTML保存
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="ブラウザ印刷およびPDF保存"
            >
              <Printer className="w-3.5 h-3.5" />
              印刷 / PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Statistics Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-[#131722] flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="人物名、レイヤー、キーワードを事典内検索..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#0f121a] border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/50">
              要素: <strong className="text-indigo-400 font-mono">{bibleData.totalEntities}</strong> 件
            </span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/50">
              相関関係: <strong className="text-emerald-400 font-mono">{bibleData.totalRelations}</strong> 本
            </span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/50">
              事件数: <strong className="text-amber-400 font-mono">{bibleData.totalEvents}</strong> 件
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-[#141926]">
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'characters'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            キャスト・人物名鑑 ({characters.length})
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
            世界構造・レイヤー ({bibleData.layers.length})
          </button>
          <button
            onClick={() => setActiveTab('lore')}
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'lore'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            勢力・舞台・アイテム・法則 ({factions.length + locations.length + items.length + concepts.length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            年代記・タイムライン ({bibleData.events.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: CHARACTERS */}
          {activeTab === 'characters' && (
            <div className="space-y-4">
              {characters.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  {searchQuery ? '検索条件に一致する人物は見つかりませんでした。' : 'キャラクターが登録されていません。'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {characters.map(char => {
                    const layerTheme = getLayerColor(char.layer);
                    return (
                      <div
                        key={char.id}
                        className="bg-[#161c2b] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h3 className="text-base font-bold text-white flex items-center gap-2">
                                {char.name}
                                {char.existence && (
                                  <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    {char.existence}
                                  </span>
                                )}
                              </h3>
                              {char.aliases.length > 0 && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  別名: {char.aliases.join(', ')}
                                </p>
                              )}
                            </div>
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-mono border font-medium"
                              style={{
                                borderColor: layerTheme.borderHex,
                                color: layerTheme.hex,
                                backgroundColor: layerTheme.bgRgba
                              }}
                            >
                              {char.layer}
                            </span>
                          </div>

                          {/* Relations */}
                          {char.relations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-800/80">
                              <div className="text-[11px] font-semibold text-slate-400 mb-1">
                                人間関係・相関 ({char.relations.length}本):
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {char.relations.map((rel, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                                  >
                                    <span className="text-slate-500">{rel.direction === 'outgoing' ? '→' : '←'}</span>
                                    <strong className="text-slate-200">{rel.targetName}</strong>
                                    <span className="text-indigo-400 font-mono text-[10px]">[{rel.type}]</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Attributes */}
                          {Object.keys(char.attributes).length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-xs text-slate-400 space-y-1">
                              {Object.entries(char.attributes).map(([k, v]) => (
                                <div key={k} className="flex items-baseline gap-1.5">
                                  <span className="text-slate-500 font-mono text-[11px]">{k}:</span>
                                  <span className="text-slate-300">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Story Appearances badge */}
                        <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            劇中登場: <strong className="text-indigo-400">{char.storyScenes.length}</strong> シーン ({char.lineCountInStory} 台詞)
                          </span>
                          {char.storyScenes.length > 0 && (
                            <span className="text-slate-500 truncate max-w-[160px]" title={char.storyScenes.join(', ')}>
                              初出: {char.storyScenes[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LAYERS */}
          {activeTab === 'layers' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                本作品を構成する世界層（オントロジー・レイヤー）ごとの構成要素一覧です。
              </div>

              {bibleData.layers.map(layer => (
                <div
                  key={layer.name}
                  className="bg-[#161c2b] border border-slate-800 rounded-xl p-5"
                  style={{ borderLeftColor: layer.color, borderLeftWidth: '5px' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: layer.color }}
                      />
                      レイヤー: {layer.name}
                    </h3>
                    <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                      登録要素: {layer.entityCount} 件
                    </span>
                  </div>

                  {layer.entities.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">このレイヤーにはまだ要素が登録されていません。</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                      {layer.entities.map(ent => (
                        <div
                          key={ent.id}
                          className="p-2.5 rounded-lg bg-[#111622] border border-slate-800/80 flex flex-col justify-between"
                        >
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {ent.name}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                            <span>{ent.type}</span>
                            <span>{ent.storyScenes.length}出番</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: LORE (Factions, Locations, Relics, Concepts) */}
          {activeTab === 'lore' && (
            <div className="space-y-6">
              {[
                { title: '勢力・組織 (Factions)', list: factions },
                { title: '舞台・領域・拠点 (Locations)', list: locations },
                { title: 'アイテム・遺物 (Artifacts)', list: items },
                { title: '概念・世界法則 (Concepts & Phenomena)', list: concepts }
              ].map(sec => (
                <div key={sec.title} className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                    {sec.title} ({sec.list.length}件)
                  </h3>

                  {sec.list.length === 0 ? (
                    <p className="text-xs text-slate-500">該当する項目はありません。</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sec.list.map(ent => (
                        <div
                          key={ent.id}
                          className="bg-[#161c2b] border border-slate-800 rounded-lg p-3.5"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-slate-100 text-sm">{ent.name}</span>
                            <span
                              className="text-[10px] font-mono px-2 py-0.5 rounded border"
                              style={{
                                borderColor: getLayerColor(ent.layer).borderHex,
                                color: getLayerColor(ent.layer).hex,
                                backgroundColor: getLayerColor(ent.layer).bgRgba
                              }}
                            >
                              {ent.layer}
                            </span>
                          </div>
                          {ent.aliases.length > 0 && (
                            <div className="text-[11px] text-slate-400 mb-1">
                              別名: {ent.aliases.join(', ')}
                            </div>
                          )}
                          {ent.relations.length > 0 && (
                            <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
                              {ent.relations.map((r, ri) => (
                                <div key={ri} className="truncate">
                                  {r.direction === 'outgoing' ? '→' : '←'} <strong>{r.targetName}</strong> [{r.type}]
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                世界線上で発生した事件・状態遷移の時系列一覧です。
              </div>

              {bibleData.events.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  年表イベントはまだ記録されていません（画面下部のタイムラインバーより追加できます）。
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {bibleData.events.map(ev => (
                    <div key={ev.id} className="relative group">
                      <div className="absolute -left-[29px] top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-[#11151f]" />
                      <div className="bg-[#161c2b] border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-indigo-400">
                            t = {ev.timestamp}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                            {ev.type}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-100 mb-2">
                          {ev.description}
                        </p>
                        {ev.participants.length > 0 && (
                          <div className="text-xs text-slate-400">
                            関係者: {ev.participants.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#151a26] flex items-center justify-between text-xs text-slate-400">
          <span>Axral Codex 統合世界観エンジンにより同期中</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
