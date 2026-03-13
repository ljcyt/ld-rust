/** @type {import('next').NextConfig} */
const nextConfig = {
  // 只在生产构建时使用静态导出
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
