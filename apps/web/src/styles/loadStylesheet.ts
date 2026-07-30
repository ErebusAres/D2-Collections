const stylesheetLinks = new Map<string, HTMLLinkElement>();

export function ensureStylesheet(name: string, href: string): HTMLLinkElement | undefined {
  if (typeof document === "undefined") return undefined;

  const cached = stylesheetLinks.get(name);
  if (cached?.isConnected) {
    if (cached.href !== new URL(href, document.baseURI).href) cached.href = href;
    return cached;
  }

  const existing = [...document.head.querySelectorAll<HTMLLinkElement>("link[data-guardian-stylesheet]")]
    .find((link) => link.dataset.guardianStylesheet === name);
  if (existing) {
    if (existing.href !== new URL(href, document.baseURI).href) existing.href = href;
    stylesheetLinks.set(name, existing);
    return existing;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.guardianStylesheet = name;
  document.head.appendChild(link);
  stylesheetLinks.set(name, link);
  return link;
}
