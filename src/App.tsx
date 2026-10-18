import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { EditorPanel } from './components/EditorPanel';
import { GraphView } from './components/GraphView';
import { CandidatePanel } from './components/CandidatePanel';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { AddEventModal } from './components/AddEventModal';
import { RelationEditModal } from './components/RelationEditModal';
import { ConflictModal } from './components/ConflictModal';

import { WorldModel, LAYER_HIERARCHY } from './core/models';
import { Event, newEvent } from './core/events';
import { WorldState, WorldStateEngine } from './core/world_state';
import { parseCodexSyntax, ParseResult, PatchConflict, extractRelationType } from './core/parser';
import { indexNaturalLines, IndexResult, Candidate } from './core/indexer';
import { lint, LintIssue } from './core/linter';

const DEFAULT_TEXT = `# Axral WorldCode Sample
# Explicit Entity Declarations
[Alice:Character:Su-ken]
[Bob:Character:Su-ken]
[Order:Organization:Kan-ken]

# Explicit Relations
[Alice:Character] -> [Order:Organization] : 所属
[Bob:Character] -> [Order:Organization] : 所属
Alice -> Bob : 友好

# Natural Text (Secondary Indexer will extract suggestions)
BobはかつてAliceを尊敬していた。しかしOrderの教義を巡って対立した。
`;

export const App: React.FC = () => {
  // Core text state
  const [editorText, setEditorText] = useState<string>(() => {
    return localStorage.getItem('axral_worldcode_text') || localStorage.getItem('axral_codex_text') || DEFAULT_TEXT;
  });

  // Highlighted line from Linter
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // Ignored candidate IDs
  const [ignoredCandidateIds, setIgnoredCandidateIds] = useState<Set<string>>(new Set());

  // Events state (persisted across text edits)
  const [events, setEvents] = useState<Event[]>(() => {
    // Initial sample event (e.g. at t=10 Alice changes status or Bob dies)
    return [];
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Timeline & Layer filters
  const [timelineMode, setTimelineMode] = useState<boolean>(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(LAYER_HIERARCHY));
  const [graphPositions, setGraphPositions] = useState<Record<string, { x: number; y: number }>>({});
  const handleGraphPositionsChange = useCallback((positions: Record<string, { x: number; y: number }>) => {
    setGraphPositions(positions);
  }, []);
  // Remount the canvas when a different document is opened so its layout/camera cannot leak across documents.
  const [documentSessionId, setDocumentSessionId] = useState(0);

  // Modals state
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [relationEditTarget, setRelationEditTarget] = useState<{ refKey: string; oldType: string } | null>(null);

  // File input ref for opening files
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse result & Engine state
  const [parseResult, setParseResult] = useState<ParseResult>(() => parseCodexSyntax(editorText));
  const [indexResult, setIndexResult] = useState<IndexResult>({ candidates: [], ambiguities: [] });
  const [lintIssues, setLintIssues] = useState<LintIssue[]>([]);
  const [engine, setEngine] = useState<WorldStateEngine>(() => new WorldStateEngine(parseResult.model));

  // Debounced pipeline
  useEffect(() => {
    localStorage.setItem('axral_worldcode_text', editorText);
    const timer = setTimeout(() => {
      const parsed = parseCodexSyntax(editorText);
      setParseResult(parsed);

      // Run Secondary Indexer on natural lines
      const indexed = indexNaturalLines(parsed.natural_lines, Object.values(parsed.model.entities));
      // Filter out ignored candidates
      const filteredCandidates = indexed.candidates.filter(c => !ignoredCandidateIds.has(c.id));
      const cleanIndexResult = { ...indexed, candidates: filteredCandidates };
      setIndexResult(cleanIndexResult);

      // Update Engine
      const eng = new WorldStateEngine(parsed.model);
      for (const ev of events) {
        eng.addEvent(ev);
      }
      setEngine(eng);

      // Run Linter
      const issues = lint(parsed, eng, cleanIndexResult);
      setLintIssues(issues);
    }, 150);

    return () => clearTimeout(timer);
  }, [editorText, events, ignoredCandidateIds]);

  // Compute model to display in GraphView
  const displayModel = useMemo<WorldModel | WorldState>(() => {
    if (timelineMode && engine) {
      return engine.stateAt(currentTimestamp);
    }
    return parseResult.model;
  }, [timelineMode, engine, currentTimestamp, parseResult.model]);

  // Compute change summary for current timestamp
  const changeSummaryText = useMemo(() => {
    if (!timelineMode || !engine) return '';
    const evsAtTs = events.filter(e => e.timestamp === currentTimestamp);
    if (evsAtTs.length === 0) {
      return `t = ${currentTimestamp} : このタイムスタンプでのEventはありません。`;
    }

    const stateBefore = engine.stateAt(currentTimestamp - 1);
    const stateAfter = engine.stateAt(currentTimestamp);

    const lines: string[] = [];
    for (const ev of evsAtTs) {
      lines.push(`[Event: ${ev.type}] (t = ${ev.timestamp})`);
      for (const eff of ev.effects) {
        if (eff.kind === 'entity_existence' && eff.target_id) {
          const name = stateBefore.entities[eff.target_id]?.name || eff.target_id;
          const oldVal = stateBefore.entities[eff.target_id]?.existence || 'confirmed';
          const newVal = stateAfter.entities[eff.target_id]?.existence || eff.payload.existence;
          lines.push(`  • ${name}.existence: "${oldVal}" → "${newVal}"`);
        } else if (eff.kind === 'relation_status' && eff.target_id) {
          const oldStatus = stateBefore.relations[eff.target_id]?.status || 'confirmed';
          const newStatus = stateAfter.relations[eff.target_id]?.status || eff.payload.status;
          lines.push(`  • ${eff.target_id}.status: "${oldStatus}" → "${newStatus}"`);
        } else {
          lines.push(`  • Effect (${eff.kind}): ${JSON.stringify(eff.payload)}`);
        }
      }
    }
    return lines.join('\n');
  }, [timelineMode, engine, currentTimestamp, events]);

  // --- Handlers ---

  // Candidate Accepted: append non-destructively to Generated Relations (§10.1)
  const handleCandidateAccept = (candId: string) => {
    const cand = indexResult.candidates.find(c => c.id === candId);
    if (!cand) return;

    setIgnoredCandidateIds(prev => new Set(prev).add(candId));

    setEditorText(prev => {
      let text = prev;
      const genHeading = '# Generated Relations';
      const newLine = `${cand.source_name} -> ${cand.target_name} : ${cand.rel_type}`;

      if (!text.includes(genHeading)) {
        text = text.trimEnd() + `\n\n${genHeading}\n${newLine}\n`;
      } else {
        text = text.trimEnd() + `\n${newLine}\n`;
      }
      return text;
    });
  };

  // Candidate Ignored
  const handleCandidateIgnore = (candId: string) => {
    setIgnoredCandidateIds(prev => new Set(prev).add(candId));
  };

  // Relation Type Edit Requested from Graph Canvas (§10.2 Patch-style Sync)
  const handleRelationTypeEditRequested = (refKey: string, oldType: string, newType: string) => {
    setEditorText(prev => {
      let text = prev;
      const genHeading = '# Generated Relations';
      if (!text.includes(genHeading)) {
        text = text.trimEnd() + `\n\n${genHeading}\n`;
      }

      // Check if PATCH block for this refKey already exists
      const patchRegex = new RegExp(`PATCH\\s+${escapeRegex(refKey)}\\s*:[\\s\\S]*?(?=\\nPATCH|\\n#|$)`, 'g');
      const match = patchRegex.exec(text);

      if (match) {
        // Update existing PATCH block
        const updatedBlock = `PATCH ${refKey}:\n  type = "${newType}"  # was: "${oldType}"`;
        text = text.replace(match[0].trim(), updatedBlock);
      } else {
        // Append new PATCH block
        const patchBlock = `\nPATCH ${refKey}:\n  type = "${newType}"  # was: "${oldType}"\n`;
        text = text.trimEnd() + patchBlock;
      }
      return text;
    });
  };

  // Conflict Resolution (§11)
  const handleConflictResolve = (
    conflict: PatchConflict,
    action: 'keep_text' | 'apply_patch' | 'merge',
    mergeValue?: string
  ) => {
    setEditorText(prev => {
      let text = prev;
      const refKey = conflict.ref_key;

      // 1. Remove the PATCH block
      const patchBlockRegex = new RegExp(`PATCH\\s+${escapeRegex(refKey)}\\s*:[\\r\\n]+(?:[ \\t]+[A-Za-z_]+\\s*=\\s*"[^"]*"(?:\\s*#\\s*was:[^\\r\\n]*)?[\\r\\n]*)+`, 'g');
      text = text.replace(patchBlockRegex, '');

      // 2. If action is 'apply_patch' or 'merge', update the original text line
      const targetVal = action === 'apply_patch' ? conflict.patch_value : (action === 'merge' ? mergeValue : null);
      if (targetVal) {
        const lines = text.split('\n');
        // Find relation line matching ref_key
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const relType = extractRelationType(line);
          if (relType && (line.includes(refKey.split('->')[0].replace(/\[|\]/g, '')) || line.includes('->'))) {
            // Replace the relation type part at the end
            lines[i] = line.replace(/:\s*.+$/, `: ${targetVal}`);
            break;
          }
        }
        text = lines.join('\n');
      }

      return text;
    });
  };

  // Event Management
  const handleAddEvent = (data: {
    timestamp: number;
    type: string;
    isSnapshotPoint: boolean;
    effectKind: string;
    target: string;
    value: string;
  }) => {
    let effectPayload: Record<string, any> = {};
    let targetId = data.target;

    // Resolve entity name to ID if target is entity name
    if (data.effectKind === 'entity_existence') {
      const resolved = parseResult.model.resolve(data.target);
      if (resolved) {
        targetId = resolved.id;
      }
      effectPayload = { existence: data.value };
    } else if (data.effectKind === 'relation_status') {
      const relation = parseResult.model.findByRefKey(data.target);
      if (relation) {
        targetId = relation.id;
      }
      effectPayload = { status: data.value };
    }

    const ev = newEvent(
      data.timestamp,
      data.type,
      data.effectKind === 'entity_existence' ? [targetId] : [],
      [
        {
          kind: data.effectKind,
          target_id: targetId,
          payload: effectPayload,
        },
      ],
      data.isSnapshotPoint
    );

    setEvents(prev => [...prev, ev]);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
    if (selectedEventId === eventId) {
      setSelectedEventId(null);
    }
  };

  // Toggle Layer Filter
  const handleToggleLayer = (layer: string) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  // File Operations
  const handleOpenFileClick = () => {
    fileInputRef.current?.click();
  };

  // A text file is a new document, not an edit to the previous document's Timeline session.
  const resetDocumentSession = (nextText: string) => {
    const parsed = parseCodexSyntax(nextText);
    setParseResult(parsed);
    setEngine(new WorldStateEngine(parsed.model));
    setIndexResult({ candidates: [], ambiguities: [] });
    setLintIssues([]);
    setEvents([]);
    setGraphPositions({});
    setSelectedEventId(null);
    setIgnoredCandidateIds(new Set());
    setTimelineMode(false);
    setCurrentTimestamp(0);
    setVisibleLayers(new Set(LAYER_HIERARCHY));
    setHighlightedLine(null);
    setIsAddEventOpen(false);
    setIsConflictModalOpen(false);
    setRelationEditTarget(null);
    setDocumentSessionId(prev => prev + 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (events.length > 0 && !window.confirm(
      `現在のTimeline Event ${events.length}件は現在の文書に保存されていません。読み込むデータに置き換えますか？`
    )) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content === undefined) return;
      if (file.name.toLowerCase().endsWith('.axral.json')) {
        try {
          const project = JSON.parse(content);
          if (project?.format !== 'axral-world-project' || project?.schema_version !== 1 ||
              typeof project.text !== 'string' || !Array.isArray(project.events)) {
            throw new Error('Axral World Project形式またはschema_versionが不正です。');
          }
          const restoredPositions = project.graph_positions && typeof project.graph_positions === 'object'
            ? project.graph_positions : {};
          const restoredEvents = project.events as Event[];
          const restoredIgnored = Array.isArray(project.ignored_candidates) ? project.ignored_candidates : [];
          const restoredTimeline = project.timeline && typeof project.timeline === 'object' ? project.timeline : {};
          resetDocumentSession(project.text);
          setEditorText(project.text);
          setEvents(restoredEvents);
          setGraphPositions(restoredPositions);
          setIgnoredCandidateIds(new Set(restoredIgnored.filter((id: unknown) => typeof id === 'string')));
          setTimelineMode(Boolean(restoredTimeline.mode));
          setCurrentTimestamp(Number.isFinite(restoredTimeline.timestamp) ? Number(restoredTimeline.timestamp) : 0);
          setVisibleLayers(new Set(Array.isArray(restoredTimeline.visible_layers)
            ? restoredTimeline.visible_layers.filter((layer: unknown) => typeof layer === 'string')
            : LAYER_HIERARCHY));
        } catch (error) {
          window.alert(`プロジェクトを読み込めませんでした: ${error instanceof Error ? error.message : String(error)}`);
        }
        return;
      }
      resetDocumentSession(content);
      setGraphPositions({});
      setEditorText(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveFile = () => {
    const blob = new Blob([editorText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'axral_worldcode.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveProject = () => {
    const project = {
      format: 'axral-world-project',
      schema_version: 1,
      text: editorText,
      events,
      graph_positions: graphPositions,
      timeline: {
        mode: timelineMode,
        timestamp: currentTimestamp,
        visible_layers: [...visibleLayers],
      },
      ignored_candidates: [...ignoredCandidateIds],
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world.axral.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const jsonText = parseResult.model.toJson();
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world_canonical.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInsertTemplate = (tmpl: string) => {
    setEditorText(prev => prev.trimEnd() + '\n' + tmpl + '\n');
  };

  const handleResetSample = () => {
    if (window.confirm(`サンプルテキストに初期化しますか？（現在の編集内容とTimeline Event ${events.length}件が破棄されます）`)) {
      resetDocumentSession(DEFAULT_TEXT);
      setEditorText(DEFAULT_TEXT);
    }
  };

  const entityNames = Object.values(parseResult.model.entities).map(e => e.name);
  const relationRefs = Object.values(parseResult.model.relations).map(r => r.ref_key || r.id);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121418] text-gray-200 overflow-hidden font-sans">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".txt,.md,.codex,.axral.json"
        className="hidden"
      />

      {/* Top Header Menu Bar */}
      <Header
        onOpenFile={handleOpenFileClick}
        onSaveFile={handleSaveFile}
        onSaveProject={handleSaveProject}
        onExportJson={handleExportJson}
        onResolveConflicts={() => setIsConflictModalOpen(true)}
        conflictCount={parseResult.patch_conflicts.length}
        onInsertTemplate={handleInsertTemplate}
        onResetSample={handleResetSample}
      />

      {/* Main 3-Column Split Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Codex Syntax Editor (approx 28% width) */}
        <div className="w-[30%] min-w-[280px] max-w-[460px] h-full flex-shrink-0">
          <EditorPanel
            text={editorText}
            onChange={setEditorText}
            highlightedLine={highlightedLine}
            onClearHighlight={() => setHighlightedLine(null)}
          />
        </div>

        {/* Center: Graph View Canvas (flex-1) */}
        <div className="flex-1 h-full min-w-[320px] relative">
          <GraphView
            key={documentSessionId}
            model={displayModel}
            visibleLayers={visibleLayers}
            initialPositions={graphPositions}
            onPositionsChange={handleGraphPositionsChange}
            onRelationTypeEdit={(refKey, oldType) => {
              setRelationEditTarget({ refKey, oldType });
            }}
          />
        </div>

        {/* Right: Candidate Panel (approx 26% width) */}
        <div className="w-[28%] min-w-[260px] max-w-[420px] h-full flex-shrink-0">
          <CandidatePanel
            candidates={indexResult.candidates}
            onAccept={handleCandidateAccept}
            onIgnore={handleCandidateIgnore}
          />
        </div>
      </main>

      {/* Bottom Panel: Timeline Lens & Linter */}
      <BottomPanel
        timelineMode={timelineMode}
        onToggleTimelineMode={setTimelineMode}
        timestamp={currentTimestamp}
        onTimestampChange={setCurrentTimestamp}
        events={events}
        onAddEvent={() => setIsAddEventOpen(true)}
        onDeleteEvent={handleDeleteEvent}
        selectedEventId={selectedEventId}
        onSelectEventId={setSelectedEventId}
        changeSummary={changeSummaryText}
        visibleLayers={visibleLayers}
        onToggleLayer={handleToggleLayer}
        lintIssues={lintIssues}
        onJumpToLine={(line) => setHighlightedLine(line)}
      />

      {/* Status Bar */}
      <StatusBar
        entityCount={Object.keys(parseResult.model.entities).length}
        relationCount={Object.keys(parseResult.model.relations).length}
        candidateCount={indexResult.candidates.length}
        ambiguousCount={indexResult.ambiguities.length}
        conflictCount={parseResult.patch_conflicts.length}
        linterIssueCount={lintIssues.length}
        isTimelineMode={timelineMode}
        currentTimestamp={currentTimestamp}
      />

      {/* Modals */}
      <AddEventModal
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        onAdd={handleAddEvent}
        entityNames={entityNames}
        relationRefs={relationRefs}
      />

      {relationEditTarget && (
        <RelationEditModal
          isOpen={!!relationEditTarget}
          onClose={() => setRelationEditTarget(null)}
          refKey={relationEditTarget.refKey}
          currentType={relationEditTarget.oldType}
          onConfirm={(refKey, oldType, newType) => {
            handleRelationTypeEditRequested(refKey, oldType, newType);
          }}
        />
      )}

      <ConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        conflicts={parseResult.patch_conflicts}
        onResolve={handleConflictResolve}
      />
    </div>
  );
};

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default App;
