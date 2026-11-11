/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../shared/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#16A34A',
          accent: '#22C55E',
          dark: '#0A5F2A',
          deep: '#026932',
          lime: '#44C624',
          ink: '#14231A',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Noto Sans Ethiopic', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
