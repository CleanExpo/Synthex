/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.{html,js}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#007AFF',
        secondary: '#0051D5',
        accent: {
          purple: '#5856D6',
          teal: '#5AC8FA'
        },
        success: '#34C759',
        warning: '#FF9500',
        danger: '#FF3B30'
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}