/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Design Token Colors (Brand)
        brand: {
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
          'primary-light': 'rgb(var(--color-primary-light) / <alpha-value>)',
          'primary-dark': 'rgb(var(--color-primary-dark) / <alpha-value>)',
          violet: 'rgb(var(--color-violet) / <alpha-value>)',
          fuchsia: 'rgb(var(--color-fuchsia) / <alpha-value>)',
          cyan: 'rgb(var(--color-cyan) / <alpha-value>)',
          amber: 'rgb(var(--color-amber) / <alpha-value>)',
          emerald: 'rgb(var(--color-emerald) / <alpha-value>)',
          rose: 'rgb(var(--color-rose) / <alpha-value>)',
        },
        // Semantic Colors
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        // Brutalist Dark Slate (brutalist base)
        slate: {
          950: '#07070A',
          900: '#111111', 
          800: '#1a1a1a', 
          700: '#2b2b2b',
          600: '#3c3c3c',
          500: '#525252',
        },
        // Acid Colors (neon brutalism)
        acid: {
          pink: '#FF0066',
          yellow: '#FFEA00',
          orange: '#FF5500',
          green: '#00FF66',
          blue: '#00CCFF',
        },
        // App Surface Colors (dark theme backgrounds — tokens prevent inline hex)
        surface: {
          dark: '#111111', 
          darker: '#07070A', 
          base: '#1a1a1a', 
          void: '#111111', 
        },
        // Glass Colors
        glass: {
          bg: {
            base: 'var(--glass-bg-base)',
            elevated: 'var(--glass-bg-elevated)',
            premium: 'var(--glass-bg-premium)',
            solid: 'var(--glass-bg-solid)',
          },
          border: {
            subtle: 'var(--glass-border-subtle)',
            DEFAULT: 'var(--glass-border-default)',
            prominent: 'var(--glass-border-prominent)',
            hover: 'var(--glass-border-hover)',
          },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Animation Timing from Design Tokens
      transitionDuration: {
        fastest: 'var(--duration-fastest)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
        slowest: 'var(--duration-slowest)',
      },
      transitionTimingFunction: {
        smooth: 'var(--ease-smooth)',
        bounce: 'var(--ease-bounce)',
        spring: 'var(--ease-spring)',
        snappy: 'var(--ease-snappy)',
      },
      // Backdrop Blur from Design Tokens
      backdropBlur: {
        glass: {
          sm: 'var(--glass-blur-sm)',
          md: 'var(--glass-blur-md)',
          lg: 'var(--glass-blur-lg)',
          xl: 'var(--glass-blur-xl)',
        },
      },
      // Box Shadow from Design Tokens
      boxShadow: {
        glass: 'var(--glass-shadow)',
        'glass-lg': 'var(--glass-shadow-lg)',
        'glass-inset': 'var(--glass-inset)',
        'glow-primary': 'var(--glow-primary)',
        'glow-primary-lg': 'var(--glow-primary-lg)',
        brutal: '6px 6px 0px 0px rgba(0,0,0,1)',
        'brutal-lg': '12px 12px 0px 0px rgba(0,0,0,1)',
        'brutal-acid-pink': '6px 6px 0px 0px #FF0066',
        'brutal-acid-yellow': '6px 6px 0px 0px #FFEA00',
        'brutal-acid-orange': '6px 6px 0px 0px #FF5500',
        'brutal-white': '6px 6px 0px 0px #FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
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
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: 'var(--glow-primary)' },
          '50%': { boxShadow: 'var(--glow-primary-lg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - var(--gap)))' },
        },
        'marquee-vertical': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(calc(-100% - var(--gap)))' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.5s infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.6s var(--ease-smooth)',
        'fade-in': 'fade-in 0.8s var(--ease-smooth)',
        marquee: 'marquee var(--duration) infinite linear',
        'marquee-vertical': 'marquee-vertical var(--duration) linear infinite',
      },
    },
  },
  plugins: [],
};
