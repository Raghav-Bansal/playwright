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
import { defineTabTool, defineTool } from './tool';

const close = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_close',
    title: 'Close browser',
    description: 'Close the page',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (context, params, response) => {
    await context.closeBrowserContext();
    response.setIncludeTabs();
    response.addCode(`await page.close()`);
  },
});

const resize = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_resize',
    title: 'Resize browser window',
    description: 'Resize the browser window',
    inputSchema: z.object({
      width: z.number().describe('Width of the browser window'),
      height: z.number().describe('Height of the browser window'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    response.addCode(`await page.setViewportSize({ width: ${params.width}, height: ${params.height} });`);

    await tab.waitForCompletion(async () => {
      await tab.page.setViewportSize({ width: params.width, height: params.height });
    });
  },
});

const startRecording = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_start_recording',
    title: 'Start Playbook Recording Session',
    description: 'Start recording a new playbook session; all subsequent actions will be grouped for learning.',
    inputSchema: z.object({
      sessionName: z.string().optional().describe('Optional session name for grouping recorded steps (if omitted, uses timestamp)')
    }),
    type: 'action',
  },
  handle: async (context, params, response) => {
    const sessionName = params.sessionName || `session-${new Date().toISOString()}`;
    global.playbookRecordSession = { active: true, steps: [], sessionName };
    response.addResult(`Persistent playbook recording started (sessionName = ${sessionName})`);
  },
});

const stopRecording = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_stop_recording',
    title: 'Stop Playbook Recording Session',
    description: 'Stop recording and commit session as a pattern to playbook.yaml.',
    inputSchema: z.object({}),
    type: 'action',
  },
  handle: async (context, params, response) => {
    if (
      global.playbookRecordSession &&
      global.playbookRecordSession.active &&
      Array.isArray(global.playbookRecordSession.steps) &&
      global.playbookStore
    ) {
      const sessionPattern = {
        name: global.playbookRecordSession.sessionName || `session-${new Date().toISOString()}`,
        steps: global.playbookRecordSession.steps,
        meta: { recordedAt: new Date().toISOString() }
      };
      global.playbookStore.addPattern(sessionPattern);
      global.playbookRecordSession.active = false;
      response.addResult(`Playbook session saved as pattern '${sessionPattern.name}' (${sessionPattern.steps.length} steps)`);
    } else {
      response.addError('No active playbook recording session to stop.');
    }
  },
});

export default [
  close,
  resize,
  startRecording,
  stopRecording
];
