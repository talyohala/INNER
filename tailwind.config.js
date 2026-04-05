/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#000000', // שחור מוחלט (נקי לחלוטין)
          card: 'rgba(255, 255, 255, 0.02)', // רקע כמעט בלתי מורגש לקלפים
          border: 'rgba(255, 255, 255, 0.05)', // קווי מתאר סופר-עדינים
        },
        brand: {
          DEFAULT: '#FFFFFF', // לבן ראשי לכפתורים וטקסט בולט
          muted: '#888888', // אפור לטקסט משני
        },
        accent: {
          crd: '#C2A382', // צבע שמפניה/נחושת עדין למטבעות (CRD)
          vip: '#E5E5E5', // כסף/פלטינום לסטטוס
        }
      }
    },
  },
  plugins: [],
}
