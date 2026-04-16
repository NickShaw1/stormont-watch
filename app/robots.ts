import type { MetadataRoute } from 'next'

export const runtime = 'edge'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'CCBot',
          'anthropic-ai',
          'ClaudeBot',
          'Claude-Web',
          'Google-Extended',
          'FacebookBot',
          'Amazonbot',
          'Applebot-Extended',
          'Bytespider',
          'cohere-ai',
          'Diffbot',
          'ImagesiftBot',
          'magpie-crawler',
          'omgili',
          'omgilibot',
          'PetalBot',
          'Scrapy',
          'Timpibot',
          'YouBot',
          'PerplexityBot',
          'AI2Bot',
          'Kangaroo Bot',
        ],
        disallow: '/',
      },
    ],
    sitemap: 'https://www.stormontwatch.com/sitemap.xml',
  }
}
