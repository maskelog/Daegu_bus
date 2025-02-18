/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://apis.data.go.kr/6270000/dbmsapi01/:path*'
      }
    ];
  }
};

module.exports = nextConfig;