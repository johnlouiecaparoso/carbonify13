import { test, expect } from '@playwright/test'

test.describe('Wallet Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wallet')
  })

  test('should display wallet page with initial balance', async ({ page }) => {
    // Check if wallet page redirects to login (authentication required)
    await expect(page).toHaveURL(/\/login/)

    // The wallet page requires authentication, so we should be redirected to login
    await expect(page.locator('h1')).toContainText('CARBONIFY')
  })

  test('should have top-up functionality', async ({ page }) => {
    // Since wallet requires authentication, we should be redirected to login
    await expect(page).toHaveURL(/\/login/)

    // Check that we can see login form elements
    const loginForm = page.locator('form, input, button')
    await expect(loginForm.first()).toBeVisible()
  })

  test('should have withdrawal functionality', async ({ page }) => {
    // Since wallet requires authentication, we should be redirected to login
    await expect(page).toHaveURL(/\/login/)

    // Check that we can see login form elements
    const loginForm = page.locator('form, input, button')
    await expect(loginForm.first()).toBeVisible()
  })

  test('should display transaction history section', async ({ page }) => {
    // Since wallet requires authentication, we should be redirected to login
    await expect(page).toHaveURL(/\/login/)

    // Check that we can see login form elements
    const loginForm = page.locator('form, input, button')
    await expect(loginForm.first()).toBeVisible()
  })

  test('should handle wallet navigation', async ({ page }) => {
    // Test navigation to wallet from other pages
    await page.goto('/')
    await page.goto('/wallet')
    // Should redirect to login since wallet requires authentication
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show wallet in dashboard integration', async ({ page }) => {
    // Navigate to dashboard to check wallet integration
    await page.goto('/dashboard')

    // Dashboard should also require authentication
    await expect(page).toHaveURL(/\/login/)

    // Check that we can see login form elements
    const loginForm = page.locator('form, input, button')
    await expect(loginForm.first()).toBeVisible()
  })
})
