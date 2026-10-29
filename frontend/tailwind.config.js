/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFCF9',
          100: '#FAF7F2',
          200: '#F5EFE6',
          300: '#EADFCF',
          400: '#D6C4AD',
          500: '#B89F82',
        },
        forest: {
          50: '#F0F7F4',
          100: '#D8ECE2',
          200: '#B2DAC7',
          300: '#83C2A5',
          400: '#52A782',
          500: '#2D8A63',
          600: '#1F6F4E',
          700: '#17563C',
          800: '#144531',
          900: '#0E2F22',
          950: '#081D15',
        },
        amberGold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
