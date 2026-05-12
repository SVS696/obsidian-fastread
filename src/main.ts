import { MarkdownView, Plugin } from "obsidian";
import { decorateElement } from "./reading";
import { createFastreadEditorExtension, FastreadStateProvider } from "./editor";
import { DEFAULT_SETTINGS, FastreadSettings, FastreadSettingTab } from "./settings";
import {
  buildCommonWordsSet,
  DEFAULT_ALGORITHM,
  parseAlgorithm,
  ParsedAlgorithm,
  serializeAlgorithm,
  withRestRatio,
} from "./algorithm";

export default class FastreadPlugin extends Plugin {
  settings!: FastreadSettings;
  private statusBarEl: HTMLElement | null = null;
  private algoCache: ParsedAlgorithm = parseAlgorithm(DEFAULT_ALGORITHM);
  private stateVersion = 0;

  async onload() {
    await this.loadSettings();
    this.recomputeAlgo();

    const provider: FastreadStateProvider = {
      isEnabled: () => this.settings.enabled,
      getAlgorithm: () => this.algoCache,
      version: () => this.stateVersion,
    };
    this.registerEditorExtension(createFastreadEditorExtension(provider));

    this.registerMarkdownPostProcessor((el) => {
      if (!this.settings.enabled) return;
      decorateElement(el, this.algoCache);
    });

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("fastread-statusbar");
    this.statusBarEl.addEventListener("click", (evt) => {
      if (evt.shiftKey) {
        this.cyclePreset();
      } else {
        this.toggleEnabled();
      }
    });
    this.updateStatusBar();

    this.addCommand({
      id: "fastread-toggle",
      name: "Toggle Fastread",
      callback: () => this.toggleEnabled(),
    });
    this.addCommand({
      id: "fastread-cycle",
      name: "Cycle Fastread intensity",
      callback: () => this.cyclePreset(),
    });
    this.addCommand({
      id: "fastread-increase",
      name: "Increase Fastread intensity",
      callback: () => this.adjustRatio(+0.05),
    });
    this.addCommand({
      id: "fastread-decrease",
      name: "Decrease Fastread intensity",
      callback: () => this.adjustRatio(-0.05),
    });

    this.addSettingTab(new FastreadSettingTab(this.app, this));
  }

  onunload() {
    // editor extensions and post-processors are auto-unregistered
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!Array.isArray(this.settings.presets) || this.settings.presets.length < 2) {
      this.settings.presets = DEFAULT_SETTINGS.presets;
    }
    if (!Array.isArray(this.settings.commonWords)) {
      this.settings.commonWords = DEFAULT_SETTINGS.commonWords.slice();
    }
  }

  async saveAndRefresh() {
    this.recomputeAlgo();
    this.stateVersion++;
    await this.saveData(this.settings);
    this.updateStatusBar();
    this.refreshReadingViews();
  }

  syncExcludeFlag() {
    const a = parseAlgorithm(this.settings.algorithm);
    a.exclude = this.settings.excludeCommonWords;
    this.settings.algorithm = serializeAlgorithm(a);
  }

  currentRatio(): number {
    return parseAlgorithm(this.settings.algorithm).restRatio;
  }

  setRatio(r: number) {
    this.settings.algorithm = withRestRatio(this.settings.algorithm, r);
  }

  private recomputeAlgo() {
    this.algoCache = parseAlgorithm(this.settings.algorithm);
    this.algoCache.exclude = this.settings.excludeCommonWords;
    this.algoCache.commonWords = buildCommonWordsSet(this.settings.commonWords);
  }

  private toggleEnabled() {
    this.settings.enabled = !this.settings.enabled;
    void this.saveAndRefresh();
  }

  private cyclePreset() {
    const presets = this.settings.presets.slice().sort((a, b) => a - b);
    const current = this.settings.enabled ? this.currentRatio() : 0;
    const epsilon = 0.001;
    let nextIdx = presets.findIndex((p) => p > current + epsilon);
    if (nextIdx === -1) nextIdx = 0;
    const next = presets[nextIdx];
    if (next <= epsilon) {
      this.settings.enabled = false;
    } else {
      this.settings.enabled = true;
      this.setRatio(next);
    }
    void this.saveAndRefresh();
  }

  private adjustRatio(delta: number) {
    if (!this.settings.enabled) {
      this.settings.enabled = true;
    }
    const next = Math.max(0, Math.min(1, this.currentRatio() + delta));
    this.setRatio(next);
    void this.saveAndRefresh();
  }

  private updateStatusBar() {
    if (!this.statusBarEl) return;
    this.statusBarEl.empty();
    const on = this.settings.enabled;
    this.statusBarEl.toggleClass("is-on", on);
    this.statusBarEl.toggleClass("is-off", !on);
    const ratio = this.currentRatio();
    const label = on ? `FR ${ratio.toFixed(2)}` : "FR off";
    this.statusBarEl.setText(label);
    this.statusBarEl.setAttr(
      "aria-label",
      on
        ? `Fastread on (ratio ${ratio.toFixed(2)}). Click to disable, Shift+click to cycle.`
        : "Fastread off. Click to enable, Shift+click to cycle.",
    );
  }

  private refreshReadingViews() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        view.previewMode?.rerender(true);
      }
    });
  }
}
