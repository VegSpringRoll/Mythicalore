import React, { useState, useEffect } from 'react';
import { AppSettingsRecord, ImageApiProfile } from '../../types/settings';
import { saveAppSettings } from '../../db';
import { 
  X, 
  Image as ImageIcon, 
  Save, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Sparkles
} from 'lucide-react';

interface ImageApiModalProps {
  isOpen: boolean;
  settings: AppSettingsRecord;
  onUpdateSettings: (settings: AppSettingsRecord) => void;
  onClose: () => void;
}

export const ImageApiModal: React.FC<ImageApiModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  // Profiles list
  const initialProfiles: ImageApiProfile[] = (settings.imageApi?.profiles && settings.imageApi.profiles.length > 0)
    ? settings.imageApi.profiles
    : [
        {
          id: 'default-cf',
          name: 'Primary Cloudflare',
          provider: 'cloudflare',
          accountId: settings.imageApi?.accountId || '',
          apiToken: settings.imageApi?.apiToken || '',
          model: settings.imageApi?.model || '@cf/black-forest-labs/flux-1-schnell',
          createdAt: Date.now(),
        },
      ];

  const profiles = initialProfiles;
  const activeProfileId = settings.imageApi?.activeProfileId || profiles[0]?.id || 'default-cf';
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  // Editor states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [model, setModel] = useState('@cf/black-forest-labs/flux-1-schnell');
  const [showToken, setShowToken] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSavedSuccess(false);
      setIsFormOpen(false);
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfigured = Boolean(activeProfile?.accountId?.trim() && activeProfile?.apiToken?.trim());

  const handleStartCreate = () => {
    setEditingId(null);
    setName(`Account ${profiles.length + 1}`);
    setAccountId('');
    setApiToken('');
    setModel('@cf/black-forest-labs/flux-1-schnell');
    setShowToken(false);
    setIsFormOpen(true);
  };

  const handleStartEdit = (p: ImageApiProfile) => {
    setEditingId(p.id);
    setName(p.name);
    setAccountId(p.accountId);
    setApiToken(p.apiToken);
    setModel(p.model);
    setShowToken(false);
    setIsFormOpen(true);
  };

  const handleActivateProfile = async (p: ImageApiProfile) => {
    const updated: AppSettingsRecord = {
      ...settings,
      imageApi: {
        provider: 'cloudflare',
        accountId: p.accountId,
        apiToken: p.apiToken,
        model: p.model,
        enabled: true,
        activeProfileId: p.id,
        profiles,
      },
    };
    await saveAppSettings(updated);
    onUpdateSettings(updated);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      alert('Please enter a profile name.');
      return;
    }
    if (!accountId.trim() || !apiToken.trim()) {
      alert('Please enter both Cloudflare Account ID and API Token.');
      return;
    }

    setIsSaving(true);
    try {
      const newOrUpdatedProfile: ImageApiProfile = {
        id: editingId || `cf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        provider: 'cloudflare',
        accountId: accountId.trim(),
        apiToken: apiToken.trim(),
        model: model.trim(),
        createdAt: editingId
          ? (profiles.find((p) => p.id === editingId)?.createdAt || Date.now())
          : Date.now(),
      };

      const updatedProfiles = editingId
        ? profiles.map((p) => (p.id === editingId ? newOrUpdatedProfile : p))
        : [...profiles, newOrUpdatedProfile];

      // Auto-activate if editing the currently active profile or adding first/new profile
      const nextActiveId = editingId
        ? (activeProfileId === editingId ? newOrUpdatedProfile.id : activeProfileId)
        : newOrUpdatedProfile.id;

      const currentActive = updatedProfiles.find((p) => p.id === nextActiveId) || newOrUpdatedProfile;

      const updated: AppSettingsRecord = {
        ...settings,
        imageApi: {
          provider: 'cloudflare',
          accountId: currentActive.accountId,
          apiToken: currentActive.apiToken,
          model: currentActive.model,
          enabled: true,
          activeProfileId: nextActiveId,
          profiles: updatedProfiles,
        },
      };

      await saveAppSettings(updated);
      onUpdateSettings(updated);
      setIsFormOpen(false);
      setEditingId(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('[ImageApiModal] Save profile error:', err);
      alert('Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      alert('You must have at least one Image API profile. You can edit it instead.');
      return;
    }
    if (!confirm('Delete this Image API profile?')) return;

    const remaining = profiles.filter((p) => p.id !== id);
    const nextActive = remaining[0];

    const updated: AppSettingsRecord = {
      ...settings,
      imageApi: {
        provider: 'cloudflare',
        accountId: nextActive.accountId,
        apiToken: nextActive.apiToken,
        model: nextActive.model,
        enabled: true,
        activeProfileId: nextActive.id,
        profiles: remaining,
      },
    };

    await saveAppSettings(updated);
    onUpdateSettings(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_70px_rgba(0,0,0,0.9)] overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-black/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-glow-white/10">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Image Generator Profiles</span>
                {isConfigured ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {activeProfile?.name || 'Active'}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                    Not Configured
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">Save multiple Cloudflare Workers AI credentials &amp; models</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {savedSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-300 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Image API Profile saved and activated successfully!</span>
            </div>
          )}

          {/* Profile Management Actions Header */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Saved Profiles ({profiles.length})
              </h4>
              <p className="text-[11px] text-zinc-400">
                Switch between accounts or add backup keys for image generation
              </p>
            </div>

            {!isFormOpen && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Profile</span>
              </button>
            )}
          </div>

          {/* Create / Edit Form */}
          {isFormOpen && (
            <div className="p-4 sm:p-5 rounded-2xl bg-black/60 border border-white/20 space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                  <span>{editingId ? 'Edit Image Profile' : 'New Image Generator Profile'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-0.5"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Profile Name */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Profile Label / Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Primary Cloudflare, Backup Key, FLUX Fast"
                    className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/15 text-xs text-white focus:outline-none focus:border-white/40 font-sans"
                  />
                </div>

                {/* Account ID */}
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Cloudflare Account ID
                  </label>
                  <input
                    type="text"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="e.g. 023e105f4ecef8ad9ca31a8372d0c353"
                    className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/15 text-xs text-white focus:outline-none focus:border-white/40 font-mono"
                  />
                </div>

                {/* API Token */}
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Cloudflare API Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      placeholder="Workers AI Token"
                      className="w-full pl-3 pr-9 py-2 rounded-xl bg-black/70 border border-white/15 text-xs text-white focus:outline-none focus:border-white/40 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Text-to-Image Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/15 text-xs text-white focus:outline-none focus:border-white/40 font-mono"
                  >
                    <option value="@cf/black-forest-labs/flux-1-schnell">
                      FLUX.1 Schnell (Recommended - 4-step ultra-fast, high fidelity)
                    </option>
                    <option value="@cf/stabilityai/stable-diffusion-xl-base-1.0">
                      SDXL Base 1.0 (Stability AI)
                    </option>
                    <option value="@cf/bytedance/stable-diffusion-xl-lightning">
                      SDXL Lightning (ByteDance)
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Update Profile' : 'Save Profile'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Saved Profiles Grid */}
          <div className="space-y-2.5">
            {profiles.map((p) => {
              const isActive = p.id === activeProfileId;

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-white/[0.07] border-white/30 shadow-[0_4px_25px_rgba(255,255,255,0.06)]'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">{p.name}</span>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active Profile
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                          {p.model.replace('@cf/', '').replace('black-forest-labs/', '')}
                        </span>
                      </div>

                      <p className="text-[11px] font-mono text-zinc-500 truncate">
                        Account ID: {p.accountId ? `${p.accountId.slice(0, 8)}...${p.accountId.slice(-4)}` : '(Not set)'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleActivateProfile(p)}
                          className="px-3 py-1 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                          Activate
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartEdit(p)}
                        className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title="Edit profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {profiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProfile(p.id)}
                          className="p-1.5 rounded-xl hover:bg-red-500/20 text-zinc-500 hover:text-red-300 transition-colors"
                          title="Delete profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Architecture & Prompt Guide Note */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Refined 2-Sentence SFW Visual Prompts</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              When you tap <strong>Illustrate</strong> on any AI message, your background Summarizer Model digests the character visual appearance from the card and the current message context into a refined 2-sentence visual prompt (sanitizing any adult content to SFW) before sending to Cloudflare.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-white/10 bg-black/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
