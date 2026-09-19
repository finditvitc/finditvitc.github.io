/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#004ac6',
          container: '#2563eb',
        },
        'on-primary': '#ffffff',
        'on-primary-container': '#eeefff',
        'found-emerald': {
          DEFAULT: '#059669',
          soft: '#ECFDF5',
        },
        'lost-coral': {
          DEFAULT: '#F97316',
          soft: '#FFF7ED',
        },
        'emergency-crimson': {
          DEFAULT: '#DC2626',
          surface: '#450A0A',
        },
        surface: {
          DEFAULT: '#f9f9ff',
          dim: '#cfdaf2',
          bright: '#f9f9ff',
          'container-lowest': '#ffffff',
          'container-low': '#f0f3ff',
          container: '#e7eeff',
          'container-high': '#dee8ff',
          'container-highest': '#d8e3fb',
        },
        'campus-base': '#FAFAF9',
        'on-surface': '#111c2d',
        'on-surface-variant': '#434655',
        outline: {
          DEFAULT: '#737686',
          variant: '#c3c6d7',
        },
        'border-subtle': '#E2E8F0',
        campus: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        emergency: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        }
      },
      fontFamily: {
        headline: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['"Space Grotesk"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
