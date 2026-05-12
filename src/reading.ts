import { findWordSpans, ParsedAlgorithm } from "./algorithm";

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "CODE", "PRE", "MJX-CONTAINER",
  "MATH", "SVG", "CANVAS", "TEXTAREA", "INPUT",
]);

const BOLD_TAGS = new Set(["STRONG", "B"]);

export interface ReadingOptions {
  skipWordAfterBold: boolean;
}

export function decorateElement(root: HTMLElement, algo: ParsedAlgorithm, opts: ReadingOptions): void {
  const doc = root.ownerDocument;
  if (!doc) return;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      const text = node.nodeValue;
      if (!text || text.trim().length === 0) return NodeFilter.FILTER_REJECT;
      let p: Node | null = node.parentNode;
      while (p && p.nodeType === Node.ELEMENT_NODE) {
        const el = p as Element;
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        if (el.classList.contains("fastread-highlight")) return NodeFilter.FILTER_REJECT;
        if (el.classList.contains("fastread-rest")) return NodeFilter.FILTER_REJECT;
        p = el.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    targets.push(n as Text);
  }

  for (const textNode of targets) {
    const skipFirst = opts.skipWordAfterBold && isAfterBold(textNode);
    replaceTextNode(textNode, algo, skipFirst);
  }
}

const BLOCK_TAGS = new Set([
  "P", "DIV", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6",
  "BLOCKQUOTE", "PRE", "TABLE", "TR", "TD", "TH", "HR", "ARTICLE", "SECTION",
]);

function isAfterBold(node: Node): boolean {
  let cursor: Node | null = node;
  while (cursor) {
    let prev: Node | null = cursor.previousSibling;
    while (prev && prev.nodeType === Node.TEXT_NODE && !(prev.nodeValue ?? "").trim()) {
      prev = prev.previousSibling;
    }
    if (prev) {
      if (prev.nodeType !== Node.ELEMENT_NODE) return false;
      const el = prev as Element;
      if (BOLD_TAGS.has(el.tagName)) return true;
      const last = lastNonEmptyDescendant(el);
      if (last) return BOLD_TAGS.has(last.tagName);
      return false;
    }
    const parent: Node | null = cursor.parentNode;
    if (!parent || parent.nodeType !== Node.ELEMENT_NODE) return false;
    if (BLOCK_TAGS.has((parent as Element).tagName)) return false;
    cursor = parent;
  }
  return false;
}

function lastNonEmptyDescendant(el: Element): Element | null {
  let cur: Element | null = el;
  while (cur && cur.lastElementChild) {
    cur = cur.lastElementChild;
  }
  return cur;
}

function replaceTextNode(node: Text, algo: ParsedAlgorithm, skipFirst: boolean): void {
  const text = node.nodeValue ?? "";
  if (text.length < 2) return;

  let spans = findWordSpans(text, algo);
  if (skipFirst && spans.length > 0) {
    spans = spans.slice(1);
  }
  if (spans.length === 0) return;

  const doc = node.ownerDocument;
  if (!doc) return;

  const frag = doc.createDocumentFragment();
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      frag.appendChild(doc.createTextNode(text.slice(cursor, span.start)));
    }
    const bold = doc.createElement("span");
    bold.className = "fastread-highlight";
    bold.textContent = text.slice(span.start, span.boldEnd);
    frag.appendChild(bold);

    if (span.boldEnd < span.end) {
      const rest = doc.createElement("span");
      rest.className = "fastread-rest";
      rest.textContent = text.slice(span.boldEnd, span.end);
      frag.appendChild(rest);
    }
    cursor = span.end;
  }
  if (cursor < text.length) {
    frag.appendChild(doc.createTextNode(text.slice(cursor)));
  }

  node.replaceWith(frag);
}
