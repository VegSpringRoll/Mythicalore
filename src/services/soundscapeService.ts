export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  mood: string;
  source: 'freetouse' | 'procedural' | 'stream';
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

// Reliable, CORS-enabled permanent ambient audio streams
const RELIABLE_STREAMS: Record<string, string> = {
  Rain: 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/rain.mp3',
  Thunderstorm: 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/thunder.mp3',
  Embers: 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/fire.mp3',
  'Tense Combat': 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/wind.mp3',
  Tavern: 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/fire.mp3',
  Mysterious: 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/wind.mp3',
  Fog: 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/wind.mp3',
  'Romantic Night': 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/night.mp3',
  'Clear Night': 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/night.mp3',
  Peaceful: 'https://raw.githubusercontent.com/rafaelescrich/ambient-sounds/master/sounds/birds.mp3',
};

/**
 * Web Audio API Procedural Ambient Sound Generator.
 * Zero external requests, zero CORS blocks, works 100% offline and on all mobile browsers.
 */
class ProceduralAmbientGenerator {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];

  public init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  public stop() {
    this.activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch {}
    });
    this.activeNodes = [];
  }

  public start(mood: AtmosphereMood) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.stop();

    try {
      if (mood === 'Rain' || mood === 'Thunderstorm') {
        this.buildRain(mood === 'Thunderstorm');
      } else if (mood === 'Embers' || mood === 'Tavern') {
        this.buildFireplace();
      } else if (mood === 'Peaceful' || mood === 'Romantic Night') {
        this.buildChimePad();
      } else {
        // Mysterious / Fog / Clear Night / Tense Combat
        this.buildAtmosphericDrone(mood);
      }
    } catch (e) {
      console.warn('[ProceduralSynth] Synthesis error:', e);
    }
  }

  private buildAtmosphericDrone(mood: AtmosphereMood) {
    if (!this.ctx || !this.masterGain) return;

    const baseFreq = mood === 'Tense Combat' ? 48 : 55;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 1.5, this.ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();

    this.activeNodes.push(osc1, osc2, filter, gain);
  }

  private buildRain(thunder: boolean) {
    if (!this.ctx || !this.masterGain) return;

    // White/Pink noise buffer for steady rain
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    this.activeNodes.push(noise, filter, gain);

    if (thunder) {
      const rumbles = this.ctx.createOscillator();
      rumbles.type = 'sine';
      rumbles.frequency.setValueAtTime(45, this.ctx.currentTime);
      const rGain = this.ctx.createGain();
      rGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      rumbles.connect(rGain);
      rGain.connect(this.masterGain);
      rumbles.start();
      this.activeNodes.push(rumbles, rGain);
    }
  }

  private buildFireplace() {
    if (!this.ctx || !this.masterGain) return;

    // Warm low drone
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(65, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    this.activeNodes.push(osc, filter, gain);
  }

  private buildChimePad() {
    if (!this.ctx || !this.masterGain) return;

    // Peaceful soft chords (A, C#, E)
    const freqs = [220, 277.18, 329.63];
    freqs.forEach((f) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      this.activeNodes.push(osc, gain);
    });
  }
}

class SoundscapeManager {
  private audio: HTMLAudioElement | null = null;
  private proceduralSynth: ProceduralAmbientGenerator = new ProceduralAmbientGenerator();
  private currentTrack: AudioTrack | null = null;
  private currentMood: AtmosphereMood = 'Mysterious';
  private isPlaying: boolean = false;
  private volume: number = 0.4;
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
        console.warn('[SoundscapeManager] HTML Audio playback error, switching to procedural soundscape:', e);
        this.useProceduralFallback();
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
      isMuted: this.volume === 0,
    };
  }

  /**
   * Resolves a track from FreeToUse API (https://api.freetouse.com/v3) with fallback
   */
  public async fetchFreeToUseTrack(mood: AtmosphereMood): Promise<AudioTrack> {
    const cached = this.fetchedTracksCache.get(mood);
    if (cached && cached.length > 0) {
      return cached[Math.floor(Math.random() * cached.length)];
    }

    const queryMap: Record<string, string> = {
      Rain: 'rain chill ambient',
      Thunderstorm: 'cinematic dramatic dark',
      'Tense Combat': 'cinematic battle combat',
      Tavern: 'acoustic folk lofi',
      Embers: 'ambient warm calm',
      Mysterious: 'ambient drone mysterious',
      Fog: 'ambient drone chill',
      'Romantic Night': 'piano romantic chill',
      'Clear Night': 'ambient night lofi',
      Peaceful: 'peaceful acoustic calm',
    };

    const query = queryMap[mood] || 'ambient chill';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`https://api.freetouse.com/v3/tracks?search=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawTracks = Array.isArray(data) ? data : (data.tracks || data.data || []);
        if (rawTracks.length > 0) {
          const mapped: AudioTrack[] = rawTracks
            .filter((t: any) => t.mp3 || t.audio_url || t.file || t.url || t.mp3_file || t.download_url)
            .map((t: any) => ({
              id: String(t.id || t.title),
              title: t.title || `${mood} Atmosphere`,
              artist: Array.isArray(t.artists) ? t.artists.join(', ') : (t.artist || 'Free To Use Music'),
              url: t.mp3 || t.audio_url || t.file || t.url || t.mp3_file || t.download_url,
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
      console.warn('[SoundscapeManager] FreeToUse API query failed, using direct audio stream:', err);
    }

    const streamUrl = RELIABLE_STREAMS[mood] || RELIABLE_STREAMS['Mysterious'];
    return {
      id: `${mood.toLowerCase()}-stream`,
      title: `${mood} Atmosphere`,
      artist: 'Ambient Soundscape (freetouse.com)',
      url: streamUrl,
      mood,
      source: 'stream',
    };
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

  public async setMood(mood: AtmosphereMood) {
    this.currentMood = mood;
    if (this.isPlaying) {
      this.proceduralSynth.start(mood);
    }
    const track = await this.fetchFreeToUseTrack(mood);
    await this.loadTrack(track);
  }

  public async loadTrack(track: AudioTrack) {
    this.currentTrack = track;

    if (this.audio) {
      this.audio.src = track.url;
      this.audio.volume = this.volume;
      this.audio.load();

      if (this.isPlaying) {
        try {
          await this.audio.play();
          // If HTML audio succeeds, pause procedural synth
          this.proceduralSynth.stop();
        } catch (err) {
          console.warn('[SoundscapeManager] HTMLAudio play failed, falling back to Web Audio synth:', err);
          this.useProceduralFallback();
        }
      }
    }
    this.notify();
  }

  private useProceduralFallback() {
    this.currentTrack = {
      id: `${this.currentMood.toLowerCase()}-synth`,
      title: `${this.currentMood} Ambience`,
      artist: 'Procedural Audio Engine',
      url: '',
      mood: this.currentMood,
      source: 'procedural',
    };
    if (this.isPlaying) {
      this.proceduralSynth.start(this.currentMood);
    }
    this.notify();
  }

  public async play() {
    this.isPlaying = true;

    // 1. Immediately start procedural synth so mobile user gesture is fulfilled without awaiting network
    this.proceduralSynth.init();
    this.proceduralSynth.setVolume(this.volume);
    this.proceduralSynth.start(this.currentMood);

    // 2. Concurrently load/play audio track
    if (!this.currentTrack) {
      this.setMood(this.currentMood);
    } else if (this.audio && this.currentTrack.url) {
      try {
        await this.audio.play();
        this.proceduralSynth.stop();
      } catch (err) {
        console.warn('[SoundscapeManager] HTMLAudio play failed, keeping procedural synth:', err);
      }
    }
    this.notify();
  }

  public pause() {
    this.isPlaying = false;
    if (this.audio) {
      this.audio.pause();
    }
    this.proceduralSynth.stop();
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
    this.proceduralSynth.setVolume(this.volume);
    this.notify();
  }
}

export const soundscape = new SoundscapeManager();
