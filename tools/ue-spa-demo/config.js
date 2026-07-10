export const demoConfig = {
  authorUrl: 'https://author-p138879-e1741192.adobeaemcloud.com',

  // Content Fragment path used by Universal Editor as the persistence resource.
  fragmentVariation: 'master',
  fragmentResource: '/content/dam/ue-demo/fragments/home-hero',

  // Optional. Leave blank to use fallback content below.
  // Expected response can be either:
  // { data: { heroByPath: { item: { title, eyebrow, description, image } } } }
  // or any object with top-level title/eyebrow/description/image fields.
  graphQlEndpoint: './content.json',

  fallbackContent: {
    eyebrow: 'Universal Editor SPA demo',
    title: 'Editable content from a remote app',
    description:
      'This static SPA renders Universal Editor annotations so authors can select and edit fields in context.',
    image:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
    ctaLabel: 'View content',
  },
};

