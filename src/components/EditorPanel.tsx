import React, { useRef, useEffect, useState } from 'react';
import { FileText, Code2, Sparkles, HelpCircle } from 'lucide-react';

interface EditorPanelProps {
  text: string;
  onChange: (newText: string) => void;
  highlightedLine?: number | null;
  onClearHighlight?: () => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  text,
  onChange,
  highlightedLine,
  onClearHighlight,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  const lines = text.split('\n');
  const lineCount = lines.length;

  // Handle scroll syncing between line numbers and textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
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
      
      // Calculate scroll position approximately
      const lineHeight = 20;
      textarea.scrollTop = Math.max(0, targetIndex * lineHeight - 60);
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textarea.scrollTop;
      }
    }
  }, [highlightedLine]);

  return (
    <div className="h-full flex flex-col bg-[#16181D] border-r border-[#2B2E36] overflow-hidden">
      {/* Editor Header */}
      <div className="h-9 px-3 bg-[#1A1D23] border-b border-[#2B2E36] flex items-center justify-between text-xs text-gray-300">
        <div className="flex items-center space-x-2">
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-medium text-gray-200">Codex Text Editor</span>
          <span className="text-[11px] text-gray-500 font-mono">({lineCount} lines)</span>
        </div>

        <div className="flex items-center space-x-1">
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
            <span>Codex Syntax 記述例</span>
          </div>
          <div className="grid grid-cols-1 gap-1 font-mono text-[11px]">
            <div className="bg-[#14161B] p-1.5 rounded border border-[#2B2E36]">
              <span className="text-emerald-400">[名前:型]</span> または <span className="text-emerald-400">[名前:型:Layer]</span>
              <span className="text-gray-500 block text-[10px]">Entity宣言 (例: [A:Character:Su-ken], [B:Organization:Kan-ken])</span>
            </div>
            <div className="bg-[#14161B] p-1.5 rounded border border-[#2B2E36]">
              <span className="text-sky-400">[A:Character] -&gt; [B:Organization] : 所属</span>
              <span className="text-gray-500 block text-[10px]">型付き明示Relation</span>
            </div>
            <div className="bg-[#14161B] p-1.5 rounded border border-[#2B2E36]">
              <span className="text-amber-400">A -&gt; B : 対立</span>
              <span className="text-gray-500 block text-[10px]">型省略Shorthand (既出名またはUnknown型として生成)</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            ※ 地の文（自然文）を書くと右のCandidate Panelに自動提案されます。
          </p>
        </div>
      )}

      {/* Code Editor Container with Gutter */}
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

        {/* Text Area */}
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
          className="flex-1 h-full bg-[#16181D] text-gray-200 p-3 font-mono text-[12.5px] leading-[20px] resize-none outline-none border-none overflow-auto selection:bg-indigo-900 selection:text-white"
          placeholder="Codex Syntax または自然文を入力してください..."
        />
      </div>
    </div>
  );
};
