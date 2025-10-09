export const pageTree = {
  name: 'Nile Documentation',
  children: [
    {
      type: 'page',
      name: 'Introduction',
      url: '/docs',
    },
    {
      type: 'page',
      name: 'Getting Started',
      url: '/docs/getting-started',
    },
    {
      type: 'page',
      name: 'Core Concepts',
      url: '/docs/core-concepts',
    },
    {
      type: 'folder',
      name: 'API Reference',
      index: {
        type: 'page',
        name: 'Overview',
        url: '/docs/api-reference',
      },
      children: [
        {
          type: 'page',
          name: 'REST-RPC',
          url: '/docs/api-reference/rest-rpc',
        },
        {
          type: 'page',
          name: 'WebSocket RPC',
          url: '/docs/api-reference/websocket-rpc',
        },
        {
          type: 'page',
          name: 'Agentic System',
          url: '/docs/api-reference/agentic',
        },
      ],
    },
    {
      type: 'folder',
      name: 'Guides',
      children: [
        {
          type: 'page',
          name: 'Architecture',
          url: '/docs/guides/architecture',
        },
        {
          type: 'page',
          name: 'Authentication',
          url: '/docs/guides/authentication',
        },
        {
          type: 'page',
          name: 'Hooks',
          url: '/docs/guides/hooks',
        },
      ],
    },
  ],
};
