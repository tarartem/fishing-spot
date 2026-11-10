import { test, expect } from '@playwright/test';

test.describe('Fishing Spot — Spain MVP Screenshot-to-Grid Artifact E2E Flow', () => {
  test('Guest sees clean map without suggested spot chips, captures exact water body area, views scale banner, runs AI analysis with altitude/road access & Spain regulations, and saves artifact', async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto('/');

    // 1. Verify suggested spot chips are removed from the map screen
    await expect(page.getByTestId('water-body-pins-layer')).toHaveCount(0);

    // 2. User switches between Satellite, Terrain, and Plain map styles
    await expect(page.getByTestId('map-style-switcher')).toBeVisible();
    await page.getByTestId('map-style-terrain').click();
    await page.getByTestId('map-style-plain').click();
    await page.getByTestId('map-style-satellite').click();

    // 3. User captures the framed water body area on the map
    await page.getByTestId('capture-map-area-button').click();

    // 4. User sees the captured 1024x1024 screenshot + scale quality banner and initiates AI analysis
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();
    await expect(page.getByTestId('selection-scale-banner')).toBeVisible();
    await expect(page.getByTestId('captured-screenshot-preview')).toBeVisible();
    await page.getByTestId('initiate-ai-analysis-button').click();

    // 5. User receives the annotated screenshot + Geography/Altitude/Road Access card + Spain Fishing Regulations card + Spots 1-6 + Best Game Plan
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByTestId('annotated-artifact-screenshot')
    ).toBeVisible();
    await expect(page.getByTestId('geographical-context-card')).toBeVisible();
    await expect(page.getByTestId('restriction-check-card')).toContainText(
      'Spain Fishing Regulations'
    );

    const summary = page.getByTestId('where-to-fish-summary');
    await expect(summary).toContainText('🎯 Where to Fish on the Grid:');
    await expect(page.getByTestId('artifact-spot-1')).toBeVisible();
    await expect(page.getByTestId('artifact-spot-6')).toBeVisible();

    const gamePlan = page.getByTestId('best-game-plan-summary');
    await expect(gamePlan).toContainText('🚗 Best Game Plan for This Area:');

    // 6. Screenshot is saved as user's artifact
    await expect(page.getByTestId('my-artifacts-list')).toContainText(
      'My Artifacts (1)'
    );
  });
});
