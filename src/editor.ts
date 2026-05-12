import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { findWordSpans, ParsedAlgorithm, parseAlgorithm } from "./algorithm";

const SKIP_NODE_TYPES = /(?:formatting|hashtag|tag|url|link|inline-code|code-block|HyperMD-codeblock|math|frontmatter)/i;

export interface FastreadStateProvider {
  isEnabled(): boolean;
  getAlgorithm(): ParsedAlgorithm;
  version(): number;
}

const boldMark = Decoration.mark({ class: "fastread-highlight" });
const restMark = Decoration.mark({ class: "fastread-rest" });

export function createFastreadEditorExtension(state: FastreadStateProvider) {
  let lastVersion = -1;

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
        lastVersion = state.version();
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || state.version() !== lastVersion) {
          this.decorations = this.build(u.view);
          lastVersion = state.version();
        }
      }

      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        if (!state.isEnabled()) return builder.finish();
        const algo = state.getAlgorithm();
        const doc = view.state.doc;

        for (const { from, to } of view.visibleRanges) {
          const skipRanges = collectSkipRanges(view, from, to);
          let cursor = from;
          for (const sr of skipRanges) {
            if (sr.from > cursor) {
              this.decorateRange(builder, doc.sliceString(cursor, sr.from), cursor, algo);
            }
            cursor = Math.max(cursor, sr.to);
          }
          if (cursor < to) {
            this.decorateRange(builder, doc.sliceString(cursor, to), cursor, algo);
          }
        }
        return builder.finish();
      }

      decorateRange(
        builder: RangeSetBuilder<Decoration>,
        text: string,
        offset: number,
        algo: ParsedAlgorithm,
      ): void {
        const spans = findWordSpans(text, algo);
        for (const sp of spans) {
          const absStart = offset + sp.start;
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

export { parseAlgorithm };
