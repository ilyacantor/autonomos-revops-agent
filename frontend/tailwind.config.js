/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#000000',
        'card-bg': '#0A2540',
        'card-border': '#1E4A6F',
        'teal-accent': '#0BCAD9',
        'teal-hover': '#09A8B5',
        'text-secondary': '#A0AEC0',
      },
      fontFamily: {
        sans: ['Quicksand', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
