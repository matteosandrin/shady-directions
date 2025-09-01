/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      animation: {
        'pulse': 'custom-pulse 2s infinite',
      },
      keyframes: {
        'custom-pulse': {
          '0%': {
            boxShadow: '0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000'
          },
          '50%': {
            boxShadow: '0 0 15px #ff0000, 0 0 30px #ff0000, 0 0 45px #ff0000'
          },
          '100%': {
            boxShadow: '0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000'
          }
        }
      },
      colors: {
        'shaded-route': '#8b5cf6',
        'sunny-route': '#fbbf24',
        'start-marker': '#00ff00',
        'end-marker': '#ff0000',
        'error-red': '#d73027'
      }
    },
  },
  plugins: [],
}