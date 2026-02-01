import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Sidepanel AI Agent',
    permissions: ['sidePanel', 'storage'],
    side_panel: {
      default_path: 'sidepanel.html'
    }
  }
});
