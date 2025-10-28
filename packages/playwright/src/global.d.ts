import type { PlaybookStore } from 'playwright-core/lib/common/playbookStore';

declare global {
  var playbookStore: PlaybookStore | undefined;
  var playbookRecordSession: {
    active: boolean;
    steps: any[];
    sessionName?: string;
  } | undefined;
}
export {};
