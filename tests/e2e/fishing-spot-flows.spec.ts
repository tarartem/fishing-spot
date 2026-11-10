import { test, expect } from '@playwright/test';

test.describe('Fishing Spot — Guest vs. Registered E2E Flows', () => {
  test('Guest sees named Water Body Pins, basic description, catchable fish, teaser feedback & CTA, then registers with Email to unlock the Spatial Grid & exact spots', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Guest opens app and sees named Water Body Pins over Poland & Spain waters
    await expect(page.getByTestId('guest-mode-badge')).toBeVisible();
    const zegrzePin = page.getByTestId('water-body-pin-wb-pl-zegrzynskie');
    const mequinenzaPin = page.getByTestId('water-body-pin-wb-es-mequinenza');
    await expect(zegrzePin).toBeVisible();
    await expect(mequinenzaPin).toBeVisible();

    // 2. Guest clicks Jezioro Zegrzyńskie Water Body Pin
    await zegrzePin.click();

    await expect(page.getByTestId('water-body-drawer')).toBeVisible();
    await expect(page.getByTestId('drawer-water-body-name')).toHaveText(
      'Jezioro Zegrzyńskie'
    );
    await expect(page.getByTestId('water-body-basic-description')).toContainText(
      'Lowland reservoir'
    );
    await expect(page.getByTestId('catchable-species-list')).toContainText(
      'zander'
    );
    await expect(page.getByTestId('guest-teaser-feedback')).toContainText(
      'Marek K.'
    );
    await expect(page.getByTestId('guest-registration-cta')).toBeVisible();

    // Crucial verification: Spatial Grid and Exact Spots are hidden from Guests
    await expect(page.getByTestId('spatial-grid-overlay')).toHaveCount(0);
    await expect(page.getByTestId('exact-spots-list')).toHaveCount(0);

    // 3. Guest clicks the CTA to register with Email
    await page.getByTestId('cta-register-button').click();
    await expect(page.getByTestId('email-register-modal')).toBeVisible();

    await page
      .getByTestId('register-email-input')
      .fill('artem.angler@fishing-spot.eu');
    await page.getByTestId('register-submit-button').click();

    // 4. Registered User immediately unlocks Spatial Grid (A1..H8) and Exact Fishing Spot Pins
    await expect(page.getByTestId('authenticated-user-badge')).toContainText(
      'artem.angler@fishing-spot.eu'
    );
    await expect(page.getByTestId('spatial-grid-overlay')).toBeVisible();
    await expect(page.getByTestId('exact-spots-list')).toBeVisible();
    await expect(page.getByTestId('spot-card-C4')).toContainText(
      'Old Narew Channel Drop-Off'
    );

    // 5. Registered user runs AI Spatial Grid Advisor with 4 core inputs
    await page.getByTestId('input-fishing-type').selectOption('feeder_bottom');
    await page.getByTestId('run-ai-grid-button').click();
    await expect(page.getByTestId('ai-water-body-summary')).toContainText(
      'Jezioro Zegrzyńskie'
    );

    // 6. Registered user clicks an individual cell on the Spatial Grid for a Level 2 Micro-Analysis
    const firstFishableCell = page
      .locator('[data-testid^="grid-cell-"]:not(:has-text("BAN"))')
      .first();
    await firstFishableCell.click();
    await expect(page.getByTestId('cell-micro-analysis-card')).toBeVisible();

    // 7. Registered user views and posts a community review
    await page.getByTestId('tab-reviews').click();
    await expect(page.getByTestId('reviews-tab-panel')).toBeVisible();
    await page
      .getByTestId('review-comment-input')
      .fill('Great evening bite along the drop-off in cell C4!');
    await page.getByTestId('submit-review-button').click();

    await expect(page.getByTestId('full-reviews-list')).toContainText(
      'Great evening bite along the drop-off in cell C4!'
    );
  });
});
