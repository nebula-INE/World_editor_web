/**
 * Axral Codex - World Bible (Wiki) Exporter
 * Generates an encyclopedia compendium of the world, layers, entities,
 * relationships, timeline chronicle, and script connections.
 * Supports clean Markdown and standalone styled HTML / Print.
 */

import type { WorldModel, Entity, Relation } from './models';
import type { WorldState } from './world_state';
import type { Event as WorldEvent } from './events';
import type { AxralStoryV1 } from './story';
import { getLayerColor } from './layers';

export interface BibleEntityEntry {
  id: string;
  name: string;
  type: string;
  layer: string;
  aliases: string[];
  attributes: Record<string, any>;
  existence: string;
  relations: Array<{
    targetName: string;
    type: string;
    status: string;
    direction: 'outgoing' | 'incoming';
  }>;
  storyScenes: string[];
  lineCountInStory: number;
}

export interface BibleLayerEntry {
  name: string;
  color: string;
  entityCount: number;
  entities: BibleEntityEntry[];
}

export interface WorldBibleData {
  title: string;
  subtitle: string;
  generatedAt: string;
  totalEntities: number;
  totalRelations: number;
  totalEvents: number;
  totalScenes: number;
  layers: BibleLayerEntry[];
  categorizedEntities: Record<string, BibleEntityEntry[]>;
  events: Array<{
    id: string;
    timestamp: number;
    type: string;
    participants: string[];
    description: string;
  }>;
}

export function buildWorldBibleData(
  worldModel: WorldModel | WorldState,
  story?: AxralStoryV1 | null,
  events: WorldEvent[] = [],
  allLayers: string[] = ['Su-ken', 'Kan-ken', 'An-ken', 'Ki-ken']
): WorldBibleData {
  const entities = worldModel.entities || {};
  const relations = worldModel.relations || {};

  // Map story character appearances
  const appearances: Record<string, Set<string>> = {};
  const speechLines: Record<string, number> = {};

  if (story) {
    story.chapters.forEach((chap, ci) => {
      chap.scenes.forEach((sc, si) => {
        const scTitle = `${chap.title || `第${ci + 1}幕`} - ${sc.title || `Scene ${si + 1}`}`;
        sc.blocks.forEach(b => {
          if (b.type === 'dialogue' && b.character_id) {
            const speaker = b.character_id.trim();
            if (!appearances[speaker]) appearances[speaker] = new Set();
            appearances[speaker].add(scTitle);
            speechLines[speaker] = (speechLines[speaker] || 0) + 1;
          }
          if (b.entity_refs) {
            b.entity_refs.forEach(r => {
              const ref = r.trim();
              if (!appearances[ref]) appearances[ref] = new Set();
              appearances[ref].add(scTitle);
            });
          }
        });
      });
    });
  }

  // Build entity entries
  const entityEntries: BibleEntityEntry[] = Object.values(entities).map(ent => {
    const entLayer = ent.layer || 'Su-ken';
    const entRelations: BibleEntityEntry['relations'] = [];

    // Find outgoing and incoming relations
    Object.values(relations).forEach(rel => {
      if (rel.source === ent.id) {
        const target = entities[rel.target];
        entRelations.push({
          targetName: target ? target.name : rel.target,
          type: rel.type || 'relates',
          status: rel.status || 'confirmed',
          direction: 'outgoing'
        });
      } else if (rel.target === ent.id) {
        const source = entities[rel.source];
        entRelations.push({
          targetName: source ? source.name : rel.source,
          type: rel.type || 'relates',
          status: rel.status || 'confirmed',
          direction: 'incoming'
        });
      }
    });

    // Story appearances
    const appearedScenes = Array.from(appearances[ent.name] || []);
    const lines = speechLines[ent.name] || 0;

    return {
      id: ent.id,
      name: ent.name,
      type: ent.type || 'Concept',
      layer: entLayer,
      aliases: ent.aliases || [],
      attributes: ent.attributes || {},
      existence: ent.existence || 'confirmed',
      relations: entRelations,
      storyScenes: appearedScenes,
      lineCountInStory: lines
    };
  });

  // Sort entities by name
  entityEntries.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  // Group by Layer
  const layerMap: Record<string, BibleLayerEntry> = {};
  for (const l of allLayers) {
    layerMap[l] = {
      name: l,
      color: getLayerColor(l).hex,
      entityCount: 0,
      entities: []
    };
  }

  entityEntries.forEach(entry => {
    if (!layerMap[entry.layer]) {
      layerMap[entry.layer] = {
        name: entry.layer,
        color: getLayerColor(entry.layer).hex,
        entityCount: 0,
        entities: []
      };
    }
    layerMap[entry.layer].entities.push(entry);
    layerMap[entry.layer].entityCount++;
  });

  // Group by Category / Type
  const categorizedEntities: Record<string, BibleEntityEntry[]> = {
    '登場人物・キャラクター': [],
    '勢力・組織': [],
    '舞台・領域・場所': [],
    'アイテム・遺物': [],
    '概念・現象・法則': []
  };

  entityEntries.forEach(ent => {
    const t = ent.type.toLowerCase();
    if (['character', 'person', 'hero', 'villain', '人物', 'キャラクター'].some(k => t.includes(k))) {
      categorizedEntities['登場人物・キャラクター'].push(ent);
    } else if (['faction', 'org', 'organization', 'group', 'guild', '勢力', '組織'].some(k => t.includes(k))) {
      categorizedEntities['勢力・組織'].push(ent);
    } else if (['location', 'place', 'realm', 'world', 'city', '場所', '拠点', '舞台'].some(k => t.includes(k))) {
      categorizedEntities['舞台・領域・場所'].push(ent);
    } else if (['item', 'artifact', 'relic', 'weapon', '道具', '遺物', 'アイテム'].some(k => t.includes(k))) {
      categorizedEntities['アイテム・遺物'].push(ent);
    } else {
      categorizedEntities['概念・現象・法則'].push(ent);
    }
  });

  // Timeline events
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const eventEntries = sortedEvents.map(ev => {
    const participantNames = (ev.participants || []).map(pId => {
      const ent = entities[pId];
      return ent ? ent.name : pId;
    });

    const effectSummary = (ev.effects || []).map(eff => {
      if (eff.kind === 'relation_add') {
        return `関係成立: ${eff.payload?.type || ''}`;
      }
      if (eff.kind === 'relation_status') {
        return `関係変遷: ${eff.payload?.status || ''}`;
      }
      if (eff.kind === 'entity_existence') {
        return `存在変化: ${eff.payload?.existence || ''}`;
      }
      return eff.kind;
    }).join(', ');

    return {
      id: ev.id,
      timestamp: ev.timestamp,
      type: ev.type || 'Event',
      participants: participantNames,
      description: effectSummary ? `${ev.type} (${effectSummary})` : ev.type
    };
  });

  let totalScenesCount = 0;
  if (story) {
    story.chapters.forEach(c => totalScenesCount += c.scenes.length);
  }

  return {
    title: story?.title || '世界設定資料集 (World Bible)',
    subtitle: 'Axral Codex 多層オントロジー＆タイムライン設定資料',
    generatedAt: new Date().toLocaleString('ja-JP'),
    totalEntities: entityEntries.length,
    totalRelations: Object.keys(relations).length,
    totalEvents: events.length,
    totalScenes: totalScenesCount,
    layers: Object.values(layerMap),
    categorizedEntities,
    events: eventEntries
  };
}

/**
 * Generates clean, well-formatted Markdown
 */
export function generateWorldBibleMarkdown(bible: WorldBibleData): string {
  const lines: string[] = [];

  lines.push(`# ${bible.title}`);
  lines.push(`> ${bible.subtitle} | 生成日時: ${bible.generatedAt}`);
  lines.push('');
  lines.push(`- **総登録エンティティ**: ${bible.totalEntities} 件`);
  lines.push(`- **相関関係数**: ${bible.totalRelations} 本`);
  lines.push(`- **タイムライン事件数**: ${bible.totalEvents} 件`);
  lines.push(`- **シナリオ収録シーン数**: ${bible.totalScenes} シーン`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Layer Structure
  lines.push('## 1. 世界構造・階層レイヤー (World Layers)');
  lines.push('');
  bible.layers.forEach(layer => {
    lines.push(`### ■ レイヤー: ${layer.name} (${layer.entityCount}件)`);
    if (layer.entities.length === 0) {
      lines.push('*登録要素なし*');
    } else {
      lines.push('| 名前 | 種別 | 状態 | シナリオ出番 |');
      lines.push('| :--- | :--- | :--- | :--- |');
      layer.entities.forEach(ent => {
        const sceneCount = ent.storyScenes.length;
        const sceneText = sceneCount > 0 ? `${sceneCount}シーン (${ent.lineCountInStory}セリフ)` : '-';
        lines.push(`| **${ent.name}** | ${ent.type} | ${ent.existence} | ${sceneText} |`);
      });
    }
    lines.push('');
  });

  lines.push('---');
  lines.push('');

  // 2. Categorized Encyclopedia
  lines.push('## 2. 詳細名鑑・事典 (Encyclopedia)');
  lines.push('');

  Object.entries(bible.categorizedEntities).forEach(([catTitle, entities]) => {
    if (entities.length === 0) return;
    lines.push(`### 【${catTitle}】 (${entities.length}件)`);
    lines.push('');

    entities.forEach(ent => {
      lines.push(`#### ● ${ent.name}`);
      lines.push(`- **種別**: \`${ent.type}\` / **所属レイヤー**: \`${ent.layer}\` / **ステータス**: \`${ent.existence}\``);
      if (ent.aliases && ent.aliases.length > 0) {
        lines.push(`- **別名・異名**: ${ent.aliases.join(', ')}`);
      }

      // Attributes
      const attrKeys = Object.keys(ent.attributes);
      if (attrKeys.length > 0) {
        lines.push('- **設定・属性**:');
        attrKeys.forEach(k => {
          lines.push(`  - *${k}*: ${JSON.stringify(ent.attributes[k])}`);
        });
      }

      // Relations
      if (ent.relations.length > 0) {
        lines.push('- **相関関係**:');
        ent.relations.forEach(rel => {
          const arrow = rel.direction === 'outgoing' ? '→' : '←';
          lines.push(`  - ${arrow} **${rel.targetName}** 【${rel.type}】 *(状態: ${rel.status})*`);
        });
      }

      // Story appearances
      if (ent.storyScenes.length > 0) {
        lines.push(`- **劇中登場シーン** (${ent.lineCountInStory}台詞):`);
        ent.storyScenes.forEach(sc => {
          lines.push(`  - *${sc}*`);
        });
      }
      lines.push('');
    });
  });

  lines.push('---');
  lines.push('');

  // 3. Timeline Chronicle
  lines.push('## 3. タイムライン年代記 (Timeline Chronicle)');
  lines.push('');
  if (bible.events.length === 0) {
    lines.push('*登録された年表イベントはありません。*');
  } else {
    lines.push('| 時点 (t) | 事件種別 | 関係者 | 概要・影響 |');
    lines.push('| :---: | :--- | :--- | :--- |');
    bible.events.forEach(ev => {
      const parts = ev.participants.length > 0 ? ev.participants.join(', ') : '-';
      lines.push(`| **t = ${ev.timestamp}** | \`${ev.type}\` | ${parts} | ${ev.description} |`);
    });
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by Axral Codex Engine - High-Integrity Worldbuilding System*');

  return lines.join('\n');
}

/**
 * Generates standalone styled HTML for offline browsing or print to PDF
 */
export function generateWorldBibleHtml(bible: WorldBibleData): string {
  const mdContent = generateWorldBibleMarkdown(bible);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(bible.title)} - 設定資料集</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #0e1117;
      --card-bg: #161b26;
      --border: #283042;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --accent-light: #818cf8;
    }
    @media print {
      body { background: #fff !important; color: #111 !important; }
      .card, table, th, td { border-color: #ccc !important; background: #fff !important; color: #111 !important; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "BIZ UDPGothic", sans-serif;
      line-height: 1.6;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 20px;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
    header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    h1 { font-size: 2.2rem; margin: 0 0 8px 0; color: #fff; letter-spacing: -0.02em; }
    .subtitle { color: var(--text-muted); font-size: 0.95rem; }
    .stats-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 16px;
    }
    .stat-badge {
      background: var(--card-bg);
      border: 1px solid var(--border);
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
    }
    .stat-badge strong { color: var(--accent-light); }
    h2 { font-size: 1.4rem; color: #fff; border-left: 4px solid var(--accent); padding-left: 12px; margin-top: 40px; }
    h3 { font-size: 1.15rem; color: #cbd5e1; margin-top: 24px; }
    h4 { font-size: 1.05rem; color: #93c5fd; margin: 16px 0 6px 0; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      background: #1e293b;
      border: 1px solid #334155;
      margin-right: 6px;
      color: #94a3b8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 0.9rem;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    th { background: #1a2234; color: #cbd5e1; }
    tr:nth-child(even) { background: #131722; }
    ul { padding-left: 20px; margin: 6px 0; font-size: 0.9rem; }
    li { margin-bottom: 4px; }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .print-btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">印刷 / PDF出力</button>
  <div class="container">
    <header>
      <h1>${escapeHtml(bible.title)}</h1>
      <div class="subtitle">${escapeHtml(bible.subtitle)} | 生成日時: ${escapeHtml(bible.generatedAt)}</div>
      <div class="stats-bar">
        <div class="stat-badge">総エンティティ: <strong>${bible.totalEntities}</strong> 件</div>
        <div class="stat-badge">相関関係: <strong>${bible.totalRelations}</strong> 本</div>
        <div class="stat-badge">タイムライン事件: <strong>${bible.totalEvents}</strong> 件</div>
        <div class="stat-badge">シーン数: <strong>${bible.totalScenes}</strong></div>
      </div>
    </header>

    <section>
      <h2>1. 世界構造・階層レイヤー (World Layers)</h2>
      ${bible.layers.map(l => `
        <div class="card" style="border-left: 4px solid ${l.color};">
          <h3 style="margin-top:0;">レイヤー: ${escapeHtml(l.name)} (${l.entityCount}件)</h3>
          ${l.entities.length === 0 ? '<p style="color:#64748b; font-size:0.85rem;">登録要素なし</p>' : `
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>種別</th>
                  <th>ステータス</th>
                  <th>劇中登場</th>
                </tr>
              </thead>
              <tbody>
                ${l.entities.map(e => `
                  <tr>
                    <td><strong>${escapeHtml(e.name)}</strong></td>
                    <td>${escapeHtml(e.type)}</td>
                    <td><span class="badge">${escapeHtml(e.existence)}</span></td>
                    <td>${e.storyScenes.length > 0 ? `${e.storyScenes.length}シーン (${e.lineCountInStory}台詞)` : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      `).join('')}
    </section>

    <section>
      <h2>2. 詳細名鑑・事典 (Encyclopedia)</h2>
      ${Object.entries(bible.categorizedEntities).map(([catTitle, ents]) => {
        if (ents.length === 0) return '';
        const cardsHtml = ents.map(ent => `
          <div class="card">
            <h4>${escapeHtml(ent.name)}</h4>
            <div style="margin-bottom:8px;">
              <span class="badge">種別: ${escapeHtml(ent.type)}</span>
              <span class="badge" style="border-color:${getLayerColor(ent.layer).hex}; color:${getLayerColor(ent.layer).hex}">レイヤー: ${escapeHtml(ent.layer)}</span>
              <span class="badge">状態: ${escapeHtml(ent.existence)}</span>
              ${ent.aliases.length > 0 ? `<span class="badge">別名: ${escapeHtml(ent.aliases.join(', '))}</span>` : ''}
            </div>
            ${ent.relations.length > 0 ? `
              <div style="font-size:0.85rem; color:#94a3b8; margin-top:6px;">
                <strong>相関関係:</strong>
                <ul>
                  ${ent.relations.map(r => `
                    <li>${r.direction === 'outgoing' ? '→' : '←'} <strong>${escapeHtml(r.targetName)}</strong> 【${escapeHtml(r.type)}】 (${escapeHtml(r.status)})</li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
            ${ent.storyScenes.length > 0 ? `
              <div style="font-size:0.85rem; color:#94a3b8; margin-top:6px;">
                <strong>劇中登場 (${ent.lineCountInStory}台詞):</strong>
                <ul>
                  ${ent.storyScenes.map(sc => `<li>${escapeHtml(sc)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `).join('');

        return `
          <h3>【${escapeHtml(catTitle)}】 (${ents.length}件)</h3>
          ${cardsHtml}
        `;
      }).join('')}
    </section>

    <section>
      <h2>3. タイムライン年代記 (Timeline Chronicle)</h2>
      ${bible.events.length === 0 ? '<p style="color:#64748b;">登録された年表イベントはありません。</p>' : `
        <table>
          <thead>
            <tr>
              <th style="width: 80px; text-align: center;">時点 (t)</th>
              <th>事件種別</th>
              <th>関係者</th>
              <th>内容・変遷</th>
            </tr>
          </thead>
          <tbody>
            ${bible.events.map(ev => `
              <tr>
                <td style="text-align: center;"><strong>t = ${ev.timestamp}</strong></td>
                <td><span class="badge">${escapeHtml(ev.type)}</span></td>
                <td>${escapeHtml(ev.participants.join(', ') || '-')}</td>
                <td>${escapeHtml(ev.description)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </section>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
