import React, { useEffect, useRef, useState } from 'react';

export type WeatherType = 
  | 'Rain' 
  | 'Thunderstorm' 
  | 'Embers' 
  | 'Fog' 
  | 'Romantic Night' 
  | 'Clear Night' 
  | 'Snow' 
  | 'None';

interface AmbientWeatherCanvasProps {
  weather?: string;
  mood?: string;
  enabled?: boolean;
}

export const AmbientWeatherCanvas: React.FC<AmbientWeatherCanvasProps> = ({
  weather,
  mood,
  enabled = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [thunderFlash, setThunderFlash] = useState(false);

  // Normalize weather type from AI state
  const normalizedWeather = ((): WeatherType => {
    const raw = `${weather || ''} ${mood || ''}`.toLowerCase();
    if (raw.includes('thunder') || raw.includes('storm')) return 'Thunderstorm';
    if (raw.includes('rain') || raw.includes('drizzle')) return 'Rain';
    if (raw.includes('ember') || raw.includes('combat') || raw.includes('tavern') || raw.includes('fire')) return 'Embers';
    if (raw.includes('fog') || raw.includes('mist') || raw.includes('crypt') || raw.includes('dungeon')) return 'Fog';
    if (raw.includes('romantic') || raw.includes('star') || raw.includes('moon')) return 'Romantic Night';
    if (raw.includes('snow') || raw.includes('blizzard') || raw.includes('frost')) return 'Snow';
    if (raw.includes('night')) return 'Clear Night';
    return 'Rain'; // Atmospheric default
  })();

  useEffect(() => {
    if (!enabled || normalizedWeather === 'Fog' || normalizedWeather === 'None') return;

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isTabVisible = !document.hidden;

    // Lock canvas resolution to 1x (NO window.devicePixelRatio scaling for 80% mobile GPU savings)
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Particle pool (capped to 25 - 35 particles max for 60fps low-battery mobile execution)
    const particleCount = normalizedWeather === 'Embers' ? 20 : normalizedWeather === 'Romantic Night' ? 18 : 32;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speedY: normalizedWeather === 'Embers' 
        ? -(0.4 + Math.random() * 0.8) 
        : normalizedWeather === 'Snow' 
        ? 0.5 + Math.random() * 0.8 
        : 8 + Math.random() * 7, // Rain speed
      speedX: normalizedWeather === 'Embers'
        ? (Math.random() - 0.5) * 0.4
        : normalizedWeather === 'Snow'
        ? (Math.random() - 0.5) * 0.5
        : -1.2, // Rain angle
      length: normalizedWeather === 'Rain' || normalizedWeather === 'Thunderstorm' 
        ? 12 + Math.random() * 12 
        : 1.5 + Math.random() * 2,
      opacity: 0.08 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
    }));

    // Auto-pause when document is hidden (switched apps, backgrounded)
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        animId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Occasional thunderstorm flash
    let flashTimer: any = null;
    if (normalizedWeather === 'Thunderstorm') {
      const scheduleFlash = () => {
        flashTimer = setTimeout(() => {
          setThunderFlash(true);
          setTimeout(() => setThunderFlash(false), 60);
          scheduleFlash();
        }, 12000 + Math.random() * 16000);
      };
      scheduleFlash();
    }

    const render = () => {
      if (!isTabVisible) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += 0.02;

        if (normalizedWeather === 'Rain' || normalizedWeather === 'Thunderstorm') {
          // Ultra-thin diagonal rain streaks in monochromatic rgba(255, 255, 255, 0.12)
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.speedX * (p.length / 8), p.y + p.length);
          ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          p.y += p.speedY;
          p.x += p.speedX;

          if (p.y > canvas.height) {
            p.y = -p.length;
            p.x = Math.random() * (canvas.width + 100);
          }
        } else if (normalizedWeather === 'Embers') {
          // Slow-rising ember dots with slight horizontal sway in warm subtle tone
          ctx.beginPath();
          const swayX = p.x + Math.sin(p.phase) * 6;
          ctx.arc(swayX, p.y, p.length, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 130, 50, ${p.opacity * 1.5})`;
          ctx.fill();

          p.y += p.speedY;
          p.x += p.speedX;

          if (p.y < -10) {
            p.y = canvas.height + 10;
            p.x = Math.random() * canvas.width;
          }
        } else if (normalizedWeather === 'Romantic Night' || normalizedWeather === 'Clear Night') {
          // Floating stardust motes with gentle twinkle
          const twinkle = (Math.sin(p.phase) + 1) * 0.5 * 0.15 + 0.05;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.length, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`;
          ctx.fill();

          p.y += Math.sin(p.phase * 0.5) * 0.2;
          p.x += Math.cos(p.phase * 0.5) * 0.2;
        } else if (normalizedWeather === 'Snow') {
          // Soft snowflakes drifting down
          ctx.beginPath();
          const swayX = p.x + Math.sin(p.phase) * 10;
          ctx.arc(swayX, p.y, p.length, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 1.8})`;
          ctx.fill();

          p.y += p.speedY;
          if (p.y > canvas.height) {
            p.y = -5;
            p.x = Math.random() * canvas.width;
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (flashTimer) clearTimeout(flashTimer);
    };
  }, [normalizedWeather, enabled]);

  if (!enabled || normalizedWeather === 'None') return null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-[1] overflow-hidden">
      {/* 1. Pure CSS Ambient Vignettes (Matching OLED Dark UI) */}
      {(normalizedWeather === 'Rain' || normalizedWeather === 'Thunderstorm') && (
        <div 
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(50, 80, 130, 0.08), transparent 70%)',
          }}
        />
      )}

      {normalizedWeather === 'Embers' && (
        <div 
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background: 'radial-gradient(circle at 50% 100%, rgba(200, 80, 20, 0.06), transparent 70%)',
          }}
        />
      )}

      {normalizedWeather === 'Fog' && (
        // Fog uses pure CSS radial gradient — zero JS overhead
        <div 
          className="absolute inset-0 animate-pulse transition-opacity duration-1000"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(200, 215, 240, 0.04), transparent 75%)',
            animationDuration: '6s',
          }}
        />
      )}

      {(normalizedWeather === 'Romantic Night' || normalizedWeather === 'Clear Night') && (
        <div 
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background: 'radial-gradient(circle at 75% 15%, rgba(180, 200, 255, 0.05), transparent 60%)',
          }}
        />
      )}

      {/* Thunderstorm subtle white ambient flash */}
      {thunderFlash && (
        <div className="absolute inset-0 bg-white/[0.07] transition-opacity duration-75" />
      )}

      {/* 2. Single 1x Low-Resolution Canvas Overlay (Behind message cards) */}
      {normalizedWeather !== 'Fog' && (
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      )}
    </div>
  );
};
