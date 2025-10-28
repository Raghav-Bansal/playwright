/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';
import * as javascript from '../codegen';

const verifyElement = defineTabTool({
  capability: 'testing',
  schema: {
    name: 'browser_verify_element_visible',
    title: 'Verify element visible',
    description: 'Verify element is visible on the page',
    inputSchema: z.object({
      role: z.string().describe('ROLE of the element. Can be found in the snapshot like this: \`- {ROLE} "Accessible Name":\`'),
      accessibleName: z.string().describe('ACCESSIBLE_NAME of the element. Can be found in the snapshot like this: \`- role "{ACCESSIBLE_NAME}"\`'),
    }),
    type: 'assertion',
  },

  handle: async (tab, params, response) => {
    // Playbook workflow-driven: Example for verify_element_visible
    if ((global as any).playbookRunner) {
      const runner = (global as any).playbookRunner;
      const stepsResult = runner.getSteps('verify_element_visible');
      if (stepsResult.resolved && stepsResult.steps.length > 0) {
        for (const step of stepsResult.steps) {
          if (step.type === 'assertion' && step.selector) {
            response.addCode(`[Playbook] Assertion (element visible): ${step.selector}`);
            const isVisible = await tab.page.isVisible(step.selector);
            if (!isVisible) {
              response.addError(`Element not visible by selector: ${step.selector}`);
              return;
            }
          }
        }
        response.addResult('Playbook assertion(s) succeeded');
        return;
      }
    }
    const locator = tab.page.getByRole(params.role as any, { name: params.accessibleName });
    if (await locator.count() === 0) {
      response.addError(`Element with role "${params.role}" and accessible name "${params.accessibleName}" not found`);
      return;
    }

    response.addCode(`await expect(page.getByRole(${javascript.escapeWithQuotes(params.role)}, { name: ${javascript.escapeWithQuotes(params.accessibleName)} })).toBeVisible();`);
    response.addResult('Done');

    // --- Dual-mode persistent learning: fallback-triggered playbook persistence ---
    if (global.playbookStore) {
      try {
        const store = global.playbookStore;
        const patternName = 'verify_element_visible';
        const selector = `role=${params.role} name=${params.accessibleName}`;
        const stepObj = { type: 'assertion' as const, selector };
        const pattern = store.getPattern(patternName);
        let shouldAdd = true;
        if (pattern && Array.isArray(pattern.steps)) {
          shouldAdd = !pattern.steps.some(
            step => step.type === 'assertion' && step.selector === selector
          );
          if (shouldAdd) {
            pattern.steps.push(stepObj);
            store.addPattern(pattern);
          }
        } else {
          store.addPattern({ name: patternName, steps: [stepObj] });
        }
        if (
          global.playbookRecordSession &&
          global.playbookRecordSession.active
        ) {
          global.playbookRecordSession.steps.push(stepObj);
        }
      } catch (e) {
        if (console && console.warn) {
          console.warn('[playbookStore persist: verify_element_visible]', e);
        }
      }
    }
  },
});

const verifyText = defineTabTool({
  capability: 'testing',
  schema: {
    name: 'browser_verify_text_visible',
    title: 'Verify text visible',
    description: `Verify text is visible on the page. Prefer ${verifyElement.schema.name} if possible.`,
    inputSchema: z.object({
      text: z.string().describe('TEXT to verify. Can be found in the snapshot like this: \`- role "Accessible Name": {TEXT}\` or like this: \`- text: {TEXT}\`'),
    }),
    type: 'assertion',
  },

  handle: async (tab, params, response) => {
    const locator = tab.page.getByText(params.text).filter({ visible: true });
    if (await locator.count() === 0) {
      response.addError('Text not found');
      return;
    }

    response.addCode(`await expect(page.getByText(${javascript.escapeWithQuotes(params.text)})).toBeVisible();`);
    response.addResult('Done');
  },
});

const verifyList = defineTabTool({
  capability: 'testing',
  schema: {
    name: 'browser_verify_list_visible',
    title: 'Verify list visible',
    description: 'Verify list is visible on the page',
    inputSchema: z.object({
      element: z.string().describe('Human-readable list description'),
      ref: z.string().describe('Exact target element reference that points to the list'),
      items: z.array(z.string()).describe('Items to verify'),
    }),
    type: 'assertion',
  },

  handle: async (tab, params, response) => {
    const { locator } = await tab.refLocator({ ref: params.ref, element: params.element });
    const itemTexts: string[] = [];
    for (const item of params.items) {
      const itemLocator = locator.getByText(item);
      if (await itemLocator.count() === 0) {
        response.addError(`Item "${item}" not found`);
        return;
      }
      itemTexts.push((await itemLocator.textContent())!);
    }
    const ariaSnapshot = `\`
- list:
${itemTexts.map(t => `  - listitem: ${javascript.escapeWithQuotes(t, '"')}`).join('\n')}
\``;
    response.addCode(`await expect(page.locator('body')).toMatchAriaSnapshot(${ariaSnapshot});`);
    response.addResult('Done');
  },
});

const verifyValue = defineTabTool({
  capability: 'testing',
  schema: {
    name: 'browser_verify_value',
    title: 'Verify value',
    description: 'Verify element value',
    inputSchema: z.object({
      type: z.enum(['textbox', 'checkbox', 'radio', 'combobox', 'slider']).describe('Type of the element'),
      element: z.string().describe('Human-readable element description'),
      ref: z.string().describe('Exact target element reference that points to the element'),
      value: z.string().describe('Value to verify. For checkbox, use "true" or "false".'),
    }),
    type: 'assertion',
  },

  handle: async (tab, params, response) => {
    const { locator, resolved } = await tab.refLocator({ ref: params.ref, element: params.element });
    const locatorSource = `page.${resolved}`;
    if (params.type === 'textbox' || params.type === 'slider' || params.type === 'combobox') {
      const value = await locator.inputValue();
      if (value !== params.value) {
        response.addError(`Expected value "${params.value}", but got "${value}"`);
        return;
      }
      response.addCode(`await expect(${locatorSource}).toHaveValue(${javascript.quote(params.value)});`);
    } else if (params.type === 'checkbox' || params.type === 'radio') {
      const value = await locator.isChecked();
      if (value !== (params.value === 'true')) {
        response.addError(`Expected value "${params.value}", but got "${value}"`);
        return;
      }
      const matcher = value ? 'toBeChecked' : 'not.toBeChecked';
      response.addCode(`await expect(${locatorSource}).${matcher}();`);
    }
    response.addResult('Done');
  },
});

export default [
  verifyElement,
  verifyText,
  verifyList,
  verifyValue,
];
