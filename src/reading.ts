import { findWordSpans, ParsedAlgorithm } from "./algorithm";

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "CODE", "PRE", "MJX-CONTAINER",
  "MATH", "SVG", "CANVAS", "TEXTAREA", "INPUT",
]);

export function decorateElement(root: HTMLElement, algo: ParsedAlgorithm): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      const text = node.nodeValue;
      if (!text || text.trim().length === 0) return NodeFilter.FILTER_REJECT;
      let p: Node | null = node.parentNode;
      while (p && p instanceof Element) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.classList && p.classList.contains("fastread-highlight")) return NodeFilter.FILTER_REJECT;
        if (p.classList && p.classList.contains("fastread-rest")) return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
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
    replaceTextNode(textNode, algo);
  }
}

function replaceTextNode(node: Text, algo: ParsedAlgorithm): void {
  const text = node.nodeValue ?? "";
  if (text.length < 2) return;

  const spans = findWordSpans(text, algo);
  if (spans.length === 0) return;

  const frag = document.createDocumentFragment();
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      frag.appendChild(document.createTextNode(text.slice(cursor, span.start)));
    }
    const bold = document.createElement("span");
    bold.className = "fastread-highlight";
    bold.textContent = text.slice(span.start, span.boldEnd);
    frag.appendChild(bold);

    if (span.boldEnd < span.end) {
      const rest = document.createElement("span");
      rest.className = "fastread-rest";
      rest.textContent = text.slice(span.boldEnd, span.end);
      frag.appendChild(rest);
    }
    cursor = span.end;
  }
  if (cursor < text.length) {
    frag.appendChild(document.createTextNode(text.slice(cursor)));
  }

  node.replaceWith(frag);
}
