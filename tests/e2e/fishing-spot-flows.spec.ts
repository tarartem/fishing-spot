import { test, expect } from '@playwright/test';

test.describe('Fishing Spot — Guest Screenshot-to-Grid Artifact E2E Flow', () => {
  test('Guest switches map layers, selects water body area to create screenshot, initiates AI analysis, receives annotated screenshot with points 1–6 + summary, and navigates to analyze another water body', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. User switches between Satellite, Terrain, and Plain map styles
    await expect(page.getByTestId('map-style-switcher')).toBeVisible();
    await page.getByTestId('map-style-terrain').click();
    await page.getByTestId('map-style-plain').click();
    await page.getByTestId('map-style-satellite').click();

    // 2. User navigates to Embalse de Cortes (Valencia) and selects the area on the map (creating the screenshot)
    await page.getByTestId('water-body-pin-wb-es-cortes-valencia').click();
    await page.getByTestId('capture-map-area-button').click();

    // 3. User sees the captured screenshot on the screen and initiates AI analysis
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();
    await expect(page.getByTestId('captured-screenshot-preview')).toBeVisible();
    await page.getByTestId('initiate-ai-analysis-button').click();

    // 4. User receives the annotated screenshot with points 1–6 and the 🎯 Where to Fish on the Grid + 🚗 Best Game Plan summary
    await expect(page.getByTestId('user-artifact-view')).toBeVisible();
    await expect(page.getByTestId('recognized-water-body-name')).toContainText(
      'Embalse de Cortes'
    );
    await expect(
      page.getByTestId('annotated-artifact-screenshot')
    ).toBeVisible();

    const summary = page.getByTestId('where-to-fish-summary');
    await expect(summary).toContainText('🎯 Where to Fish on the Grid:');
    await expect(summary).toContainText(
      '🔴 Spot 1: Tip of the Dehesa de Cortes Peninsula (Grid E6 / F6)'
    );
    await expect(summary).toContainText(
      '🔴 Spot 2: The Underwater Shelf Below Playa del Ral (Grid E2 / E3)'
    );
    await expect(summary).toContainText(
      '🔵 Spot 3: Carpa Cofrentes Sheltered Bay (Grid B6 / C6)'
    );
    await expect(summary).toContainText(
      '🔵 Spot 4: Playa del Ral Beach Cove (Grid D1 / E1)'
    );
    await expect(summary).toContainText(
      '🟠 Spot 5: The Canyon S-Bend & Powerline Point (Grid E4)'
    );
    await expect(summary).toContainText(
      '🟠 Spot 6: Southern Gate of the Western Arm (Grid E7)'
    );

    const gamePlan = page.getByTestId('best-game-plan-summary');
    await expect(gamePlan).toContainText('🚗 Best Game Plan for This Area:');
    await expect(gamePlan).toContainText(
      'Drive down to Playa del Ral (Spot 4, Grid D1/E1) first'
    );

    // 5. Screenshot is saved as user's artifact and user can navigate to another water body and analyze it
    await expect(page.getByTestId('my-artifacts-list')).toContainText(
      'My Artifacts (1)'
    );
    await page.getByTestId('artifact-back-to-map-button').click();

    // Navigate to Embalse de Tous (Valencia) and analyze it
    await page.getByTestId('water-body-pin-wb-es-tous-valencia').click();
    await page.getByTestId('capture-map-area-button').click();
    await page.getByTestId('initiate-ai-analysis-button').click();

    await expect(page.getByTestId('recognized-water-body-name')).toContainText(
      'Embalse de Tous'
    );
    await expect(page.getByTestId('my-artifacts-list')).toContainText(
      'My Artifacts (2)'
    );
  });
});
