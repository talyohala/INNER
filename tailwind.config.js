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
          DEFAULT: '#141416', // אפור פחם עמוק (החזרתי)
          card: 'rgba(255, 255, 255, 0.1)', // לבן שקוף לחלוטין (לא אפור)
          border: 'rgba(255, 255, 255, 0.25)', // גבול לבן וחזק יותר להשתקפות של המראה
        },
        brand: {
          DEFAULT: '#FFFFFF', // לבן בוהק
          muted: '#A1A1AA', // אפור בהיר לטקסט
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
