/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d0f12',
        surface: 'rgba(255, 255, 255, 0.05)',
        border: 'rgba(255, 255, 255, 0.08)',
        primary: '#d6b38a',
        primaryHover: '#cfa57b',
        muted: '#a5adb7',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
        'primary-gradient': 'linear-gradient(180deg, #f0d4b4, #cfa57b)',
      }
    },
  },
  plugins: [],
}
