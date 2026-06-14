/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#155DFC', hover: '#1248C9', light: '#51A2FF' },
        surface: { DEFAULT: '#F8FAFC', card: '#FFFFFF', dark: '#0F172A' },
        border: { DEFAULT: '#E2E8F0' },
        text: { primary: '#020817', secondary: '#64748B' },
        status: { success: '#10B981', warning: '#F59E0B', info: '#3B82F6' }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { DEFAULT: '8px', lg: '12px' },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
      }
    },
  },
  plugins: [],
}