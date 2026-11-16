const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'] },
      colors: {
        base: token('base'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        mute: token('mute'),
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        toastIn: { from: { opacity: 0, transform: 'translateY(8px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        pop: { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'none' } },
        bar: { from: { width: '0%' }, to: { width: '100%' } },
      },
      animation: {
        toast: 'toastIn .2s ease-out',
        fade: 'fadeIn .2s ease-out',
        pop: 'pop .18s ease-out',
        bar: 'bar 1.6s ease-in-out forwards',
      },
    },
  },
  plugins: [],
};
