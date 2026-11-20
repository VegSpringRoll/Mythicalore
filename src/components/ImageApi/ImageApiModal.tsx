import React, { useState, useEffect } from 'react';
import { AppSettingsRecord } from '../../types/settings';
import { saveAppSettings } from '../../db';
import { 
  X, 
  Image as ImageIcon, 
  Save, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldCheck
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
  const [accountId, setAccountId] = useState(settings.imageApi?.accountId || '');
  const [apiToken, setApiToken] = useState(settings.imageApi?.apiToken || '');
  const [model, setModel] = useState(settings.imageApi?.model || '@cf/black-forest-labs/flux-1-schnell');
  const [showToken, setShowToken] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAccountId(settings.imageApi?.accountId || '');
      setApiToken(settings.imageApi?.apiToken || '');
      setModel(settings.imageApi?.model || '@cf/black-forest-labs/flux-1-schnell');
      setSavedSuccess(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const isConfigured = Boolean(accountId.trim() && apiToken.trim());

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated: AppSettingsRecord = {
        ...settings,
        imageApi: {
          provider: 'cloudflare',
          accountId: accountId.trim(),
          apiToken: apiToken.trim(),
          model: model.trim(),
          enabled: true,
        },
      };
      await saveAppSettings(updated);
      onUpdateSettings(updated);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('[ImageApiModal] Save error:', err);
      alert('Failed to save Image API configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_70px_rgba(0,0,0,0.9)] overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-glow-white/10">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Image API</span>
                {isConfigured ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                    Not Configured
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">Cloudflare Workers AI Image Generation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            Connect your Cloudflare account to unlock high-resolution scene illustrations directly from the footer of any AI response.
          </p>

          {/* Form Fields */}
          <div className="space-y-3.5 pt-1">
            {/* Account ID */}
            <div>
              <label className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider block mb-1.5">
                Cloudflare Account ID
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g. 023e105f4ecef8ad9ca31a8372d0c353"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-black/60 border border-white/15 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Found on your Cloudflare dashboard sidebar under <strong>Workers &amp; Pages</strong>.
              </p>
            </div>

            {/* API Token */}
            <div>
              <label className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider block mb-1.5">
                Cloudflare API Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Workers AI Read / Write Token"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl bg-black/60 border border-white/15 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Token requires <code>Workers AI: Read</code> permission.
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider block mb-1.5">
                Image Generation Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-white/40 font-mono"
              >
                <option value="@cf/black-forest-labs/flux-1-schnell">
                  FLUX.1 Schnell (Recommended - 4 Step Ultra-Fast)
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

          {/* Architecture & Safety Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Automatic SFW Conversion by Summary Model</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              When you click <strong>Illustrate</strong>, your background Summarizer Model digests the scene context and character visuals into an artistic visual prompt, automatically sanitizing explicit elements to SFW. The main roleplay context remains untouched.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/40">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
              savedSuccess
                ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.25)]'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-black" />
                <span>Saved Successfully!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
