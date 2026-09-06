import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * A value that changes on every deploy, used to name the service worker's
 * cache so each build gets its own and `activate` can evict the rest.
 *
 * It must be identical across every process in one build — Next evaluates
 * this config more than once — so a timestamp is the last resort, not the
 * first. The commit SHA is stable by construction and is what Vercel builds
 * from anyway.
 *
 * A SHA that has not moved (an uncommitted local build) simply reuses the
 * previous cache name, which is exactly today's behaviour and no worse. The
 * failure this fixes is caches that are never evicted *across* deploys.
 */
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  (() => {
    try {
      return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      return `t${Date.now().toString(36)}`;
    }
  })();

const nextConfig: NextConfig = {
  // @ts-ignore
  allowedDevOrigins: ['169.254.6.230', '10.55.1.66', 'large-colts-punch.loca.lt', '10.37.63.245', '10.161.223.245', '192.168.1.11', 'real-eyes-reply.loca.lt', '10.183.147.245', 'odd-lights-notice.loca.lt'],
  generateBuildId: async () => buildId,
  // Inlined at build time. public/sw.js is served verbatim and cannot be
  // templated, so the id reaches it through its registration URL instead.
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
};

export default nextConfig;
