/**
 * Tasarim tokenlari docs/DESIGN.md dosyasindan gelir.
 * Mockup'ta Tailwind CDN uzerinden verilen ayni degerler burada derlenir.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#b90014',
        'on-primary': '#ffffff',
        'primary-container': '#e31b23',
        'on-primary-container': '#fff9f8',
        'primary-fixed': '#ffdad6',
        'primary-fixed-dim': '#ffb4ac',
        'on-primary-fixed': '#410002',
        'on-primary-fixed-variant': '#93000d',
        'inverse-primary': '#ffb4ac',

        secondary: '#515f74',
        'on-secondary': '#ffffff',
        'secondary-container': '#d5e3fd',
        'on-secondary-container': '#57657b',
        'secondary-fixed': '#d5e3fd',
        'secondary-fixed-dim': '#b9c7e0',
        'on-secondary-fixed': '#0d1c2f',
        'on-secondary-fixed-variant': '#3a485c',

        tertiary: '#585c5d',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#717476',
        'on-tertiary-container': '#f9fbfd',
        'tertiary-fixed': '#e0e3e5',
        'tertiary-fixed-dim': '#c4c7c9',
        'on-tertiary-fixed': '#191c1e',
        'on-tertiary-fixed-variant': '#444749',

        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        // Marka lacivertleri — "10 Adımda Kardiyoloji" logosundan
        brand: {
          navy: '#1b3a6b',
          'navy-dark': '#132a4e',
          'navy-light': '#3d7ac4',
          red: '#e31b23',
        },

        // Fonksiyonel aksanlar (DESIGN.md: doygunlugu dusuk, akademik ton)
        success: '#0f766e',
        'success-container': '#d1fae5',
        'on-success-container': '#064e3b',
        warning: '#b45309',
        'warning-container': '#fef3c7',
        'on-warning-container': '#78350f',

        background: '#f8f9ff',
        'on-background': '#0b1c30',
        surface: '#f8f9ff',
        'on-surface': '#0b1c30',
        'surface-dim': '#cbdbf5',
        'surface-bright': '#f8f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'surface-container-high': '#dce9ff',
        'surface-container-highest': '#d3e4fe',
        'surface-variant': '#d3e4fe',
        'on-surface-variant': '#5d3f3c',
        'inverse-surface': '#213145',
        'inverse-on-surface': '#eaf1ff',
        'surface-tint': '#c00015',
        outline: '#926e6b',
        'outline-variant': '#e7bdb8',
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '9999px',
      },
      spacing: {
        unit: '8px',
        gutter: '24px',
        'margin-mobile': '16px',
        'margin-desktop': '40px',
        'section-gap': '80px',
      },
      maxWidth: {
        'container-max-width': '1280px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-lg-mobile': ['28px', { lineHeight: '36px', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-sm': ['13px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
      boxShadow: {
        // DESIGN.md: Level 1 (kartlar) ve Level 2 (modallar)
        level1: '0px 4px 20px rgba(0, 0, 0, 0.04)',
        level2: '0px 10px 32px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
