import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      port: 5173,
      clientPort: 5173,
    },
    watch: {
      usePolling: true,
    },
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private',
      Pragma: 'no-cache',
      Expires: '0',
      'Last-Modified': new Date().toUTCString(),
      ETag: `"${Date.now()}"`,
      Vary: '*',
      Age: '0',
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          auth: [
            './src/views/LoginView.vue',
            './src/views/RegisterView.vue',
            './src/components/auth/LoginForm.vue',
            './src/components/auth/RegisterForm.vue',
          ],
          marketplace: [
            './src/views/MarketplaceViewEnhanced.vue',
            './src/components/search/AdvancedSearch.vue',
          ],
          analytics: ['./src/views/AnalyticsView.vue', './src/utils/analytics.js'],
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/\.(css)$/.test(assetInfo.name)) {
            return `css/[name]-[hash].${ext}`
          }
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `images/[name]-[hash].${ext}`
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name)) {
            return `fonts/[name]-[hash].${ext}`
          }
          return `assets/[name]-[hash].${ext}`
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
      },
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  // Security/hygiene: strip noisy debug logging (which included session email,
  // user ids and profile objects) from the PRODUCTION bundle. console.error and
  // console.warn are preserved for real error reporting. In dev (no minify)
  // logging stays intact.
  esbuild: {
    pure: ['console.log', 'console.info', 'console.debug'],
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia'],
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
  },
})
