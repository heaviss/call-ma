import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it } from 'vitest';

import { createLogger } from '../app/logger.ts';
import { getEl } from './fakes/dom.ts';

describe('createLogger', () => {
  let logsEl: Element;

  beforeEach(() => {
    const dom = new JSDOM('<div id="logs"></div>');
    logsEl = getEl(dom.window.document, '#logs');
  });

  it('appends a timestamped line on log()', () => {
    const logger = createLogger(logsEl);

    logger.log('hello');

    expect(logsEl.textContent).toContain('hello');
    expect(logsEl.textContent).toMatch(/\[\d+:\d+/);
  });

  it('appends multiple lines without overwriting', () => {
    const logger = createLogger(logsEl);

    logger.log('first');
    logger.log('second');

    expect(logsEl.textContent).toContain('first');
    expect(logsEl.textContent).toContain('second');
  });

  it('clears all content on clear()', () => {
    const logger = createLogger(logsEl);
    logger.log('something');

    logger.clear();

    expect(logsEl.textContent).toBe('');
  });
});
