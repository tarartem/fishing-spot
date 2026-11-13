import { test, expect } from '@playwright/test';

test.describe('Fishing Spot — Synthetic User Personas E2E Testing Suite', () => {
  // Set generous timeout for AI analysis pipeline and tile downloads
  test.setTimeout(60000);

  test('Persona 1: Carlos Mendoza (Family & Bank Angler) — Evaluates road access, fish species, and downloads 1-page PDF report', async ({
    page,
  }) => {
    // 1. Carlos loads the app
    await page.goto('/');

    // 2. Searches for Embalse de Cortes
    const searchInput = page.getByTestId('water-body-search-input');
    await searchInput.fill('Embalse de Cortes');
    await page.getByRole('button', { name: 'Go' }).click();

    // 3. Captures framed reticle area
    await page.getByTestId('capture-map-area-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();

    // 4. Carlos checks the scale guidance banner to ensure tactical resolution
    const scaleBanner = page.getByTestId('selection-scale-banner');
    await expect(scaleBanner).toBeVisible();

    // 5. Initiates AI analysis
    await page.getByTestId('initiate-ai-analysis-button').click();

    // 7. Inspects resulting artifact
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({ timeout: 35000 });
    await expect(page.getByTestId('recognized-water-body-name')).toContainText(/Cortes|Naranjero/);

    // 8. Checks Fish Species Roster
    const speciesCard = page.getByTestId('species-present-card');
    await expect(speciesCard).toBeVisible();
    await expect(speciesCard).toContainText('Fish Species');

    // 9. Inspects road access for family bank fishing
    const spot4 = page.getByTestId('artifact-spot-4');
    await expect(spot4).toBeVisible();
    await expect(spot4).toContainText(/Access & Road Surface/);

    // 10. Downloads 1-page PDF report for offline use in the car
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-pdf-report-button').click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toMatch(/fishing-spot-.*\.pdf$/);
    const pdfPath = await pdfDownload.path();
    expect(pdfPath).toBeTruthy();
  });

  test('Persona 2: Mateo Fernández (Trophy Predator Specialist) — Assesses terrain contours, uses drag-box sector crop, validates satellite capture, and inspects trophy spots', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Mateo checks terrain contours to judge steep canyon walls
    await page.getByTestId('map-style-terrain').click();
    await expect(page.getByTestId('map-style-terrain')).toHaveClass(/bg-emerald-500/);

    // 2. Toggles satellite sources: Esri Alt then back to PNOA HD
    await page.getByTestId('satellite-source-esri').click();
    await expect(page.getByTestId('satellite-source-esri')).toHaveClass(/bg-sky-400/);
    await page.getByTestId('satellite-source-pnoa').click();
    await expect(page.getByTestId('satellite-source-pnoa')).toHaveClass(/bg-sky-400/);

    // 3. Captures framed area for exact sector targeting
    await page.getByTestId('capture-map-area-button').click();

    // 5. Verifies preview panel opens with satellite capture badge (auto-switched from terrain)
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();
    const satBadge = page.getByTestId('satellite-capture-badge');
    await expect(satBadge).toBeVisible();
    await expect(satBadge).toContainText('Satellite');

    // 6. Runs AI analysis
    await page.getByTestId('initiate-ai-analysis-button').click();
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({ timeout: 35000 });

    // 8. Inspects Rank 1 Trophy / Premier Structure spot
    const spot1 = page.getByTestId('artifact-spot-1');
    await expect(spot1).toBeVisible();
    await expect(spot1).toContainText(/Spot 1/);
    await expect(spot1).toContainText(/Structure/);

    // 9. Inspects Best Game Plan
    const gamePlan = page.getByTestId('best-game-plan-summary');
    await expect(gamePlan).toBeVisible();
    await expect(gamePlan).toContainText('Best Game Plan for This Area:');

    // 10. Downloads high-res annotated grid PNG image
    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-artifact-button').click(),
    ]);
    expect(pngDownload.suggestedFilename()).toMatch(/fishing-spot-grid-.*\.png$/);
  });

  test('Persona 3: Elena Soriano (Multi-Water-Body Trip Planner & Legal Compliance Angler) — Validates regulations, saves multi-reservoir artifacts, and toggles gallery', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto('/');

    // 1. Elena analyzes Embalse de Cortes first
    await page.getByTestId('capture-map-area-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();
    await page.getByTestId('initiate-ai-analysis-button').click();
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({ timeout: 35000 });

    // 2. Checks legal restrictions card
    const restrictionCard = page.getByTestId('restriction-check-card');
    await expect(restrictionCard).toBeVisible();
    await expect(restrictionCard).toContainText('Spain Fishing Regulations');
    await expect(restrictionCard).toContainText('Permits:');
    await expect(restrictionCard).toContainText('Restricted / Safety Zones:');

    // 3. Verifies first artifact saved under My spots
    await expect(page.getByTestId('my-spots-dropdown-button')).toContainText('My spots (1)');

    // 4. Returns to map to plan the next leg of her trip
    await page.getByTestId('artifact-back-to-map-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).not.toBeVisible();
    await expect(page.getByTestId('user-artifact-view')).not.toBeVisible();

    // 5. Searches second water body: Embalse de Tous
    const searchInput = page.getByTestId('water-body-search-input');
    await searchInput.fill('Embalse de Tous');
    await page.getByRole('button', { name: 'Go' }).click();
    await page.waitForTimeout(1000);

    // 6. Captures Embalse de Tous area and initiates AI analysis
    await page.getByTestId('capture-map-area-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();
    await page.getByTestId('initiate-ai-analysis-button').click();
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({ timeout: 35000 });

    // 7. Verifies gallery updated to 2 saved artifacts and opens dropdown
    await expect(page.getByTestId('my-spots-dropdown-button')).toContainText('My spots (2)');
    await page.getByTestId('my-spots-dropdown-button').click();
    await expect(page.getByTestId('saved-artifact-chip-0')).toBeVisible();
    await expect(page.getByTestId('saved-artifact-chip-1')).toBeVisible();

    // 8. Toggles back to the first artifact in the header gallery
    await page.getByTestId('saved-artifact-chip-1').click();
    await expect(page.getByTestId('user-artifact-view')).toBeVisible();
    await expect(page.getByTestId('recognized-water-body-name')).toContainText('Embalse de Cortes');
  });

  test('Persona 4: Lucas Gómez (Lost Novice & Boundary Tester) — Mistakenly selects dry inland hills, verifies zero hallucinated spots and recovery flow', async ({
    page,
  }) => {
    // Deterministic inland dry coordinates (Camino del Otonel, mountain hills in Valencia)
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

    // 1. Lucas searches for inland dry hills
    const searchInput = page.getByTestId('water-body-search-input');
    await searchInput.fill('Otonel Dry Hills');
    await page.getByRole('button', { name: 'Go' }).click();

    // Wait for MapLibre flyTo animation
    await page.waitForTimeout(2000);

    // 2. Lucas captures the dry mountain area
    await page.getByTestId('capture-map-area-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();

    // 3. Runs AI analysis
    await page.getByTestId('initiate-ai-analysis-button').click();

    // 4. Verifies zero-hallucination guardrail triggers
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({ timeout: 35000 });
    const noWaterBanner = page.getByTestId('no-water-detected-banner');
    await expect(noWaterBanner).toBeVisible();
    await expect(noWaterBanner).toContainText('No Fishable Water Body Found');

    // 5. Zero fishing spots hallucinated
    await expect(page.getByTestId('artifact-spot-1')).toHaveCount(0);

    // 6. Zero false PDF report download button
    await expect(page.getByTestId('download-pdf-report-button')).toHaveCount(0);

    // 7. Lucas uses the recovery action to reposition over real water
    await page.getByRole('button', { name: 'Reposition Map Over Water' }).click();
    await expect(page.getByTestId('user-artifact-view')).not.toBeVisible();
  });
});
