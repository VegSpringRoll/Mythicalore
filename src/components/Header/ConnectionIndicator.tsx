import React, { useState, useEffect, useCallback } from 'react';
import { AppSettingsRecord } from '../../types/settings';
import { testConnection } from '../../services/llmClient';
import { Activity } from 'lucide-react';

interface ConnectionIndicatorProps {
  settings: AppSettingsRecord;
  onOpenSettings: () => void;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  settings,
  onOpenSettings,
}) => {
  const [status, setStatus] = useState<'connected' | 'testing' | 'disconnected'>('testing');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setStatus('testing');
    setErrorMsg(null);

    const activeRpProfile = settings.roleplayProfiles?.find((p) => p.id === settings.primaryModel.profileId)
      || settings.roleplayProfiles?.[0];

    const provider = activeRpProfile?.provider || settings.primaryModel.provider;
    const model = activeRpProfile?.model || settings.primaryModel.model;
    const apiKey = activeRpProfile?.apiKey || settings.providers[provider]?.apiKey;
    const baseUrl = activeRpProfile?.baseUrl || settings.primaryModel.customUrl || settings.providers[provider]?.baseUrl;

    if (!apiKey && provider !== 'custom') {
      setStatus('disconnected');
      setErrorMsg('No API Key configured');
      return;
    }

    const res = await testConnection(provider, model, apiKey, baseUrl);
    if (res.success && res.latencyMs !== undefined) {
      setStatus('connected');
      setLatencyMs(res.latencyMs);
    } else {
      setStatus('disconnected');
      setErrorMsg(res.error || 'Connection failed');
    }
  }, [settings]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          if (status === 'disconnected') {
            onOpenSettings();
          } else {
            checkConnection();
          }
        }}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs font-mono transition-all ${
          status === 'connected'
            ? 'bg-white/[0.08] border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.18)] hover:border-white/50'
            : status === 'testing'
            ? 'bg-white/[0.03] border-white/20 text-zinc-400'
            : 'bg-black/50 border-white/10 text-zinc-500 hover:border-white/25'
        }`}
        title={
          status === 'connected'
            ? `Active AI Connection (${latencyMs}ms). Click to re-ping.`
            : status === 'testing'
            ? 'Testing AI connection...'
            : `${errorMsg || 'Disconnected'}. Click to configure BYOK settings.`
        }
      >
        {status === 'connected' ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"></span>
            </span>
            <span className="font-semibold">{latencyMs ? `${latencyMs}ms` : 'Online'}</span>
          </>
        ) : status === 'testing' ? (
          <>
            <Activity className="w-3 h-3 text-zinc-300 animate-spin" />
            <span className="font-semibold text-zinc-300">Pinging...</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>
            </span>
            <span className="font-semibold text-zinc-400">Offline</span>
          </>
        )}
      </button>
    </div>
  );
};
