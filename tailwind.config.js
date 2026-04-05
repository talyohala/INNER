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
        surface: {
          DEFAULT: '#18191C', 
          card: '#2B2D31', 
          border: 'rgba(255, 255, 255, 0.06)', 
        },
        brand: {
          DEFAULT: '#F2F3F5',
          muted: '#949BA4',
        },
        accent: {
          primary: '#B8C8FA', // תכלת פסטל רך ונעים יותר
        }
      }
    },
  },
  plugins: [],
}
