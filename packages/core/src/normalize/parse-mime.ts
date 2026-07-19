/**
 * MIME parse via mailparser. AGENTS.md §12
 */
import { simpleParser, type ParsedMail, type Attachment } from "mailparser";
import { parse as parseHtml } from "node-html-parser";

export type ParsedMime = {
  subject?: string;
  text?: string;
  html?: string;
  textAsHtml?: string;
  fromAddress?: string;
  fromName?: string;
  toAddresses: string[];
  headers: Record<string, string>;
  attachments: Array<{
    filename?: string;
    contentType?: string;
    size: number;
    content?: Buffer;
  }>;
  calendarParts: string[];
};

function headersFromParsed(mail: ParsedMail): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(mail.headers)) {
    if (value == null) continue;
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.map(String).join(", ");
    else if (typeof value === "object" && "value" in (value as object)) {
      out[key] = String((value as { value: unknown }).value);
    } else out[key] = String(value);
  }
  return out;
}

function collectCalendar(mail: ParsedMail, attachments: Attachment[]): string[] {
  const parts: string[] = [];
  for (const att of attachments) {
    const ct = (att.contentType ?? "").toLowerCase();
    const name = (att.filename ?? "").toLowerCase();
    if (
      ct.includes("text/calendar") ||
      ct.includes("application/ics") ||
      name.endsWith(".ics")
    ) {
      if (att.content) parts.push(att.content.toString("utf8"));
    }
  }
  // Some clients put calendar in text body
  if (mail.text?.includes("BEGIN:VCALENDAR")) {
    parts.push(mail.text);
  }
  return parts;
}

export async function parseMimeBuffer(raw: Buffer): Promise<ParsedMime> {
  const mail = await simpleParser(raw);
  const attachments = mail.attachments ?? [];
  const from = mail.from?.value?.[0];
  const toAddresses =
    mail.to && "value" in mail.to
      ? ((mail.to.value ?? []).map((a) => a.address).filter(Boolean) as string[])
      : [];

  return {
    subject: mail.subject,
    text: mail.text,
    html: typeof mail.html === "string" ? mail.html : undefined,
    textAsHtml: mail.textAsHtml,
    fromAddress: from?.address,
    fromName: from?.name,
    toAddresses,
    headers: headersFromParsed(mail),
    attachments: attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      content: a.content,
    })),
    calendarParts: collectCalendar(mail, attachments),
  };
}

/** Prefer text/plain; else HTML→text via node-html-parser. */
export function htmlToText(html: string): string {
  const root = parseHtml(html);
  for (const sel of ["script", "style", "noscript"]) {
    root.querySelectorAll(sel).forEach((el) => el.remove());
  }
  // Block elements → newlines
  for (const sel of ["p", "div", "br", "li", "tr", "h1", "h2", "h3"]) {
    root.querySelectorAll(sel).forEach((el) => {
      el.insertAdjacentHTML("afterend", "\n");
    });
  }
  return root.text.replace(/\n{3,}/g, "\n\n").trim();
}
