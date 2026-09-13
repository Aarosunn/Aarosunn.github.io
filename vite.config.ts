import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// VITE_BASE: '/' for a user site (<user>.github.io), '/<repo>/' for a project site
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
