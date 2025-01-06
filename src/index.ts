/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import Cloudflare from "cloudflare";

const GOOGLE_IP_LIST_URL = "https://www.gstatic.com/ipranges/goog.json";

interface GoogleIpListResponse {
  syncToken: string;
  creationTime: string;
  prefixes: Array<IPv4Prefix | IPv6Prefix>;
}

interface IPv4Prefix {
  ipv4Prefix: string;
  ipv6Prefix: never;
}

interface IPv6Prefix {
  ipv6Prefix: string;
  ipv4Prefix: never;
}

async function fetchGoogleIps() {
  const response = await fetch(GOOGLE_IP_LIST_URL);
  if (!response.ok) {
    console.error(`Failed to fetch Google IPs: ${response.status}`);
    return null;
  }

  const data: GoogleIpListResponse = await response.json();

  return [
    ...data.prefixes.map((p) => p.ipv4Prefix).filter(Boolean),
    ...data.prefixes.map((p) => p.ipv6Prefix).filter(Boolean),
  ];
}

export default {
  async scheduled(_, env, ctx) {
    ctx.waitUntil(
      (async () => {
        if (!env.CLOUDFLARE_API_TOKEN) return;
        const cloudflare = new Cloudflare({
          apiToken: env.CLOUDFLARE_API_TOKEN,
        });

        const googleIps = await fetchGoogleIps();
        if (!googleIps) return;

        await cloudflare.zeroTrust.access.groups.update(env.ACCESS_GROUP_ID, {
          name: "Google",
          include: googleIps.map((ip) => ({ ip: { ip: ip! } })),
          account_id: env.CLOUDFLARE_ACCOUNT_ID,
        });
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
