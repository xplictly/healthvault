/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ch: {
          bg: '#181a1b',
          surface: '#222425',
          'surface-hover': '#2a2d2e',
          border: '#333637',
          green: '#64f0eb',
          'green-dim': '#3ba8a7',
          teal: '#64f0eb',
          yellow: '#f5a623',
          orange: '#e8590c',
          red: '#ff4757',
          blue: '#4dabf7',
          purple: '#b197fc',
          text: '#d4d4d4',
          'text-dim': '#888a8b',
          'text-bright': '#f0f0f0',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Menlo', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
