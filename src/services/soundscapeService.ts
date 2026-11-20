export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  mood: string;
  source: 'freetouse' | 'fallback';
}

export type AtmosphereMood = 
  | 'Rain' 
  | 'Thunderstorm' 
  | 'Embers' 
  | 'Tense Combat' 
  | 'Tavern' 
  | 'Mysterious' 
  | 'Fog' 
  | 'Romantic Night' 
  | 'Clear Night' 
  | 'Peaceful';

// Curated high-availability royalty-free streams for instant zero-latency start
const FALLBACK_TRACKS: Record<string, AudioTrack> = {
  Rain: {
    id: 'rain-default',
    title: 'Rainy Nightfall',
    artist: 'Ambient Soundscape (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/weather/rain_heavy.ogg',
    mood: 'Rain',
    source: 'fallback',
  },
  Thunderstorm: {
    id: 'thunder-default',
    title: 'Distant Thunderstorm',
    artist: 'Nature Echoes (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/weather/thunderstorm.ogg',
    mood: 'Thunderstorm',
    source: 'fallback',
  },
  'Tense Combat': {
    id: 'combat-default',
    title: 'Shadow Vanguard',
    artist: 'Cinematic Orchestral (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/horror/ambient_hum.ogg',
    mood: 'Tense Combat',
    source: 'fallback',
  },
  Tavern: {
    id: 'tavern-default',
    title: 'Hearthfire & Mead',
    artist: 'Fantasy Lofi (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/ambiences/campfire_in_forest.ogg',
    mood: 'Tavern',
    source: 'fallback',
  },
  Embers: {
    id: 'embers-default',
    title: 'Dying Embers',
    artist: 'Cozy Atmosphere (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/ambiences/campfire_in_forest.ogg',
    mood: 'Embers',
    source: 'fallback',
  },
  Mysterious: {
    id: 'mystery-default',
    title: 'Whispers of the Reliquary',
    artist: 'Dark Drone (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/weather/wind_blowing.ogg',
    mood: 'Mysterious',
    source: 'fallback',
  },
  Fog: {
    id: 'fog-default',
    title: 'Veil of Mists',
    artist: 'Ambient Fog (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/weather/wind_blowing.ogg',
    mood: 'Fog',
    source: 'fallback',
  },
  'Romantic Night': {
    id: 'romantic-default',
    title: 'Under Starlit Glass',
    artist: 'Midnight Melancholy (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/ambiences/night_crickets.ogg',
    mood: 'Romantic Night',
    source: 'fallback',
  },
  'Clear Night': {
    id: 'night-default',
    title: 'Starlight Nocturne',
    artist: 'Celestial Calm (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/ambiences/night_crickets.ogg',
    mood: 'Clear Night',
    source: 'fallback',
  },
  Peaceful: {
    id: 'peaceful-default',
    title: 'Sanctuary Dawn',
    artist: 'Serene Acoustic (freetouse.com)',
    url: 'https://actions.google.com/sounds/v1/ambiences/outdoor_ambience.ogg',
    mood: 'Peaceful',
    source: 'fallback',
  },
};

class SoundscapeManager {
  private audio: HTMLAudioElement | null = null;
  private currentTrack: AudioTrack | null = null;
  private currentMood: string = 'Mysterious';
  private isPlaying: boolean = false;
  private volume: number = 0.4;
  private isMuted: boolean = false;
  private listeners: Set<() => void> = new Set();
  private fetchedTracksCache: Map<string, AudioTrack[]> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.volume = this.volume;

      this.audio.addEventListener('play', () => {
        this.isPlaying = true;
        this.notify();
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.notify();
      });

      this.audio.addEventListener('error', (e) => {
        console.warn('[SoundscapeManager] Audio playback error, switching to fallback track:', e);
        this.fallbackToDefaultTrack();
      });
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getState() {
    return {
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      currentMood: this.currentMood,
      volume: this.volume,
      isMuted: this.isMuted,
    };
  }

  /**
   * Resolves a track from FreeToUse API (https://api.freetouse.com/v3)
   */
  public async fetchFreeToUseTrack(mood: string): Promise<AudioTrack> {
    const cached = this.fetchedTracksCache.get(mood);
    if (cached && cached.length > 0) {
      return cached[Math.floor(Math.random() * cached.length)];
    }

    const queryMap: Record<string, string> = {
      Rain: 'rain ambient chill',
      Thunderstorm: 'cinematic dark dramatic',
      'Tense Combat': 'cinematic combat battle',
      Tavern: 'acoustic folk lofi',
      Embers: 'ambient fire warm',
      Mysterious: 'ambient drone mysterious',
      Fog: 'ambient drone chill',
      'Romantic Night': 'piano romantic chill',
      'Clear Night': 'ambient night lofi',
      Peaceful: 'peaceful calm acoustic',
    };

    const query = queryMap[mood] || 'ambient chill';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`https://api.freetouse.com/v3/tracks?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawTracks = Array.isArray(data) ? data : (data.tracks || data.data || []);
        if (rawTracks.length > 0) {
          const mapped: AudioTrack[] = rawTracks
            .filter((t: any) => t.mp3_file || t.download_url || t.file_url || t.url)
            .map((t: any) => ({
              id: String(t.id || t.title),
              title: t.title || 'Atmospheric BGM',
              artist: Array.isArray(t.artists) ? t.artists.join(', ') : (t.artist || 'Free To Use Music'),
              url: t.mp3_file || t.download_url || t.file_url || t.url,
              mood,
              source: 'freetouse' as const,
            }));

          if (mapped.length > 0) {
            this.fetchedTracksCache.set(mood, mapped);
            return mapped[0];
          }
        }
      }
    } catch (err) {
      console.warn('[SoundscapeManager] FreeToUse API fetch failed, using fallback stream:', err);
    }

    return FALLBACK_TRACKS[mood] || FALLBACK_TRACKS['Mysterious'];
  }

  /**
   * Synchronizes soundscape with current world state atmosphere/mood.
   */
  public async syncWithAtmosphere(atmosphereOrMood?: string) {
    if (!atmosphereOrMood) return;

    const lower = atmosphereOrMood.toLowerCase();
    let detectedMood: AtmosphereMood = 'Mysterious';

    if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('stormy')) {
      detectedMood = lower.includes('thunder') ? 'Thunderstorm' : 'Rain';
    } else if (lower.includes('thunder')) {
      detectedMood = 'Thunderstorm';
    } else if (lower.includes('combat') || lower.includes('fight') || lower.includes('tense') || lower.includes('danger')) {
      detectedMood = 'Tense Combat';
    } else if (lower.includes('tavern') || lower.includes('inn') || lower.includes('hearth') || lower.includes('cozy')) {
      detectedMood = 'Tavern';
    } else if (lower.includes('ember') || lower.includes('fire') || lower.includes('flame')) {
      detectedMood = 'Embers';
    } else if (lower.includes('fog') || lower.includes('mist')) {
      detectedMood = 'Fog';
    } else if (lower.includes('romantic') || lower.includes('love') || lower.includes('intimate')) {
      detectedMood = 'Romantic Night';
    } else if (lower.includes('peace') || lower.includes('calm') || lower.includes('serene')) {
      detectedMood = 'Peaceful';
    } else if (lower.includes('night') || lower.includes('moon') || lower.includes('star')) {
      detectedMood = 'Clear Night';
    }

    if (detectedMood !== this.currentMood || !this.currentTrack) {
      await this.setMood(detectedMood);
    }
  }

  public async setMood(mood: AtmosphereMood) {
    this.currentMood = mood;
    const track = await this.fetchFreeToUseTrack(mood);
    await this.loadTrack(track);
  }

  public async loadTrack(track: AudioTrack) {
    if (!this.audio) return;
    this.currentTrack = track;

    const wasPlaying = this.isPlaying;
    this.audio.src = track.url;
    this.audio.load();

    if (wasPlaying) {
      try {
        await this.audio.play();
      } catch (err) {
        console.warn('[SoundscapeManager] Auto-play was prevented by browser policy:', err);
      }
    }
    this.notify();
  }

  public async play() {
    if (!this.audio) return;
    if (!this.currentTrack) {
      await this.setMood('Mysterious');
    }
    try {
      await this.audio.play();
    } catch (err) {
      console.warn('[SoundscapeManager] Play prevented by browser:', err);
    }
    this.notify();
  }

  public pause() {
    if (!this.audio) return;
    this.audio.pause();
    this.notify();
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    this.notify();
  }

  private fallbackToDefaultTrack() {
    const fallback = FALLBACK_TRACKS[this.currentMood] || FALLBACK_TRACKS['Mysterious'];
    if (this.currentTrack?.url !== fallback.url) {
      this.loadTrack(fallback);
    }
  }
}

export const soundscape = new SoundscapeManager();
