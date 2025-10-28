// Persistent Playbook Type Schema for Workflow Automation in Playwright MCP

export interface PlaybookSelector {
  name: string; // semantic name, e.g. 'login.username'
  strategy: 'role+name' | 'id' | 'css' | 'data-attr' | 'other';
  value: string;
  context?: string; // sub-page or state, optional
  lastValidated: Date;
  fallbackOrder: string[];
}

export interface PlaybookStep {
  type: 'click' | 'fill' | 'select' | 'wait' | 'custom';
  selector: string; // semantic name (see PlaybookSelector)
  value?: any;
  params?: Record<string, any>;
  waitFor?: string;
}

export interface PlaybookPattern {
  name: string; // e.g. 'login_flow'
  steps: PlaybookStep[];
  parameters?: string[]; // for reusable logic
}

export interface PlaybookFileSchema {
  version: string;
  selectors: Record<string, PlaybookSelector>;
  patterns: Record<string, PlaybookPattern>;
  meta?: Record<string, any>;
}
