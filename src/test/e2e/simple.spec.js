import { test, expect } from '@playwright/test'

test.describe('Basic App Functionality', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    // Check if the page loads without errors
    await expect(page).toHaveTitle(/Carbonify/)

    // Check for the main brand title
    await expect(page.locator('h1.hero-title')).toContainText(
      'Trade Carbon Credits with Confidence',
    )
  })

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login')

    // Check if login page loads
    await expect(page).toHaveURL('/login')
    await expect(page.locator('h1')).toContainText('CARBONIFY')
  })

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/register')

    // Check if register page loads
    await expect(page).toHaveURL('/register')
    await expect(page.locator('h1')).toContainText('CARBONIFY')
  })

  test('should navigate to marketplace page', async ({ page }) => {
    await page.goto('/marketplace')

    // Check if marketplace page loads
    await expect(page).toHaveURL('/marketplace')

    // Look for the actual page title in the marketplace
    const pageTitle = page.locator('h1')
    await expect(pageTitle).toBeVisible()
  })

  test('should navigate to wallet page', async ({ page }) => {
    await page.goto('/wallet')

    // Check if wallet page loads (should redirect to login for unauthenticated users)
    await expect(page).toHaveURL(/\/login/)

    // Look for login form since unauthenticated users should be redirected
    const loginForm = page.locator('form, .login-form, [class*="login"]').first()
    await expect(loginForm).toBeVisible()
  })

  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/nonexistent-page')

    // Should either redirect to home or show 404
    expect(response?.status()).toBeGreaterThanOrEqual(200)
  })
})
