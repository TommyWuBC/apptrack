/**
 * Quote / signature stripping → text_plain (keep full in text_full).
 * Heuristic; fixture-driven. AGENTS.md §12
 */
const QUOTE_PATTERNS: RegExp[] = [
  /^On .+ wrote:\s*$/im,
  /^From:\s.+$/im,
  /^-{2,}\s*$/m,
  /^_{2,}\s*$/m,
  /^Sent from my (iPhone|iPad|Android).*$/im,
  /^Get Outlook for .*$/im,
];

export function stripQuotesAndSignatures(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inQuoteBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.startsWith(">")) {
      inQuoteBlock = true;
      continue;
    }

    // Standalone quote/signature markers: drop this line and the rest
    let hitMarker = false;
    for (const re of QUOTE_PATTERNS) {
      if (re.test(line)) {
        hitMarker = true;
        break;
      }
    }
    if (hitMarker) break;

    if (inQuoteBlock && line.trim() === "") {
      inQuoteBlock = false;
      continue;
    }
    if (inQuoteBlock) continue;

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
