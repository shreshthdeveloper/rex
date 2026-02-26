export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'surface-secondary': 'var(--color-surface-secondary)',
        'surface-tertiary': 'var(--color-surface-tertiary)',
        'surface-elevated': 'var(--color-surface-elevated)',
        brand: 'var(--color-brand)',
        'brand-hover': 'var(--color-brand-hover)',
        'brand-light': 'var(--color-brand-light)',
        'brand-dark': 'var(--color-brand-dark)',
        content: 'var(--color-content)',
        'content-secondary': 'var(--color-content-secondary)',
        'content-tertiary': 'var(--color-content-tertiary)',
        'content-inverse': 'var(--color-content-inverse)',
        border: 'var(--color-border)',
        'border-hover': 'var(--color-border-hover)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        base: 'var(--transition-base)',
        slow: 'var(--transition-slow)',
      },
      maxWidth: {
        container: 'var(--container-max)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
