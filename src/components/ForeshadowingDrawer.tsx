import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bookmark,
  Trash2,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';
import type {
  ForeshadowingItem,
  ForeshadowingStatus,
  ForeshadowingImportance,
  ForeshadowingFinding
} from '../core/foreshadowing';
import {
  validateForeshadowing,
  calculateForeshadowingStats
} from '../core/foreshadowing';
import type { AxralStoryV1 } from '../core/story';

interface ForeshadowingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  story: AxralStoryV1;
  items: ForeshadowingItem[];
  onUpdateItems: (items: ForeshadowingItem[]) => void;
  onSelectScene: (sceneId: string) => void;
}

export const ForeshadowingDrawer: React.FC<ForeshadowingDrawerProps> = ({
  isOpen,
  onClose,
  story,
  items,
  onUpdateItems,
  onSelectScene
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);

  // Form state for adding new item
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImportance, setNewImportance] = useState<ForeshadowingImportance>('major');
  const [newSetupSceneId, setNewSetupSceneId] = useState('');
  const [newPayoffSceneId, setNewPayoffSceneId] = useState('');

  // Extract all scenes for dropdown selection
  const allScenes = useMemo(() => {
    const list: { id: string; title: string; chapterTitle: string }[] = [];
    story.chapters.forEach(ch => {
      ch.scenes.forEach(sc => {
        list.push({ id: sc.id, title: sc.title, chapterTitle: ch.title });
      });
    });
    return list;
  }, [story]);

  // Validation findings
  const findings = useMemo(() => {
    return validateForeshadowing(items, story);
  }, [items, story]);

  // Statistics
  const stats = useMemo(() => {
    return calculateForeshadowingStats(items);
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filterStatus === 'all') return items;
    return items.filter(i => i.status === filterStatus);
  }, [items, filterStatus]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: ForeshadowingItem = {
      id: `fsh_${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      status: 'open',
      importance: newImportance,
      setupSceneId: newSetupSceneId || (allScenes[0]?.id ?? ''),
      payoffSceneId: newPayoffSceneId || undefined
    };

    onUpdateItems([...items, newItem]);
    setNewTitle('');
    setNewDescription('');
    setIsAdding(false);
  };

  const handleStatusChange = (id: string, nextStatus: ForeshadowingStatus) => {
    onUpdateItems(
      items.map(item => (item.id === id ? { ...item, status: nextStatus } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    onUpdateItems(items.filter(item => item.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-neutral-900 border-l border-neutral-800 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold text-neutral-100">伏線・プロットフラグ管理</h2>
              <p className="text-xs text-neutral-400">
                仕込みシーンと回収シーンの時系列連動・未回収警告
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="px-6 py-3 bg-neutral-950/40 border-b border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 tabular-nums">
            <span className="text-neutral-300">
              総数: <strong className="font-semibold">{stats.total}</strong>
            </span>
            <span className="text-amber-400">
              未回収: <strong className="font-semibold">{stats.open}</strong>
            </span>
            <span className="text-cyan-400">
              示唆中: <strong className="font-semibold">{stats.hinted}</strong>
            </span>
            <span className="text-emerald-400">
              回収済: <strong className="font-semibold">{stats.resolved}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">回収率:</span>
            <span className="font-mono font-bold text-cyan-400 text-sm tabular-nums">
              {stats.resolutionRate}%
            </span>
          </div>
        </div>

        {/* Consistency Findings Warnings (if any) */}
        {findings.length > 0 && (
          <div className="px-6 py-2.5 bg-rose-950/20 border-b border-rose-900/40 space-y-1.5">
            {findings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{f.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters and Add button */}
        <div className="px-6 py-3 border-b border-neutral-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-lg text-xs">
            {(['all', 'open', 'hinted', 'resolved'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterStatus === st
                    ? 'bg-neutral-800 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {st === 'all' && 'すべて'}
                {st === 'open' && '未回収'}
                {st === 'hinted' && '示唆中'}
                {st === 'resolved' && '回収済'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>伏線を追加</span>
          </button>
        </div>

        {/* Add Item Form (Conditional) */}
        {isAdding && (
          <form
            onSubmit={handleAddItem}
            className="p-4 mx-6 my-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-150"
          >
            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                伏線タイトル *
              </label>
              <input
                type="text"
                required
                placeholder="例: 古文書の隠し部屋の鍵"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                説明・仕掛けの内容
              </label>
              <textarea
                rows={2}
                placeholder="読者・観客に提示する謎や情報..."
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">仕込みシーン</label>
                <select
                  value={newSetupSceneId}
                  onChange={e => setNewSetupSceneId(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 outline-none"
                >
                  <option value="">シーンを選択...</option>
                  {allScenes.map(sc => (
                    <option key={sc.id} value={sc.id}>
                      {sc.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">回収予定シーン</label>
                <select
                  value={newPayoffSceneId}
                  onChange={e => setNewPayoffSceneId(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 outline-none"
                >
                  <option value="">未定 / 随時</option>
                  {allScenes.map(sc => (
                    <option key={sc.id} value={sc.id}>
                      {sc.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1 text-xs text-neutral-400 hover:text-white"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition-colors"
              >
                保存する
              </button>
            </div>
          </form>
        )}

        {/* List of items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs">
              該当する伏線・フラグはありません。
            </div>
          ) : (
            filteredItems.map(item => {
              const setupScene = allScenes.find(s => s.id === item.setupSceneId);
              const payoffScene = allScenes.find(s => s.id === item.payoffSceneId);

              return (
                <div
                  key={item.id}
                  className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-lg space-y-2.5 transition-colors hover:border-neutral-700"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-200 text-sm">
                          {item.title}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            item.importance === 'major'
                              ? 'bg-rose-950/50 text-rose-300 border border-rose-800/40'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {item.importance === 'major' ? '本筋・重要' : '小ネタ・布石'}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      title="削除"
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Scene Links */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 pt-1">
                    {setupScene && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectScene(setupScene.id);
                          onClose();
                        }}
                        className="flex items-center gap-1 hover:text-cyan-300 transition-colors"
                      >
                        <span className="text-amber-400">仕込み:</span>
                        <span className="underline">{setupScene.title}</span>
                      </button>
                    )}

                    <span aria-hidden="true">→</span>

                    {payoffScene ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectScene(payoffScene.id);
                          onClose();
                        }}
                        className="flex items-center gap-1 hover:text-cyan-300 transition-colors"
                      >
                        <span className="text-emerald-400">回収:</span>
                        <span className="underline">{payoffScene.title}</span>
                      </button>
                    ) : (
                      <span className="text-neutral-500 italic">回収シーン未設定</span>
                    )}
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-900 text-xs">
                    <span className="text-[11px] text-neutral-400">進行状態:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'open')}
                        className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                          item.status === 'open'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        未回収
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'hinted')}
                        className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                          item.status === 'hinted'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        示唆中
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'resolved')}
                        className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                          item.status === 'resolved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        回収完了
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
