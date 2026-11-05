import type { Locator, Page } from '@playwright/test';

import { test as base, expect } from '@playwright/test';

// ponytail: browser.newContext() doesn't inherit playwright.config.ts's `use.permissions` —
// only the default page/context fixtures do — so the receiver context grants them explicitly.
const CONTEXT_OPTIONS = {
  permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'],
};
const CONNECT_TIMEOUT_MS = 10_000;

// The initiator is the default `page`; the receiver needs a second, isolated browser context.
const test = base.extend<{ receiver: Page }>({
  receiver: async ({ browser }, use) => {
    const context = await browser.newContext(CONTEXT_OPTIONS);
    await use(await context.newPage());
    await context.close();
  },
});

function logsOf(page: Page): Locator {
  return page.getByRole('region', { name: 'Logs and stats', includeHidden: true });
}

async function copyDirectLink(page: Page): Promise<string> {
  const copyButton = page.getByRole('button', { name: 'Copy link', exact: true });
  await expect(copyButton).toBeEnabled({ timeout: CONNECT_TIMEOUT_MS });
  await copyButton.click();
  await expect(logsOf(page)).toContainText('Direct link copied.');
  return page.evaluate(async () => navigator.clipboard.readText());
}

test.describe('direct connection', () => {
  test('two browsers connect via the direct QR/link fallback', async ({
    page: initiator,
    receiver,
  }) => {
    await initiator.goto('/?debug=true');
    await initiator.getByRole('button', { name: "Can't connect? Try directly" }).click();
    await receiver.goto(await copyDirectLink(initiator));
    await initiator.getByLabel('Paste their response link:').fill(await copyDirectLink(receiver));
    await initiator.getByRole('button', { name: 'Connect', exact: true }).click();

    await expect(logsOf(initiator)).toContainText('Direct connection established!', {
      timeout: CONNECT_TIMEOUT_MS,
    });
    await expect(logsOf(receiver)).toContainText('Direct connection established!', {
      timeout: CONNECT_TIMEOUT_MS,
    });
  });
});
