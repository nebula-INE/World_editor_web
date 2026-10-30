/**
 * Foreshadowing & Plot Flag Tracking Engine for Axral Story
 */
import type { AxralStoryV1 } from './story';

export type ForeshadowingStatus = 'open' | 'hinted' | 'resolved';
export type ForeshadowingImportance = 'major' | 'minor' | 'clue';

export interface ForeshadowingItem {
  id: string;
  title: string;
  description: string;
  status: ForeshadowingStatus;
  importance: ForeshadowingImportance;
  setupSceneId: string;
  payoffSceneId?: string | null;
  notes?: string;
  category?: string;
}

export interface ForeshadowingFinding {
  id: string;
  type: 'order_error' | 'unresolved_climax' | 'missing_scene' | 'orphan_payoff';
  severity: 'error' | 'warning' | 'info';
  message: string;
  setupSceneTitle?: string;
  payoffSceneTitle?: string;
}

export interface ForeshadowingStats {
  total: number;
  open: number;
  hinted: number;
  resolved: number;
  resolutionRate: number; // 0 - 100
  majorCount: number;
  minorCount: number;
}

export const DEFAULT_FORESHADOWING_ITEMS: ForeshadowingItem[] = [
  {
    id: 'fsh_01',
    title: '水晶のペンダントの謎の共鳴',
    description: '第1幕で主人公が譲り受けたペンダントが、異界の境界線で突然青く微光を放つ。',
    status: 'hinted',
    importance: 'major',
    setupSceneId: '', // will link dynamically to scene 0 or 1
    payoffSceneId: '',
    category: 'アイテム・遺物',
    notes: '終盤の次元崩壊阻止の鍵となる伏線'
  },
  {
    id: 'fsh_02',
    title: '教団記録文書の欠落ページ',
    description: 'Bobが書庫で発見した古い日誌から、第3代総長の失踪理由が削り取られている。',
    status: 'open',
    importance: 'major',
    setupSceneId: '',
    payoffSceneId: '',
    category: '歴史の真相',
    notes: '総長が生きて異界に渡っていた証拠'
  },
  {
    id: 'fsh_03',
    title: '夜霧に漂う特異な香草の匂い',
    description: '事件前夜に現場周辺で漂っていた珍しい薬草の香り。',
    status: 'resolved',
    importance: 'clue',
    setupSceneId: '',
    payoffSceneId: '',
    category: '手がかり',
    notes: '真犯人の携行品と一致'
  }
];

export function getStorySceneMap(story: AxralStoryV1): Map<string, { title: string; globalIndex: number; chapterTitle: string }> {
  const map = new Map<string, { title: string; globalIndex: number; chapterTitle: string }>();
  let idx = 0;
  for (const ch of story.chapters) {
    for (const sc of ch.scenes) {
      map.set(sc.id, {
        title: sc.title,
        globalIndex: idx++,
        chapterTitle: ch.title
      });
    }
  }
  return map;
}

export function validateForeshadowing(
  items: ForeshadowingItem[],
  story: AxralStoryV1
): ForeshadowingFinding[] {
  const sceneMap = getStorySceneMap(story);
  const totalScenes = sceneMap.size;
  const findings: ForeshadowingFinding[] = [];

  for (const item of items) {
    const setupInfo = item.setupSceneId ? sceneMap.get(item.setupSceneId) : undefined;
    const payoffInfo = item.payoffSceneId ? sceneMap.get(item.payoffSceneId) : undefined;

    // Check if setup scene exists
    if (item.setupSceneId && !setupInfo) {
      findings.push({
        id: item.id,
        type: 'missing_scene',
        severity: 'error',
        message: `伏線「${item.title}」の仕込みシーンが見つかりません。`
      });
    }

    // Check if payoff scene exists
    if (item.payoffSceneId && !payoffInfo) {
      findings.push({
        id: item.id,
        type: 'missing_scene',
        severity: 'warning',
        message: `伏線「${item.title}」の回収指定シーンが見つかりません。`
      });
    }

    // Check chronological order (payoff must occur after setup)
    if (setupInfo && payoffInfo) {
      if (payoffInfo.globalIndex < setupInfo.globalIndex) {
        findings.push({
          id: item.id,
          type: 'order_error',
          severity: 'error',
          message: `伏線の回収シーン「${payoffInfo.title}」が仕込みシーン「${setupInfo.title}」より前に配置されています。`,
          setupSceneTitle: setupInfo.title,
          payoffSceneTitle: payoffInfo.title
        });
      } else if (payoffInfo.globalIndex === setupInfo.globalIndex && item.status !== 'resolved') {
        findings.push({
          id: item.id,
          type: 'order_error',
          severity: 'info',
          message: `同一シーン内で仕込みと回収が設定されています。即時解決のエピソードか確認してください。`,
          setupSceneTitle: setupInfo.title,
          payoffSceneTitle: payoffInfo.title
        });
      }
    }

    // Major unresolved near the end
    if (item.importance === 'major' && item.status === 'open' && setupInfo) {
      const remainingScenes = totalScenes - setupInfo.globalIndex;
      if (totalScenes >= 4 && remainingScenes <= 1) {
        findings.push({
          id: item.id,
          type: 'unresolved_climax',
          severity: 'warning',
          message: `重要伏線「${item.title}」が終盤近くになっても回収予定が未定または未回収のままです。`,
          setupSceneTitle: setupInfo.title
        });
      }
    }
  }

  return findings;
}

export function calculateForeshadowingStats(items: ForeshadowingItem[]): ForeshadowingStats {
  const total = items.length;
  let open = 0;
  let hinted = 0;
  let resolved = 0;
  let majorCount = 0;
  let minorCount = 0;

  for (const item of items) {
    if (item.status === 'resolved') resolved++;
    else if (item.status === 'hinted') hinted++;
    else open++;

    if (item.importance === 'major') majorCount++;
    else minorCount++;
  }

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return {
    total,
    open,
    hinted,
    resolved,
    resolutionRate,
    majorCount,
    minorCount
  };
}
