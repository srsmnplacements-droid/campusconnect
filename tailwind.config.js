/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { green: '#15803d', greenDark: '#166534', greenLight: '#dcfce7', navy: '#0b2545', navyLight: '#e8eef7' },
      },
    },
  },
  plugins: [],
}
