import React, { useState } from 'react';
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  FileText,
  User,
  Clock,
  Layers,
  Sparkles,
  Bookmark,
  CheckCircle2,
  Trash2,
  Maximize2
} from 'lucide-react';
import type { AxralStoryV1, StoryScene } from '../core/story';
import { getPovColor } from '../core/pov';
import { getLayerColor } from '../core/layers';
import type { ForeshadowingItem } from '../core/foreshadowing';

interface SceneCorkboardProps {
  story: AxralStoryV1;
  selectedChapterId: string | null;
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  onOpenSceneInEditor: (sceneId: string) => void;
  onAddScene: (chapterId: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onReorderScene: (sceneId: string, toIndex: number) => void;
  onUpdateSceneTitle: (sceneId: string, title: string) => void;
  onUpdateSceneSynopsis: (sceneId: string, synopsis: string) => void;
  onUpdateScenePov: (sceneId: string, povCharacter: string) => void;
  allCharacters: string[];
  foreshadowingItems: ForeshadowingItem[];
  allLayers?: string[];
}

export const SceneCorkboard: React.FC<SceneCorkboardProps> = ({
  story,
  selectedChapterId,
  selectedSceneId,
  onSelectScene,
  onOpenSceneInEditor,
  onAddScene,
  onDeleteScene,
  onReorderScene,
  onUpdateSceneTitle,
  onUpdateSceneSynopsis,
  onUpdateScenePov,
  allCharacters,
  foreshadowingItems,
  allLayers = ['Su-ken', 'Kan-ken', 'An-ken', 'Ki-ken']
}) => {
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  const currentChapter = story.chapters.find(c => c.id === selectedChapterId) || story.chapters[0];
  const scenes = currentChapter?.scenes || [];

  const handleStartEditTitle = (scene: StoryScene) => {
    setEditingTitleId(scene.id);
    setTempTitle(scene.title);
  };

  const handleSaveTitle = (sceneId: string) => {
    if (tempTitle.trim()) {
      onUpdateSceneTitle(sceneId, tempTitle.trim());
    }
    setEditingTitleId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950/60 overflow-hidden select-none">
      {/* Corkboard Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800 bg-neutral-900/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <span>{currentChapter?.title || '全シーン'}</span>
            <span className="text-xs text-neutral-400 font-normal">
              · {scenes.length}枚のシーンカード
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => currentChapter && onAddScene(currentChapter.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新しいシーンを追加</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {scenes.map((scene, index) => {
            const isSelected = scene.id === selectedSceneId;
            const povCharacter = (scene as any).pov_character_id || (scene as any).povCharacter || '三人称客観';
            const povStyle = getPovColor(povCharacter);
            const synopsis = (scene as any).synopsis || '';
            const layer = (scene as any).layer || 'Su-ken';
            const layerStyle = getLayerColor(layer);

            // Related foreshadowing items
            const setups = foreshadowingItems.filter(f => f.setupSceneId === scene.id);
            const payoffs = foreshadowingItems.filter(f => f.payoffSceneId === scene.id);

            // Block counts
            const dialogueCount = scene.blocks.filter(b => b.type === 'dialogue').length;
            const wordCount = scene.blocks.reduce((acc, b) => acc + (b.text?.length || 0), 0);

            return (
              <div
                key={scene.id}
                onClick={() => onSelectScene(scene.id)}
                className={`flex flex-col bg-neutral-900/90 rounded-lg border transition-all duration-150 hover:border-neutral-600 shadow-md ${
                  isSelected
                    ? 'border-cyan-500 ring-1 ring-cyan-500/50 shadow-cyan-950/30'
                    : 'border-neutral-800'
                }`}
                style={{
                  minHeight: '260px'
                }}
              >
                {/* Card Header with POV color strip */}
                <div
                  className="px-3 py-2 border-b border-neutral-800/80 flex items-center justify-between gap-2"
                  style={{
                    borderTop: `3px solid ${povStyle.color}`,
                    backgroundColor: povStyle.bgSubtle
                  }}
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="font-mono text-xs font-bold text-neutral-400 tabular-nums shrink-0">
                      #{String(index + 1).padStart(2, '0')}
                    </span>

                    {editingTitleId === scene.id ? (
                      <input
                        type="text"
                        value={tempTitle}
                        autoFocus
                        onChange={(e) => setTempTitle(e.target.value)}
                        onBlur={() => handleSaveTitle(scene.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle(scene.id);
                          if (e.key === 'Escape') setEditingTitleId(null);
                        }}
                        className="bg-neutral-950 border border-cyan-500 rounded px-1.5 py-0.5 text-xs text-neutral-100 outline-none w-full"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => handleStartEditTitle(scene)}
                        title="ダブルクリックでタイトル編集"
                        className="font-medium text-xs text-neutral-200 truncate cursor-pointer hover:text-white"
                      >
                        {scene.title}
                      </span>
                    )}
                  </div>

                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0"
                    style={{
                      backgroundColor: layerStyle.bgRgba,
                      borderColor: layerStyle.borderHex,
                      color: layerStyle.textHex
                    }}
                  >
                    {layer}
                  </span>
                </div>

                {/* POV & Time bar */}
                <div className="px-3 py-1.5 bg-neutral-950/40 border-b border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-neutral-400" />
                    <select
                      value={povCharacter}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateScenePov(scene.id, e.target.value)}
                      className="bg-transparent border-none text-[11px] font-medium outline-none cursor-pointer"
                      style={{ color: povStyle.textCol }}
                    >
                      <option value="三人称客観" className="bg-neutral-900 text-neutral-300">
                        三人称客観
                      </option>
                      {allCharacters.map(name => (
                        <option key={name} value={name} className="bg-neutral-900 text-neutral-300">
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-neutral-400">
                    <Clock className="w-2.5 h-2.5" />
                    <span>t={index}</span>
                  </div>
                </div>

                {/* Synopsis Body (Editable) */}
                <div className="flex-1 p-3 flex flex-col">
                  <label className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                    あらすじ / プロット概要
                  </label>
                  <textarea
                    value={synopsis}
                    placeholder="このシーンで起きる出来事や目的を記入..."
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdateSceneSynopsis(scene.id, e.target.value)}
                    rows={4}
                    className="flex-1 w-full bg-neutral-950/50 hover:bg-neutral-950 focus:bg-neutral-950 border border-neutral-800/80 focus:border-cyan-500/70 rounded p-2 text-xs text-neutral-300 placeholder:text-neutral-600 outline-none resize-none transition-colors"
                  />
                </div>

                {/* Foreshadowing Tags (if any) */}
                {(setups.length > 0 || payoffs.length > 0) && (
                  <div className="px-3 py-1.5 bg-neutral-950/30 border-t border-neutral-800/60 flex flex-wrap gap-1 text-[10px]">
                    {setups.map(s => (
                      <span
                        key={s.id}
                        title={`仕込み: ${s.title}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-950/40 border border-amber-800/50 text-amber-300 rounded"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        <span className="truncate max-w-[90px]">{s.title}</span>
                      </span>
                    ))}
                    {payoffs.map(p => (
                      <span
                        key={p.id}
                        title={`回収: ${p.title}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="truncate max-w-[90px]">{p.title}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Footer: Metrics & Reorder controls */}
                <div className="px-3 py-2 border-t border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-[11px] text-neutral-400">
                  <div className="flex items-center gap-2 tabular-nums font-mono text-[10px]">
                    <span>セリフ {dialogueCount}</span>
                    <span aria-hidden="true">·</span>
                    <span>{wordCount}字</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      title="前へ移動"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderScene(scene.id, index - 1);
                      }}
                      className="p-1 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-neutral-300 transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === scenes.length - 1}
                      title="次へ移動"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderScene(scene.id, index + 1);
                      }}
                      className="p-1 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-neutral-300 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      title="台本エディタで開く"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSceneInEditor(scene.id);
                      }}
                      className="p-1 hover:bg-cyan-900/40 text-cyan-400 rounded transition-colors ml-1"
                    >
                      <FileText className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      title="シーン削除"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`シーン「${scene.title}」を削除しますか？`)) {
                          onDeleteScene(scene.id);
                        }
                      }}
                      className="p-1 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
