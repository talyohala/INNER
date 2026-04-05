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
          DEFAULT: '#141416', // אפור פחם עמוק (לא שחור)
          card: 'rgba(255, 255, 255, 0.06)', // לבן שקוף בולט יותר
          border: 'rgba(255, 255, 255, 0.12)', // גבולות בהירים יותר
        },
        brand: {
          DEFAULT: '#F3F4F6', // לבן רך
          muted: '#9CA3AF', // אפור קריר
        },
        accent: {
          crd: '#EAB308', // ענבר/זהב
          vip: '#A855F7', // סגול VIP
        }
      }
    },
  },
  plugins: [],
}
