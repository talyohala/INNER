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
          DEFAULT: '#050505', // שחור-פחם עמוק במיוחד שייתן לזכוכית לבלוט
          card: 'rgba(255, 255, 255, 0.02)', // לבן סופר-שקוף (רק 2% אטימות!)
          border: 'rgba(255, 255, 255, 0.08)', // גבול חצי-שקוף ועדין שיחזיר אור
        },
        brand: {
          DEFAULT: '#F3F4F6',
          muted: '#888888',
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
