import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';
import { colors } from './src/styles/tailwind.colors';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        dark: colors.dark,
        red: colors.red,
        green: colors.green,
        gray: colors.gray,
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fadeIn': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '70%': { transform: 'scale(1.2)', opacity: '0' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
        'typing': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fadeIn': 'fadeIn 0.3s ease-out forwards',
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'typing': 'typing 1.5s steps(20, end) infinite',
      },
      boxShadow: {
        'primary': '0 0 0 2px rgba(255, 107, 0, 0.5)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};

export default config;
