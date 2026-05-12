import { App, PluginSettingTab, Setting } from "obsidian";
import type FastreadPlugin from "./main";
import { DEFAULT_ALGORITHM, DEFAULT_COMMON_WORDS } from "./algorithm";

export interface FastreadSettings {
  enabled: boolean;
  algorithm: string;
  presets: number[];
  excludeCommonWords: boolean;
  commonWords: string[];
}

export const DEFAULT_SETTINGS: FastreadSettings = {
  enabled: false,
  algorithm: DEFAULT_ALGORITHM,
  presets: [0, 0.2, 0.4, 0.6],
  excludeCommonWords: true,
  commonWords: DEFAULT_COMMON_WORDS.slice(),
};

function parseWordList(raw: string): string[] {
  return raw
    .split(/[\s,;\n]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
}

function formatWordList(words: string[]): string {
  return words.join(", ");
}

export class FastreadSettingTab extends PluginSettingTab {
  plugin: FastreadPlugin;

  constructor(app: App, plugin: FastreadPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enabled")
      .setDesc("Turn highlighting on/off (also togglable from the status bar).")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
          this.plugin.settings.enabled = v;
          await this.plugin.saveAndRefresh();
        }),
      );

    new Setting(containerEl)
      .setName("Algorithm string")
      .setDesc(
        "Format: '<sign> <s1> <s2> ... <sN> <ratio>'. Sign '-' skips common English words; '+' highlights all. " +
          "Each size sets how many leading characters to bold for words of that length. Final number is the bold fraction for longer words.",
      )
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_ALGORITHM)
          .setValue(this.plugin.settings.algorithm)
          .onChange(async (v) => {
            this.plugin.settings.algorithm = v || DEFAULT_ALGORITHM;
            await this.plugin.saveAndRefresh();
          }),
      );

    new Setting(containerEl)
      .setName("Cycle presets")
      .setDesc(
        "Comma-separated ratios for Shift+click on the status bar (or the 'Cycle' command). " +
          "0 means off. Add any value you need — e.g. '0, 0.25, 0.4, 0.6'.",
      )
      .addText((t) =>
        t
          .setPlaceholder("0, 0.2, 0.4, 0.6")
          .setValue(this.plugin.settings.presets.join(", "))
          .onChange(async (v) => {
            const parts = v
              .split(/[,;\s]+/)
              .map((x) => Number(x))
              .filter((x) => Number.isFinite(x) && x >= 0 && x <= 1);
            if (parts.length >= 2) {
              this.plugin.settings.presets = parts;
              await this.plugin.saveAndRefresh();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Exclude common words")
      .setDesc("Skip words from the list below. Equivalent to '-' sign in the algorithm string.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.excludeCommonWords).onChange(async (v) => {
          this.plugin.settings.excludeCommonWords = v;
          this.plugin.syncExcludeFlag();
          await this.plugin.saveAndRefresh();
        }),
      );

    const wordsSetting = new Setting(containerEl)
      .setName("Common words list")
      .setDesc(
        "Words to skip (case-insensitive). Separate by comma, space, or newline. " +
          `Currently ${this.plugin.settings.commonWords.length} words.`,
      );
    wordsSetting.addTextArea((ta) => {
      ta.setPlaceholder("the, и, на, of, в, ...")
        .setValue(formatWordList(this.plugin.settings.commonWords))
        .onChange(async (v) => {
          this.plugin.settings.commonWords = parseWordList(v);
          await this.plugin.saveAndRefresh();
          wordsSetting.setDesc(
            "Words to skip (case-insensitive). Separate by comma, space, or newline. " +
              `Currently ${this.plugin.settings.commonWords.length} words.`,
          );
        });
      ta.inputEl.rows = 10;
      ta.inputEl.style.width = "100%";
      ta.inputEl.style.fontFamily = "var(--font-monospace)";
    });
    wordsSetting.addExtraButton((btn) =>
      btn
        .setIcon("rotate-ccw")
        .setTooltip("Reset to defaults")
        .onClick(async () => {
          this.plugin.settings.commonWords = DEFAULT_COMMON_WORDS.slice();
          await this.plugin.saveAndRefresh();
          this.display();
        }),
    );
    wordsSetting.addExtraButton((btn) =>
      btn
        .setIcon("x")
        .setTooltip("Clear all")
        .onClick(async () => {
          this.plugin.settings.commonWords = [];
          await this.plugin.saveAndRefresh();
          this.display();
        }),
    );
  }
}
