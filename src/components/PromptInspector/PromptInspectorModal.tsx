import React, { useState } from 'react';
import { PromptInspectionData } from '../../types/llm';
import { 
  X, 
  Copy, 
  Check, 
  Eye, 
  Layers, 
  BookOpen, 
  ShieldAlert, 
  FileCode,
  Sparkles
} from 'lucide-react';

interface PromptInspectorModalProps {
  isOpen: boolean;
  data: PromptInspectionData | null;
  onClose: () => void;
}

export const PromptInspectorModal: React.FC<PromptInspectorModalProps> = ({
  isOpen,
  data,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'window' | 'lore' | 'raw'>('system');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(data.rawPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-4xl h-[90vh] flex flex-col rounded-3xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-glow-white/10">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Turn Prompt Inspector
                <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15">
                  🪙 ~{data.totalTokensEstimated} Dispatched Tokens
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Transparent multi-tier prompt assembly diagnostics & raw dispatch payload
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPayload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-semibold transition-all shadow-sm"
              title="Copy Full Dispatched JSON Payload"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-white" />}
              <span>{copied ? 'Copied Payload!' : 'Copy Full Payload'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/30 px-6 gap-3 text-xs font-medium overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('system')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'system'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Assembled System Prompt</span>
          </button>

          <button
            onClick={() => setActiveTab('window')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'window'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sliding Window History ({data.activeWindowMessages.length} items)</span>
          </button>

          <button
            onClick={() => setActiveTab('lore')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'lore'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Triggered Lorebook ({data.triggeredLore.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'raw'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw Dispatched Payload</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs">
          {/* TAB 1: SYSTEM PROMPT */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-2 text-zinc-300">
                <Sparkles className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  All macros ({'{{char}}'}, {'{{user}}'}, etc.) resolved. Includes character persona, protagonist bio, Tier 2 historical summary, and Tier 3 pinned memories.
                </p>
              </div>

              {/* Director Rules Checklist */}
              {data.directorRules.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Active Director Rules & Anchors
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300 text-[11px]">
                    {data.directorRules.map((rule, idx) => (
                      <li key={idx}>{rule}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {data.systemPrompt}
              </div>
            </div>
          )}

          {/* TAB 2: SLIDING WINDOW */}
          {activeTab === 'window' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400 font-sans">
                Only the active window turns are sent to the LLM. Older turns are digested by the Tier 2 Background Summarizer into the rolling summary.
              </p>

              {data.activeWindowMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border ${
                    msg.role === 'user'
                      ? 'bg-white/10 border-white/25 text-zinc-100'
                      : msg.role === 'system'
                      ? 'bg-white/[0.03] border-white/10 text-zinc-400'
                      : 'bg-black/60 border-white/15 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 text-[10px] uppercase font-bold tracking-wider">
                    <span className={msg.role === 'user' ? 'text-white' : 'text-zinc-300'}>
                      {msg.role}
                    </span>
                    <span className="text-zinc-500">Item #{idx + 1}</span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-xs">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: TRIGGERED LOREBOOK */}
          {activeTab === 'lore' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400 font-sans">
                Keywords scanned from the active scene and current draft. Only matched lore entries are injected into Tier 3 memory.
              </p>

              {data.triggeredLore.length > 0 ? (
                <div className="space-y-3">
                  {data.triggeredLore.map((entry, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white/[0.03] border border-white/15 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white">{entry.name}</h4>
                        <div className="flex items-center gap-1">
                          {entry.keys.map((k, kIdx) => (
                            <span key={kIdx} className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 border border-white/10">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {entry.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-zinc-500 font-sans">
                  No keywords in current scene or draft triggered lorebook entries.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RAW PAYLOAD */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-sans">Exact JSON dispatched to proxy backend:</span>
                <button
                  onClick={handleCopyPayload}
                  className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white hover:underline font-sans"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-black/60 border border-white/10 text-zinc-300 whitespace-pre-wrap leading-relaxed overflow-x-auto text-[11px]">
                {JSON.stringify(data.rawPayload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
