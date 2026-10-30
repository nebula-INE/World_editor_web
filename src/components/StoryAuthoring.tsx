import React, { useRef, useState, useMemo, useEffect } from 'react';
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
  ArrowRight,
  Maximize2,
  Minimize2,
  Printer,
  Clock,
  BarChart2,
  AlertTriangle,
  AlertOctagon,
  Info,
  ShieldAlert,
  LayoutGrid,
  Share2
} from 'lucide-react';
import { getLayerColor } from '../core/layers';
import { getPovColor } from '../core/pov';
import { SceneCorkboard } from './SceneCorkboard';
import { RelationshipGraphModal } from './RelationshipGraphModal';
import { ForeshadowingDrawer } from './ForeshadowingDrawer';
import { EntityHoverCard } from './EntityHoverCard';
import {
  DEFAULT_FORESHADOWING_ITEMS,
  type ForeshadowingItem
} from '../core/foreshadowing';
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
import {
  formatAsStandardScreenplay,
  formatAsNovelText,
  exportStoryAsCsv,
  triggerFileDownload
} from '../core/story-export';
import { lintScriptConsistency, type ScriptLintIssue } from '../core/script-linter';
import { ScriptAnalyticsModal } from './ScriptAnalyticsModal';
import { WorldBibleModal } from './WorldBibleModal';
import type { WorldModel } from '../core/models';
import type { WorldState, WorldStateEngine } from '../core/world_state';
import type { Event as WorldEvent } from '../core/events';

interface StoryAuthoringProps {
  onClose: () => void;
  worldModel?: WorldModel | WorldState;
  engine?: WorldStateEngine | null;
  events?: WorldEvent[];
  allLayers?: string[];
  onAddEntityToWorld?: (entityName: string, layer?: string) => void;
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
  engine,
  events = [],
  allLayers = ['Su-ken', 'Kan-ken', 'An-ken', 'Ki-ken'],
  onAddEntityToWorld
}) => {
  // Story State: Default with 3-act or blank
  const [story, setStory] = useState<AxralStoryV1>(() => {
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

  // View Mode: 'editor' (linear block editor) | 'corkboard' (Scrivener-style card board)
  const [viewMode, setViewMode] = useState<'editor' | 'corkboard'>('editor');

  // Zen Mode (Focus Mode) state
  const [isZenMode, setIsZenMode] = useState(false);

  // Modals & Drawers state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isWorldBibleOpen, setIsWorldBibleOpen] = useState(false);
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isForeshadowingDrawerOpen, setIsForeshadowingDrawerOpen] = useState(false);
  const [initialFocusedEntity, setInitialFocusedEntity] = useState<string | null>(null);
  const [selectedIssueBlockId, setSelectedIssueBlockId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Foreshadowing items state (persisted)
  const [foreshadowingItems, setForeshadowingItems] = useState<ForeshadowingItem[]>(() => {
    try {
      const saved = localStorage.getItem('axral_foreshadowing_items');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FORESHADOWING_ITEMS.map((item, idx) => ({
      ...item,
      setupSceneId: story.chapters[0]?.scenes[idx % (story.chapters[0]?.scenes.length || 1)]?.id || ''
    }));
  });

  const handleUpdateForeshadowingItems = (items: ForeshadowingItem[]) => {
    setForeshadowingItems(items);
    localStorage.setItem('axral_foreshadowing_items', JSON.stringify(items));
  };

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<string>('台本エディタが準備完了しました。');

  // Handle escape key to exit Zen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZenMode) {
        setIsZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode]);

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

  // Real-time Script Inconsistency Linter (timeline & layer cross-verification)
  const scriptIssues = useMemo(() => {
    return lintScriptConsistency({
      story,
      worldModel: worldModel || { entities: {}, relations: {} } as any,
      engine: engine ?? null,
      allLayers
    });
  }, [story, worldModel, engine, allLayers]);

  const issuesByBlockId = useMemo(() => {
    const map = new Map<string, ScriptLintIssue[]>();
    scriptIssues.forEach(iss => {
      const list = map.get(iss.blockId) || [];
      list.push(iss);
      map.set(iss.blockId, list);
    });
    return map;
  }, [scriptIssues]);

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
      triggerFileDownload(storyFilename(story.title), serialized, 'application/json;charset=utf-8');
      savedSnapshot.current = serialized;
      setStatusMessage('物語ファイル（.axral-story.json）を書き出しました。');
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCopyText = async (text: string, typeKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(typeKey);
      setTimeout(() => setCopiedType(null), 2000);
      setStatusMessage('クリップボードにコピーしました。');
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
      <header className="flex h-14 items-center justify-between border-b border-[#2B2E36] bg-[#16181D] px-4 shrink-0">
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
              className="w-40 sm:w-56 md:w-64 rounded border border-[#343842] bg-[#1d2027] px-2.5 py-1 text-sm font-medium text-white focus:border-indigo-500 focus:outline-none"
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

        {/* Center: View Mode Switcher & Quick Stats */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 bg-[#1a1d24] border border-[#2d323e] rounded p-0.5">
            <button
              onClick={() => setViewMode('editor')}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                viewMode === 'editor'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="ブロック編集エディタ"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>エディタ</span>
            </button>
            <button
              onClick={() => setViewMode('corkboard')}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                viewMode === 'corkboard'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Scrivener風のシーンカード一覧・あらすじ編集コルクボード"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>コルクボード</span>
            </button>
          </div>

          {!isZenMode && (
            <div className="hidden 2xl:flex items-center space-x-4 text-xs text-gray-400">
              <span>文字数: <strong className="text-gray-200 font-mono">{stats.charCount.toLocaleString()}</strong> 字</span>
              <span>章: <strong className="text-gray-200 font-mono">{stats.chapterCount}</strong></span>
              <span>シーン: <strong className="text-gray-200 font-mono">{stats.sceneCount}</strong></span>
              <span>セリフ: <strong className="text-gray-200 font-mono">{stats.dialogueCount}</strong></span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Foreshadowing Plot Flag Drawer Button */}
          <button
            onClick={() => setIsForeshadowingDrawerOpen(true)}
            className="flex items-center space-x-1.5 rounded border border-amber-700/60 bg-amber-950/60 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-900/60 transition-colors"
            title="伏線・プロットフラグの仕込みと回収を管理"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden md:inline">伏線フラグ</span>
            <span className="font-mono text-[10px] bg-amber-900/80 px-1.5 py-0.2 rounded text-amber-200">
              {foreshadowingItems.filter(f => f.status === 'open').length}
            </span>
          </button>

          {/* Dynamic Relationship Web Button */}
          <button
            onClick={() => setIsRelationshipModalOpen(true)}
            className="flex items-center space-x-1.5 rounded border border-cyan-700/60 bg-cyan-950/60 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-900/60 transition-colors"
            title="時間軸と連動する人物・勢力ダイナミック相関図を表示"
          >
            <Share2 className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden md:inline">動的相関図</span>
          </button>

          {/* Real-time Inconsistency Linter Indicator */}
          {scriptIssues.length > 0 && (
            <div
              className="hidden lg:flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-600/70 text-amber-300 text-xs font-semibold cursor-pointer"
              title={`世界観・設定との不整合が${scriptIssues.length}件検知されています（各ブロックの警告バッジで解消可能）`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span>設定警告: {scriptIssues.length}件</span>
            </div>
          )}

          {/* Analytics Dashboard Button */}
          <button
            onClick={() => setIsAnalyticsOpen(true)}
            className="flex items-center space-x-1.5 rounded border border-indigo-700/60 bg-indigo-950/60 px-2.5 py-1 text-xs font-medium text-indigo-200 hover:bg-indigo-900/60 transition-colors"
            title="文字数比率、セリフシェア、シーン登場マトリクスを表示"
          >
            <BarChart2 className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden md:inline">執筆統計</span>
          </button>

          {/* World Bible Wiki Modal Button */}
          <button
            onClick={() => setIsWorldBibleOpen(true)}
            className="flex items-center space-x-1.5 rounded border border-cyan-700/60 bg-cyan-950/60 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-900/60 transition-colors"
            title="世界観・名鑑・年表の設定資料集（Wiki形式）を閲覧・エクスポート"
          >
            <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden md:inline">設定資料集</span>
          </button>

          {/* Zen Mode Toggle */}
          <button
            onClick={() => setIsZenMode(prev => !prev)}
            className={`flex items-center space-x-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              isZenMode
                ? 'bg-amber-600 text-white shadow'
                : 'border border-[#343842] bg-[#22252c] text-gray-300 hover:bg-[#2c3039]'
            }`}
            title={isZenMode ? "通常表示に戻る (Esc)" : "執筆集中モード（余白を広げ集中執筆）"}
          >
            {isZenMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isZenMode ? '集中解除' : '集中モード'}</span>
          </button>

          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 rounded border border-indigo-700/60 bg-indigo-950/60 px-2.5 py-1 text-xs font-medium text-indigo-200 hover:bg-indigo-900/60 transition-colors"
            title="起承転結・三幕構成・マダミス等のテンプレートから選ぶ"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>構成テンプレ</span>
          </button>

          <button
            onClick={handleOpenFile}
            className="hidden sm:flex items-center space-x-1 rounded border border-[#343842] bg-[#22252c] px-2.5 py-1 text-xs text-gray-300 hover:bg-[#2c3039]"
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

          {/* Export Modal Launcher */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center space-x-1 rounded border border-amber-700/60 bg-amber-950/50 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-900/60"
            title="台本清書・小説・CSV・印刷など各種エクスポート"
          >
            <Download className="h-3.5 w-3.5 text-amber-400" />
            <span>エクスポート</span>
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

      {/* Main Studio Workspace: 3 Columns (or 1 wide column in Zen mode) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ========================================================= */}
        {/* Left Column: Chapters & Scenes Navigation (260px)         */}
        {/* ========================================================= */}
        {!isZenMode && (
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
                          title="章を上へ"
                          disabled={cIdx === 0}
                          onClick={() => mutateStory(s => reorderChapter(s, chap.id, cIdx - 1))}
                          className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-[#2b2f3a] disabled:opacity-20"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          title="章を下へ"
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
                        const povChar = (sc as any).pov_character_id || '三人称客観';
                        const povStyle = getPovColor(povChar);

                        return (
                          <div
                            key={sc.id}
                            onClick={() => {
                              setSelectedChapterId(chap.id);
                              setSelectedSceneId(sc.id);
                            }}
                            style={{
                              borderLeft: `3px solid ${povStyle.color}`
                            }}
                            className={`group flex items-center justify-between rounded-r px-2 py-1.5 cursor-pointer text-xs transition-colors ${
                              isScActive
                                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                                : 'text-gray-300 hover:bg-[#232731]'
                            }`}
                          >
                            <div className="min-w-0 flex-1 truncate pr-1">
                              <span className="opacity-70 mr-1.5 font-mono">{sIdx + 1}.</span>
                              <span>{sc.title || '（無題のシーン）'}</span>
                              {povChar !== '三人称客観' && (
                                <span
                                  className="ml-1.5 text-[9px] px-1 py-0.2 rounded font-medium"
                                  style={{
                                    backgroundColor: isScActive ? 'rgba(255,255,255,0.2)' : povStyle.badgeBg,
                                    color: isScActive ? '#fff' : povStyle.textCol
                                  }}
                                >
                                  {povChar}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              <span className={`text-[10px] font-mono mr-1 ${isScActive ? 'text-indigo-200' : 'text-gray-500'}`}>
                                {scCharCount}字
                              </span>

                              {/* Scene Reorder buttons */}
                              <button
                                title="シーンを上へ"
                                disabled={sIdx === 0}
                                onClick={e => {
                                  e.stopPropagation();
                                  mutateStory(s => reorderScene(s, sc.id, sIdx - 1));
                                }}
                                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-white disabled:opacity-0"
                              >
                                <ChevronUp className="h-2.5 w-2.5" />
                              </button>
                              <button
                                title="シーンを下へ"
                                disabled={sIdx === chap.scenes.length - 1}
                                onClick={e => {
                                  e.stopPropagation();
                                  mutateStory(s => reorderScene(s, sc.id, sIdx + 1));
                                }}
                                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-white disabled:opacity-0"
                              >
                                <ChevronDown className="h-2.5 w-2.5" />
                              </button>

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
        )}

        {/* ========================================================= */}
        {/* Center Column: Block Editor & Production Palette (flex-1) */}
        {/* ========================================================= */}
        <main className={`flex-1 min-w-0 flex flex-col bg-[#111317] ${isZenMode ? 'max-w-4xl mx-auto w-full border-x border-[#2B2E36]' : ''}`}>
          {viewMode === 'corkboard' ? (
            <SceneCorkboard
              story={story}
              selectedChapterId={selectedChapterId}
              selectedSceneId={selectedSceneId}
              onSelectScene={(scId) => setSelectedSceneId(scId)}
              onOpenSceneInEditor={(scId) => {
                setSelectedSceneId(scId);
                setViewMode('editor');
              }}
              onAddScene={(chapId) => {
                const newScId = uid();
                mutateStory(s => addScene(s, chapId, newScId, `シーン ${currentChapter?.scenes.length ? currentChapter.scenes.length + 1 : 1}`));
                setSelectedSceneId(newScId);
              }}
              onDeleteScene={(scId) => {
                mutateStory(s => deleteScene(s, scId));
                if (selectedSceneId === scId) setSelectedSceneId(null);
              }}
              onReorderScene={(scId, toIdx) => {
                mutateStory(s => reorderScene(s, scId, toIdx));
              }}
              onUpdateSceneTitle={(scId, title) => {
                mutateStory(s => renameScene(s, scId, title));
              }}
              onUpdateSceneSynopsis={(scId, synopsis) => {
                mutateStory(s => ({
                  ...s,
                  chapters: s.chapters.map(c => ({
                    ...c,
                    scenes: c.scenes.map(sc => sc.id === scId ? { ...sc, synopsis } : sc)
                  }))
                }));
              }}
              onUpdateScenePov={(scId, pov) => {
                mutateStory(s => ({
                  ...s,
                  chapters: s.chapters.map(c => ({
                    ...c,
                    scenes: c.scenes.map(sc => sc.id === scId ? { ...sc, pov_character_id: pov } : sc)
                  }))
                }));
              }}
              allCharacters={knownCharacters}
              foreshadowingItems={foreshadowingItems}
              allLayers={allLayers}
            />
          ) : currentScene ? (
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
                      className="rounded border border-[#343842] bg-[#1e222b] px-2.5 py-1 text-sm font-semibold text-white focus:border-indigo-500 focus:outline-none flex-1 max-w-sm"
                    />

                    {/* Scene Timestamp ($t$) input */}
                    <div className="flex items-center space-x-1 bg-[#1d2028] border border-[#353945] rounded px-2 py-1 text-xs">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span className="text-[11px] text-gray-400 font-mono">t =</span>
                      <input
                        type="number"
                        value={(currentScene as any).timestamp ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          mutateStory(s => ({
                            ...s,
                            chapters: s.chapters.map(c => c.id !== currentChapter.id ? c : {
                              ...c,
                              scenes: c.scenes.map(sc => sc.id !== currentScene.id ? sc : {
                                ...sc,
                                timestamp: val === '' ? undefined : Number(val)
                              })
                            })
                          }));
                        }}
                        placeholder="0"
                        className="w-12 bg-transparent text-white font-mono text-xs outline-none"
                        title="このシーンが発生するタイムライン時刻 (t) を設定"
                      />
                    </div>

                    {/* Scene POV (Point of View) Selector */}
                    <div className="flex items-center space-x-1.5 bg-[#1d2028] border border-[#353945] rounded px-2 py-1 text-xs">
                      <User className="w-3 h-3 text-cyan-400" />
                      <span className="text-[11px] text-gray-400">視点:</span>
                      <select
                        value={(currentScene as any).pov_character_id || '三人称客観'}
                        onChange={e => {
                          const povVal = e.target.value;
                          mutateStory(s => ({
                            ...s,
                            chapters: s.chapters.map(c => c.id !== currentChapter.id ? c : {
                              ...c,
                              scenes: c.scenes.map(sc => sc.id !== currentScene.id ? sc : {
                                ...sc,
                                pov_character_id: povVal
                              })
                            })
                          }));
                        }}
                        className="bg-transparent text-cyan-300 font-medium text-xs outline-none cursor-pointer"
                        title="このシーンを描写する視点（POV）キャラクターを設定"
                      >
                        <option value="三人称客観" className="bg-[#181b22] text-gray-300">三人称客観</option>
                        {knownCharacters.map(name => (
                          <option key={name} value={name} className="bg-[#181b22] text-gray-300">{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Character Speaker Quick Palette with Layer Filtering */}
                  {charactersWithLayer.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                      <div className="flex items-center space-x-1 shrink-0">
                        <User className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="hidden sm:inline font-medium text-gray-300">話者:</span>
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
                    <span>＋ 柱</span>
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
                    <span>＋ 台詞</span>
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
                  const isSlugline = blk.type === 'direction' && blk.text.trim().startsWith('〇');
                  const isAudioCue = blk.type === 'direction' && (blk.text.includes('【SE:') || blk.text.includes('【BGM:'));
                  const speaker = blk.character_id;
                  const isKnownSpeaker = speaker ? knownCharacters.includes(speaker) : true;
                  const blockIssues = issuesByBlockId.get(blk.id) || [];
                  const hasError = blockIssues.some(i => i.severity === 'error');
                  const hasWarning = blockIssues.some(i => i.severity === 'warning');

                  return (
                    <article
                      key={blk.id}
                      className={`group rounded-lg border p-3 transition-all ${
                        hasError
                          ? 'border-rose-600/80 bg-[#1a1419] shadow-sm ring-1 ring-rose-500/30'
                          : hasWarning
                          ? 'border-amber-600/70 bg-[#191815]'
                          : isSlugline
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
                            <div className="flex items-center space-x-1.5">
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

                              {/* Hover Inspector for Registered Character */}
                              {speaker && isKnownSpeaker && (
                                <EntityHoverCard
                                  entityName={speaker}
                                  worldModel={worldModel}
                                  onOpenWiki={(n) => {
                                    setInitialFocusedEntity(n);
                                    setIsWorldBibleOpen(true);
                                  }}
                                  onOpenGraph={(n) => {
                                    setInitialFocusedEntity(n);
                                    setIsRelationshipModalOpen(true);
                                  }}
                                >
                                  <span className="text-[10px] text-cyan-400 cursor-pointer hover:underline font-mono px-1">
                                    [設定確認]
                                  </span>
                                </EntityHoverCard>
                              )}

                              {/* One-Click WorldCode Registration for Unregistered Characters */}
                              {speaker && !isKnownSpeaker && onAddEntityToWorld && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onAddEntityToWorld(speaker, 'Su-ken');
                                    setStatusMessage(`世界設定に [${speaker}:Character] を追加しました。`);
                                  }}
                                  className="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-600/70 text-emerald-300 hover:bg-emerald-900 text-[10px] transition-colors"
                                  title="このキャラクターを世界観（WorldCode）に登録"
                                >
                                  <Plus className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>世界観に登録</span>
                                </button>
                              )}
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
                            title="ルビ構文 |漢字《かんじ》 を挿入"
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

                      {/* Real-time Inconsistency Linter Banner */}
                      {blockIssues.length > 0 && (
                        <div className="space-y-1.5 mb-2.5">
                          {blockIssues.map(iss => (
                            <div
                              key={iss.id}
                              className={`p-2.5 rounded border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                iss.severity === 'error'
                                  ? 'border-rose-700/70 bg-rose-950/40 text-rose-200'
                                  : 'border-amber-700/70 bg-amber-950/40 text-amber-200'
                              }`}
                            >
                              <div className="flex items-start space-x-2">
                                {iss.severity === 'error' ? (
                                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <div className="font-bold flex items-center gap-1.5 text-xs">
                                    <span>{iss.title}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                      iss.severity === 'error' ? 'bg-rose-900/60 text-rose-200' : 'bg-amber-900/60 text-amber-200'
                                    }`}>
                                      {iss.severity === 'error' ? '設定矛盾' : '校正警告'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] opacity-90 mt-0.5">{iss.message}</p>
                                </div>
                              </div>

                              {iss.suggestedAction && (() => {
                                const action = iss.suggestedAction;
                                return (
                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    {action.type === 'add_entity' && onAddEntityToWorld && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onAddEntityToWorld(action.targetName!, action.targetLayer || 'Su-ken');
                                          setStatusMessage(`世界設定に [${action.targetName!}:Character] を追加しました。`);
                                        }}
                                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow transition-colors"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>{action.label}</span>
                                      </button>
                                    )}
                                    {action.type === 'sync_layer' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          mutateStory(s => ({
                                            ...s,
                                            chapters: s.chapters.map(c => c.id !== currentChapter.id ? c : {
                                              ...c,
                                              scenes: c.scenes.map(sc => sc.id !== currentScene.id ? sc : {
                                                ...sc,
                                                layer: action.targetLayer
                                              })
                                            })
                                          }));
                                          setStatusMessage(`シーンの舞台レイヤーを【${action.targetLayer}】に同期しました。`);
                                        }}
                                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow transition-colors"
                                      >
                                        <span>舞台レイヤーを同期</span>
                                      </button>
                                    )}
                                    {action.type === 'sync_timestamp' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          mutateStory(s => ({
                                            ...s,
                                            chapters: s.chapters.map(c => c.id !== currentChapter.id ? c : {
                                              ...c,
                                              scenes: c.scenes.map(sc => sc.id !== currentScene.id ? sc : {
                                                ...sc,
                                                timestamp: action.targetTimestamp ?? 0
                                              })
                                            })
                                          }));
                                          setStatusMessage(`シーン時点を t=${action.targetTimestamp ?? 0} に同期しました。`);
                                        }}
                                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow transition-colors"
                                      >
                                        <span>時点を t={action.targetTimestamp ?? 0} に同期</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      )}

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
                        className="w-full rounded border border-[#2e3340] bg-[#111318] p-2.5 text-sm leading-relaxed text-gray-100 focus:border-indigo-500 focus:outline-none resize-y font-sans"
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
        {!isZenMode && (
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
                      onClick={() => handleCopyText(formatAsStandardScreenplay(story), 'screenplay')}
                      className="flex items-center space-x-1 rounded bg-[#212530] border border-[#343846] px-2 py-0.5 text-[11px] text-gray-200 hover:bg-[#2b303d]"
                    >
                      {copiedType === 'screenplay' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-indigo-400" />}
                      <span>{copiedType === 'screenplay' ? '完了' : 'コピー'}</span>
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

                      {ch.scenes.map(sc => {
                        const timeStr = typeof (sc as any).timestamp === 'number' ? ` (t=${(sc as any).timestamp})` : '';
                        return (
                          <div key={sc.id} className="space-y-2">
                            <div className="text-gray-400 font-bold border-l-2 border-indigo-500 pl-2">
                              ▼ {sc.title}{timeStr}
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
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 2: Vertical Novel View (writing-mode: vertical-rl) */}
              {previewTab === 'vertical' && (
                <div className="h-full flex flex-col">
                  <div className="pb-2 border-b border-[#232731] text-[11px] text-gray-400 mb-2 flex items-center justify-between">
                    <span>小説・ライトノベル縦書きプレビュー（ルビ対応）</span>
                    <button
                      onClick={() => handleCopyText(formatAsNovelText(story), 'novel')}
                      className="flex items-center space-x-1 rounded bg-[#212530] border border-[#343846] px-2 py-0.5 text-[11px] text-gray-200 hover:bg-[#2b303d]"
                    >
                      {copiedType === 'novel' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-emerald-400" />}
                      <span>{copiedType === 'novel' ? '完了' : '原稿コピー'}</span>
                    </button>
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
                                    onAddEntityToWorld(charItem.characterName, 'Su-ken');
                                    setStatusMessage(`世界設定に [${charItem.characterName}:Character] を追加しました。`);
                                  }}
                                  className="flex items-center space-x-1 rounded bg-indigo-900/60 border border-indigo-600 px-2.5 py-1 text-[11px] text-indigo-200 hover:bg-indigo-800 transition-colors"
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
        )}
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
      {/* Universal Export Modal                                    */}
      {/* ========================================================= */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-[#383d4c] bg-[#181a22] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2b2e38] px-5 py-4 bg-[#1c1f28]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Download className="h-4 w-4 text-amber-400" />
                  <span>台本・シナリオのエクスポート</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  日本標準脚本フォーマット、小説原稿、ゲームデータ（CSV）、印刷用PDFなど用途に合わせて出力できます。
                </p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="rounded p-1 text-gray-400 hover:text-white hover:bg-[#2a2e3a]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              {/* Option 1: Standard Japanese Screenplay Text */}
              <div className="p-3.5 bg-[#14161C] border border-[#2B2F3A] rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-gray-100 flex items-center space-x-1.5">
                    <Film className="w-4 h-4 text-indigo-400" />
                    <span>標準脚本テキスト（柱・ト書き3字下げ・セリフ）</span>
                  </div>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    映画・アニメ・舞台・ボイスドラマ業界標準の清書フォーマットです。
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleCopyText(formatAsStandardScreenplay(story), 'export-screenplay')}
                    className="px-2.5 py-1.5 bg-[#252A36] hover:bg-[#303646] text-gray-200 rounded border border-[#3B4254] font-medium"
                  >
                    {copiedType === 'export-screenplay' ? '完了' : 'コピー'}
                  </button>
                  <button
                    onClick={() => triggerFileDownload(`${story.title || 'シナリオ'}_標準台本.txt`, formatAsStandardScreenplay(story))}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium shadow"
                  >
                    .txt 保存
                  </button>
                </div>
              </div>

              {/* Option 2: Novel Manuscript Text */}
              <div className="p-3.5 bg-[#14161C] border border-[#2B2F3A] rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-gray-100 flex items-center space-x-1.5">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>小説・縦書き原稿テキスト</span>
                  </div>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    地の文1字下げ、かぎ括弧会話文、章立てを整理した小説用フォーマットです。
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleCopyText(formatAsNovelText(story), 'export-novel')}
                    className="px-2.5 py-1.5 bg-[#252A36] hover:bg-[#303646] text-gray-200 rounded border border-[#3B4254] font-medium"
                  >
                    {copiedType === 'export-novel' ? '完了' : 'コピー'}
                  </button>
                  <button
                    onClick={() => triggerFileDownload(`${story.title || 'シナリオ'}_小説原稿.txt`, formatAsNovelText(story))}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium shadow"
                  >
                    .txt 保存
                  </button>
                </div>
              </div>

              {/* Option 3: Game Scenario & Voice Recording CSV */}
              <div className="p-3.5 bg-[#14161C] border border-[#2B2F3A] rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-gray-100 flex items-center space-x-1.5">
                    <Split className="w-4 h-4 text-purple-400" />
                    <span>ゲームシナリオ・台詞収録用 CSV</span>
                  </div>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    章、シーン、順序、種別、話者、本文、タイムスタンプをスプレッドシート等で一元管理できます。
                  </p>
                </div>
                <button
                  onClick={() => triggerFileDownload(`${story.title || 'シナリオ'}_収録リスト.csv`, exportStoryAsCsv(story), 'text/csv;charset=utf-8')}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium shadow shrink-0"
                >
                  .csv 保存
                </button>
              </div>

              {/* Option 4: Browser Print / PDF */}
              <div className="p-3.5 bg-[#14161C] border border-[#2B2F3A] rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-gray-100 flex items-center space-x-1.5">
                    <Printer className="w-4 h-4 text-sky-400" />
                    <span>印刷 / PDF出力</span>
                  </div>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    ブラウザの印刷ダイアログを呼び出し、「PDFとして保存」または用紙印刷ができます。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPreviewTab('screenplay');
                    setTimeout(() => window.print(), 200);
                  }}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium shadow shrink-0"
                >
                  印刷 / PDF
                </button>
              </div>
            </div>

            <div className="border-t border-[#2b2e38] px-5 py-3 bg-[#161820] flex justify-end">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="rounded border border-[#373c49] bg-[#22252f] px-4 py-1.5 text-xs text-gray-300 hover:bg-[#2b303d]"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Script & Cast Analytics Dashboard Modal */}
      {isAnalyticsOpen && (
        <ScriptAnalyticsModal
          story={story}
          onClose={() => setIsAnalyticsOpen(false)}
        />
      )}

      {/* World Bible Compendium Wiki Modal */}
      {isWorldBibleOpen && (
        <WorldBibleModal
          worldModel={worldModel || { entities: {}, relations: {} } as any}
          story={story}
          events={events}
          allLayers={allLayers}
          onClose={() => setIsWorldBibleOpen(false)}
        />
      )}

      {/* Dynamic Relationship & Faction Web Graph Modal */}
      {isRelationshipModalOpen && (
        <RelationshipGraphModal
          isOpen={isRelationshipModalOpen}
          onClose={() => setIsRelationshipModalOpen(false)}
          worldModel={worldModel || { entities: {}, relations: {} } as any}
          engine={engine}
          currentTimestamp={typeof (currentScene as any)?.timestamp === 'number' ? (currentScene as any).timestamp : 0}
          initialFocusedEntity={initialFocusedEntity}
          onOpenWiki={(name) => {
            setInitialFocusedEntity(name);
            setIsWorldBibleOpen(true);
          }}
        />
      )}

      {/* Foreshadowing & Plot Flag Tracker Drawer */}
      {isForeshadowingDrawerOpen && (
        <ForeshadowingDrawer
          isOpen={isForeshadowingDrawerOpen}
          onClose={() => setIsForeshadowingDrawerOpen(false)}
          story={story}
          items={foreshadowingItems}
          onUpdateItems={handleUpdateForeshadowingItems}
          onSelectScene={(scId) => {
            for (const ch of story.chapters) {
              if (ch.scenes.some(s => s.id === scId)) {
                setSelectedChapterId(ch.id);
                setSelectedSceneId(scId);
                break;
              }
            }
          }}
        />
      )}
    </div>
  );
};
export default StoryAuthoring;
