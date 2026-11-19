import React from 'react';

/**
 * Pure Monochrome Atmospheric Scenery:
 * Deep obsidian black backgrounds, silver-white glowing full moon,
 * ethereal drifting mist, gothic fantasy citadel silhouette, and soft silver water reflections.
 */
export const AtmosphericBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none bg-[#050507]">
      {/* Base Obsidian Gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #050507 0%, #0a0a0d 45%, #0e0e12 75%, #050507 100%)',
        }}
      />

      {/* Soft Ethereal Silver/White Blooms */}
      <div 
        className="absolute -top-32 right-1/4 w-[750px] h-[750px] rounded-full blur-[160px] opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, rgba(200, 200, 210, 0.15) 50%, transparent 80%)' }}
      />
      <div 
        className="absolute bottom-10 left-1/3 w-[800px] h-[450px] rounded-full blur-[180px] opacity-15"
        style={{ background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(150, 150, 160, 0.08) 60%, transparent 80%)' }}
      />

      {/* Monochrome Cinematic Fantasy Scenery SVG */}
      <svg 
        className="absolute inset-0 w-full h-full object-cover" 
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1920 1080"
      >
        <defs>
          {/* Luminous Silver Moon Glow */}
          <radialGradient id="silverMoonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#f4f4f5" stopOpacity="0.7" />
            <stop offset="55%" stopColor="#d4d4d8" stopOpacity="0.25" />
            <stop offset="85%" stopColor="#a1a1aa" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#71717a" stopOpacity="0" />
          </radialGradient>

          {/* Silver Water Reflection Gradient */}
          <linearGradient id="silverWaterReflect" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#d4d4d8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>

          {/* Ethereal Mist Gradient */}
          <linearGradient id="mistGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#d4d4d8" stopOpacity="0.04" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>

          {/* Gothic Spire Silhouette Gradient */}
          <linearGradient id="gothicSpireGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a1a20" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#111114" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#08080a" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* --- CELESTIAL SILVER MOON (Top Right) --- */}
        <g transform="translate(1480, 160)">
          {/* Outer Luminous Halo */}
          <circle cx="0" cy="0" r="220" fill="url(#silverMoonGlow)" opacity="0.75" />
          {/* Main Moon Disc */}
          <circle cx="0" cy="0" r="95" fill="#ffffff" opacity="0.95" />
          {/* Soft Silver Rim & Craters */}
          <circle cx="-10" cy="-6" r="92" fill="#e4e4e7" opacity="0.3" />
          <ellipse cx="-20" cy="-22" rx="30" ry="18" fill="#a1a1aa" opacity="0.14" />
          <ellipse cx="28" cy="18" rx="35" ry="20" fill="#71717a" opacity="0.12" />
          <ellipse cx="-5" cy="35" rx="22" ry="12" fill="#a1a1aa" opacity="0.1" />
        </g>

        {/* --- DISTANT MONOCHROME MOUNTAINS --- */}
        <g opacity="0.35">
          <path d="M600 750 L850 520 L1100 750 Z" fill="#141418" />
          <path d="M980 750 L1240 460 L1520 750 Z" fill="#18181e" />
          <path d="M1380 750 L1660 490 L1940 750 Z" fill="#121216" />
        </g>

        {/* --- GOTHIC SANCTUARY & CITADEL SPIRES (Right Horizon) --- */}
        <g opacity="0.75" transform="translate(1560, 360)">
          {/* Base Fortress Ridge */}
          <path d="M-80 500 L-40 380 L60 380 L120 500 Z" fill="#0d0d10" />

          {/* Central Cathedral Spire */}
          <path d="M80 80 L90 280 L70 280 Z" fill="url(#gothicSpireGrad)" />
          <polygon points="80,40 75,90 85,90" fill="#27272a" />
          {/* Cross / Pinnacle Finch */}
          <line x1="80" y1="25" x2="80" y2="45" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
          <line x1="74" y1="32" x2="86" y2="32" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />

          {/* Flanking Needle Spires */}
          <polygon points="20,160 16,320 24,320" fill="url(#gothicSpireGrad)" />
          <polygon points="140,180 136,330 144,330" fill="url(#gothicSpireGrad)" />
          <polygon points="-30,240 -34,360 -26,360" fill="#111115" />
          <polygon points="190,250 186,370 194,370" fill="#111115" />

          {/* Arched Gothic Windows with soft white glow */}
          <path d="M72 180 Q80 165 88 180 L88 220 L72 220 Z" fill="#ffffff" opacity="0.35" />
          <path d="M18 220 Q22 210 26 220 L26 250 L18 250 Z" fill="#ffffff" opacity="0.25" />
          <path d="M136 230 Q140 220 144 230 L144 260 L136 260 Z" fill="#ffffff" opacity="0.25" />

          {/* Battlement Roofs */}
          <rect x="50" y="270" width="60" height="20" fill="#18181c" />
          <rect x="0" y="310" width="160" height="40" fill="#121215" />
        </g>

        {/* --- DRIFTING MIST & HORIZON FOG LAYERS --- */}
        <g opacity="0.6">
          <ellipse cx="1400" cy="720" rx="600" ry="45" fill="url(#mistGrad)" />
          <ellipse cx="1100" cy="760" rx="800" ry="60" fill="url(#mistGrad)" />
          <ellipse cx="1600" cy="800" rx="500" ry="50" fill="url(#mistGrad)" />
        </g>

        {/* --- SILVER MOON WATER REFLECTION --- */}
        <g transform="translate(1480, 820)">
          <ellipse cx="0" cy="20" rx="160" ry="7" fill="url(#silverWaterReflect)" opacity="0.6" />
          <ellipse cx="-20" cy="50" rx="130" ry="5.5" fill="url(#silverWaterReflect)" opacity="0.5" />
          <ellipse cx="15" cy="80" rx="110" ry="5" fill="url(#silverWaterReflect)" opacity="0.45" />
          <ellipse cx="-5" cy="110" rx="140" ry="6" fill="url(#silverWaterReflect)" opacity="0.35" />
          <ellipse cx="20" cy="140" rx="95" ry="4" fill="url(#silverWaterReflect)" opacity="0.25" />
          <ellipse cx="-10" cy="180" rx="120" ry="5" fill="url(#silverWaterReflect)" opacity="0.2" />
        </g>

        {/* --- FLOATING ETHEREAL SILVER STARDUST PARTICLES --- */}
        <g opacity="0.5">
          <circle cx="1320" cy="220" r="1.5" fill="#ffffff" opacity="0.8" />
          <circle cx="1380" cy="340" r="2" fill="#ffffff" opacity="0.6" />
          <circle cx="1560" cy="280" r="1.8" fill="#ffffff" opacity="0.7" />
          <circle cx="1620" cy="180" r="1.2" fill="#ffffff" opacity="0.9" />
          <circle cx="1440" cy="460" r="2.2" fill="#ffffff" opacity="0.5" />
          <circle cx="1280" cy="520" r="1.5" fill="#ffffff" opacity="0.6" />
          <circle cx="1700" cy="420" r="1.6" fill="#ffffff" opacity="0.7" />
          <circle cx="1150" cy="380" r="1.2" fill="#ffffff" opacity="0.5" />
          <circle cx="1020" cy="280" r="1.4" fill="#ffffff" opacity="0.4" />
        </g>
      </svg>
    </div>
  );
};
