interface Env {
  API_ORIGIN: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (!context.env.API_ORIGIN) {
    return Response.json(
      { code: "api_proxy_unconfigured", message: "Guardian Nexus API proxy is not configured." },
      { status: 503 }
    );
  }

  const incoming = new URL(context.request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, context.env.API_ORIGIN);
  const headers = new Headers(context.request.headers);
  headers.set("X-Forwarded-Host", incoming.host);
  headers.set("X-Forwarded-Proto", incoming.protocol.replace(":", ""));

  return fetch(new Request(target, {
    method: context.request.method,
    headers,
    body: context.request.method === "GET" || context.request.method === "HEAD" ? undefined : context.request.body,
    redirect: "manual"
  }));
}
