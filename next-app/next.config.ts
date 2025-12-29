import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // reactCompiler: true,

  // Turbopack設定（Next.js 16でwebpack設定と共存するために必要）
  turbopack: {},
  // transformers.js compatibility
  serverExternalPackages: ['onnxruntime-node', 'sharp'],

  webpack: (config) => {
    // For browser-side transformers.js
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    };
    return config;
  },
};

export default nextConfig;
