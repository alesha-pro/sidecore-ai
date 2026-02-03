import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    resolve: {
      alias: {
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
  }),
  manifest: {
    name: 'Sidepanel AI Agent',
    permissions: ['sidePanel', 'storage', 'tabs', 'scripting', 'contextMenus'],
    host_permissions: [
      '<all_urls>',  // Required for on-demand content extraction via chrome.scripting.executeScript
      'https://api.openai.com/*',
      'https://*.openai.com/*',
      'http://localhost:11434/*'  // Ollama local
    ],
    side_panel: {
      default_path: 'sidepanel.html'
    }
  }
});
