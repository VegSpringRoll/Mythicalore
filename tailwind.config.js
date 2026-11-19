/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#050507',
          elevated: '#0e0e12',
          surface: '#141418',
          glass: 'rgba(14, 14, 18, 0.75)',
        },
        charcoal: {
          900: '#0a0a0d',
          800: '#121216',
          700: '#18181f',
          600: '#22222a',
        },
        accent: {
          DEFAULT: '#ffffff',
          hover: '#e4e4e7',
          silver: '#d4d4d8',
          cyan: '#ffffff',
          fuchsia: '#ffffff',
          amber: '#ffffff',
          rose: '#f43f5e',
          emerald: '#10b981',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.08)',
          glow: 'rgba(255, 255, 255, 0.25)',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.7)',
        'glow-white': '0 0 20px rgba(255, 255, 255, 0.25)',
        'glow-silver': '0 0 20px -2px rgba(255, 255, 255, 0.15)',
        'glow-indigo': '0 0 20px -2px rgba(255, 255, 255, 0.2)',
        'glow-cyan': '0 0 20px -2px rgba(255, 255, 255, 0.2)',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        }
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
