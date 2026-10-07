import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/visdiff/',
  title: 'visdiff',
  description: 'Capture browser edits with intent and source context for coding agents.',
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
      message: 'Show your agent what to change',
      copyright: 'Released under the MIT License.',
    },
  },
})
