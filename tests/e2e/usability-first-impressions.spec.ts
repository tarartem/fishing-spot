import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Usability & First Impression Deep Testing', () => {
  const screenshotsDir = path.join(process.cwd(), 'test-results', 'usability-audit');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Desktop (1440x900) — First Impression, Visual Hierarchy & Workflow Journey', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Initial screen capture (First Impression)
    await page.waitForTimeout(2000); // Allow map tiles and canvas to settle
    await page.screenshot({
      path: path.join(screenshotsDir, '01-first-impression-desktop.png'),
    });

    // Measure Header layout & overlap
    const header = page.locator('header');
    const headerBox = await header.boundingBox();
    console.log('DESKTOP_HEADER_BOX:', JSON.stringify(headerBox));

    const reticle = page.getByTestId('target-reticle-box');
    const reticleBox = await reticle.boundingBox();
    console.log('DESKTOP_RETICLE_BOX:', JSON.stringify(reticleBox));

    const bottomBar = page.getByTestId('capture-map-area-button').locator('..');
    const bottomBarBox = await bottomBar.boundingBox();
    console.log('DESKTOP_BOTTOM_BAR_BOX:', JSON.stringify(bottomBarBox));

    // Open streamlined preview panel
    await page.getByTestId('capture-map-area-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, '02-preview-panel-desktop.png'),
    });

    // Run AI analysis to inspect the artifact view
    await page.getByTestId('initiate-ai-analysis-button').click();
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({ timeout: 35000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotsDir, '03-artifact-view-desktop.png'),
    });
  });

  test('Mobile (390x844 - iPhone 13/14) — First Impression, Touch Usability & Cramping Audit', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotsDir, '04-first-impression-mobile.png'),
    });

    // Measure Header height on mobile — does it wrap and collide with map controls?
    const header = page.locator('header');
    const headerBox = await header.boundingBox();
    console.log('MOBILE_HEADER_BOX:', JSON.stringify(headerBox));

    const styleSwitcher = page.getByTestId('map-style-switcher');
    const styleSwitcherBox = await styleSwitcher.boundingBox();
    console.log('MOBILE_STYLE_SWITCHER_BOX:', JSON.stringify(styleSwitcherBox));

    const bottomBar = page.getByTestId('capture-map-area-button').locator('..');
    const bottomBarBox = await bottomBar.boundingBox();
    console.log('MOBILE_BOTTOM_BAR_BOX:', JSON.stringify(bottomBarBox));

    // Capture area
    await page.getByTestId('capture-map-area-button').click();
    await expect(page.getByTestId('screenshot-preview-panel')).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, '05-preview-panel-mobile.png'),
    });

    // Check initiate button visibility without excessive scrolling
    const initiateBtn = page.getByTestId('initiate-ai-analysis-button');
    const isInitiateVisible = await initiateBtn.isVisible();
    console.log('MOBILE_INITIATE_BTN_VISIBLE_IMMEDIATELY:', isInitiateVisible);

    await initiateBtn.click();
    await expect(page.getByTestId('user-artifact-view')).toBeVisible({ timeout: 35000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotsDir, '06-artifact-view-mobile.png'),
    });
  });
});
