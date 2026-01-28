import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开启重写规则，解决跨域问题
  async rewrites() {
    return [
      {
        source: '/api/:path*', // 前端请求路径
        destination: 'http://127.0.0.1:8000/api/:path*', // 转发到的后端路径
      },
    ];
  },
};

export default nextConfig;