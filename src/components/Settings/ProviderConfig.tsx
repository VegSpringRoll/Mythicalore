import React, { useState } from 'react';
import { ProviderId, ProviderConfig as ProviderConfigType } from '../../types/settings';
import { testConnection, TestConnectionResult } from '../../services/llmClient';
import { Key, Eye, EyeOff, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProviderConfigProps {
  providers: Record<ProviderId, ProviderConfigType>;
  onChange: (updated: Record<ProviderId, ProviderConfigType>) => void;
}

interface ProviderMeta {
  id: ProviderId;
  name: string;
  badge: string;
  defaultBaseUrl: string;
  hint: string;
  defaultModelForTest: string;
  isLocal?: boolean;
}

const PROVIDERS_META: ProviderMeta[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter (Recommended)',
    badge: 'Universal Multi-Model',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    hint: 'Access Claude 3.5, Llama 3.3, DeepSeek, and unaligned roleplay models.',
    defaultModelForTest: 'anthropic/claude-3.5-sonnet',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    badge: 'GPT-4o / GPT-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    hint: 'Official OpenAI API key. Note: OpenAI strips min_p and repetition penalties.',
    defaultModelForTest: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    badge: 'Claude 3.5 Sonnet',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    hint: 'Official Anthropic key. Formats top-level system prompts automatically.',
    defaultModelForTest: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Flash / Pro',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    hint: 'Google AI Studio key. High speed & generous token context.',
    defaultModelForTest: 'gemini-1.5-flash',
  },
  {
    id: 'groq',
    name: 'Groq',
    badge: 'Ultra-Fast Llama',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    hint: 'Super high token/sec speed. Ideal for background summarizer and rapid turns.',
    defaultModelForTest: 'llama-3.3-70b-versatile',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    badge: 'Mistral Large / Nemo',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    hint: 'Mistral official endpoint with strong creative prose capabilities.',
    defaultModelForTest: 'mistral-large-latest',
  },
  {
    id: 'custom',
    name: 'Local / Custom Endpoint',
    badge: 'Ollama / llama.cpp / vLLM',
    defaultBaseUrl: 'http://localhost:11434/v1',
    hint: 'Connect to llama.cpp (llama-server), Ollama, LM Studio, or vLLM locally.',
    defaultModelForTest: 'llama3.2',
    isLocal: true,
  },
];

export const ProviderConfig: React.FC<ProviderConfigProps> = ({ providers, onChange }) => {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestConnectionResult>>({});

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdate = (id: ProviderId, field: 'apiKey' | 'baseUrl', value: string) => {
    const current = providers[id] || { apiKey: '' };
    onChange({
      ...providers,
      [id]: {
        ...current,
        [field]: value,
      },
    });
  };

  const handleTest = async (meta: ProviderMeta) => {
    setTesting((prev) => ({ ...prev, [meta.id]: true }));
    setTestResults((prev) => {
      const copy = { ...prev };
      delete copy[meta.id];
      return copy;
    });

    const config = providers[meta.id] || { apiKey: '' };
    const result = await testConnection(
      meta.id,
      meta.defaultModelForTest,
      config.apiKey,
      config.baseUrl || meta.defaultBaseUrl
    );

    setTestResults((prev) => ({ ...prev, [meta.id]: result }));
    setTesting((prev) => ({ ...prev, [meta.id]: false }));
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
        <Key className="w-4 h-4 text-white shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-300 leading-relaxed">
          <strong className="text-white">BYOK (Bring Your Own Key) Security Promise:</strong> API keys are stored solely inside your browser's local IndexedDB. They are transmitted statelessly in request headers only during generation and are never written to disk or logged by the proxy server.
        </div>
      </div>

      <div className="space-y-3">
        {PROVIDERS_META.map((meta) => {
          const config = providers[meta.id] || { apiKey: '', baseUrl: meta.defaultBaseUrl };
          const isKeyVisible = showKeys[meta.id];
          const isTestingNow = testing[meta.id];
          const result = testResults[meta.id];

          return (
            <div
              key={meta.id}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{meta.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-300 border border-white/10 font-mono">
                      {meta.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{meta.hint}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleTest(meta)}
                  disabled={isTestingNow || (!meta.isLocal && !config.apiKey)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 text-xs font-medium text-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Activity className={`w-3.5 h-3.5 text-zinc-300 ${isTestingNow ? 'animate-spin' : ''}`} />
                  <span>{isTestingNow ? 'Pinging...' : 'Test Connection'}</span>
                </button>
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* API Key */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    API Key {meta.isLocal && '(Optional for local endpoints)'}
                  </label>
                  <div className="relative">
                    <input
                      type={isKeyVisible ? 'text' : 'password'}
                      value={config.apiKey || ''}
                      onChange={(e) => handleUpdate(meta.id, 'apiKey', e.target.value)}
                      placeholder={meta.isLocal ? 'Not required for Ollama / LM Studio' : 'sk-...'}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey(meta.id)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Base URL / Endpoint
                  </label>
                  <input
                    type="text"
                    value={config.baseUrl ?? meta.defaultBaseUrl}
                    onChange={(e) => handleUpdate(meta.id, 'baseUrl', e.target.value)}
                    placeholder={meta.defaultBaseUrl}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* Test Connection Results Badge */}
              {result && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    result.success
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-black/60 border-white/20 text-zinc-300'
                  }`}
                >
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    {result.success ? (
                      <div>
                        <strong>Connection Verified!</strong> Latency: <span className="font-mono text-white">{result.latencyMs}ms</span>
                        {result.preview && <span className="text-[11px] text-zinc-300 block mt-0.5 font-mono">Response: "{result.preview}"</span>}
                      </div>
                    ) : (
                      <div>
                        <strong>Connection Failed:</strong> {result.error}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
