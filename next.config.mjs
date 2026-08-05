import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function callbackDevOrigin() {
  try {
    const callbackUrl = new URL(process.env.MINICHI_LINE_LOGIN_CALLBACK_URL || "");
    return callbackUrl.hostname ? [callbackUrl.hostname] : [];
  } catch (_error) {
    return [];
  }
}

const nextConfig = {
  allowedDevOrigins: callbackDevOrigin(),
  outputFileTracingRoot: projectRoot,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
