/**
 * HTML sanitize — strict allowlist. AGENTS.md §12 / T4
 * INV-6: never fetches URLs; only rewrites attributes in-memory.
 */
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "a",
  "ul",
  "ol",
  "li",
  "b",
  "i",
  "strong",
  "em",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "div",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "pre",
  "code",
];

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "name", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...(attribs.href ? { href: attribs.href } : {}),
          ...(attribs.name ? { name: attribs.name } : {}),
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}
