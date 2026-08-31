import React, { useRef, useEffect, useState, useMemo } from 'react';
import { FileText, Code2, Sparkles, HelpCircle, Palette } from 'lucide-react';

interface EditorPanelProps {
  text: string;
  onChange: (newText: string) => void;
  highlightedLine?: number | null;
  onClearHighlight?: () => void;
}

// Tokenize a single line for syntax highlighting
function renderHighlightedLine(line: string): React.ReactNode {
  if (!line) {
    return ' ';
  }

  const trimmed = line.trim();

  // 1. Comment / Markdown Header
  if (trimmed.startsWith('#')) {
    if (trimmed.startsWith('# Generated Relations') || trimmed.startsWith('# Explicit')) {
      return <span className="text-indigo-300 font-bold">{line}</span>;
    }
    return <span className="text-gray-500 italic">{line}</span>;
  }

  // 2. PATCH block header: `PATCH ...:`
  const patchHeaderMatch = line.match(/^(\s*)(PATCH\b)([\s\S]*?)(:?)$/);
  if (patchHeaderMatch && (line.includes('PATCH [') || line.includes('PATCH ') && line.endsWith(':'))) {
    return (
      <span>
        {patchHeaderMatch[1]}
        <span className="text-rose-400 font-bold">{patchHeaderMatch[2]}</span>
        <span className="text-sky-300">{patchHeaderMatch[3]}</span>
        <span className="text-gray-400">{patchHeaderMatch[4]}</span>
      </span>
    );
  }

  // 3. PATCH property line: `  type = "..."  # was: "..."`
  const patchPropMatch = line.match(/^(\s*)([A-Za-z_]+)(\s*=\s*)("[^"]*")(\s*(?:#.*)?)$/);
  if (patchPropMatch) {
    return (
      <span>
        {patchPropMatch[1]}
        <span className="text-violet-300">{patchPropMatch[2]}</span>
        <span className="text-gray-400">{patchPropMatch[3]}</span>
        <span className="text-emerald-300">{patchPropMatch[4]}</span>
        {patchPropMatch[5] && <span className="text-gray-500 italic">{patchPropMatch[5]}</span>}
      </span>
    );
  }

  // 4. Explicit Entity declaration: `[Name:Type]` or `[Name:Type:Layer]`
  const entityDeclMatch = line.match(/^(\s*)\[([^:\]]+):([^:\]]+)(?::([^:\]]+))?\](\s*(?:#.*)?)$/);
  if (entityDeclMatch) {
    const [, indent, name, type, layer, comment] = entityDeclMatch;
    return (
      <span>
        {indent}
        <span className="text-gray-500 font-bold">[</span>
        <span className="text-emerald-300 font-semibold">{name}</span>
        <span className="text-gray-500">:</span>
        <span className="text-purple-300">{type}</span>
        {layer && (
          <>
            <span className="text-gray-500">:</span>
            <span className="text-amber-300">{layer}</span>
          </>
        )}
        <span className="text-gray-500 font-bold">]</span>
        {comment && <span className="text-gray-500 italic">{comment}</span>}
      </span>
    );
  }

  // 5. Explicit Relation: `[A:Type] -> [B:Type] : RelType` or Shorthand `A -> B : RelType`
  if (line.includes('->')) {
    const arrowParts = line.split('->');
    if (arrowParts.length === 2) {
      const leftPart = arrowParts[0];
      const rightFull = arrowParts[1];

      let rightEntity = rightFull;
      let relType = '';
      let comment = '';

      if (rightFull.includes(':')) {
        const colonIdx = rightFull.indexOf(':');
        rightEntity = rightFull.substring(0, colonIdx);
        const rest = rightFull.substring(colonIdx + 1);
        if (rest.includes('#')) {
          const hashIdx = rest.indexOf('#');
          relType = rest.substring(0, hashIdx);
          comment = rest.substring(hashIdx);
        } else {
          relType = rest;
        }
      } else if (rightFull.includes('#')) {
        const hashIdx = rightFull.indexOf('#');
        rightEntity = rightFull.substring(0, hashIdx);
        comment = rightFull.substring(hashIdx);
      }

      return (
        <span>
          {renderEntityRef(leftPart)}
          <span className="text-sky-400 font-bold mx-1">{'->'}</span>
          {renderEntityRef(rightEntity)}
          {relType !== '' && (
            <>
              <span className="text-gray-500 mx-0.5">:</span>
              <span className="text-amber-300 font-medium">{relType}</span>
            </>
          )}
          {comment && <span className="text-gray-500 italic">{comment}</span>}
        </span>
      );
    }
  }

  // 6. Natural novel/story text (地の文)
  // Highlight bracketed entity mentions or quotations lightly
  const tokens = splitNaturalText(line);
  return (
    <span className="text-slate-300">
      {tokens.map((token, i) => {
        if (token.type === 'entity') {
          return (
            <span key={i} className="text-emerald-300 font-medium bg-emerald-950/30 px-0.5 rounded">
              {token.text}
            </span>
          );
        } else if (token.type === 'quote') {
          return (
            <span key={i} className="text-yellow-200">
              {token.text}
            </span>
          );
        }
        return <span key={i}>{token.text}</span>;
      })}
    </span>
  );
}

// Helper to format entity reference `[Name:Type]` or plain `Name`
function renderEntityRef(str: string): React.ReactNode {
  const match = str.match(/^(\s*)\[([^:\]]+)(?::([^:\]]+))?(?::([^:\]]+))?\](\s*)$/);
  if (match) {
    const [, pre, name, type, layer, post] = match;
    return (
      <span>
        {pre}
        <span className="text-gray-500 font-bold">[</span>
        <span className="text-emerald-300 font-semibold">{name}</span>
        {type && (
          <>
            <span className="text-gray-500">:</span>
            <span className="text-purple-300">{type}</span>
          </>
        )}
        {layer && (
          <>
            <span className="text-gray-500">:</span>
            <span className="text-amber-300">{layer}</span>
          </>
        )}
        <span className="text-gray-500 font-bold">]</span>
        {post}
      </span>
    );
  }
  return <span className="text-cyan-200 font-medium">{str}</span>;
}

// Tokenize natural text
function splitNaturalText(text: string): { type: 'normal' | 'entity' | 'quote'; text: string }[] {
  const result: { type: 'normal' | 'entity' | 'quote'; text: string }[] = [];
  const regex = /(\[[^\]]+\]|「[^」]*」|"[^"]*")/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'normal', text: text.substring(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('[')) {
      result.push({ type: 'entity', text: token });
    } else {
      result.push({ type: 'quote', text: token });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push({ type: 'normal', text: text.substring(lastIndex) });
  }

  return result;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  text,
  onChange,
  highlightedLine,
  onClearHighlight,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [syntaxHighlightEnabled, setSyntaxHighlightEnabled] = useState(true);

  const lines = useMemo(() => text.split('\n'), [text]);
  const lineCount = lines.length;

  // Handle scroll syncing between line numbers, syntax overlay, and textarea
  const handleScroll = () => {
    if (textareaRef.current) {
      const top = textareaRef.current.scrollTop;
      const left = textareaRef.current.scrollLeft;

      if (gutterRef.current) {
        gutterRef.current.scrollTop = top;
      }
      if (overlayRef.current) {
        overlayRef.current.scrollTop = top;
        overlayRef.current.scrollLeft = left;
      }
    }
  };

  // Jump to highlighted line when triggered from Linter
  useEffect(() => {
    if (highlightedLine && textareaRef.current) {
      const textarea = textareaRef.current;
      const linesArray = textarea.value.split('\n');
      const targetIndex = Math.max(0, Math.min(highlightedLine - 1, linesArray.length - 1));
      
      let charPosition = 0;
      for (let i = 0; i < targetIndex; i++) {
        charPosition += linesArray[i].length + 1;
      }
      
      textarea.focus();
      textarea.setSelectionRange(charPosition, charPosition + linesArray[targetIndex].length);
      
      // Calculate scroll position
      const lineHeight = 20;
      textarea.scrollTop = Math.max(0, targetIndex * lineHeight - 60);
      handleScroll();
    }
  }, [highlightedLine]);

  return (
    <div className="h-full flex flex-col bg-[#16181D] border-r border-[#2B2E36] overflow-hidden">
      {/* Editor Header */}
      <div className="h-9 px-3 bg-[#1A1D23] border-b border-[#2B2E36] flex items-center justify-between text-xs text-gray-300 select-none">
        <div className="flex items-center space-x-2">
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-medium text-gray-200">Code Text Editor</span>
          <span className="text-[11px] text-gray-500 font-mono">({lineCount} lines)</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setSyntaxHighlightEnabled(!syntaxHighlightEnabled)}
            className={`px-2 py-0.5 rounded text-[11px] flex items-center space-x-1 transition-colors ${
              syntaxHighlightEnabled
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#252830]'
            }`}
            title="構文ハイライトの切替"
          >
            <Palette className="w-3 h-3" />
            <span>Highlight</span>
          </button>

          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`px-2 py-0.5 rounded text-[11px] flex items-center space-x-1 transition-colors ${
              showHelp ? 'bg-indigo-900/60 text-indigo-300' : 'text-gray-400 hover:text-gray-200 hover:bg-[#252830]'
            }`}
            title="Codex 構文ガイド"
          >
            <HelpCircle className="w-3 h-3" />
            <span>Syntax Help</span>
          </button>
        </div>
      </div>

      {/* Syntax Guide Box (Collapsible) */}
      {showHelp && (
        <div className="bg-[#1C2028] border-b border-[#2F3440] p-3 text-[11px] text-gray-300 space-y-1.5 animate-fadeIn">
          <div className="font-semibold text-gray-100 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Codex Syntax 記述例 & 色分けガイド</span>
          </div>
          <div className="grid grid-cols-1 gap-1 font-mono text-[11px]">
            <div className="bg-[#14161B] p-1.5 rounded border border-[#2B2E36] flex items-center justify-between">
              <div>
                <span className="text-emerald-300">[Alice</span>
                <span className="text-gray-500">:</span>
                <span className="text-purple-300">Character</span>
                <span className="text-gray-500">:</span>
                <span className="text-amber-300">Su-ken]</span>
              </div>
              <span className="text-gray-400 text-[10px]">Entity宣言 (名前 / 型 / Layer)</span>
            </div>
            <div className="bg-[#14161B] p-1.5 rounded border border-[#2B2E36] flex items-center justify-between">
              <div>
                <span className="text-emerald-300">[Alice:Character]</span>
                <span className="text-sky-400 font-bold mx-1">{'->'}</span>
                <span className="text-emerald-300">[Order:Org]</span>
                <span className="text-gray-400 mx-1">:</span>
                <span className="text-amber-300 font-medium">所属</span>
              </div>
              <span className="text-gray-400 text-[10px]">型付き明示Relation</span>
            </div>
            <div className="bg-[#14161B] p-1.5 rounded border border-[#2B2E36] flex items-center justify-between">
              <div>
                <span className="text-cyan-200">Alice</span>
                <span className="text-sky-400 font-bold mx-1">{'->'}</span>
                <span className="text-cyan-200">Bob</span>
                <span className="text-gray-400 mx-1">:</span>
                <span className="text-amber-300 font-medium">友好</span>
              </div>
              <span className="text-gray-400 text-[10px]">Shorthand Relation</span>
            </div>
            <div className="bg-[#14161B] p-1.5 rounded border border-[#2B2E36] flex items-center justify-between">
              <div>
                <span className="text-rose-400 font-bold">PATCH</span>{' '}
                <span className="text-sky-300">[A] -&gt; [B]</span>: <span className="text-violet-300">type</span> = <span className="text-emerald-300">"対立"</span>
              </div>
              <span className="text-gray-400 text-[10px]">非破壊的Patchブロック</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            ※ 地の文（自然文）を書くと右のCandidate Panelに自動提案されます。
          </p>
        </div>
      )}

      {/* Code Editor Container with Gutter & Syntax Overlay */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          className="w-11 bg-[#14161B] py-3 text-right pr-2 select-none border-r border-[#232730] font-mono text-[12px] text-gray-600 overflow-hidden leading-[20px]"
        >
          {Array.from({ length: lineCount }).map((_, i) => {
            const lineNum = i + 1;
            const isHighlight = highlightedLine === lineNum;
            return (
              <div
                key={lineNum}
                className={`transition-colors ${
                  isHighlight ? 'text-amber-400 font-bold bg-amber-950/40 -mr-2 pr-2' : ''
                }`}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Editor Area (Overlay + Textarea) */}
        <div className="flex-1 relative h-full overflow-hidden bg-[#16181D]">
          {/* Syntax Highlighting Background Overlay */}
          {syntaxHighlightEnabled && (
            <div
              ref={overlayRef}
              aria-hidden="true"
              className="absolute inset-0 p-3 font-mono text-[12.5px] leading-[20px] whitespace-pre overflow-hidden pointer-events-none select-none z-0"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              {lines.map((line, idx) => (
                <div key={idx} className="h-[20px] whitespace-pre">
                  {renderHighlightedLine(line)}
                </div>
              ))}
            </div>
          )}

          {/* Foreground Editable Textarea */}
          <textarea
            id="codex-editor-textarea"
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              onChange(e.target.value);
              if (highlightedLine && onClearHighlight) {
                onClearHighlight();
              }
            }}
            onScroll={handleScroll}
            spellCheck={false}
            className={`absolute inset-0 w-full h-full p-3 font-mono text-[12.5px] leading-[20px] whitespace-pre resize-none outline-none border-none overflow-auto z-10 ${
              syntaxHighlightEnabled
                ? 'bg-transparent text-transparent caret-white selection:bg-indigo-600/40 selection:text-transparent'
                : 'bg-[#16181D] text-gray-200 selection:bg-indigo-900 selection:text-white'
            }`}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
            placeholder="Codex Syntax または自然文を入力してください..."
          />
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;

