import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/visdiff/',
  title: 'visdiff',
  description: 'Turn visual UI feedback into actionable tasks for coding agents.',
  cleanUrls: true,
  themeConfig: {
    siteTitle: 'visdiff',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Agent workflow', link: '/guide/agent-workflow' },
      { text: 'Task format', link: '/reference/task-format' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Agent workflow', link: '/guide/agent-workflow' },
            { text: 'CLI and MCP', link: '/guide/cli-and-mcp' },
            { text: 'Development', link: '/guide/development' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Task format', link: '/reference/task-format' },
            { text: 'Bundler adapters', link: '/reference/adapters' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/artemjasan/visdiff' },
    ],
    editLink: {
      pattern: 'https://github.com/artemjasan/visdiff/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Visual feedback, ready for your coding agent',
      copyright: 'Released under the MIT License.',
    },
  },
})
