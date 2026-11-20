export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  mood: string;
  source: 'freetouse' | 'preset';
}

export type AtmosphereMood = 
  | 'Rain' 
  | 'Thunderstorm' 
  | 'Tense Combat' 
  | 'Tavern' 
  | 'Embers' 
  | 'Mysterious' 
  | 'Fog' 
  | 'Romantic Night' 
  | 'Clear Night' 
  | 'Peaceful';

// Curated instant-play FreeToUse royalty-free tracks for zero-latency startup
const MOOD_PRESETS: Record<AtmosphereMood, AudioTrack[]> = {
  Rain: [
    {
      id: 'rain-1',
      title: 'Rainy Day',
      artist: 'Avanti (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/029d64dc-0592-01c5-f05d-a07c174e3701/file/mp3/file.mp3',
      mood: 'Rain',
      source: 'preset',
    },
    {
      id: 'rain-2',
      title: '9am, meeeh',
      artist: 'Piki (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/fcd4ca38-da20-0f15-a371-01f4e0fbd2fa/file/mp3/file.mp3',
      mood: 'Rain',
      source: 'preset',
    },
  ],
  Thunderstorm: [
    {
      id: 'thunder-1',
      title: 'Akaneiro (Dramatic)',
      artist: 'Johny Grimes (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/fc95e0bb-e942-4c4b-874b-a194fd200cf3/file/mp3/file.mp3',
      mood: 'Thunderstorm',
      source: 'preset',
    },
    {
      id: 'thunder-2',
      title: 'Spinning Shadows',
      artist: 'Zambolino (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/c9659c50-bdf3-42de-b815-87173272350e/file/mp3/file.mp3',
      mood: 'Thunderstorm',
      source: 'preset',
    },
  ],
  'Tense Combat': [
    {
      id: 'combat-1',
      title: 'Fight for Dawn',
      artist: 'Johny Grimes (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/fc95e0bb-e942-4c4b-874b-a194fd200cf3/file/mp3/file.mp3',
      mood: 'Tense Combat',
      source: 'preset',
    },
    {
      id: 'combat-2',
      title: 'Dark Horizon',
      artist: 'Free To Use Music',
      url: 'https://eu.data.freetouse.com/music/tracks/c9659c50-bdf3-42de-b815-87173272350e/file/mp3/file.mp3',
      mood: 'Tense Combat',
      source: 'preset',
    },
  ],
  Tavern: [
    {
      id: 'tavern-1',
      title: 'Mercado Festive',
      artist: 'Burgundy X (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/09f7ccd2-5cad-4695-86c4-b6f5c6cc7ada/file/mp3/file.mp3',
      mood: 'Tavern',
      source: 'preset',
    },
  ],
  Embers: [
    {
      id: 'embers-1',
      title: 'Warm Embers',
      artist: 'Nebulite (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/2f78d5fe-6b95-c391-a3c4-dc16c92d7648/file/mp3/file.mp3',
      mood: 'Embers',
      source: 'preset',
    },
  ],
  Mysterious: [
    {
      id: 'mystic-1',
      title: 'Not Too Far',
      artist: 'Nebulite (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/2f78d5fe-6b95-c391-a3c4-dc16c92d7648/file/mp3/file.mp3',
      mood: 'Mysterious',
      source: 'preset',
    },
    {
      id: 'mystic-2',
      title: 'Akaneiro',
      artist: 'Johny Grimes (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/fc95e0bb-e942-4c4b-874b-a194fd200cf3/file/mp3/file.mp3',
      mood: 'Mysterious',
      source: 'preset',
    },
  ],
  Fog: [
    {
      id: 'fog-1',
      title: 'Mist of Eternity',
      artist: 'Piki (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/fcd4ca38-da20-0f15-a371-01f4e0fbd2fa/file/mp3/file.mp3',
      mood: 'Fog',
      source: 'preset',
    },
  ],
  'Romantic Night': [
    {
      id: 'romantic-1',
      title: 'Moonlit Sanctuary',
      artist: 'Avanti (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/029d64dc-0592-01c5-f05d-a07c174e3701/file/mp3/file.mp3',
      mood: 'Romantic Night',
      source: 'preset',
    },
  ],
  'Clear Night': [
    {
      id: 'night-1',
      title: 'Starlight Dream',
      artist: 'Nebulite (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/2f78d5fe-6b95-c391-a3c4-dc16c92d7648/file/mp3/file.mp3',
      mood: 'Clear Night',
      source: 'preset',
    },
  ],
  Peaceful: [
    {
      id: 'peace-1',
      title: 'Quiet Reflections',
      artist: 'Avanti (Free To Use)',
      url: 'https://eu.data.freetouse.com/music/tracks/029d64dc-0592-01c5-f05d-a07c174e3701/file/mp3/file.mp3',
      mood: 'Peaceful',
      source: 'preset',
    },
  ],
};

const MOOD_SEARCH_QUERIES: Record<AtmosphereMood, string> = {
  Rain: 'rain lofi',
  Thunderstorm: 'dark cinematic',
  'Tense Combat': 'battle epic',
  Tavern: 'acoustic festive',
  Embers: 'warm calm',
  Mysterious: 'ambient mystery',
  Fog: 'ambient chill',
  'Romantic Night': 'romantic piano',
  'Clear Night': 'night chill',
  Peaceful: 'peaceful calm',
};

class SoundscapeManager {
  private audio: HTMLAudioElement | null = null;
  private currentTrack: AudioTrack | null = null;
  private currentMood: AtmosphereMood = 'Mysterious';
  private isPlaying: boolean = false;
  private volume: number = 0.4;
  private listeners: Set<() => void> = new Set();
  private fetchedTracksCache: Map<string, AudioTrack[]> = new Map();
  private isFetching: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.volume = this.volume;
      this.audio.crossOrigin = 'anonymous';

      this.audio.addEventListener('play', () => {
        this.isPlaying = true;
        this.notify();
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.notify();
      });

      this.audio.addEventListener('error', (e) => {
        console.warn('[SoundscapeManager] Audio track failed to load, switching to next track:', e);
        this.nextRandomTrack();
      });

      // Default initial preset
      const presets = MOOD_PRESETS['Mysterious'];
      this.currentTrack = presets[0];
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
      isMuted: this.volume === 0,
      isFetching: this.isFetching,
    };
  }

  /**
   * Fetches tracks from FreeToUse API (https://api.freetouse.com/v3/music/tracks/search)
   */
  public async fetchFreeToUseTracks(mood: AtmosphereMood): Promise<AudioTrack[]> {
    const query = MOOD_SEARCH_QUERIES[mood] || 'ambient chill';
    try {
      this.isFetching = true;
      this.notify();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const url = `https://api.freetouse.com/v3/music/tracks/search?query=${encodeURIComponent(query)}&order=random&limit=15`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const rawTracks = Array.isArray(json.data) ? json.data : (json.tracks || []);
        const mapped: AudioTrack[] = rawTracks
          .filter((t: any) => t.files?.mp3)
          .map((t: any) => ({
            id: String(t.id || t.title),
            title: t.title || `${mood} Atmosphere`,
            artist: t.artists?.[0]?.[1]?.name || 'Free To Use Music',
            url: t.files.mp3,
            mood,
            source: 'freetouse' as const,
          }));

        if (mapped.length > 0) {
          this.fetchedTracksCache.set(mood, mapped);
          return mapped;
        }
      }
    } catch (err) {
      console.warn('[SoundscapeManager] FreeToUse API fetch failed, using curated preset:', err);
    } finally {
      this.isFetching = false;
      this.notify();
    }

    // Fallback to presets
    return MOOD_PRESETS[mood] || MOOD_PRESETS['Mysterious'];
  }

  /**
   * Switches to a new atmosphere mood, fetching or using cached tracks.
   */
  public async setMood(mood: AtmosphereMood) {
    this.currentMood = mood;

    // Pick first from cache or presets immediately for responsiveness
    const cached = this.fetchedTracksCache.get(mood);
    if (cached && cached.length > 0) {
      const randomTrack = cached[Math.floor(Math.random() * cached.length)];
      await this.loadAndPlay(randomTrack);
      return;
    }

    const presets = MOOD_PRESETS[mood] || MOOD_PRESETS['Mysterious'];
    const presetTrack = presets[Math.floor(Math.random() * presets.length)];
    await this.loadAndPlay(presetTrack);

    // Concurrently fetch dynamic pool from FreeToUse API
    this.fetchFreeToUseTracks(mood).then((pool) => {
      this.fetchedTracksCache.set(mood, pool);
    });
  }

  /**
   * Changes the soundtrack to a new random track (for when the user doesn't like current track).
   */
  public async nextRandomTrack() {
    let pool = this.fetchedTracksCache.get(this.currentMood);
    if (!pool || pool.length === 0) {
      pool = await this.fetchFreeToUseTracks(this.currentMood);
      this.fetchedTracksCache.set(this.currentMood, pool);
    }

    // Filter out current track
    const otherTracks = pool.filter((t) => t.id !== this.currentTrack?.id);
    const pickFrom = otherTracks.length > 0 ? otherTracks : pool;
    const nextTrack = pickFrom[Math.floor(Math.random() * pickFrom.length)];

    if (nextTrack) {
      await this.loadAndPlay(nextTrack);
    }
  }

  /**
   * Loads track URL into HTMLAudioElement and plays if active.
   */
  private async loadAndPlay(track: AudioTrack) {
    this.currentTrack = track;
    if (this.audio) {
      this.audio.src = track.url;
      this.audio.volume = this.volume;
      this.audio.load();

      if (this.isPlaying) {
        try {
          await this.audio.play();
        } catch (err) {
          console.warn('[SoundscapeManager] HTMLAudio play error:', err);
        }
      }
    }
    this.notify();
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

    if (detectedMood !== this.currentMood) {
      this.currentMood = detectedMood;
      if (this.isPlaying) {
        await this.setMood(detectedMood);
      }
    }
  }

  public async play() {
    this.isPlaying = true;
    if (!this.currentTrack) {
      await this.setMood(this.currentMood);
    } else if (this.audio) {
      if (!this.audio.src || this.audio.src === '' || this.audio.src === window.location.href) {
        this.audio.src = this.currentTrack.url;
      }
      try {
        await this.audio.play();
      } catch (err) {
        console.warn('[SoundscapeManager] HTMLAudio play failed, retrying next track:', err);
        await this.nextRandomTrack();
      }
    }
    this.notify();
  }

  public pause() {
    this.isPlaying = false;
    if (this.audio) {
      this.audio.pause();
    }
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
}

export const soundscape = new SoundscapeManager();
