# Fastread for Obsidian

Bold the leading letters of each word so your eye locks onto the start of every token — a "bionic reading" style highlighter. Toggle it on or off (and cycle through intensity presets) directly from the status bar.

Ported from [ahrm/chrome-fastread](https://github.com/ahrm/chrome-fastread).

## Features

- Works in both **Reading View** and **Live Preview** (Source mode is left untouched).
- **Does not modify your markdown** — only visual decorations are applied.
- **Status bar widget**: `FR off` / `FR 0.40` — click to toggle, Shift+click to cycle intensity presets.
- Configurable highlight algorithm: choose how many leading characters to bold per word length and the ratio for longer words.
- Built-in **common-words skip list** for English and Russian (prepositions, conjunctions, particles, short pronouns) — fully editable in settings.
- Commands (assignable to hotkeys): Toggle, Cycle intensity, Increase intensity, Decrease intensity.

## Algorithm string

The full formula uses the chrome-fastread convention:

```
- 0 1 1 2 0.4
^ ^ ^ ^ ^ ^
| | | | | └─ Fraction of letters to bold for words of length 5 or more (0.0 – 1.0).
| | | | └──── Letters bolded for 4-letter words.
| | | └────── Letters bolded for 3-letter words.
| | └──────── Letters bolded for 2-letter words.
| └────────── Letters bolded for 1-letter words.
└──────────── '-' to skip common words from the list; '+' to highlight every word.
```

## Settings

- **Algorithm string** — the full formula.
- **Cycle presets** — comma-separated ratios cycled by Shift+click or the `Cycle` command (default `0, 0.2, 0.4, 0.6`).
- **Exclude common words** — toggle the skip list on or off.
- **Common words list** — editable textarea, prefilled with a default English + Russian set, with Reset and Clear buttons.

## Install (manual)

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/SVS696/obsidian-fastread/releases/latest).
2. Place them into `<your vault>/.obsidian/plugins/fastread/`.
3. In Obsidian, enable **Fastread** under Settings → Community plugins.

## Build from source

```bash
git clone https://github.com/SVS696/obsidian-fastread.git
cd obsidian-fastread
npm install
npm run build
```

Outputs `main.js` next to `manifest.json` and `styles.css`.

## License

MIT — see [LICENSE](./LICENSE).
