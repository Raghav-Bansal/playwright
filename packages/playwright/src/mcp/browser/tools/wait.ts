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
import { defineTool } from './tool';

const wait = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_wait_for',
    title: 'Wait for',
    description: 'Wait for text to appear or disappear or a specified time to pass',
    inputSchema: z.object({
      time: z.number().optional().describe('The time to wait in seconds'),
      text: z.string().optional().describe('The text to wait for'),
      textGone: z.string().optional().describe('The text to wait for to disappear'),
    }),
    type: 'assertion',
  },

  handle: async (context, params, response) => {
    // Playbook workflow-driven: Example for wait handler
    if ((global as any).playbookRunner) {
      const runner = (global as any).playbookRunner;
      const stepsResult = runner.getSteps('wait');
      if (stepsResult.resolved && stepsResult.steps.length > 0) {
        const tab = context.currentTabOrDie();
        for (const step of stepsResult.steps) {
          if (step.type === 'wait') {
            response.addCode(`[Playbook] Wait: ${step.params?.ms || 0} ms`);
            await tab.page.waitForTimeout(Number(step.params?.ms) || 0);
          }
        }
        response.addResult('Playbook wait steps complete');
        response.setIncludeSnapshot();
        return;
      }
    }

    if (!params.text && !params.textGone && !params.time)
      throw new Error('Either time, text or textGone must be provided');

    if (params.time) {
      response.addCode(`await new Promise(f => setTimeout(f, ${params.time!} * 1000));`);
      await new Promise(f => setTimeout(f, Math.min(30000, params.time! * 1000)));
    }

    const tab = context.currentTabOrDie();
    const locator = params.text ? tab.page.getByText(params.text).first() : undefined;
    const goneLocator = params.textGone ? tab.page.getByText(params.textGone).first() : undefined;

    if (goneLocator) {
      response.addCode(`await page.getByText(${JSON.stringify(params.textGone)}).first().waitFor({ state: 'hidden' });`);
      await goneLocator.waitFor({ state: 'hidden' });
    }

    if (locator) {
      response.addCode(`await page.getByText(${JSON.stringify(params.text)}).first().waitFor({ state: 'visible' });`);
      await locator.waitFor({ state: 'visible' });
    }

    response.addResult(`Waited for ${params.text || params.textGone || params.time}`);
    response.setIncludeSnapshot();

    // --- Dual-mode persistent learning: fallback-triggered playbook persistence ---
    if (global.playbookStore) {
      try {
        const store = global.playbookStore;
        const patternName = 'wait';
        const stepParams: Record<string, any> = {};
        if (params.time) stepParams.ms = params.time * 1000;
        if (params.text) stepParams.text = params.text;
        if (params.textGone) stepParams.textGone = params.textGone;
        const stepObj = { type: 'wait' as const, selector: '', params: stepParams };
        const pattern = store.getPattern(patternName);
        let shouldAdd = true;
        if (pattern && Array.isArray(pattern.steps)) {
          shouldAdd = !pattern.steps.some(
            step => step.type === 'wait' && JSON.stringify(step.params) === JSON.stringify(stepParams)
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
          console.warn('[playbookStore persist: wait]', e);
        }
      }
    }
  },
});

export default [
  wait,
];
