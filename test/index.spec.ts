import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  createScheduledController,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("cloudflare", () => {
  return {
    default: vi.fn(() => ({
      zeroTrust: {
        access: {
          groups: {
            update: vi.fn(),
          },
        },
      },
    })),
  };
});

describe("Google IP Sync worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.CLOUDFLARE_API_TOKEN = "mock-api-token";
    // @ts-ignore
    env.CLOUDFLARE_ACCOUNT_ID = "mock-account-id";
    // @ts-ignore
    env.ACCESS_GROUP_ID = "mock-group-id";
  });

  it("fetches Google IPs and updates Cloudflare group", async () => {
    const mockGoogleResponse = {
      syncToken: "1234567890",
      creationTime: "2024-01-01T00:00:00.000Z",
      prefixes: [
        { ipv4Prefix: "35.190.0.0/17" },
        { ipv4Prefix: "35.191.0.0/16" },
        { ipv6Prefix: "2600:1900::/35" },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGoogleResponse,
    });

    const ctx = createExecutionContext();
    const controller = createScheduledController();
    await worker.scheduled(controller, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.gstatic.com/ipranges/goog.json",
    );

    const Cloudflare = (await import("cloudflare")).default;
    expect(Cloudflare).toHaveBeenCalledWith({
      apiToken: "mock-api-token",
    });

    const mockCloudflareInstance = (Cloudflare as any).mock.results[0].value;

    expect(
      mockCloudflareInstance.zeroTrust.access.groups.update,
    ).toHaveBeenCalledWith("mock-group-id", {
      name: "Google",
      include: [
        { ip: { ip: "35.190.0.0/17" } },
        { ip: { ip: "35.191.0.0/16" } },
        { ip: { ip: "2600:1900::/35" } },
      ],
      account_id: "mock-account-id",
    });
  });

  it("handles Google API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const ctx = createExecutionContext();

    const controller = createScheduledController();
    await worker.scheduled(controller, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.gstatic.com/ipranges/goog.json",
    );

    const Cloudflare = (await import("cloudflare")).default;
    const mockCloudflareInstance = (Cloudflare as any).mock.results[0].value;
    expect(
      mockCloudflareInstance.zeroTrust.access.groups.update,
    ).not.toHaveBeenCalled();
  });

  it("handles missing environment variables", async () => {
    // @ts-ignore
    env.CLOUDFLARE_API_TOKEN = undefined;
    const mockGoogleResponse = {
      syncToken: "1234567890",
      creationTime: "2024-01-01T00:00:00.000Z",
      prefixes: [
        { ipv4Prefix: "35.190.0.0/17" },
        { ipv4Prefix: "35.191.0.0/16" },
        { ipv6Prefix: "2600:1900::/35" },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGoogleResponse,
    });

    const ctx = createExecutionContext();

    const controller = createScheduledController();
    await worker.scheduled(controller, env, ctx);
    await waitOnExecutionContext(ctx);

    const Cloudflare = (await import("cloudflare")).default;
    expect(Cloudflare).not.toHaveBeenCalled();
  });
});
