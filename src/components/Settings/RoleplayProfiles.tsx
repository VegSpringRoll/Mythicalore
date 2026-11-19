import React, { useState } from 'react';
import { RoleplayProfile, ProviderId, AppSettingsRecord } from '../../types/settings';
import { testConnection, fetchProviderModels, TestConnectionResult, ModelOption } from '../../services/llmClient';
import { saveAppSettings } from '../../db';
import { 
  Cpu, 
  Plus, 
  Check, 
  Trash2, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Edit2, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Search,
  Zap,
  Save,
  Sliders
} from 'lucide-react';

interface RoleplayProfilesProps {
  settings: AppSettingsRecord;
  onUpdateSettings: (settings: AppSettingsRecord) => void;
}

const PROVIDER_OPTIONS: Array<{ id: ProviderId; label: string; defaultBaseUrl: string; placeholderModel: string }> = [
  { id: 'openrouter', label: 'OpenRouter (Multi-Model / Recommended)', defaultBaseUrl: 'https://openrouter.ai/api/v1', placeholderModel: 'anthropic/claude-3.5-sonnet' },
  { id: 'anthropic', label: 'Anthropic (Claude Direct)', defaultBaseUrl: 'https://api.anthropic.com/v1', placeholderModel: 'claude-3-5-sonnet-20241022' },
  { id: 'openai', label: 'OpenAI Direct', defaultBaseUrl: 'https://api.openai.com/v1', placeholderModel: 'gpt-4o' },
  { id: 'gemini', label: 'Google Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', placeholderModel: 'gemini-2.0-flash' },
  { id: 'groq', label: 'Groq (Ultra-Fast)', defaultBaseUrl: 'https://api.groq.com/openai/v1', placeholderModel: 'llama-3.3-70b-versatile' },
  { id: 'mistral', label: 'Mistral AI', defaultBaseUrl: 'https://api.mistral.ai/v1', placeholderModel: 'mistral-large-latest' },
  { id: 'custom', label: 'Local / Custom Endpoint (Ollama, llama.cpp, vLLM)', defaultBaseUrl: 'http://localhost:11434/v1', placeholderModel: 'llama3.2' },
];

export const RoleplayProfiles: React.FC<RoleplayProfilesProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const profiles = settings.roleplayProfiles || [];
  const activeProfileId = settings.primaryModel.profileId;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(profiles.length === 0);

  // Form states
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<ProviderId>('openrouter');
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [showKey, setShowKey] = useState(false);

  // Model Fetching states
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<ModelOption[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Ping test
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const startEdit = (p: RoleplayProfile) => {
    setEditingId(p.id);
    setName(p.name);
    setProvider(p.provider);
    setModel(p.model);
    setApiKey(p.apiKey || '');
    setBaseUrl(p.baseUrl || PROVIDER_OPTIONS.find((o) => o.id === p.provider)?.defaultBaseUrl || '');
    setIsFormOpen(true);
    setTestResult(null);
    setFetchError(null);
    setSaveSuccessMsg(null);
  };

  const startCreate = () => {
    setEditingId(null);
    setName('');
    const def = PROVIDER_OPTIONS[0];
    setProvider(def.id);
    setModel(def.placeholderModel);
    setApiKey('');
    setBaseUrl(def.defaultBaseUrl);
    setFetchedModels([]);
    setIsFormOpen(true);
    setTestResult(null);
    setFetchError(null);
    setSaveSuccessMsg(null);
  };

  const handleFetch = async () => {
    if (!apiKey && provider !== 'custom') {
      alert('Please enter your API Key first to fetch available models.');
      return;
    }
    setIsFetchingModels(true);
    setFetchError(null);

    try {
      const list = await fetchProviderModels(provider, apiKey.trim(), baseUrl.trim());
      setFetchedModels(list);
      if (list.length > 0 && !model) {
        setModel(list[0].id);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !model.trim()) {
      alert('Please provide a profile name and select or enter a model identifier.');
      return;
    }

    const defaultUrl = PROVIDER_OPTIONS.find((o) => o.id === provider)?.defaultBaseUrl;

    const newProfile: RoleplayProfile = {
      id: editingId || `rp-${Date.now()}`,
      name: name.trim(),
      provider,
      model: model.trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || defaultUrl,
      createdAt: Date.now(),
    };

    let updatedList: RoleplayProfile[];
    if (editingId) {
      updatedList = profiles.map((p) => (p.id === editingId ? newProfile : p));
    } else {
      updatedList = [...profiles, newProfile];
    }

    const updatedSettings: AppSettingsRecord = {
      ...settings,
      roleplayProfiles: updatedList,
      primaryModel: {
        provider: newProfile.provider,
        model: newProfile.model,
        customUrl: newProfile.baseUrl,
        profileId: newProfile.id,
      },
      providers: {
        ...settings.providers,
        [newProfile.provider]: {
          apiKey: newProfile.apiKey,
          baseUrl: newProfile.baseUrl || settings.providers[newProfile.provider]?.baseUrl,
        },
      },
    };

    // Save directly to IndexedDB
    await saveAppSettings(updatedSettings);
    onUpdateSettings(updatedSettings);

    setSaveSuccessMsg(`Profile "${newProfile.name}" saved & activated!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);

    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleSelectProfile = async (p: RoleplayProfile) => {
    const updatedSettings: AppSettingsRecord = {
      ...settings,
      primaryModel: {
        provider: p.provider,
        model: p.model,
        customUrl: p.baseUrl,
        profileId: p.id,
      },
      providers: {
        ...settings.providers,
        [p.provider]: {
          apiKey: p.apiKey,
          baseUrl: p.baseUrl || settings.providers[p.provider]?.baseUrl,
        },
      },
    };
    await saveAppSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
  };

  const handleDelete = async (id: string) => {
    const updatedList = profiles.filter((p) => p.id !== id);
    let updatedPrimary = settings.primaryModel;

    if (activeProfileId === id && updatedList[0]) {
      const nextActive = updatedList[0];
      updatedPrimary = {
        provider: nextActive.provider,
        model: nextActive.model,
        customUrl: nextActive.baseUrl,
        profileId: nextActive.id,
      };
    }

    const updatedSettings: AppSettingsRecord = {
      ...settings,
      roleplayProfiles: updatedList,
      primaryModel: updatedPrimary,
    };

    await saveAppSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
  };

  const handleTest = async () => {
    if (!model.trim()) {
      alert('Enter or select a model identifier first.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    const defaultUrl = PROVIDER_OPTIONS.find((o) => o.id === provider)?.defaultBaseUrl;
    const result = await testConnection(provider, model.trim(), apiKey.trim(), baseUrl.trim() || defaultUrl);

    setTestResult(result);
    setIsTesting(false);
  };

  const filteredModels = fetchedModels.filter((m) => 
    m.id.toLowerCase().includes(modelSearch.toLowerCase()) || 
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-white" />
            <span>Roleplay BYOK & Models</span>
          </h4>
          <p className="text-xs text-zinc-400">
            Connect your API keys, auto-fetch models from providers, and save profiles.
          </p>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            onClick={startCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-black" />
            <span>New BYOK Profile</span>
          </button>
        )}
      </div>

      {saveSuccessMsg && (
        <div className="p-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Connection Form */}
      {isFormOpen && (
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/20 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-zinc-300" />
              <span>{editingId ? `Edit BYOK Profile: ${name}` : 'Configure New BYOK Profile'}</span>
            </h5>
            {profiles.length > 0 && (
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Close
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            {/* Profile Name */}
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Profile Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Claude 3.5 Sonnet, OpenRouter Llama 3"
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-white"
              />
            </div>

            {/* Provider */}
            <div>
              <label className="block text-zinc-400 font-medium mb-1">API Provider *</label>
              <select
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as ProviderId;
                  setProvider(p);
                  const def = PROVIDER_OPTIONS.find((o) => o.id === p);
                  if (def) {
                    setBaseUrl(def.defaultBaseUrl);
                    setModel(def.placeholderModel);
                  }
                  setFetchedModels([]);
                  setTestResult(null);
                  setFetchError(null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-white"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-zinc-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-zinc-400 font-medium mb-1">
                API Key {provider === 'custom' && '(Optional for local endpoints)'}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'custom' ? 'Not required for Ollama' : 'sk-...'}
                  className="w-full pr-8 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono focus:outline-none focus:border-white"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-zinc-400 font-medium mb-1">API Base URL / Endpoint</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={PROVIDER_OPTIONS.find((o) => o.id === provider)?.defaultBaseUrl}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono focus:outline-none focus:border-white"
              />
            </div>
          </div>

          {/* Model Selector Section with Connect / Auto-Fetch Button (SillyTavern style!) */}
          <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-300" />
                <span>Model Selector (Auto-Fetch or Custom ID)</span>
              </label>

              {/* Connect / Fetch Models Button */}
              <button
                type="button"
                onClick={handleFetch}
                disabled={isFetchingModels || (!apiKey && provider !== 'custom')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                <span>{isFetchingModels ? 'Connecting & Fetching...' : 'Connect / Fetch Models'}</span>
              </button>
            </div>

            {/* If models were fetched, show searchable dropdown */}
            {fetchedModels.length > 0 ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder={`Filter among ${fetchedModels.length} models...`}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-white"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto rounded-xl bg-black/60 border border-white/10 divide-y divide-white/5 scrollbar-thin">
                  {filteredModels.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      className={`px-3 py-2 cursor-pointer text-xs flex items-center justify-between transition-colors ${
                        model === m.id
                          ? 'bg-white/20 text-white font-semibold'
                          : 'hover:bg-white/5 text-zinc-300'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <span className="font-mono text-white">{m.id}</span>
                        {m.name && m.name !== m.id && (
                          <span className="text-[10px] text-zinc-400 block truncate">{m.name}</span>
                        )}
                      </div>
                      {model === m.id && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. anthropic/claude-3.5-sonnet, gpt-4o, llama3.2"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  💡 Click <strong>Connect / Fetch Models</strong> above to auto-load available models directly from {provider}.
                </p>
              </div>
            )}

            {fetchError && (
              <p className="text-[11px] text-zinc-300 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Fetch Error: {fetchError}</span>
              </p>
            )}
          </div>

          {/* Action Buttons: Test Connection & Save Profile */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || (!apiKey && provider !== 'custom')}
              className="flex items-center gap-1.5 text-xs text-zinc-300 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 transition-all disabled:opacity-40"
            >
              <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing Latency...' : 'Test Connection'}</span>
            </button>

            <div className="flex items-center gap-2">
              {profiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
              >
                <Save className="w-3.5 h-3.5 text-black" />
                <span>Save Profile</span>
              </button>
            </div>
          </div>

          {/* Test Ping Result Badge */}
          {testResult && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-black/60 border-white/20 text-zinc-300'
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Success! Latency: <strong>{testResult.latencyMs}ms</strong> — Ready for roleplay!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Connection failed: {testResult.error}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Saved Profiles Grid */}
      <div className="space-y-3">
        <h5 className="text-xs font-semibold text-zinc-300">Saved BYOK Profiles ({profiles.length})</h5>

        {profiles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profiles.map((p) => {
              const isActive = p.id === activeProfileId;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectProfile(p)}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex flex-col justify-between transition-all ${
                    isActive
                      ? 'border-white/40 bg-white/10 shadow-glow-white/10'
                      : 'border-white/10 hover:border-white/20 bg-[#0e0e12]/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-white truncate">{p.name}</h5>
                      {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-black font-semibold flex items-center gap-1 shadow-sm">
                          <Check className="w-2.5 h-2.5 text-black" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-zinc-300 mt-1 truncate">
                      {p.provider}: {p.model}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between">
                    <span className="text-[11px] text-zinc-300">
                      {isActive ? 'Primary Model Active' : 'Click to Activate'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(p);
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-white"
                        title="Edit Profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete BYOK profile "${p.name}"?`)) {
                            handleDelete(p.id);
                          }
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !isFormOpen && (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
              <p className="text-xs text-zinc-400">
                No saved BYOK profiles yet. Configure your provider key and model above.
              </p>
              <button
                type="button"
                onClick={startCreate}
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
              >
                + Add Your First BYOK Model
              </button>
            </div>
          )
        )}
      </div>

      {/* --- SLIDING WINDOW ACTIVE TURNS (BYOK Context Window Setting) --- */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-300" />
              <span>Sliding Window Active Turns</span>
            </label>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Controls how many recent chat turns (user + assistant) are sent directly to the AI in the active prompt payload. Older turns are digested by the Summarizer.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={2}
              max={50}
              value={settings.contextWindow.slidingWindowTurns || 10}
              onChange={async (e) => {
                const val = Math.max(2, Math.min(50, parseInt(e.target.value, 10) || 10));
                const updatedSettings: AppSettingsRecord = {
                  ...settings,
                  contextWindow: {
                    ...settings.contextWindow,
                    slidingWindowTurns: val,
                  },
                };
                await saveAppSettings(updatedSettings);
                onUpdateSettings(updatedSettings);
              }}
              className="w-16 px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/15 text-white font-mono text-center text-xs focus:outline-none focus:border-white"
            />
            <span className="text-xs font-medium text-zinc-300">turns</span>
          </div>
        </div>
      </div>
    </div>
  );
};
