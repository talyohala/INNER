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
          DEFAULT: '#141416', 
          card: 'rgba(255, 255, 255, 0.08)', // קצת יותר לבן כדי שהזכוכית תבלוט
          border: 'rgba(255, 255, 255, 0.15)', // גבולות בוהקים יותר
        },
        brand: {
          DEFAULT: '#F3F4F6',
          muted: '#9CA3AF',
        },
        accent: {
          crd: '#EAB308',
          vip: '#A855F7',
        }
      }
    },
  },
  plugins: [],
}
