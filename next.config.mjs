/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'aims.niassembly.gov.uk',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/assembly/votes/:id(nia-bill-.+)',
        destination: '/assembly/bills/:id',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
