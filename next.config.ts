import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['firebase-admin'],
  devIndicators: {
    allowedDevOrigins: [
      'https://6000-firebase-studio-1761821327150.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev',
      'https://9000-firebase-studio-1761821327150.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev',
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn-icons-png.flaticon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'webcart.tech',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
