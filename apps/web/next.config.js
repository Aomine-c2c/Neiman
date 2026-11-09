/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/company', destination: '/dashboard/organizations', permanent: false },
      { source: '/organization', destination: '/dashboard/organizations', permanent: false },
      { source: '/departments', destination: '/dashboard/departments', permanent: false },
      { source: '/agents', destination: '/dashboard/agents', permanent: false },
      { source: '/projects', destination: '/dashboard/projects', permanent: false },
      { source: '/tasks', destination: '/dashboard/tasks', permanent: false },
      { source: '/workflows', destination: '/dashboard/workflows', permanent: false },
      { source: '/intelligence', destination: '/dashboard/intelligence', permanent: false },
      { source: '/resources', destination: '/dashboard/resources', permanent: false },
      { source: '/memory', destination: '/dashboard/memory', permanent: false },
      { source: '/decisions', destination: '/dashboard/decisions', permanent: false },
      { source: '/approvals', destination: '/dashboard/approvals', permanent: false },
      { source: '/activity', destination: '/dashboard/activity', permanent: false },
      { source: '/evolution', destination: '/dashboard/evolution', permanent: false },
      { source: '/simulation', destination: '/dashboard/simulation', permanent: false },
      { source: '/settings', destination: '/dashboard/settings', permanent: false },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
};

module.exports = nextConfig;