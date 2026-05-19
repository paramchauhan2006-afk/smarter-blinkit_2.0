/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#f8cb46',
        secondary: '#000000',
        accent: '#2b2b2b'
      }
    },
  },
  plugins: [],
}
