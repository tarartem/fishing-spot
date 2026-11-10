import { test, expect } from '@playwright/test';

test.describe('Fishing Spot — Map Switcher, Valencia Guest Exploration & Registered Visual Grid', () => {
  test('Switches between Satellite, Terrain & Plain maps, explores Valencia water body pins as Guest, and unlocks A1–H8 visual grid + numbered spots (1–6) + Legend on Registration', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Verify Map Style Switcher (Satellite | Terrain | Plain)
    await expect(page.getByTestId('map-style-switcher')).toBeVisible();
    await page.getByTestId('map-style-terrain').click();
    await page.getByTestId('map-style-plain').click();
    await page.getByTestId('map-style-satellite').click();

    // 2. Guest sees Valencia & Poland Water Body Pins on the map
    await expect(page.getByTestId('guest-mode-badge')).toBeVisible();
    const cortesValenciaPin = page.getByTestId(
      'water-body-pin-wb-es-cortes-valencia'
    );
    const tousValenciaPin = page.getByTestId(
      'water-body-pin-wb-es-tous-valencia'
    );
    await expect(cortesValenciaPin).toBeVisible();
    await expect(tousValenciaPin).toBeVisible();

    // 3. Guest clicks Embalse de Cortes (Cofrentes — Valencia) pin
    await cortesValenciaPin.click();

    await expect(page.getByTestId('water-body-drawer')).toBeVisible();
    await expect(page.getByTestId('drawer-water-body-name')).toContainText(
      'Embalse de Cortes'
    );
    await expect(page.getByTestId('water-body-basic-description')).toContainText(
      'Valencia'
    );
    await expect(page.getByTestId('catchable-species-list')).toContainText(
      'black bass'
    );
    await expect(page.getByTestId('guest-teaser-feedback')).toContainText(
      'Pablo S.'
    );
    await expect(page.getByTestId('guest-registration-cta')).toBeVisible();

    // Spatial Grid and Spot Features Legend remain hidden for Guests
    await expect(page.getByTestId('spatial-grid-overlay')).toHaveCount(0);
    await expect(page.getByTestId('spot-features-legend')).toHaveCount(0);

    // 4. Register with Email to unlock the A1–H8 Visual Grid, Numbered Points (1–6) & Spot Features Legend
    await page.getByTestId('cta-register-button').click();
    await page
      .getByTestId('register-email-input')
      .fill('valencia.angler@fishing-spot.eu');
    await page.getByTestId('register-submit-button').click();

    await expect(page.getByTestId('spatial-grid-overlay')).toBeVisible();
    await expect(page.getByTestId('spot-features-legend')).toBeVisible();
    await expect(page.getByTestId('spot-features-legend')).toContainText(
      'Dehesa de Cortes Main Peninsula Point'
    );
    await expect(page.getByTestId('exact-spot-pin-F6')).toHaveText('1');
    await expect(page.getByTestId('exact-spot-pin-E2')).toHaveText('2');
    await expect(page.getByTestId('exact-spot-pin-C7')).toHaveText('3');
  });
});
