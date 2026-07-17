/**
 * Link extraction. INV-6: never fetch — only parse href / bare URLs.
 * Decode tracking destinations from the URL itself when possible.
 */
export type ExtractedLink = {
  url: string;
  anchor?: string;
  isTracking: boolean;
};

const TRACKING_HOSTS = [
  "sendgrid.net",
  "sendgrid.com",
  "mailgun.org",
  "mandrillapp.com",
  "list-manage.com",
  "click.mailchimp.com",
  "trk.mailchimp.com",
  "t.sidekickopen",
  "href.li",
];

const HREF_RE = /href\s*=\s*["']([^"']+)["']/gi;
const BARE_URL_RE = /https?:\/\/[^\s<>"')]+/gi;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isTrackingUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return TRACKING_HOSTS.some((t) => host === t || host.endsWith(`.${t}`));
}

/** Best-effort unwrap of common redirect query params (no network). */
export function unwrapTrackingUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of ["url", "u", "redirect", "dest", "target", "q"]) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//i.test(v)) return v;
    }
  } catch {
    /* keep original */
  }
  return url;
}

export function extractLinks(opts: {
  html?: string | null;
  text?: string | null;
}): ExtractedLink[] {
  const seen = new Set<string>();
  const out: ExtractedLink[] = [];

  const add = (raw: string, anchor?: string) => {
    const url = raw.trim().replace(/[.,;)]+$/, "");
    if (!url || seen.has(url)) return;
    seen.add(url);
    const tracking = isTrackingUrl(url);
    out.push({
      url: tracking ? unwrapTrackingUrl(url) : url,
      anchor,
      isTracking: tracking,
    });
  };

  if (opts.html) {
    let m: RegExpExecArray | null;
    const re = new RegExp(HREF_RE);
    while ((m = re.exec(opts.html)) !== null) {
      add(m[1]!);
    }
  }
  if (opts.text) {
    const matches = opts.text.match(BARE_URL_RE) ?? [];
    for (const u of matches) add(u);
  }
  return out;
}
