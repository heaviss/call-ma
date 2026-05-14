import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createLogger } from '../app/logger.js';

describe('createLogger', () => {
  let logsEl;

  beforeEach(() => {
    const dom = new JSDOM('<div id="logs"></div>');
    logsEl = dom.window.document.querySelector('#logs');
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
