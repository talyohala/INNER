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
          DEFAULT: '#0F0F11', // פחם עמוק ויוקרתי
          card: 'rgba(255, 255, 255, 0.05)', 
          border: 'rgba(255, 255, 255, 0.1)', 
        },
        brand: {
          DEFAULT: '#FFFFFF',
          muted: '#8E8E93',
        },
        accent: {
          crd: '#D4AF37', // שמפניה אמיתית ונקייה
          vip: '#E5E4E2', // פלטינום
        }
      }
    },
  },
  plugins: [],
}
