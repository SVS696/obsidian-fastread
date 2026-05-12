import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { findWordSpans, ParsedAlgorithm, parseAlgorithm } from "./algorithm";

const SKIP_NODE_TYPES = /(?:formatting|hashtag|tag|url|link|inline-code|code-block|HyperMD-codeblock|math|frontmatter)/i;
const STRONG_NODE_TYPES = /^(Strong|HyperMD-Strong|cm-strong)/i;
const WORD_AFTER_BOLD_RE = /[\p{L}\p{N}]+/u;

export interface FastreadStateProvider {
  isEnabled(): boolean;
  getAlgorithm(): ParsedAlgorithm;
  getSkipWordAfterBold(): boolean;
  version(): number;
}

const boldMark = Decoration.mark({ class: "fastread-highlight" });
const restMark = Decoration.mark({ class: "fastread-rest" });

export function createFastreadEditorExtension(state: FastreadStateProvider) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private lastVersion: number;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
        this.lastVersion = state.version();
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || state.version() !== this.lastVersion) {
          this.decorations = this.build(u.view);
          this.lastVersion = state.version();
        }
      }

      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        if (!state.isEnabled()) return builder.finish();
        const algo = state.getAlgorithm();
        const doc = view.state.doc;
        const skipWordPositions = state.getSkipWordAfterBold()
          ? collectSkipWordPositions(view)
          : null;

        for (const { from, to } of view.visibleRanges) {
          const skipRanges = collectSkipRanges(view, from, to);
          let cursor = from;
          for (const sr of skipRanges) {
            if (sr.from > cursor) {
              this.decorateRange(builder, doc.sliceString(cursor, sr.from), cursor, algo, skipWordPositions);
            }
            cursor = Math.max(cursor, sr.to);
          }
          if (cursor < to) {
            this.decorateRange(builder, doc.sliceString(cursor, to), cursor, algo, skipWordPositions);
          }
        }
        return builder.finish();
      }

      decorateRange(
        builder: RangeSetBuilder<Decoration>,
        text: string,
        offset: number,
        algo: ParsedAlgorithm,
        skipWordPositions: Set<number> | null,
      ): void {
        const spans = findWordSpans(text, algo);
        for (const sp of spans) {
          const absStart = offset + sp.start;
          if (skipWordPositions && skipWordPositions.has(absStart)) continue;
          const absBoldEnd = offset + sp.boldEnd;
          const absEnd = offset + sp.end;
          if (absBoldEnd > absStart) {
            builder.add(absStart, absBoldEnd, boldMark);
          }
          if (absEnd > absBoldEnd) {
            builder.add(absBoldEnd, absEnd, restMark);
          }
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

interface Range {
  from: number;
  to: number;
}

function collectSkipRanges(view: EditorView, from: number, to: number): Range[] {
  const ranges: Range[] = [];
  try {
    const tree = syntaxTree(view.state);
    tree.iterate({
      from,
      to,
      enter(node) {
        if (SKIP_NODE_TYPES.test(node.type.name)) {
          ranges.push({ from: node.from, to: node.to });
        }
      },
    });
  } catch {
    // syntax tree not ready
  }
  ranges.sort((a, b) => a.from - b.from);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.from <= last.to) {
      last.to = Math.max(last.to, r.to);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function collectSkipWordPositions(view: EditorView): Set<number> {
  const positions = new Set<number>();
  const doc = view.state.doc;
  try {
    const tree = syntaxTree(view.state);
    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from,
        to,
        enter(node) {
          if (!STRONG_NODE_TYPES.test(node.type.name)) return;
          const after = node.to;
          if (after >= doc.length) return;
          const tail = doc.sliceString(after, Math.min(after + 200, doc.length));
          const m = WORD_AFTER_BOLD_RE.exec(tail);
          if (m) positions.add(after + m.index);
        },
      });
    }
  } catch {
    // syntax tree not ready
  }
  return positions;
}

export { parseAlgorithm };
