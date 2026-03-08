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
    name: 'Sidecore AI',
    // Mandatory: minimal install footprint
    // - sidePanel: UI container
    // - storage: settings + chat persistence
    // - tabs: query tab metadata (title, URL) for tab picker
    // - activeTab: scripting access to current tab on user gesture (single-tab flow)
    // - scripting: inject content extractor into tabs
    // - contextMenus: "Summarize page" / "Ask about page" actions
    permissions: ['sidePanel', 'storage', 'tabs', 'activeTab', 'scripting', 'contextMenus'],
    // Optional: requested at runtime via chrome.permissions.request()
    // - <all_urls>: multi-tab extraction (read content from non-active tabs)
    // - External API origins are requested dynamically per-domain for LLM/MCP/fetch
    optional_host_permissions: ['<all_urls>'],
    side_panel: {
      default_path: 'sidepanel.html'
    },
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png'
    }
  }
});
