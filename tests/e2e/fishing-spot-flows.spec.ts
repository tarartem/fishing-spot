import { test, expect } from '@playwright/test';

test.describe('Fishing Spot — Spain MVP Screenshot-to-Grid Artifact E2E Flow', () => {
  test('Guest sees 2-mode Satellite/Terrain switcher (no Plain Map), captures satellite imagery even from Terrain mode, sees species roster & road-surface access, and saves artifact', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto('/');

    // 1. Verify suggested spot chips and obsolete Plain Map view are absent
    await expect(page.getByTestId('water-body-pins-layer')).toHaveCount(0);
    await expect(page.getByTestId('map-style-plain')).toHaveCount(0);

    // 2. User switches between Satellite (PNOA / Esri) and Terrain views, ending in Terrain to test always-satellite capture
    await expect(page.getByTestId('map-style-switcher')).toBeVisible();
    await page.getByTestId('satellite-source-esri').click();
    await page.getByTestId('satellite-source-pnoa').click();
    await page.getByTestId('map-style-terrain').click();

    // 3. User captures the framed water body area while viewing Terrain
    await page.getByTestId('capture-map-area-button').click();

    // 4. User sees the captured 1024x1024 SATELLITE screenshot + scale quality banner and initiates AI analysis
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();
    await expect(page.getByTestId('selection-scale-banner')).toBeVisible();
    await expect(page.getByTestId('captured-screenshot-preview')).toBeVisible();
    await expect(page.getByTestId('satellite-capture-badge')).toContainText(
      'Satellite'
    );
    await page.getByTestId('initiate-ai-analysis-button').click();

    // 5. User receives annotated screenshot + Fish Species card + Geography/Altitude/Road Access card + Spain Regulations + Spots + Best Game Plan
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({
      timeout: 45000,
    });
    await expect(
      page.getByTestId('annotated-artifact-screenshot')
    ).toBeVisible();
    await expect(page.getByTestId('species-present-card')).toBeVisible();
    await expect(page.getByTestId('geographical-context-card')).toBeVisible();
    await expect(page.getByTestId('restriction-check-card')).toContainText(
      'Spain Fishing Regulations'
    );

    const summary = page.getByTestId('where-to-fish-summary');
    await expect(summary).toContainText('🎯 Where to Fish on the Grid:');
    await expect(page.getByTestId('artifact-spot-1')).toBeVisible();
    await expect(page.getByTestId('artifact-spot-4')).toBeVisible();

    const gamePlan = page.getByTestId('best-game-plan-summary');
    await expect(gamePlan).toContainText('🚗 Best Game Plan for This Area:');

    // 6. Verify 1-page PDF report download button & English-only UI outside restrictions
    await expect(page.locator('header')).not.toContainText('España');
    await expect(page.locator('header')).toContainText(
      'Find top fishing spots using satellite & terrain data'
    );

    // Verify Header GPS link, Copy button, and New Analysis CTA
    await expect(page.getByTestId('copy-gps-button')).toBeVisible();
    await expect(page.locator('a[href*="google.com/maps"]')).toBeVisible();
    await expect(page.getByTestId('artifact-back-to-map-button')).toContainText(
      'Analyze Another Location'
    );

    // Verify Dedicated Metadata Footer
    await expect(page.getByTestId('artifact-footer')).toBeVisible();
    await expect(page.getByTestId('artifact-footer')).toContainText('v0.');

    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-pdf-report-button').click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toMatch(/fishing-spot-.*\.pdf$/);

    // 7. Screenshot is saved as user's artifact under My spots
    await expect(page.getByTestId('my-spots-dropdown-button')).toContainText(
      'My spots (1)'
    );
  });

  test('Rejects dry-land screenshots without hallucinating spots or generating a PDF report', async ({
    page,
  }) => {
    test.setTimeout(45000);

    // Deterministic dry-hills coordinate lookup (Camino del Otonel, inland terrain)
    await page.route('https://nominatim.openstreetmap.org/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            lon: '-0.84',
            lat: '39.255',
            display_name: 'Otonel Dry Hills, Valencia, Spain',
          },
        ]),
      });
    });

    await page.goto('/');
    await page.getByTestId('water-body-search-input').fill('Otonel Dry Hills');
    await page.getByRole('button', { name: 'Go' }).click();

    // Wait for MapLibre flyTo transition to settle on the dry hillside
    await page.waitForTimeout(2000);

    await page.getByTestId('capture-map-area-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();
    await page.getByTestId('initiate-ai-analysis-button').click();

    await expect(page.getByTestId('user-artifact-view')).toBeVisible({
      timeout: 45000,
    });
    await expect(page.getByTestId('no-water-detected-banner')).toBeVisible();
    await expect(page.getByTestId('artifact-spot-1')).toHaveCount(0);
    await expect(page.getByTestId('download-pdf-report-button')).toHaveCount(0);
    await expect(page.locator('header')).not.toContainText('España');
  });

  test('Direct GPS coordinate search flies to target without Nominatim network request', async ({
    page,
  }) => {
    let nominatimCalled = false;
    await page.route('https://nominatim.openstreetmap.org/search*', async (route) => {
      nominatimCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');
    await page.getByTestId('water-body-search-input').fill('39.248, -0.935');
    await page.getByRole('button', { name: 'Go' }).click();

    // Settle brief flyTo
    await page.waitForTimeout(1000);
    expect(nominatimCalled).toBe(false);

    // Capture framed area at that GPS coordinate
    await page.getByTestId('capture-map-area-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();
  });
});
