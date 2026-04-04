// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/contexts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Основные цвета приложения
        primary: {
          DEFAULT: '#2458c6',
          50: '#eef3ff',
          100: '#dae6ff',
          200: '#bfd2ff',
          300: '#9cb7ff',
          400: '#7496f6',
          500: '#4f76e6',
          600: '#2458c6',
          700: '#2146a0',
          800: '#203b80',
          900: '#1f3468',
          950: '#162142',
        },
        secondary: {
          DEFAULT: '#f2b451',
          50: '#fff9ed',
          100: '#fff1d2',
          200: '#fee0a4',
          300: '#fccc72',
          400: '#f6bb5a',
          500: '#f2b451',
          600: '#de9a33',
          700: '#be7c28',
          800: '#986228',
          900: '#7b5123',
          950: '#452a12',
        },
        accent: {
          DEFAULT: '#0f8f8c',
          50: '#ecfbfa',
          100: '#cef6f2',
          200: '#9eece7',
          300: '#67dbd6',
          400: '#35c2c0',
          500: '#17a9a8',
          600: '#0f8f8c',
          700: '#116f6e',
          800: '#155957',
          900: '#164948',
          950: '#072b2b',
        },
        
        // Цвета категорий мероприятий
        category: {
          concert: {
            DEFAULT: '#6fa3f4',
            light: '#e6f2ff',
            dark: '#2b539f',
          },
          internal: {
            DEFAULT: '#7aa8ff',
            light: '#edf1ff',
            dark: '#3c5fa3',
          },
          public: {
            DEFAULT: '#6fc7ff',
            light: '#e6f6ff',
            dark: '#2b6da6',
          },
          competition: {
            DEFAULT: '#7ad8f5',
            light: '#e8fbff',
            dark: '#2f8fb0',
          },
          lecture: {
            DEFAULT: '#6fa3f4',
            light: '#e6f2ff',
            dark: '#3569c9',
          },
          masterclass: {
            DEFAULT: '#8ad4ff',
            light: '#e9f6ff',
            dark: '#3a7db4',
          },
          volunteer: {
            DEFAULT: '#7ccfe6',
            light: '#e9f7fb',
            dark: '#2e8199',
          },
          news: {
            DEFAULT: '#94bfff',
            light: '#edf4ff',
            dark: '#3f6fb5',
          },
        },
        
        // Статусные цвета
        success: {
          DEFAULT: '#4caf50',
          50: '#f0f9f0',
          100: '#dcf0dd',
          200: '#bce1be',
          300: '#90ca93',
          400: '#5fab62',
          500: '#4caf50',
          600: '#3d8b40',
          700: '#336f36',
          800: '#2d5930',
          900: '#274a29',
          950: '#112713',
        },
        danger: {
          DEFAULT: '#f44336',
          50: '#fef2f2',
          100: '#fee2e1',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#f44336',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        warning: {
          DEFAULT: '#ff9800',
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ff9800',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        
        // Нейтральные цвета
        gray: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#868e96',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
          950: '#121417',
        },
        
        // Семантические цвета
        light: '#f6fbff',
        'light-gray': '#edf2fa',
        dark: '#101b32',
        border: '#c7d2e6',
        background: '#f8f9fc',
      },
      
      // Расширение borderRadius
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        'DEFAULT': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px',
        'radius': '0.75rem',
        'radius-sm': '0.5rem',
      },
      
      // Тени
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'custom': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'custom-hover': '0 8px 20px rgba(0, 0, 0, 0.12)',
        'card': '0 2px 10px rgba(32, 88, 148, 0.12)',
        'card-hover': '0 10px 28px rgba(32, 88, 148, 0.18)',
        'modal': '0 20px 60px rgba(0, 0, 0, 0.2)',
      },
      
      // Анимации
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-out': 'fadeOut 0.5s ease-in-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'slide-in-down': 'slideInDown 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'scale-out': 'scaleOut 0.2s ease-in',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'gradient': 'gradient 3s ease infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      
      // Переходы
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
        'transform': 'transform',
        'colors': 'background-color, border-color, color, fill, stroke',
        'opacity': 'opacity',
        'shadow': 'box-shadow',
        'filter': 'filter',
      },
      
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '1200': '1200ms',
      },
      
      // Шрифты
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      
      // Размеры контейнера
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
        '10xl': '104rem',
      },
      
      // Расширение spacing
      spacing: {
        '5%': '5%',
        '10%': '10%',
        '15%': '15%',
        '128': '32rem',
        '144': '36rem',
      },
      
      // Z-index
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      
      // Градиенты
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2458c6 0%, #4f76e6 100%)',
        'gradient-accent': 'linear-gradient(135deg, #0f8f8c 0%, #62d8d4 100%)',
        'gradient-success': 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)',
        'gradient-danger': 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
        'gradient-warning': 'linear-gradient(135deg, #f2b451 0%, #ffd993 100%)',
        'gradient-concert': 'linear-gradient(135deg, #2458c6 0%, #7fa3ff 100%)',
        'gradient-internal': 'linear-gradient(135deg, #0f8f8c 0%, #a8ece9 100%)',
        'gradient-public': 'linear-gradient(135deg, #f2b451 0%, #ffe1a9 100%)',
        'gradient-competition': 'linear-gradient(135deg, #2146a0 0%, #2458c6 100%)',
        'gradient-shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
      },
      
      // Backdrop фильтры
      backdropBlur: {
        'xs': '2px',
      },
      
      // Размеры для кастомизации
      minHeight: {
        'screen-75': '75vh',
        'screen-80': '80vh',
        'screen-85': '85vh',
        'screen-90': '90vh',
      },
      
      // Grid
      gridTemplateColumns: {
        '16': 'repeat(16, minmax(0, 1fr))',
        '24': 'repeat(24, minmax(0, 1fr))',
      },
    },
  },
  
  plugins: [
    // Плагин для анимации placeholder
    function({ addUtilities }) {
      const newUtilities = {
        '.animate-shimmer': {
          backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite',
        },
        '.bg-gradient-animated': {
          backgroundSize: '400% 400%',
          animation: 'gradient 15s ease infinite',
        },
        '.text-gradient': {
          backgroundClip: 'text',
          '-webkit-background-clip': 'text',
          color: 'transparent',
        },
        '.hide-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.glass': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-dark': {
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.2)',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}
