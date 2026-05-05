export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
        fontFamily: {
            sans: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        },
        colors: {
            spotify: '#1DB954',
            youtube: '#FF0000',
            darkBackground: '#070808',
            surfaceCard: '#101313',
            ink: '#F4F7F5',
            muted: '#98A29E',
            line: 'rgba(255,255,255,0.10)'
        },
        boxShadow: {
            glowGreen: '0 18px 70px rgba(29,185,84,0.22)',
            panel: '0 24px 80px rgba(0,0,0,0.42)'
        },
        keyframes: {
            aurora: {
                '0%, 100%': { backgroundPosition: '0% 50%' },
                '50%': { backgroundPosition: '100% 50%' },
            },
            floatSlow: {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-12px)' },
            },
            marquee: {
                '0%': { transform: 'translateX(0)' },
                '100%': { transform: 'translateX(-50%)' },
            },
            shimmer: {
                '0%': { transform: 'translateX(-120%)' },
                '100%': { transform: 'translateX(120%)' },
            },
            spinSlow: {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
            },
        },
        animation: {
            aurora: 'aurora 16s ease infinite',
            floatSlow: 'floatSlow 5s ease-in-out infinite',
            marquee: 'marquee 28s linear infinite',
            shimmer: 'shimmer 2.8s ease-in-out infinite',
            spinSlow: 'spinSlow 14s linear infinite',
        },
    },
  },
  plugins: [],
}
