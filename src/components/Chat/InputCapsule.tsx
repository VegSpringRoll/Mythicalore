import React, { useRef, useEffect } from 'react';
import { Send, Square, Compass, Eye, Feather } from 'lucide-react';
import { estimateTokens } from '../../services/tokenEstimator';

interface InputCapsuleProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  cumulativeTokens: number;
  onOpenInspector: () => void;
}

export const InputCapsule: React.FC<InputCapsuleProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  cumulativeTokens,
  onOpenInspector,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftTokens = estimateTokens(value);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 180);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isStreaming && value.trim()) {
        onSend();
      }
    }
  };

  const handleInsertOOC = () => {
    const oocTemplate = '(OOC: Direct the scene to: )';
    const nextVal = value ? `${value} ${oocTemplate}` : oocTemplate;
    onChange(nextVal);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length - 1;
        textareaRef.current.selectionEnd = textareaRef.current.value.length - 1;
      }
    }, 50);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto flex flex-col gap-2 p-3 sm:p-3.5 rounded-[26px] bg-[#0c0c0f]/85 backdrop-blur-2xl border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.85)] transition-all">
      {/* Top Diagnostics & Tools Bar matching image */}
      <div className="flex items-center justify-between px-1.5 text-xs">
        {/* Token Pill & Inspector */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Monochrome Token Circle Pill */}
          <span 
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/10 font-mono text-[11px] text-zinc-300 shadow-inner"
            title="Whole-chronicle cumulative token count"
          >
            <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] inline-block"></span>
            <span>~{cumulativeTokens} total tokens</span>
          </span>

          {/* Current Draft Token Count Pill */}
          {draftTokens > 0 && (
            <span 
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 font-mono text-[11px] text-white animate-fadeIn"
              title="Estimated tokens in current draft"
            >
              <span>✍️ ~{draftTokens} draft</span>
            </span>
          )}

          {/* Turn Prompt Inspector Trigger */}
          <button
            type="button"
            onClick={onOpenInspector}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 border border-white/20 text-[11px] font-semibold text-white transition-all shadow-sm"
            title="Inspect exact assembled prompt, active director rules, and triggered lore"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-300" />
            <span>Inspect</span>
          </button>
        </div>

        {/* 1-Click OOC Steering Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInsertOOC}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 border border-white/20 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors"
            title="Insert (OOC: ...) director steering tag"
          >
            <Compass className="w-3 h-3 text-zinc-300" />
            <span>(OOC)</span>
          </button>
        </div>
      </div>

      {/* Main Multiline Input Area with Quill icon & Monochrome Send Button */}
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <Feather className="w-4 h-4 text-zinc-400 shrink-0 mb-0.5" />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your protagonist's action or dialogue..."
          rows={1}
          className="flex-1 max-h-40 min-h-[38px] py-1.5 px-2 bg-transparent border-none text-white text-sm placeholder-zinc-500 focus:outline-none resize-none leading-relaxed font-sans"
        />

        {/* Action Button: Send or Stop */}
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-white/30 text-white flex items-center justify-center shrink-0 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            title="Stop Generating (AbortController)"
          >
            <Square className="w-4 h-4 fill-white" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!value.trim()}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-white text-black hover:bg-zinc-200 flex items-center justify-center shrink-0 transition-all shadow-[0_0_20px_rgba(255,255,255,0.25)] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none hover:scale-105 active:scale-95 font-bold"
            title="Send Message"
          >
            <Send className="w-4 h-4 text-black fill-black" />
          </button>
        )}
      </div>
    </div>
  );
};
