import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('call-ma');
    await expect(page.getByRole('button', { name: 'Create Conference' })).toBeVisible();
  });
});
