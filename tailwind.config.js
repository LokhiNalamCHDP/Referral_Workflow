/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'rgb(48 158 235 / <alpha-value>)'
      }
    }
  },
  plugins: []
}
