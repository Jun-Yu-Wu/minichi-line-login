import config from "../../../src/server/config";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    service: "minichi_line_login",
    status: "ok",
    lineBindingIngressConfigured: config.isLineBindingIngressConfigured(),
    lineLoginWebConfigured: config.isLineLoginWebConfigured(),
  }, {
    headers: { "cache-control": "no-store" },
  });
}
