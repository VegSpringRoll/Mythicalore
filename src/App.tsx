import { useEffect, useState } from 'react';
import { initDatabase, getAppSettings } from './db';
import { blobToDataUrl } from './services/pngParser';
import { AppSettingsRecord } from './types/settings';
import { CharacterRecord } from './types/characterCard';
import { PersonaRecord } from './types/persona';
import { db } from './db';
import { CardGalleryModal } from './components/CardGallery/CardGalleryModal';
import { PersonaModal } from './components/Persona/PersonaModal';
import { SettingsDrawer } from './components/Settings/SettingsDrawer';
import { LorebookManagerModal } from './components/Lorebook/LorebookManagerModal';
import { ChatContainer } from './components/Chat/ChatContainer';
import { ChatHistoryModal } from './components/Chat/ChatHistoryModal';
import { ConnectionIndicator } from './components/Header/ConnectionIndicator';
import { SoundwavePill } from './components/Header/SoundwavePill';
import { AtmosphericBackground } from './components/UI/AtmosphericBackground';
import { 
  User, 
  Layers, 
  MessageSquare, 
  Settings as SettingsIcon,
  Plus, 
  Bookmark, 
  ScrollText, 
  Cpu, 
  PenTool,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettingsRecord | null>(null);
  const [activeCharacter, setActiveCharacter] = useState<CharacterRecord | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaRecord | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Modals & Sidebars
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLorebookOpen, setIsLorebookOpen] = useState(false);
  const [isWorldStateOpen, setIsWorldStateOpen] = useState(false);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [activeAtmosphere, setActiveAtmosphere] = useState<string>('Mysterious');

  // Chat key to force remount on fresh session
  const [chatSessionKey, setChatSessionKey] = useState(0);

  useEffect(() => {
    async function setup() {
      await initDatabase();
      const loadedSettings = await getAppSettings();
      setSettings(loadedSettings);

      const personas = await db.personas.toArray();
      for (const p of personas) {
        if (p.avatarBlob && (!p.avatarUrl || p.avatarUrl.startsWith('blob:'))) {
          p.avatarUrl = await blobToDataUrl(p.avatarBlob);
          await db.personas.update(p.id, { avatarUrl: p.avatarUrl });
        }
      }
      const defPersona = personas.find((p) => p.isDefault) || personas[0] || null;
      setActivePersona(defPersona);

      const characters = await db.characters.toArray();
      const favChar = characters.find((c) => c.isFavorite) || characters[0] || null;
      if (favChar && favChar.avatarBlob && (!favChar.avatarUrl || favChar.avatarUrl.startsWith('blob:'))) {
        favChar.avatarUrl = await blobToDataUrl(favChar.avatarBlob);
        await db.characters.update(favChar.id, { avatarUrl: favChar.avatarUrl });
      }
      setActiveCharacter(favChar);

      setReady(true);
    }
    setup();
  }, []);

  const handleNewChat = async () => {
    if (!activeCharacter || !activePersona) return;
    if (confirm(`Start a fresh roleplay session with ${activeCharacter.name}? (Older sessions remain saved in chat history)`)) {
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await db.sessions.put({
        id: newSessionId,
        characterId: activeCharacter.id,
        personaId: activePersona.id,
        title: `Roleplay with ${activeCharacter.name}`,
        rollingSummary: '',
        pinnedMemories: [],
        worldState: {
          time: 'Midnight (23:45)',
          date: 'Day 14, Lunar Eclipse',
          location: activeCharacter.genre === 'Cyberpunk' ? 'Sector 7 Hideout' : 'Sunken Sanctum - Reliquary Crypts',
          atmosphere: 'Cold stone, distant solemn bells, incense smoke',
          notes: 'Prevent the red mist from breaching the sanctuary seals',
        },
        chapters: [],
        chapterTurnInterval: settings?.contextWindow.chapterTurnInterval || 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setActiveSessionId(newSessionId);
      setChatSessionKey((k) => k + 1);
    }
  };

  const handleSelectSession = async (sessionId: string, characterId: string, personaId: string) => {
    const char = await db.characters.get(characterId);
    const pers = await db.personas.get(personaId);
    if (char) {
      if (char.avatarBlob && (!char.avatarUrl || char.avatarUrl.startsWith('blob:'))) {
        char.avatarUrl = await blobToDataUrl(char.avatarBlob);
      }
      setActiveCharacter(char);
    }
    if (pers) {
      if (pers.avatarBlob && (!pers.avatarUrl || pers.avatarUrl.startsWith('blob:'))) {
        pers.avatarUrl = await blobToDataUrl(pers.avatarBlob);
      }
      setActivePersona(pers);
    }
    setActiveSessionId(sessionId);
    setChatSessionKey((k) => k + 1);
    setIsChatHistoryOpen(false);
  };

  if (!ready || !settings) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050507] text-zinc-300">
        <div className="flex flex-col items-center gap-3">
          <PenTool className="w-8 h-8 text-white animate-pulse" />
          <p className="text-sm tracking-wide text-zinc-400">Initializing Mythicalore Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden text-gray-100 font-sans selection:bg-white/20 selection:text-white bg-[#050507]">
      {/* Dynamic Scenic Background matching image */}
      <AtmosphericBackground />

      {/* --- DESKTOP LEFT NAVIGATION RAIL (sm:flex) --- */}
      <aside className="hidden sm:flex w-16 bg-[#08080a]/85 backdrop-blur-2xl border-r border-white/10 flex-col items-center py-4 justify-between shrink-0 z-40 shadow-2xl">
        {/* Top Brand Logo */}
        <div className="flex flex-col items-center gap-5">
          <div 
            onClick={() => setIsGalleryOpen(true)}
            className="h-10 w-10 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-900 border border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center text-white cursor-pointer hover:scale-105 transition-transform"
            title="Mythicalore Vault"
          >
            <PenTool className="w-4 h-4 text-white" />
          </div>

          {/* Action Icons List */}
          <div className="flex flex-col items-center gap-3">
            {/* New Chat Button (+) */}
            <button
              type="button"
              onClick={handleNewChat}
              className="h-10 w-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 flex items-center justify-center transition-all"
              title="Start New Chat Session"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Active Roleplay Chat / All Chats Button */}
            <button
              type="button"
              onClick={() => setIsChatHistoryOpen(true)}
              className="h-10 w-10 rounded-2xl bg-white/15 border border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)] flex items-center justify-center hover:bg-white/20 transition-all"
              title="Active Roleplay Chats (All Chats)"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Card Vault Button */}
            <button
              type="button"
              onClick={() => setIsGalleryOpen(true)}
              className="h-10 w-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 flex items-center justify-center transition-all"
              title="Character Card Vault"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Story Chronicles & Rolling Summary Button */}
            <button
              type="button"
              onClick={() => setIsWorldStateOpen(!isWorldStateOpen)}
              className={`h-10 w-10 rounded-2xl border flex items-center justify-center transition-all ${
                isWorldStateOpen
                  ? 'bg-white/20 border-white/40 text-white shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10'
              }`}
              title="Story Chronicles & Rolling Summary Panel"
            >
              <ScrollText className="w-4 h-4" />
            </button>

            {/* Lorebook Button */}
            <button
              type="button"
              onClick={() => setIsLorebookOpen(true)}
              className="h-10 w-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 flex items-center justify-center transition-all"
              title="Lorebook"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom: Persona Button (Replaced Settings Icon) */}
        <button
          type="button"
          onClick={() => setIsPersonaOpen(true)}
          className="h-10 w-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/20 flex items-center justify-center transition-all overflow-hidden shadow-sm"
          title={`Protagonist Persona (${activePersona?.name || 'Switch'})`}
        >
          {activePersona?.avatarUrl ? (
            <img src={activePersona.avatarUrl} alt={activePersona.name} className="h-full w-full object-cover" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* --- MOBILE LEFT DRAWER OVERLAY --- */}
      {isMobileDrawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative w-72 h-full bg-[#08080a]/95 backdrop-blur-2xl border-r border-white/15 p-5 flex flex-col justify-between z-10 shadow-2xl">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <PenTool className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">Mythicalore</h2>
                    <p className="text-[10px] text-zinc-400 font-medium">Universal Roleplay</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation items */}
              <div className="py-4 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    handleNewChat();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Plus className="w-4 h-4 text-zinc-400" />
                  <span>Start New Roleplay Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsChatHistoryOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-white/10 border border-white/15 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-white" />
                  <span>Active Roleplay Chats (All)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsGalleryOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Layers className="w-4 h-4 text-zinc-400" />
                  <span>Character Card Vault</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsWorldStateOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ScrollText className="w-4 h-4 text-zinc-400" />
                  <span>Story Chronicles &amp; Summary</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsLorebookOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Bookmark className="w-4 h-4 text-zinc-400" />
                  <span>Lorebook</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4 text-zinc-400" />
                  <span>Settings &amp; BYOK</span>
                </button>
              </div>
            </div>

            {/* Bottom Persona Switcher Card */}
            <div 
              onClick={() => {
                setIsMobileDrawerOpen(false);
                setIsPersonaOpen(true);
              }}
              className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3 cursor-pointer hover:bg-white/[0.08] transition-colors"
            >
              {activePersona?.avatarUrl ? (
                <img src={activePersona.avatarUrl} alt="Persona" className="w-9 h-9 rounded-xl object-cover border border-white/20" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{activePersona?.name || 'Default Persona'}</p>
                <p className="text-[10px] text-zinc-400">Tap to switch protagonist</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MOBILE BOTTOM NAVIGATION BAR (sm:hidden) --- */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#08080a]/90 backdrop-blur-2xl border-t border-white/10 z-40 flex items-center justify-around px-2 safe-area-bottom shadow-2xl">
        <button
          type="button"
          onClick={() => setIsChatHistoryOpen(true)}
          className="p-2 text-zinc-400 hover:text-white active:scale-95"
          title="All Chats"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setIsGalleryOpen(true)}
          className="p-2 text-zinc-400 hover:text-white active:scale-95"
          title="Card Vault"
        >
          <Layers className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleNewChat}
          className="p-2 rounded-xl bg-white text-black active:scale-95 shadow-sm"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setIsWorldStateOpen(!isWorldStateOpen)}
          className={`p-2 rounded-xl transition-colors ${
            isWorldStateOpen ? 'text-white bg-white/15' : 'text-zinc-400 hover:text-white'
          }`}
          title="Chronicles & Summary"
        >
          <ScrollText className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setIsPersonaOpen(true)}
          className="p-2 text-zinc-400 hover:text-white active:scale-95 flex items-center justify-center"
          title="Persona"
        >
          {activePersona?.avatarUrl ? (
            <img src={activePersona.avatarUrl} alt="Persona" className="w-5 h-5 rounded-full object-cover border border-white/20" />
          ) : (
            <User className="w-5 h-5" />
          )}
        </button>
      </nav>

      {/* --- MAIN APP COLUMN --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* TOP NAVIGATION BAR */}
        <header className="px-3 sm:px-5 py-2.5 sm:py-3 safe-area-top flex items-center justify-between gap-3 shrink-0 z-30">
          {/* Brand on Left (Mythicalore + Pen Icon + Mobile Hamburger) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Mobile Hamburger Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="sm:hidden p-2 rounded-xl bg-white/[0.05] border border-white/10 text-zinc-300 hover:text-white transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-glow-white/10">
              <PenTool className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-none">
                Mythicalore
              </h1>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 font-medium mt-0.5">Universal Roleplay</p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Model Pill (desktop) */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-xs font-mono text-zinc-300 transition-colors shadow-sm"
              title="Active Roleplay Model (Click to configure)"
            >
              <Cpu className="w-3.5 h-3.5 text-zinc-300" />
              <span className="truncate max-w-[180px]">
                {settings.primaryModel.provider}: {settings.primaryModel.model}
              </span>
            </button>

            {/* Active AI Connection Indicator */}
            <ConnectionIndicator
              settings={settings}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {/* Tiny Clickable Soundwave Pill actively playing BGM based on atmosphere */}
            <SoundwavePill
              currentAtmosphere={activeAtmosphere}
              autoSync={settings.soundscape?.autoSyncAtmosphere ?? true}
            />

            {/* Settings Gear Icon */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 sm:p-2 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-zinc-300 hover:text-white transition-colors"
              title="Settings & BYOK"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* --- CHAT MAIN WORKSPACE --- */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeCharacter && activePersona ? (
            <ChatContainer
              key={chatSessionKey}
              sessionId={activeSessionId}
              character={activeCharacter}
              persona={activePersona}
              settings={settings}
              isWorldStateOpen={isWorldStateOpen}
              setIsWorldStateOpen={setIsWorldStateOpen}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenGallery={() => setIsGalleryOpen(true)}
              onAtmosphereChange={setActiveAtmosphere}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center relative overflow-hidden">
              {/* Blurred Background Image */}
              <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                <img
                  src="/chat-bg.jpg"
                  alt="Mythicalore Background"
                  className="w-full h-full object-cover object-center filter blur-[6px] md:blur-[8px] scale-105 opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#050507]/80 via-transparent to-[#050507]/90" />
                <div className="absolute inset-0 bg-black/40" />
              </div>

              <div className="max-w-md p-8 rounded-3xl bg-[#0e0e13]/85 backdrop-blur-2xl border border-white/10 shadow-2xl relative z-10">
                <h2 className="text-base font-bold text-white mb-2">No Active Character Card</h2>
                <p className="text-xs text-zinc-400 mb-5">
                  Open the Card Vault to select or import a character card (.png or .json).
                </p>
                <button
                  onClick={() => setIsGalleryOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all"
                >
                  Open Card Vault
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- MODALS & DRAWERS --- */}
      <ChatHistoryModal
        isOpen={isChatHistoryOpen}
        activeSessionId={activeSessionId}
        onClose={() => setIsChatHistoryOpen(false)}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
      />

      <CardGalleryModal
        isOpen={isGalleryOpen}
        activePersona={activePersona || undefined}
        onSelectCharacter={(card) => {
          setActiveCharacter(card);
          setActiveSessionId(null);
          setChatSessionKey((k) => k + 1);
        }}
        onClose={() => setIsGalleryOpen(false)}
      />

      <PersonaModal
        isOpen={isPersonaOpen}
        activePersonaId={activePersona?.id}
        onSelectPersona={(persona) => {
          setActivePersona(persona);
          setActiveSessionId(null);
          setChatSessionKey((k) => k + 1);
        }}
        onClose={() => setIsPersonaOpen(false)}
      />

      <SettingsDrawer
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={(updated) => setSettings(updated)}
        onClose={() => setIsSettingsOpen(false)}
      />

      <LorebookManagerModal
        isOpen={isLorebookOpen}
        characterId={activeCharacter?.id}
        characterName={activeCharacter?.name}
        onClose={() => setIsLorebookOpen(false)}
      />
    </div>
  );
}
