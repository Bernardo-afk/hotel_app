/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: { primary: '#0D7377', dark: '#0B5563' },
        urgency: { red: '#E63946', yellow: '#F4A261', green: '#2DC653' },
      },
    },
  },
  plugins: [],
}

