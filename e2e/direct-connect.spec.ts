import { expect, test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
// ponytail: browser.newContext() doesn't inherit playwright.config.ts's `use.permissions` —
// only the default page/context fixtures do — so this test grants them explicitly.
const CONTEXT_OPTIONS = { permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'] };

test('two browsers connect via the direct QR/link fallback', async ({ browser }) => {
  const initiatorContext = await browser.newContext(CONTEXT_OPTIONS);
  const receiverContext  = await browser.newContext(CONTEXT_OPTIONS);
  const initiator = await initiatorContext.newPage();
  const receiver  = await receiverContext.newPage();

  await initiator.goto(`${BASE_URL}/?debug=true`);
  await initiator.locator('#directBtn').click();
  await expect(initiator.locator('#directCopyBtn')).toBeEnabled({ timeout: 10_000 });
  await initiator.locator('#directCopyBtn').click();
  await expect(initiator.locator('#logs')).toContainText('Direct link copied.');
  const offerLink = await initiator.evaluate(() => navigator.clipboard.readText());

  await receiver.goto(offerLink);
  await expect(receiver.locator('#directCopyBtn')).toBeEnabled({ timeout: 10_000 });
  await receiver.locator('#directCopyBtn').click();
  await expect(receiver.locator('#logs')).toContainText('Direct link copied.');
  const answerLink = await receiver.evaluate(() => navigator.clipboard.readText());

  await initiator.locator('#directAnswerInput').fill(answerLink);
  await initiator.locator('#directConnectBtn').click();

  await expect(initiator.locator('#logs')).toContainText('Direct connection established!', { timeout: 10_000 });
  await expect(receiver.locator('#logs')).toContainText('Direct connection established!', { timeout: 10_000 });

  await initiatorContext.close();
  await receiverContext.close();
});
