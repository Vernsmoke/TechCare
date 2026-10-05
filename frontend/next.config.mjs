import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
// Next loads frontend/.env first. Reload from the shared root used by our CLI tools.
nextEnv.loadEnvConfig(projectRoot, process.env.NODE_ENV !== 'production', console, true);
process.env.TECHCARE_PROJECT_ROOT = projectRoot;
process.env.TECHCARE_DATA_DIR = resolve(projectRoot, process.env.TECHCARE_DATA_DIR || 'data');
if (process.env.TECHCARE_FFPROBE?.match(/[/\\]/)) {
  process.env.TECHCARE_FFPROBE = resolve(projectRoot, process.env.TECHCARE_FFPROBE);
}

const config = {
  outputFileTracingRoot: projectRoot,
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.TECHCARE_BUILD_DIR || '.next',
  experimental: {
    // Keep both cache modes off for tooling that may be used by local Next commands.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  serverExternalPackages: ['sharp', 'nodemailer'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob: https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};
export default config;
