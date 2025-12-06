import React, { useEffect, useRef } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  highlightLineIndex: number | null;
  errors: string[];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, highlightLineIndex, errors }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lineCount = value.split('\n').length;
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

  // Synchronize scrolling
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Scroll to highlighted line
  useEffect(() => {
    if (highlightLineIndex !== null && textareaRef.current) {
      // Approximate line height (depends on font size/line-height in CSS)
      const lineHeight = 24; // Matches leading-6 (1.5rem = 24px)
      const targetTop = highlightLineIndex * lineHeight;
      
      textareaRef.current.scrollTo({
        top: targetTop - textareaRef.current.clientHeight / 2,
        behavior: 'smooth'
      });
    }
  }, [highlightLineIndex]);

  return (
    <div className="flex flex-col h-full border border-zinc-800 rounded-lg bg-zinc-950 overflow-hidden font-mono text-sm">
      <div className="flex-1 relative flex min-h-0">
        {/* Line Numbers Gutter */}
        <div 
          ref={lineNumbersRef}
          className="w-12 bg-zinc-900 border-r border-zinc-800 text-zinc-500 text-right pr-2 pt-4 pb-4 overflow-hidden select-none leading-6"
        >
          {lines.map((num, idx) => (
            <div 
              key={num} 
              className={`transition-colors duration-100 ${
                highlightLineIndex === idx ? 'text-blue-400 font-bold bg-blue-900/20 -mr-2 pr-2' : ''
              }`}
            >
              {num}
            </div>
          ))}
        </div>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          className="flex-1 bg-transparent text-zinc-300 p-0 pt-4 pb-4 pl-4 resize-none outline-none border-none leading-6 whitespace-pre"
          spellCheck={false}
        />
      </div>
      
      {/* Error Footer */}
      {errors.length > 0 && (
        <div className="bg-red-900/20 border-t border-red-900/50 p-2 text-xs text-red-300 max-h-24 overflow-y-auto">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}
    </div>
  );
};