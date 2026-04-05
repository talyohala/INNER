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
          DEFAULT: '#0F172A', // סלייט-900 לכרטיסיות ואלמנטים פנימיים
          card: 'rgba(15, 23, 42, 0.4)', // סלייט-900 שקוף
          border: 'rgba(51, 65, 85, 0.4)', // סלייט-700 שקוף
        },
        brand: {
          DEFAULT: '#F1F5F9', // סלייט-100 לטקסט ראשי
          muted: '#64748B', // סלייט-400 לטקסט משני
        },
        accent: {
          crd: '#38BDF8', // כחול שמיים בוהק
          vip: '#E2E8F0', // סלייט-200
        }
      }
    },
  },
  plugins: [],
}
