export type Severity = "success" | "warning" | "error";
export type AuditResult = {
  id: string;
  severity: Severity;
  message: string;
  selector?: string;
  // new:
  line?: number;
  column?: number;
  snippet?: string;     // small code excerpt around the node
  recommendation?: string; // actionable next step
};

type Locator = { line?: number; column?: number; snippet?: string };

function cssSelector(el: Element): string {
  const name = el.tagName.toLowerCase();
  const id = el.getAttribute("id");
  if (id) return `${name}#${id}`;
  const cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean);
  return cls.length ? `${name}.${cls[0]}` : name;
}

// Try to find line/col by searching the original HTML for a stable pattern.
// Priority: id → name/rel/property attr → tag occurrence.
function locateElement(el: Element, html: string): Locator {
  const tn = el.tagName.toLowerCase();
  const id = el.getAttribute("id");
  const attrs: [string, string | null][] = [
    ["id", id],
    ["name", el.getAttribute("name")],
    ["property", el.getAttribute("property")],
    ["rel", el.getAttribute("rel")],
    ["href", el.getAttribute("href")],
    ["src", el.getAttribute("src")],
  ];

  // Build a regex that matches e.g. <meta name="description" ...> or <h1 id="foo" ...>
  let pattern = "";
  const attr = attrs.find(([k, v]) => v && v.trim());
  if (attr) {
    const [k, v] = attr;
    // escape regex special chars in v
    const safeV = v!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    pattern = `<\\s*${tn}[^>]*\\b${k}\\s*=\\s*["']${safeV}["'][^>]*>`;
  } else {
    // fallback: first occurrence of the tag
    pattern = `<\\s*${tn}\\b[^>]*>`;
  }

  try {
    const re = new RegExp(pattern, "i");
    const idx = html.search(re);
    if (idx >= 0) {
      const pre = html.slice(0, idx);
      const line = pre.split(/\r\n|\r|\n/).length;
      const lastLineStart = Math.max(pre.lastIndexOf("\n"), pre.lastIndexOf("\r"));
      const column = idx - (lastLineStart >= 0 ? lastLineStart : -1);
      const snippet = html.slice(Math.max(0, idx - 120), Math.min(html.length, idx + 240));
      return { line, column, snippet };
    }
  } catch {
    /* no-op */
  }
  return {};
}

function locateQuery(html: string, query: string): Locator {
  const idx = html.indexOf(query);
  if (idx < 0) return {};
  const pre = html.slice(0, idx);
  const line = pre.split(/\r\n|\r|\n/).length;
  const lastLineStart = Math.max(pre.lastIndexOf("\n"), pre.lastIndexOf("\r"));
  const column = idx - (lastLineStart >= 0 ? lastLineStart : -1);
  const snippet = html.slice(Math.max(0, idx - 120), Math.min(html.length, idx + query.length + 120));
  return { line, column, snippet };
}

export function runSeoA11yAudit(html: string): AuditResult[] {
  const out: AuditResult[] = [];
  const doc = new DOMParser().parseFromString(html, "text/html");

  const push = (
    severity: Severity,
    id: string,
    message: string,
    el?: Element | null,
    recommendation?: string,
    queryForLocate?: string
  ) => {
    let loc: Locator = {};
    if (el) loc = locateElement(el, html);
    else if (queryForLocate) loc = locateQuery(html, queryForLocate);

    out.push({
      id,
      severity,
      message,
      selector: el ? cssSelector(el) : undefined,
      line: loc.line,
      column: loc.column,
      snippet: loc.snippet?.trim(),
      recommendation,
    });
  };

  // 1) <html lang="">
  const htmlEl = doc.documentElement;
  const lang = htmlEl.getAttribute("lang")?.trim();
  if (!lang) {
    push("error", "lang-missing", "Missing <html lang>.", doc.documentElement, "Set the <html lang> attribute, e.g., <html lang=\"en\">.");
  } else {
    push("success", "lang-ok", `HTML lang present (${lang}).`, doc.documentElement);
  }

  // 2) <title>
  const titleEl = doc.querySelector("title");
  const title = titleEl?.textContent?.trim() || "";
  if (!title) {
    push("error", "title-missing", "Missing <title>.", titleEl ?? doc.head, "Add a descriptive, unique <title> (10–60 chars).", "<title>");
  } else if (title.length < 10 || title.length > 60) {
    push("warning", "title-length", `Title length ${title.length} (aim 10–60).`, titleEl, "Rewrite title to recommended length.");
  } else {
    push("success", "title-ok", `Title present and well sized (${title.length}).`, titleEl);
  }

  // 3) meta description
  const descEl = doc.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  const desc = descEl?.getAttribute("content")?.trim() || "";
  if (!desc) {
    push("warning", "meta-desc-missing", "Missing meta description.", doc.head, "Add <meta name=\"description\" content=\"…\"> (50–160 chars).", 'meta name="description"');
  } else if (desc.length < 50 || desc.length > 160) {
    push("warning", "meta-desc-length", `Meta description length ${desc.length} (aim 50–160).`, descEl, "Rewrite description to recommended length.");
  } else {
    push("success", "meta-desc-ok", "Meta description present and well sized.", descEl);
  }

  // 4) Canonical
  const canonical = doc.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical?.href) {
    push("warning", "canonical-missing", "Canonical URL missing.", doc.head, "Add <link rel=\"canonical\" href=\"…\">.", 'link rel="canonical"');
  } else {
    push("success", "canonical-ok", "Canonical URL present.", canonical);
  }

  // 5) Headings (one H1 and sane order)
  const headings = Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  const h1s = headings.filter((h) => h.tagName.toLowerCase() === "h1");
  if (h1s.length !== 1) {
    push("warning", "h1-count", `Expected exactly 1 <h1>, found ${h1s.length}.`, h1s[0] || doc.body, "Use a single H1 and demote others to H2/H3 as needed.");
  } else {
    push("success", "h1-ok", "Exactly one H1 present.", h1s[0]);
  }

  let prev = 0;
  let orderIssues = 0;
  headings.forEach((h, idx) => {
    const level = Number(h.tagName.substring(1));
    if (prev && level - prev > 1) {
      orderIssues++;
      push("warning", `heading-order-${idx}`, `Heading jumps from H${prev} to H${level}.`, h, "Adjust heading levels to avoid skipping levels.");
    }
    prev = level;
  });
  if (orderIssues === 0) {
    // if there were headings at all
    if (headings.length > 0) push("success", "heading-order-ok", "Heading hierarchy is consistent.", headings[0]);
  }

  // 6) Open Graph / Twitter basics
  const ogT = doc.querySelector('meta[property="og:title"]');
  const ogD = doc.querySelector('meta[property="og:description"]');
  const ogI = doc.querySelector('meta[property="og:image"]');
  if (ogT && ogD && ogI) {
    push("success", "og-ok", "Open Graph tags present (title/description/image).", ogT);
  } else {
    push("warning", "og-missing", "Missing one or more OG tags (title/description/image).", doc.head, "Add og:title, og:description, and og:image meta tags.");
  }

  const tw = doc.querySelector('meta[name="twitter:card"]');
  if (tw) push("success", "twitter-card-ok", "Twitter Card present.", tw);
  else push("warning", "twitter-card-missing", "Twitter Card missing.", doc.head, "Add <meta name=\"twitter:card\" content=\"summary_large_image\">.");

  // 7) Images need alt
  const imgs = Array.from(doc.querySelectorAll("img"));
  const noAlt = imgs.filter((img) => !(img.getAttribute("alt") || "").trim());
  if (noAlt.length) {
    // report the first with locator + a summary
    const first = noAlt[0];
    push("error", "img-alt-missing", `${noAlt.length} image(s) missing alt.`, first, "Add concise, meaningful alt text for non-decorative images.");
  } else {
    if (imgs.length) push("success", "img-alt-ok", "All images have alt text.", imgs[0]);
  }

  // 8) Links: accessible names and rel for target=_blank
  const anchors = Array.from(doc.querySelectorAll("a"));
  const nameless: Element[] = [];
  let blankNoRel = 0;
  anchors.forEach((a) => {
    const txt = (a.textContent || "").replace(/\s+/g, " ").trim();
    const aria = (a.getAttribute("aria-label") || "").trim();
    if (!txt && !aria) nameless.push(a);
    const t = a.getAttribute("target");
    const rel = (a.getAttribute("rel") || "").toLowerCase();
    if (t === "_blank" && !/(noopener|noreferrer)/.test(rel)) blankNoRel++;
  });
  if (nameless.length) {
    push("error", "link-name-missing", `${nameless.length} link(s) lack accessible names.`, nameless[0], "Provide link text or aria-label that describes the destination.");
  } else if (anchors.length) {
    push("success", "link-name-ok", "All links have accessible names.", anchors[0]);
  }

  if (blankNoRel) {
    push("warning", "link-rel-missing", `${blankNoRel} link(s) use target=_blank without rel=noopener.`, anchors.find(a => a.getAttribute("target")==="_blank") || undefined, "Add rel=\"noopener\" (or rel=\"noopener noreferrer\") to external links opening in new tab.");
  } else if (anchors.length) {
    push("success", "link-rel-ok", "All external links use rel=noopener when target=_blank.", anchors[0]);
  }

  // 9) Duplicate IDs
  const idCounts = new Map<string, number>();
  doc.querySelectorAll("[id]").forEach((el) => {
    const id = el.getAttribute("id")!;
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });
  const dups = Array.from(idCounts.entries()).filter(([, c]) => c > 1);
  if (dups.length) {
    push("warning", "dup-ids", `${dups.length} duplicate id(s) detected.`, doc.querySelector(`[id="${dups[0][0]}"]`) || undefined, "Ensure IDs are unique per element.");
  } else {
    push("success", "dup-ids-ok", "No duplicate ids found.", doc.documentElement);
  }

  return out;
}
