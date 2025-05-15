/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    'bg-primary',
    'text-primary',
    'border-primary',
    'bg-dark-100',
    'bg-dark-200',
    'bg-dark-300',
    'bg-dark-400',
    'hover:bg-primary',
    'hover:text-primary',
    'hover:bg-orange-600',
    'hover:bg-primary/10',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B00', // Laranja da Bússola Executiva
        secondary: '#FFFFFF',
        dark: {
          100: '#1A1A1A',
          200: '#222222',
          300: '#2A2A2A',
          400: '#333333',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
