import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Sidepanel AI Agent',
    permissions: ['sidePanel', 'storage', 'tabs', 'scripting'],
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
