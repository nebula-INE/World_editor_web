import React, { useRef, useState, useMemo } from 'react';
import {
  X,
  FilePlus2,
  FolderOpen,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  BookOpen,
  Film,
  Mic,
  Copy,
  Check,
  Download,
  AlertCircle,
  User,
  Volume2,
  Music,
  Split,
  FileText,
  Eye,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { getLayerColor } from '../core/layers';
import {
  parseStory,
  WORK_KINDS,
  STORY_BLOCK_TYPES,
  type AxralStoryV1,
  type WorkKind,
  type StoryBlockType,
  type StoryBlock
} from '../core/story';
import {
  addChapter,
  renameChapter,
  reorderChapter,
  deleteChapter,
  addScene,
  renameScene,
  reorderScene,
  deleteScene,
  addBlock,
  updateBlock,
  reorderBlock,
  deleteBlock
} from '../core/story-editing';
import {
  isStoryFilename,
  parseStoryFileText,
  serializeStoryFile,
  storyFilename,
  STORY_FILE_SUFFIX
} from '../core/story-file';
import { STORY_TEMPLATES, type StoryTemplateOption } from '../core/story-templates';
import {
  renderRubyText,
  calculateStoryStats,
  formatAsScreenplayText,
  inspectStoryCharacterConsistency
} from '../core/story-formatters';
import type { WorldModel } from '../core/models';
import type { WorldState } from '../core/world_state';

interface StoryAuthoringProps {
  onClose: () => void;
  worldModel?: WorldModel | WorldState;
  onAddEntityToWorld?: (entityName: string) => void;
}

const uid = () => globalThis.crypto?.randomUUID?.() ?? `axral-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const WORK_KIND_LABELS: Record<WorkKind, { label: string; desc: string }> = {
  screenplay: { label: '映画・アニメ脚本', desc: '柱・ト書き・台詞で構成する映像用フォーマット' },
  audio_drama: { label: '舞台劇・音声ドラマ台本', desc: '役名、台詞、効果音(SE)、劇伴(BGM)に特化した台本' },
  novel: { label: '小説・ライトノベル', desc: '地の文、会話文、ルビ記法、縦書き表示に対応' },
  game_scenario: { label: 'マダミス・分岐ゲーム', desc: '手がかり調査、全体議論、選択肢分岐を含む構成' },
  trpg_scenario: { label: 'TRPGシナリオ', desc: 'ハンドアウト、マップシーン、判定指示を含む構成' },
  storyboard: { label: '絵コンテ・プロット', desc: '各カットの構図や演出メモを並べたプロット' }
};

const BLOCK_TYPE_CONFIG: Record<StoryBlockType, { label: string; color: string; badge: string }> = {
  direction: { label: 'ト書き・柱・演出', color: 'border-emerald-600/50 bg-emerald-950/20 text-emerald-200', badge: 'ト書き' },
  dialogue: { label: '台詞（セリフ）', color: 'border-indigo-600/50 bg-indigo-950/25 text-indigo-200', badge: '台詞' },
  prose: { label: '地の文', color: 'border-slate-600/50 bg-slate-900/30 text-slate-200', badge: '地の文' },
  narration: { label: 'ナレーション', color: 'border-cyan-600/50 bg-cyan-950/20 text-cyan-200', badge: 'ナレーション' },
  note: { label: '制作メモ・配役', color: 'border-amber-600/50 bg-amber-950/20 text-amber-200', badge: 'メモ' }
};

export const StoryAuthoring: React.FC<StoryAuthoringProps> = ({
  onClose,
  worldModel,
  onAddEntityToWorld
}) => {
  // Story State: Default with 3-act or blank
  const [story, setStory] = useState<AxralStoryV1>(() => {
    // If local storage has saved story, load it; otherwise standard template
    try {
      const saved = localStorage.getItem('axral_active_story');
      if (saved) return parseStory(JSON.parse(saved));
    } catch {}
    return STORY_TEMPLATES[0].create('新しいシナリオ作品');
  });

  const savedSnapshot = useRef<string>(serializeStoryFile(story));
  const isDirty = () => {
    try {
      return serializeStoryFile(story) !== savedSnapshot.current;
    } catch {
      return true;
    }
  };

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(story.chapters[0]?.id ?? null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(story.chapters[0]?.scenes[0]?.id ?? null);

  // Active view tab in right pane: 'screenplay' | 'vertical' | 'consistency'
  const [previewTab, setPreviewTab] = useState<'screenplay' | 'vertical' | 'consistency'>('screenplay');

  // Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [copiedScreenplay, setCopiedScreenplay] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<string>('台本エディタが準備完了しました。');

  // Save to localStorage
  const mutateStory = (fn: (current: AxralStoryV1) => AxralStoryV1) => {
    try {
      const next = fn(story);
      setStory(next);
      localStorage.setItem('axral_active_story', JSON.stringify(next));
      setStatusMessage('変更を反映しました。');
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    }
  };

  // Active Chapter and Scene
  const currentChapter = story.chapters.find(c => c.id === selectedChapterId) ?? story.chapters[0];
  const currentScene = currentChapter?.scenes.find(s => s.id === selectedSceneId) ?? currentChapter?.scenes[0];

  // Story Metrics
  const stats = useMemo(() => calculateStoryStats(story), [story]);

  const [authoringLayerFilter, setAuthoringLayerFilter] = useState<string>('all');

  // World Characters list with layer information
  const charactersWithLayer = useMemo(() => {
    const list: { name: string; layer: string; id: string }[] = [];
    if (worldModel?.entities) {
      for (const ent of Object.values(worldModel.entities)) {
        if (ent.type === 'Character' || ent.name) {
          list.push({
            name: ent.name,
            layer: ent.layer || '未分類',
            id: ent.id
          });
        }
      }
    }
    return list;
  }, [worldModel]);

  const authoringLayers = useMemo(() => {
    const s = new Set<string>();
    charactersWithLayer.forEach(c => s.add(c.layer));
    return Array.from(s);
  }, [charactersWithLayer]);

  const filteredCharacters = useMemo(() => {
    if (authoringLayerFilter === 'all') return charactersWithLayer;
    return charactersWithLayer.filter(c => c.layer === authoringLayerFilter);
  }, [charactersWithLayer, authoringLayerFilter]);

  const knownCharacters = useMemo(() => {
    return Array.from(new Set(charactersWithLayer.map(c => c.name)));
  }, [charactersWithLayer]);

  // Lore Consistency findings
  const consistencyReport = useMemo(() => {
    return inspectStoryCharacterConsistency(story, worldModel);
  }, [story, worldModel]);

  // File Operations
  const handleConfirmDiscard = (actionName: string) => {
    if (!isDirty()) return true;
    return window.confirm(`保存されていない変更があります。${actionName}を実行すると現在の変更は失われます。続行しますか？`);
  };

  const handleOpenNewFromTemplate = (tpl: StoryTemplateOption) => {
    if (!handleConfirmDiscard(`テンプレート「${tpl.name}」の適用`)) return;
    const newDoc = tpl.create();
    setStory(newDoc);
    savedSnapshot.current = serializeStoryFile(newDoc);
    localStorage.setItem('axral_active_story', JSON.stringify(newDoc));
    setSelectedChapterId(newDoc.chapters[0]?.id ?? null);
    setSelectedSceneId(newDoc.chapters[0]?.scenes[0]?.id ?? null);
    setIsTemplateModalOpen(false);
    setStatusMessage(`テンプレート「${tpl.name}」を適用しました。`);
  };

  const handleOpenFile = () => {
    if (handleConfirmDiscard('別の物語ファイルを開く')) {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      if (!isStoryFilename(file.name)) {
        throw new Error(`物語ファイルは ${STORY_FILE_SUFFIX} で終わる必要があります。`);
      }
      const text = await file.text();
      const parsed = parseStoryFileText(text);
      setStory(parsed);
      savedSnapshot.current = serializeStoryFile(parsed);
      localStorage.setItem('axral_active_story', JSON.stringify(parsed));
      setSelectedChapterId(parsed.chapters[0]?.id ?? null);
      setSelectedSceneId(parsed.chapters[0]?.scenes[0]?.id ?? null);
      setStatusMessage(`読み込みました: ${file.name}`);
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSaveFile = () => {
    try {
      const serialized = serializeStoryFile(story);
      const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = storyFilename(story.title);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      savedSnapshot.current = serialized;
      setStatusMessage('物語ファイル（.axral-story.json）を書き出しました。');
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExportText = () => {
    try {
      const text = formatAsScreenplayText(story);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${story.title || 'シナリオ'}_台本.txt`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatusMessage('台本テキスト（.txt）をエクスポートしました。');
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCopyScreenplay = async () => {
    try {
      const text = formatAsScreenplayText(story);
      await navigator.clipboard.writeText(text);
      setCopiedScreenplay(true);
      setTimeout(() => setCopiedScreenplay(false), 2000);
      setStatusMessage('台本テキストをクリップボードにコピーしました。');
    } catch {
      setStatusMessage('コピーに失敗しました。');
    }
  };

  // Quick insertion helpers for editor
  const handleInsertQuickBlock = (
    type: StoryBlockType,
    defaultText: string,
    characterId?: string
  ) => {
    if (!currentScene) return;
    const newId = uid();
    mutateStory(s => addBlock(s, currentScene.id, {
      id: newId,
      type,
      text: defaultText,
      character_id: characterId || (type === 'dialogue' ? (knownCharacters[0] || 'アリス') : null)
    }));
  };

  const handleInsertRubyHelper = (blockId: string, currentText: string) => {
    mutateStory(s => updateBlock(s, blockId, {
      text: currentText + '|漢字《かんじ》'
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#111317] text-gray-200 select-none font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept=".axral-story.json,application/json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-[#2B2E36] bg-[#16181D] px-4">
        {/* Left: Branding, Title & Genre */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow">
              劇
            </span>
            <div className="hidden sm:block">
              <span className="font-semibold text-sm tracking-wide text-white">Axral Story Studio</span>
              <span className="text-[11px] text-gray-400 block -mt-0.5">台本・シナリオ執筆エンジン</span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-[#2d313b] hidden md:block" />

          {/* Inline Title & Kind Editor */}
          <div className="flex items-center space-x-2 min-w-0">
            <input
              type="text"
              aria-label="作品タイトル"
              value={story.title}
              onChange={e => mutateStory(s => ({ ...s, title: e.target.value }))}
              placeholder="無題の作品"
              className="w-44 sm:w-60 md:w-72 rounded border border-[#343842] bg-[#1d2027] px-2.5 py-1 text-sm font-medium text-white focus:border-indigo-500 focus:outline-none"
            />

            <select
              aria-label="作品ジャンル・種別"
              value={story.kind}
              onChange={e => mutateStory(s => ({ ...s, kind: e.target.value as WorkKind }))}
              className="rounded border border-[#343842] bg-[#1d2027] px-2 py-1 text-xs text-indigo-300 font-medium focus:border-indigo-500 focus:outline-none"
            >
              {WORK_KINDS.map(kind => (
                <option key={kind} value={kind}>
                  {WORK_KIND_LABELS[kind]?.label ?? kind}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Quick Stats */}
        <div className="hidden xl:flex items-center space-x-4 text-xs text-gray-400">
          <span>文字数: <strong className="text-gray-200 font-mono">{stats.charCount.toLocaleString()}</strong> 字</span>
          <span>章: <strong className="text-gray-200 font-mono">{stats.chapterCount}</strong></span>
          <span>シーン: <strong className="text-gray-200 font-mono">{stats.sceneCount}</strong></span>
          <span>セリフ: <strong className="text-gray-200 font-mono">{stats.dialogueCount}</strong></span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center space-x-1.5 rounded border border-indigo-700/60 bg-indigo-950/60 px-2.5 py-1 text-xs font-medium text-indigo-200 hover:bg-indigo-900/60 transition-colors"
            title="起承転結・三幕構成・マダミス等のテンプレートから選ぶ"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>構成テンプレート</span>
          </button>

          <button
            onClick={() => {
              if (handleConfirmDiscard('新規作成')) {
                const blankDoc = STORY_TEMPLATES.find(t => t.id === 'blank')?.create() ?? STORY_TEMPLATES[0].create();
                setStory(blankDoc);
                savedSnapshot.current = serializeStoryFile(blankDoc);
                setSelectedChapterId(blankDoc.chapters[0]?.id ?? null);
                setSelectedSceneId(blankDoc.chapters[0]?.scenes[0]?.id ?? null);
                setStatusMessage('新しい白紙のシナリオを作成しました。');
              }
            }}
            className="hidden sm:flex items-center space-x-1 rounded border border-[#343842] bg-[#22252c] px-2.5 py-1 text-xs text-gray-300 hover:bg-[#2c3039]"
            title="白紙のシナリオを新規作成"
          >
            <FilePlus2 className="h-3.5 w-3.5 text-gray-400" />
            <span>新規</span>
          </button>

          <button
            onClick={handleOpenFile}
            className="flex items-center space-x-1 rounded border border-[#343842] bg-[#22252c] px-2.5 py-1 text-xs text-gray-300 hover:bg-[#2c3039]"
            title=".axral-story.jsonファイルを開く"
          >
            <FolderOpen className="h-3.5 w-3.5 text-sky-400" />
            <span>開く</span>
          </button>

          <button
            onClick={handleSaveFile}
            className="flex items-center space-x-1 rounded border border-emerald-800/60 bg-emerald-950/50 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-900/60"
            title=".axral-story.jsonとして保存・ダウンロード"
          >
            <Save className="h-3.5 w-3.5 text-emerald-400" />
            <span>保存</span>
          </button>

          <button
            onClick={handleExportText}
            className="hidden md:flex items-center space-x-1 rounded border border-[#343842] bg-[#22252c] px-2.5 py-1 text-xs text-gray-300 hover:bg-[#2c3039]"
            title="標準台本テキスト（.txt）をエクスポート"
          >
            <Download className="h-3.5 w-3.5 text-amber-400" />
            <span>台本書き出し</span>
          </button>

          <button
            onClick={() => {
              if (handleConfirmDiscard('Story Studioを終了')) {
                onClose();
              }
            }}
            className="flex items-center space-x-1 rounded border border-red-900/40 bg-red-950/30 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900/50"
            title="閉じる"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">閉じる</span>
          </button>
        </div>
      </header>

      {/* Main Studio Workspace: 3 Columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ========================================================= */}
        {/* Left Column: Chapters & Scenes Navigation (260px)         */}
        {/* ========================================================= */}
        <aside className="w-64 border-r border-[#2B2E36] bg-[#14161B] flex flex-col shrink-0">
          {/* Header of Nav */}
          <div className="flex items-center justify-between border-b border-[#2B2E36] px-3 py-2.5 bg-[#181B20]">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-300">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span>章・シーン構成</span>
            </div>
            <button
              onClick={() => {
                const newChapId = uid();
                mutateStory(s => addChapter(s, newChapId, `第${s.chapters.length + 1}章`));
                setSelectedChapterId(newChapId);
                setSelectedSceneId(null);
              }}
              className="flex items-center space-x-1 rounded bg-[#242831] border border-[#373c47] px-2 py-0.5 text-[11px] text-gray-200 hover:bg-[#2f3542]"
            >
              <Plus className="h-3 w-3 text-indigo-400" />
              <span>章を追加</span>
            </button>
          </div>

          {/* List of Chapters and nested Scenes */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {story.chapters.length === 0 && (
              <div className="p-4 text-center text-xs text-gray-500">
                章がありません。「章を追加」をクリックしてください。
              </div>
            )}

            {story.chapters.map((chap, cIdx) => {
              const isChapActive = currentChapter?.id === chap.id;
              return (
                <div
                  key={chap.id}
                  className={`rounded-lg border transition-colors ${
                    isChapActive
                      ? 'border-indigo-600/60 bg-[#1c202a]'
                      : 'border-[#2a2d36] bg-[#181a20] hover:border-[#383d49]'
                  }`}
                >
                  {/* Chapter Header */}
                  <div className="p-2.5 border-b border-[#252831] flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider">
                        ACT {cIdx + 1}
                      </div>
                      <input
                        type="text"
                        value={chap.title}
                        onChange={e => mutateStory(s => renameChapter(s, chap.id, e.target.value))}
                        onClick={() => setSelectedChapterId(chap.id)}
                        className="w-full bg-transparent text-xs font-bold text-gray-200 focus:bg-[#252832] focus:outline-none rounded px-1 -mx-1"
                      />
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        title="上へ"
                        disabled={cIdx === 0}
                        onClick={() => mutateStory(s => reorderChapter(s, chap.id, cIdx - 1))}
                        className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-[#2b2f3a] disabled:opacity-20"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        title="下へ"
                        disabled={cIdx === story.chapters.length - 1}
                        onClick={() => mutateStory(s => reorderChapter(s, chap.id, cIdx + 1))}
                        className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-[#2b2f3a] disabled:opacity-20"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        title="章を削除"
                        onClick={() => {
                          if (window.confirm(`「${chap.title}」と配下のシーンを削除しますか？`)) {
                            mutateStory(s => deleteChapter(s, chap.id));
                            if (selectedChapterId === chap.id) {
                              setSelectedChapterId(story.chapters.find(c => c.id !== chap.id)?.id ?? null);
                            }
                          }
                        }}
                        className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-[#2b2f3a]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Scenes inside this Chapter */}
                  <div className="p-1.5 space-y-1">
                    {chap.scenes.map((sc, sIdx) => {
                      const isScActive = currentScene?.id === sc.id;
                      const scCharCount = sc.blocks.reduce((sum, b) => sum + b.text.length, 0);

                      return (
                        <div
                          key={sc.id}
                          onClick={() => {
                            setSelectedChapterId(chap.id);
                            setSelectedSceneId(sc.id);
                          }}
                          className={`group flex items-center justify-between rounded px-2 py-1.5 cursor-pointer text-xs transition-colors ${
                            isScActive
                              ? 'bg-indigo-600 text-white font-medium shadow-sm'
                              : 'text-gray-300 hover:bg-[#232731]'
                          }`}
                        >
                          <div className="min-w-0 flex-1 truncate pr-1">
                            <span className="opacity-70 mr-1.5 font-mono">{sIdx + 1}.</span>
                            <span>{sc.title || '（無題のシーン）'}</span>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <span className={`text-[10px] font-mono mr-1 ${isScActive ? 'text-indigo-200' : 'text-gray-500'}`}>
                              {scCharCount}字
                            </span>
                            <button
                              title="シーンを削除"
                              onClick={e => {
                                e.stopPropagation();
                                if (window.confirm(`シーン「${sc.title}」を削除しますか？`)) {
                                  mutateStory(s => deleteScene(s, sc.id));
                                  if (selectedSceneId === sc.id) {
                                    setSelectedSceneId(chap.scenes.find(s => s.id !== sc.id)?.id ?? null);
                                  }
                                }
                              }}
                              className={`p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-red-400 ${
                                isScActive ? 'hover:bg-indigo-700' : 'hover:bg-[#2c313d]'
                              }`}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Scene to this Chapter Button */}
                    <button
                      onClick={() => {
                        const newScId = uid();
                        mutateStory(s => addScene(s, chap.id, newScId, `シーン ${chap.scenes.length + 1}`));
                        setSelectedChapterId(chap.id);
                        setSelectedSceneId(newScId);
                      }}
                      className="w-full flex items-center justify-center space-x-1 rounded border border-dashed border-[#343844] py-1 text-[11px] text-gray-400 hover:text-indigo-300 hover:border-indigo-600/60 hover:bg-[#1f232c] transition-colors mt-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>シーンを追加</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ========================================================= */}
        {/* Center Column: Block Editor & Production Palette (flex-1) */}
        {/* ========================================================= */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#111317]">
          {currentScene ? (
            <>
              {/* Scene Info & Quick Insertion Toolbar */}
              <div className="border-b border-[#2B2E36] bg-[#16181E] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
                    <span className="text-xs text-indigo-400 font-semibold uppercase">
                      {currentChapter?.title} /
                    </span>
                    <input
                      type="text"
                      aria-label="シーン名"
                      value={currentScene.title}
                      onChange={e => mutateStory(s => renameScene(s, currentScene.id, e.target.value))}
                      placeholder="シーン名を入力"
                      className="rounded border border-[#343842] bg-[#1e222b] px-2.5 py-1 text-sm font-semibold text-white focus:border-indigo-500 focus:outline-none flex-1 max-w-md"
                    />
                  </div>

                  {/* Character Speaker Quick Palette with Layer Filtering */}
                  {charactersWithLayer.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                      <div className="flex items-center space-x-1 shrink-0">
                        <User className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="hidden sm:inline font-medium text-gray-300">話者サジェスト:</span>
                      </div>

                      {/* Layer Filter Tabs for Speakers */}
                      {authoringLayers.length > 1 && (
                        <div className="flex items-center space-x-1 bg-[#181a22] border border-[#2d323f] rounded p-0.5 shrink-0">
                          <button
                            onClick={() => setAuthoringLayerFilter('all')}
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              authoringLayerFilter === 'all'
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            全層
                          </button>
                          {authoringLayers.map(l => {
                            const lCol = getLayerColor(l === '未分類' ? null : l);
                            return (
                              <button
                                key={l}
                                onClick={() => setAuthoringLayerFilter(l)}
                                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] ${
                                  authoringLayerFilter === l
                                    ? 'bg-[#252a38] text-white font-bold'
                                    : 'text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lCol.hex }} />
                                <span>{l}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Filtered Character Buttons */}
                      <div className="flex items-center space-x-1 overflow-x-auto max-w-[340px]">
                        {filteredCharacters.map(charObj => {
                          const lCol = getLayerColor(charObj.layer === '未分類' ? null : charObj.layer);
                          return (
                            <button
                              key={charObj.id}
                              onClick={() => handleInsertQuickBlock('dialogue', '「」', charObj.name)}
                              className="flex items-center space-x-1 rounded bg-[#20232d] border border-[#343846] px-2 py-0.5 text-[11px] text-gray-200 hover:bg-indigo-950/70 hover:border-indigo-600 transition-colors shrink-0"
                              title={`${charObj.name}（所属: ${charObj.layer}）のセリフブロックを追加`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lCol.hex }} />
                              <span>＋ {charObj.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Quick Insertion Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleInsertQuickBlock('direction', '〇 場所（時間帯）\n')}
                    className="flex items-center space-x-1 rounded bg-indigo-950/60 border border-indigo-700/60 px-2.5 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-900/70 transition-colors"
                    title="柱（シーン頭・場所と時間）を追加"
                  >
                    <Film className="h-3.5 w-3.5 text-indigo-400" />
                    <span>＋ 柱（場所・時間）</span>
                  </button>

                  <button
                    onClick={() => handleInsertQuickBlock('direction', '')}
                    className="flex items-center space-x-1 rounded bg-emerald-950/50 border border-emerald-700/60 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60 transition-colors"
                    title="ト書き（情景・動作指示）を追加"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-400" />
                    <span>＋ ト書き</span>
                  </button>

                  <button
                    onClick={() => handleInsertQuickBlock('dialogue', '「」')}
                    className="flex items-center space-x-1 rounded bg-blue-950/50 border border-blue-700/60 px-2.5 py-1 text-xs font-semibold text-blue-200 hover:bg-blue-900/60 transition-colors"
                    title="キャラクターのセリフを追加"
                  >
                    <Mic className="h-3.5 w-3.5 text-blue-400" />
                    <span>＋ 台詞（セリフ）</span>
                  </button>

                  <button
                    onClick={() => handleInsertQuickBlock('direction', '【SE: 】')}
                    className="flex items-center space-x-1 rounded bg-[#252832] border border-[#3a3f4e] px-2 py-1 text-xs text-amber-300 hover:bg-amber-950/40 hover:border-amber-700 transition-colors"
                    title="効果音（SE）指示を追加"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-amber-400" />
                    <span>＋ SE</span>
                  </button>

                  <button
                    onClick={() => handleInsertQuickBlock('direction', '【BGM: 】')}
                    className="flex items-center space-x-1 rounded bg-[#252832] border border-[#3a3f4e] px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950/40 hover:border-emerald-700 transition-colors"
                    title="劇伴音楽（BGM）指示を追加"
                  >
                    <Music className="h-3.5 w-3.5 text-emerald-400" />
                    <span>＋ BGM</span>
                  </button>

                  <button
                    onClick={() => handleInsertQuickBlock('direction', '【選択肢 / 分岐】\n1. \n2. ')}
                    className="flex items-center space-x-1 rounded bg-[#252832] border border-[#3a3f4e] px-2 py-1 text-xs text-purple-300 hover:bg-purple-950/40 hover:border-purple-700 transition-colors"
                    title="ゲーム・マダミスの選択肢・分岐フラグを追加"
                  >
                    <Split className="h-3.5 w-3.5 text-purple-400" />
                    <span>＋ 選択肢</span>
                  </button>

                  <button
                    onClick={() => handleInsertQuickBlock('prose', '')}
                    className="flex items-center space-x-1 rounded bg-[#252832] border border-[#3a3f4e] px-2 py-1 text-xs text-gray-300 hover:bg-[#313644] transition-colors"
                    title="小説の地の文を追加"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                    <span>＋ 地の文</span>
                  </button>
                </div>
              </div>

              {/* Block List Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {currentScene.blocks.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 border border-dashed border-[#2f333d] rounded-xl my-6">
                    <Sparkles className="h-8 w-8 text-indigo-400 mb-2 opacity-50" />
                    <p className="text-sm font-medium text-gray-300">まだ本文ブロックがありません</p>
                    <p className="text-xs text-gray-500 mt-1">上のツールバーから「柱」「ト書き」「台詞」などを追加して執筆を始めましょう。</p>
                  </div>
                )}

                {currentScene.blocks.map((blk, bIdx) => {
                  const cfg = BLOCK_TYPE_CONFIG[blk.type] || BLOCK_TYPE_CONFIG.prose;
                  const isSlugline = blk.type === 'direction' && blk.text.trim().startsWith('〇');
                  const isAudioCue = blk.type === 'direction' && (blk.text.includes('【SE:') || blk.text.includes('【BGM:'));

                  return (
                    <article
                      key={blk.id}
                      className={`group rounded-lg border p-3 transition-shadow ${
                        isSlugline
                          ? 'border-indigo-600/70 bg-[#171a24] shadow-sm'
                          : isAudioCue
                          ? 'border-amber-700/50 bg-[#1b1916]'
                          : blk.type === 'dialogue'
                          ? 'border-blue-700/40 bg-[#141720]'
                          : 'border-[#2d313b] bg-[#16181f] hover:border-[#3d4352]'
                      }`}
                    >
                      {/* Block Controls Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-[#242730]">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-gray-500">#{bIdx + 1}</span>

                          {/* Block Type Selector */}
                          <select
                            value={blk.type}
                            onChange={e => mutateStory(s => updateBlock(s, blk.id, { type: e.target.value as StoryBlockType }))}
                            className="rounded border border-[#343946] bg-[#20242e] px-2 py-0.5 text-xs font-medium text-gray-200 focus:border-indigo-500 focus:outline-none"
                          >
                            {STORY_BLOCK_TYPES.map(t => (
                              <option key={t} value={t}>
                                {BLOCK_TYPE_CONFIG[t]?.label ?? t}
                              </option>
                            ))}
                          </select>

                          {/* Speaker selector for dialogue */}
                          {blk.type === 'dialogue' && (
                            <div className="flex items-center space-x-1">
                              <span className="text-[11px] text-indigo-300 font-medium">話者:</span>
                              <input
                                type="text"
                                value={blk.character_id ?? ''}
                                placeholder="話者名（例: アリス）"
                                list="world-character-list"
                                onChange={e => mutateStory(s => updateBlock(s, blk.id, { character_id: e.target.value || null }))}
                                className="w-28 sm:w-36 rounded border border-indigo-700/60 bg-[#1c2130] px-2 py-0.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                              />
                              <datalist id="world-character-list">
                                {knownCharacters.map(c => (
                                  <option key={c} value={c} />
                                ))}
                              </datalist>
                            </div>
                          )}

                          {isSlugline && (
                            <span className="rounded bg-indigo-900/60 px-1.5 py-0.5 text-[10px] font-bold text-indigo-200 uppercase tracking-wide">
                              シーン柱
                            </span>
                          )}
                          {isAudioCue && (
                            <span className="rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 uppercase tracking-wide">
                              音響キュー
                            </span>
                          )}
                        </div>

                        {/* Block Action Buttons */}
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleInsertRubyHelper(blk.id, blk.text)}
                            className="rounded border border-[#353a47] bg-[#222631] px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-indigo-300 hover:border-indigo-600"
                            title="カクヨム・なろう互換のルビ構文 |漢字《かんじ》 を挿入"
                          >
                            |ルビ《振付》
                          </button>

                          <button
                            title="上へ移動"
                            disabled={bIdx === 0}
                            onClick={() => mutateStory(s => reorderBlock(s, blk.id, bIdx - 1))}
                            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#282d38] disabled:opacity-20"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            title="下へ移動"
                            disabled={bIdx === currentScene.blocks.length - 1}
                            onClick={() => mutateStory(s => reorderBlock(s, blk.id, bIdx + 1))}
                            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#282d38] disabled:opacity-20"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          <button
                            title="ブロックを削除"
                            onClick={() => {
                              if (window.confirm('このブロックを削除しますか？')) {
                                mutateStory(s => deleteBlock(s, blk.id));
                              }
                            }}
                            className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-[#282d38]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Text Input Area */}
                      <textarea
                        value={blk.text}
                        rows={blk.type === 'direction' && isSlugline ? 2 : blk.type === 'dialogue' ? 3 : 4}
                        onChange={e => mutateStory(s => updateBlock(s, blk.id, { text: e.target.value }))}
                        placeholder={
                          blk.type === 'dialogue'
                            ? '「セリフを入力してください」'
                            : blk.type === 'direction'
                            ? isSlugline
                              ? '〇 廃病院・地下室（夜）'
                              : 'ト書き・情景描写・登場人物の行動を入力'
                            : '本文を入力してください。|漢字《ルビ》記法も使用できます。'
                        }
                        className={`w-full rounded border border-[#2e3340] bg-[#111318] p-2.5 text-sm leading-relaxed text-gray-100 focus:border-indigo-500 focus:outline-none resize-y ${
                          blk.type === 'dialogue' ? 'font-sans' : 'font-sans'
                        }`}
                      />
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              左のリストからシーンを選択するか、新規シーンを追加してください。
            </div>
          )}
        </main>

        {/* ========================================================= */}
        {/* Right Column: Switchable Real-Time Preview (380px)       */}
        {/* ========================================================= */}
        <aside className="w-80 md:w-96 border-l border-[#2B2E36] bg-[#14161C] flex flex-col shrink-0">
          {/* Preview Tab Navigation */}
          <div className="flex border-b border-[#2B2E36] bg-[#181B21] p-1">
            <button
              onClick={() => setPreviewTab('screenplay')}
              className={`flex-1 flex items-center justify-center space-x-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                previewTab === 'screenplay'
                  ? 'bg-[#252934] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Film className="h-3.5 w-3.5 text-indigo-400" />
              <span>台本ビュー</span>
            </button>

            <button
              onClick={() => setPreviewTab('vertical')}
              className={`flex-1 flex items-center justify-center space-x-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                previewTab === 'vertical'
                  ? 'bg-[#252934] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
              <span>縦書き文庫</span>
            </button>

            <button
              onClick={() => setPreviewTab('consistency')}
              className={`flex-1 flex items-center justify-center space-x-1 py-1.5 text-xs font-semibold rounded transition-colors relative ${
                previewTab === 'consistency'
                  ? 'bg-[#252934] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>世界設定整合</span>
              {consistencyReport.some(c => !c.inWorldCode || c.warning) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block ml-0.5" />
              )}
            </button>
          </div>

          {/* Preview Content Area */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-[#0f1115]">
            {/* TAB 1: Screenplay View */}
            {previewTab === 'screenplay' && (
              <div className="space-y-4 font-mono text-xs text-gray-300">
                <div className="flex items-center justify-between pb-2 border-b border-[#232731]">
                  <span className="text-[11px] text-gray-400 font-sans">
                    標準台本レイアウト（柱・ト書き・台詞）
                  </span>
                  <button
                    onClick={handleCopyScreenplay}
                    className="flex items-center space-x-1 rounded bg-[#212530] border border-[#343846] px-2 py-0.5 text-[11px] text-gray-200 hover:bg-[#2b303d]"
                  >
                    {copiedScreenplay ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-indigo-400" />}
                    <span>{copiedScreenplay ? 'コピー完了' : 'コピー'}</span>
                  </button>
                </div>

                <div className="text-center py-2">
                  <h3 className="text-sm font-bold text-white tracking-widest">『{story.title}』</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">種別: {WORK_KIND_LABELS[story.kind]?.label}</p>
                </div>

                {story.chapters.map(ch => (
                  <div key={ch.id} className="space-y-3">
                    <div className="border-t border-b border-[#2b2f3a] py-1 text-center font-bold text-indigo-300">
                      【{ch.title}】
                    </div>

                    {ch.scenes.map(sc => (
                      <div key={sc.id} className="space-y-2">
                        <div className="text-gray-400 font-bold border-l-2 border-indigo-500 pl-2">
                          ▼ {sc.title}
                        </div>

                        {sc.blocks.map(b => {
                          if (b.type === 'direction') {
                            if (b.text.trim().startsWith('〇')) {
                              return (
                                <div key={b.id} className="font-bold text-white bg-[#1a1d26] p-1.5 rounded">
                                  {b.text.trim()}
                                </div>
                              );
                            }
                            return (
                              <div key={b.id} className="pl-4 text-emerald-300/90 whitespace-pre-wrap leading-relaxed">
                                {b.text.trim()}
                              </div>
                            );
                          } else if (b.type === 'dialogue') {
                            const spk = b.character_id ? `${b.character_id}` : '';
                            return (
                              <div key={b.id} className="pl-2 leading-relaxed">
                                {spk && <strong className="text-indigo-300 mr-1">{spk}</strong>}
                                <span className="text-gray-100">
                                  {b.text.trim().startsWith('「') ? b.text.trim() : `「${b.text.trim()}」`}
                                </span>
                              </div>
                            );
                          } else if (b.type === 'narration') {
                            return (
                              <div key={b.id} className="pl-2 text-cyan-300 leading-relaxed italic">
                                （N）「{b.text.trim().replace(/^「|」$/g, '')}」
                              </div>
                            );
                          } else if (b.type === 'note') {
                            return (
                              <div key={b.id} className="text-amber-400/80 text-[11px] bg-amber-950/20 p-1 rounded">
                                /* {b.text.trim()} */
                              </div>
                            );
                          } else {
                            return (
                              <div key={b.id} className="pl-2 text-gray-300 whitespace-pre-wrap leading-relaxed">
                                {renderRubyText(b.text)}
                              </div>
                            );
                          }
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: Vertical Novel View (writing-mode: vertical-rl) */}
            {previewTab === 'vertical' && (
              <div className="h-full flex flex-col">
                <div className="pb-2 border-b border-[#232731] text-[11px] text-gray-400 mb-2">
                  小説・ライトノベル縦書きプレビュー（ルビ対応）
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-hidden rounded border border-[#2b2e38] bg-[#14161d] p-4 min-h-[360px]">
                  <div
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      fontFamily: "'Noto Serif JP', 'Source Serif 4', 'Yu Mincho', serif"
                    }}
                    className="h-full space-y-reverse space-y-6 text-sm text-gray-200 leading-8 select-text tracking-wide whitespace-pre-wrap"
                  >
                    <h2 className="font-bold text-base text-white tracking-widest pl-2">
                      {story.title}
                    </h2>

                    {story.chapters.map(ch => (
                      <React.Fragment key={ch.id}>
                        <div className="font-bold text-indigo-400 my-2 text-sm">
                          ■ {ch.title}
                        </div>

                        {ch.scenes.map(sc => (
                          <div key={sc.id} className="space-y-4">
                            {sc.blocks.map(b => (
                              <p
                                key={b.id}
                                className={b.type === 'dialogue' ? 'text-white' : 'text-gray-300 indent-4'}
                              >
                                {b.type === 'dialogue' && b.character_id && (
                                  <span className="text-indigo-300 font-sans text-xs inline-block ml-1">
                                    【{b.character_id}】
                                  </span>
                                )}
                                {renderRubyText(b.text)}
                              </p>
                            ))}
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: World Lore Consistency Inspector */}
            {previewTab === 'consistency' && (
              <div className="space-y-3">
                <div className="pb-2 border-b border-[#232731] text-xs text-gray-400">
                  物語に登場する人物と、世界設定（WorldCode）の整合性を検証します。
                </div>

                {consistencyReport.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500">
                    現在、登場人物は記録されていません。セリフブロックに話者名を入力すると照合されます。
                  </div>
                ) : (
                  consistencyReport.map((charItem, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3 ${
                        !charItem.inWorldCode
                          ? 'border-amber-700/60 bg-amber-950/20'
                          : charItem.warning
                          ? 'border-red-700/60 bg-red-950/20'
                          : 'border-emerald-700/50 bg-emerald-950/15'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-indigo-400" />
                          <span className="font-bold text-sm text-white">
                            {charItem.characterName}
                          </span>
                        </div>

                        <span className="text-[10px] text-gray-400 font-mono">
                          登場ブロック: {charItem.blockCount}回
                        </span>
                      </div>

                      <div className="mt-2 text-xs">
                        {charItem.inWorldCode ? (
                          <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>WorldCode登録済み（{charItem.entityLayer || '通常レイヤー'}）</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-1.5 text-amber-300 font-medium">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>世界設定に未登録のキャラクターです</span>
                            </div>

                            {onAddEntityToWorld && (
                              <button
                                onClick={() => {
                                  onAddEntityToWorld(charItem.characterName);
                                  setStatusMessage(`世界設定に [${charItem.characterName}:Character] を追加しました。`);
                                }}
                                className="flex items-center space-x-1 rounded bg-indigo-900/60 border border-indigo-600 px-2 py-1 text-[11px] text-indigo-200 hover:bg-indigo-800 transition-colors"
                              >
                                <span>＋ 世界設定に登録する</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}

                        {charItem.warning && (
                          <p className="mt-1.5 text-[11px] text-amber-300/90 bg-black/30 p-1.5 rounded">
                            {charItem.warning}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Footer Status Bar */}
      <footer className="h-7 border-t border-[#2B2E36] bg-[#16181D] px-4 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
        <div className="flex items-center space-x-3">
          <span>{statusMessage}</span>
          {isDirty() && <span className="text-amber-400 font-medium">● 未保存の変更あり</span>}
        </div>
        <div className="flex items-center space-x-3 text-gray-500 font-mono">
          <span>作品ID: {story.work_id}</span>
          <span>形式: .axral-story.json (v1)</span>
        </div>
      </footer>

      {/* ========================================================= */}
      {/* Template Selection Modal                                   */}
      {/* ========================================================= */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[#383d4c] bg-[#181a22] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-[#2b2e38] px-5 py-4 bg-[#1c1f28]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>構成テンプレートを選択</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  ジャンルごとの王道構成（起承転結、三幕構成、マダミスなど）からすぐに執筆を開始できます。
                </p>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="rounded p-1 text-gray-400 hover:text-white hover:bg-[#2a2e3a]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {STORY_TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => handleOpenNewFromTemplate(tpl)}
                  className="group rounded-lg border border-[#2e3342] bg-[#1c202a] p-4 hover:border-indigo-500 hover:bg-[#222735] cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="rounded bg-indigo-950/80 border border-indigo-700/60 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                        {tpl.badge}
                      </span>
                      <h4 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                        {tpl.name}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-lg">
                      {tpl.description}
                    </p>
                  </div>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenNewFromTemplate(tpl);
                    }}
                    className="shrink-0 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white group-hover:bg-indigo-500 transition-colors shadow"
                  >
                    この構成で開始
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-[#2b2e38] px-5 py-3 bg-[#161820] flex justify-end">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="rounded border border-[#373c49] bg-[#22252f] px-4 py-1.5 text-xs text-gray-300 hover:bg-[#2b303d]"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StoryAuthoring;
