/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // הכנה רשמית למצב בהיר/כהה
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#141416', 
          card: 'rgba(255, 255, 255, 0.1)', 
          border: 'rgba(255, 255, 255, 0.25)', 
        },
        brand: {
          DEFAULT: '#FFFFFF',
          muted: '#A1A1AA',
        },
        accent: {
          crd: '#C2A382',
          vip: '#E5E5E5',
        }
      }
    },
  },
  plugins: [],
}
