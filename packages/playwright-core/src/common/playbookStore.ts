import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import type {
  PlaybookFileSchema,
  PlaybookSelector,
  PlaybookStep,
  PlaybookPattern
} from './playbook';

// The PlaybookStore handles persistence, merging, and schema access for playbook.yaml

export class PlaybookStore {
  private playbookPath: string;
  private playbook: PlaybookFileSchema;

  constructor(playbookPath: string = path.resolve(process.cwd(), 'playbook.yaml')) {
    this.playbookPath = playbookPath;
    this.playbook = this.load();
  }

  private load(): PlaybookFileSchema {
    if (!fs.existsSync(this.playbookPath)) {
      // Create a fresh playbook if missing
      return {
        version: '1.0.0',
        selectors: {},
        patterns: {},
        meta: { created: new Date().toISOString() }
      };
    }
    const parsed = yaml.parse(fs.readFileSync(this.playbookPath, 'utf8'));
    // TODO: version/schema migration if needed
    return parsed as PlaybookFileSchema;
  }

  save(): void {
    fs.writeFileSync(this.playbookPath, yaml.stringify(this.playbook), 'utf8');
  }

  getSelectors(): Record<string, PlaybookSelector> {
    return this.playbook.selectors;
  }

  getPatterns(): Record<string, PlaybookPattern> {
    return this.playbook.patterns;
  }

  addSelector(selector: PlaybookSelector) {
    this.playbook.selectors[selector.name] = selector;
    this.save();
  }

  addPattern(pattern: PlaybookPattern) {
    this.playbook.patterns[pattern.name] = pattern;
    this.save();
  }

  getSelector(name: string): PlaybookSelector | undefined {
    return this.playbook.selectors[name];
  }

  getPattern(name: string): PlaybookPattern | undefined {
    return this.playbook.patterns[name];
  }

  // Merge new selectors/patterns from fallback/AI, preserving previous structure
  merge(newData: Partial<PlaybookFileSchema>) {
    this.playbook = {
      ...this.playbook,
      selectors: { ...this.playbook.selectors, ...(newData.selectors || {}) },
      patterns: { ...this.playbook.patterns, ...(newData.patterns || {}) },
      meta: {
        ...this.playbook.meta,
        ...((newData.meta || {}) as object),
        lastMerged: new Date().toISOString()
      }
    };
    this.save();
  }

  // (future) Add methods for schema versioning, migration, soft validation, etc.
}
