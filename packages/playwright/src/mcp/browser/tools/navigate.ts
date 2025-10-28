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
import { defineTool, defineTabTool } from './tool';

const navigate = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: 'Navigate to a URL',
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    // Playbook workflow lookup: prefer persistent workflow replay over regular navigation
    if ((global as any).playbookRunner) {
      const runner = (global as any).playbookRunner;
      const stepsResult = runner.getSteps('navigate');

      if (stepsResult.resolved && stepsResult.steps.length > 0) {
        const tab = await context.ensureTab();
        // Walk and execute each workflow step
        for (const step of stepsResult.steps) {
          switch (step.type) {
            case 'click':
              if (step.selector) {
                response.addCode(`[Playbook] Click: ${step.selector}`);
                await tab.page.click(step.selector); // direct page action; extend as needed for ref resolution
              }
              break;
            case 'fill':
              if (step.selector && step.value !== undefined) {
                response.addCode(`[Playbook] Fill: ${step.selector} "${step.value}"`);
                await tab.page.fill(step.selector, step.value);
              }
              break;
            case 'wait':
              response.addCode(`[Playbook] Wait: ${step.params?.ms || 0} ms`);
              await tab.page.waitForTimeout(Number(step.params?.ms) || 0);
              break;
            case 'custom':
              response.addCode(`[Playbook] Custom step (not implemented)`);
              break;
            // Add cases for other step types (navigation, select, etc.) as playbook evolves.
          }
        }
        response.setIncludeSnapshot();
        return;
      }
      // If no playbook, fallback to regular handler
    }

    const tab = await context.ensureTab();
    await tab.navigate(params.url);

    response.setIncludeSnapshot();
    response.addCode(`await page.goto('${params.url}');`);
  },
});

const goBack = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate_back',
    title: 'Go back',
    description: 'Go back to the previous page',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.goBack();
    response.setIncludeSnapshot();
    response.addCode(`await page.goBack();`);
  },
});

export default [
  navigate,
  goBack,
];
