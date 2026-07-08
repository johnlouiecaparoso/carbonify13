import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { ROLES } from '@/constants/roles'
import { getRoleDefaultRoute } from '@/utils/getRoleDefaultRoute'
import {
  createProjectDeveloperGuard,
  createAdminGuard,
  createVerifierGuard,
  createLguGuard,
} from '@/middleware/roleGuard'
import { FEATURES } from '@/constants/plans'

// Lazy load components for better performance
const HomepageView = () => import(/* webpackChunkName: "homepage" */ '@/views/HomepageView.vue')
const LoginView = () => import(/* webpackChunkName: "auth" */ '@/views/LoginView.vue')
const RegisterView = () => import(/* webpackChunkName: "auth" */ '@/views/RegisterView.vue')
const WalletView = () => import(/* webpackChunkName: "user" */ '@/views/WalletView.vue')
const ProfileView = () => import(/* webpackChunkName: "user" */ '@/views/ProfileView.vue')

// Hidden Components removed - all old dashboard routes now redirect to homepage
const EmailSettingsView = () =>
  import(/* webpackChunkName: "settings" */ '@/views/EmailSettingsView.vue')
const PaymentSettingsView = () =>
  import(/* webpackChunkName: "settings" */ '@/views/PaymentSettingsView.vue')
const UserPreferencesView = () =>
  import(/* webpackChunkName: "user" */ '@/views/UserPreferencesView.vue')
const SocialView = () => import(/* webpackChunkName: "user" */ '@/views/SocialView.vue')

const FINANCE_RESTRICTED_ROLES = [ROLES.ADMIN, ROLES.VERIFIER, ROLES.PROJECT_DEVELOPER]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Public Routes
    { path: '/home', name: 'home', component: HomepageView },
    { path: '/', redirect: '/home' },
    { path: '/about', name: 'about', component: () => import('@/views/AboutView.vue') },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
    },
    {
      // MFA step-up page (requires a session at aal1; reached via the guard)
      path: '/mfa-challenge',
      name: 'mfa-challenge',
      component: () => import('@/views/MfaChallengeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // OAuth / phone sign-in lands here to finalize the session.
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/views/AuthCallbackView.vue'),
    },
    {
      path: '/marketplace',
      name: 'marketplace',
      component: () => import('@/views/MarketplaceViewEnhanced.vue'),
    },
    {
      // Public biomass feedstock marketplace (browse + request-for-quotation).
      path: '/biomass',
      name: 'biomass-marketplace',
      component: () => import('@/views/BiomassMarketplaceView.vue'),
    },
    {
      // Investor Portal — pipeline + financial model + data room. Pro-gated.
      path: '/investor',
      name: 'investor-portal',
      component: () => import('@/views/InvestorPortalView.vue'),
      meta: { requiresAuth: true, requiresFeature: FEATURES.INVESTOR_PORTAL },
    },
    {
      path: '/biomass/sell',
      name: 'biomass-sell',
      component: () => import('@/views/BiomassSellView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/biomass/rfqs',
      name: 'biomass-rfqs',
      component: () => import('@/views/BiomassRfqsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Public carbon registry — anyone can browse/verify issued & retired credits.
      path: '/registry',
      name: 'registry',
      component: () => import('@/views/RegistryView.vue'),
    },
    {
      // Public market dashboard — anonymous market snapshot (supply, price, impact).
      path: '/market',
      name: 'market-dashboard',
      component: () => import('@/views/MarketDashboardView.vue'),
    },
    {
      path: '/map',
      name: 'projects-map',
      component: () => import('@/views/ProjectsMapView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/apply',
      name: 'role-application',
      component: () => import('@/views/RoleApplicationView.vue'),
    },
    {
      path: '/retire',
      name: 'retire',
      component: () => import('@/views/RetireView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Public certificate verification (QR codes resolve here)
      path: '/verify/:certificateNumber?',
      name: 'certificate-verify',
      component: () => import('@/views/CertificateVerifyView.vue'),
    },
    {
      path: '/mobile-test',
      name: 'mobile-test',
      component: () => import('@/views/MobileTestView.vue'),
    },

    // Redirect old dashboard routes to homepage
    {
      path: '/dashboard',
      redirect: '/',
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true },
    },
    {
      path: '/wallet',
      name: 'wallet',
      component: WalletView,
      meta: { requiresAuth: true, disallowedRoles: FINANCE_RESTRICTED_ROLES },
    },
    // Project and Credit Routes
    {
      path: '/submit-project',
      name: 'submit-project',
      component: () => import('@/views/SubmitProjectView.vue'),
      meta: {
        requiresAuth: true,
        requiresProjectDeveloper: true,
      },
    },
    {
      path: '/developer/projects',
      name: 'developer-projects-dashboard',
      component: () => import('@/views/DeveloperProjectsDashboardView.vue'),
      meta: {
        requiresAuth: true,
        requiresProjectDeveloper: true,
      },
    },
    {
      path: '/developer/ledger',
      name: 'developer-asset-ledger',
      component: () => import('@/views/CarbonAssetLedgerView.vue'),
      meta: {
        requiresAuth: true,
        requiresProjectDeveloper: true,
      },
    },
    {
      path: '/developer/mrv-dashboard',
      name: 'developer-mrv-dashboard',
      component: () => import('@/views/MrvDashboardView.vue'),
      meta: {
        requiresAuth: true,
        requiresProjectDeveloper: true,
      },
    },
    {
      path: '/monitoring',
      name: 'monitoring-reports',
      component: () => import('@/views/MonitoringReportView.vue'),
      meta: {
        requiresAuth: true,
        requiresProjectDeveloper: true,
      },
    },
    {
      path: '/lgu',
      name: 'lgu-dashboard',
      component: () => import('@/views/LguDashboardView.vue'),
      meta: {
        requiresAuth: true,
        requiresLgu: true,
      },
    },
    {
      path: '/buy-credits',
      name: 'buy-credits',
      component: () => import('@/views/BuyCreditsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/credit-portfolio',
      name: 'credit-portfolio',
      component: () => import('@/views/CreditPortfolioView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/watchlist',
      name: 'watchlist',
      component: () => import('@/views/WatchlistView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('@/views/CartView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/kyc',
      name: 'kyc',
      component: () => import('@/views/KycView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/upgrade',
      name: 'upgrade',
      component: () => import('@/views/UpgradeView.vue'),
      meta: { requiresAuth: true },
    },
    // Redirect old project list route; full detail page for a single project.
    { path: '/projects', redirect: '/marketplace' },
    {
      path: '/projects/:id',
      name: 'project-detail',
      component: () => import('@/views/ProjectDetailView.vue'),
      props: true,
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/components/admin/AdminDashboard.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/components/admin/UserManagement.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/role-applications',
      name: 'admin-role-applications',
      component: () => import('@/components/admin/RoleApplications.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/database',
      name: 'admin-database',
      component: () => import('@/components/admin/DatabaseManagement.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/kyc',
      name: 'admin-kyc',
      component: () => import('@/components/admin/KycReviewPanel.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/config',
      name: 'admin-config',
      component: () => import('@/views/SystemConfigView.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/kyb',
      name: 'admin-kyb',
      component: () => import('@/views/AdminKybReviewView.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/refunds',
      name: 'admin-refunds',
      component: () => import('@/views/AdminRefundsView.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    { path: '/admin/tables', redirect: '/admin/database' },
    {
      path: '/admin/finance',
      name: 'admin-finance',
      component: () => import('@/views/FinanceConsoleView.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/audit-logs',
      name: 'admin-audit-logs',
      component: () => import('@/components/admin/AuditLogsView.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/verifier',
      name: 'verifier',
      component: () => import('@/views/VerifierPanel.vue'),
      meta: { requiresAuth: true, requiresVerifier: true },
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('@/views/AnalyticsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/sales',
      name: 'seller-earnings',
      component: () => import('@/views/SellerEarningsView.vue'),
      meta: { requiresAuth: true },
    },

    // Settings Routes
    {
      path: '/email-settings',
      name: 'email-settings',
      component: EmailSettingsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/payment-settings',
      name: 'payment-settings',
      component: PaymentSettingsView,
      meta: { requiresAuth: true },
    },

    // Certificate and Receipt Routes
    {
      path: '/certificates',
      name: 'certificates',
      component: () => import('@/views/CertificateView.vue'),
      meta: { requiresAuth: true, disallowedRoles: FINANCE_RESTRICTED_ROLES },
    },
    {
      path: '/carbon-calculator',
      name: 'carbon-calculator',
      component: () => import('@/views/CarbonCalculatorView.vue'),
      meta: { requiresAuth: true, disallowedRoles: FINANCE_RESTRICTED_ROLES },
    },
    {
      path: '/receipts',
      name: 'receipts',
      component: () => import('@/views/ReceiptView.vue'),
      meta: { requiresAuth: true, disallowedRoles: FINANCE_RESTRICTED_ROLES },
    },

    // Payment Callback (PayMongo redirects here after payment)
    {
      path: '/payment/callback',
      name: 'payment-callback',
      component: () => import('@/views/PaymentCallbackView.vue'),
      meta: { requiresAuth: true },
    },
    // Mock / legacy completion URL (same handler; session id from localStorage)
    {
      path: '/payment/complete',
      name: 'payment-complete',
      component: () => import('@/views/PaymentCallbackView.vue'),
      meta: { requiresAuth: true },
    },

    // User Preference & Social Routes
    {
      path: '/preferences',
      name: 'preferences',
      component: UserPreferencesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/social',
      name: 'social',
      component: SocialView,
      meta: { requiresAuth: true },
    },
  ],
})

// Router guard for authentication
router.beforeEach(async (to, from, next) => {
  console.log('🔍 Router guard checking:', to.name, 'from:', from.name)

  // Skip auth check for public routes
  const publicRoutes = ['login', 'register', 'homepage', 'home', 'about', 'role-application', 'certificate-verify', 'forgot-password', 'reset-password', 'registry', 'market-dashboard', 'auth-callback', 'biomass-marketplace']
  if (publicRoutes.includes(to.name)) {
    console.log('✅ Public route, allowing access')
    next()
    return
  }

  // Get user store
  const userStore = useUserStore()
  console.log('📊 User store initial state:', {
    loading: userStore.loading,
    authenticated: userStore.isAuthenticated,
    hasSession: !!userStore.session,
  })

  // If store is loading or session is null, fetch session
  // This handles the case where page refresh happens before App.vue onMounted runs
  if (userStore.loading || !userStore.session) {
    console.log('⏳ Initializing session...')

    // Ensure we fetch the session - this handles page refresh scenarios
    if (!userStore.loading) {
      // Only start fetch if not already loading to avoid duplicate calls
      try {
        await userStore.fetchSession()
      } catch (error) {
        console.error('Error fetching session in router guard:', error)
      }
    } else {
      // Wait for existing fetch to complete
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth check timeout')), 3000),
      )

      try {
        await Promise.race([
          new Promise((resolve) => {
            const checkLoading = () => {
              if (!userStore.loading) {
                console.log('✅ Loading completed')
                resolve()
              } else {
                setTimeout(checkLoading, 100) // Check less frequently
              }
            }
            checkLoading()
          }),
          timeout,
        ])
      } catch {
        console.warn('⚠️ Auth check timeout, checking Supabase directly...')

        // Last resort: check Supabase directly if store check times out
        try {
          const { getSession } = await import('@/services/authService')
          const session = await getSession()

          if (session?.user) {
            // Update store with session found in Supabase
            userStore.session = session
            console.log('✅ Session restored from Supabase storage')
            // Also fetch profile to get role
            await userStore.fetchUserProfile()
          }
        } catch (directCheckError) {
          console.error('Direct Supabase check failed:', directCheckError)
        }
      }
    }
  }

  // Final state check after waiting/fetching
  console.log('🔍 Final auth check:', {
    loading: userStore.loading,
    authenticated: userStore.isAuthenticated,
    hasSession: !!userStore.session,
    userEmail: userStore.session?.user?.email,
  })

  // Check if user is authenticated
  if (userStore.isAuthenticated) {
    console.log('✅ User authenticated, allowing access')

    // Strict 2FA enforcement: if the user has MFA enrolled but their session is
    // still at aal1, force them to the step-up page before any protected route.
    if (to.name !== 'mfa-challenge') {
      try {
        const { isMfaRequired } = await import('@/services/mfaService')
        const { required } = await isMfaRequired()
        if (required) {
          console.log('🔐 MFA step-up required, redirecting to challenge')
          next({ name: 'mfa-challenge', query: { returnTo: to.fullPath } })
          return
        }
      } catch (mfaErr) {
        // Fail open on transient errors so users are never locked out.
        console.warn('MFA enforcement check failed (allowing):', mfaErr?.message)
      }
    }

    // Allow homepage access for authenticated users (no redirect)

    // IMPORTANT: Ensure profile is loaded before checking role-specific routes
    // This prevents navigation issues where role isn't loaded yet
    if (to.meta.requiresProjectDeveloper || to.meta.requiresAdmin || to.meta.requiresVerifier || to.meta.requiresLgu || to.meta.requiresFeature) {
      if (!userStore.profile || !userStore.role || userStore.role === 'general_user') {
        console.log('⏳ Profile/role not loaded yet, fetching before route check...')
        try {
          await userStore.fetchUserProfile()
          // Small delay to ensure store is updated
          await new Promise((resolve) => setTimeout(resolve, 150))
        } catch (error) {
          console.error('Error fetching profile in router guard:', error)
        }
      }
    }

    // Check for role-specific route requirements
    if (to.meta.requiresProjectDeveloper) {
      const projectDeveloperGuard = createProjectDeveloperGuard(userStore)
      const guardResult = await projectDeveloperGuard(to, from)
      if (guardResult) {
        console.log('❌ Project Developer access required, redirecting...')
        next(guardResult)
        return
      }
    }

    // Check for LGU-only routes
    if (to.meta.requiresLgu) {
      const lguGuard = createLguGuard(userStore)
      const guardResult = await lguGuard(to, from)
      if (guardResult) {
        console.log('❌ LGU access required, redirecting...')
        next(guardResult)
        return
      }
    }

    // Check for admin-only routes
    if (to.meta.requiresAdmin) {
      const adminGuard = createAdminGuard(userStore)
      const guardResult = await adminGuard(to, from)
      if (guardResult) {
        console.log('❌ Admin access required, redirecting...')
        next(guardResult)
        return
      }
    }

    // Check for verifier-only routes
    if (to.meta.requiresVerifier) {
      const verifierGuard = createVerifierGuard(userStore)
      const guardResult = await verifierGuard(to, from)
      if (guardResult) {
        console.log('❌ Verifier access required, redirecting...')
        next(guardResult)
        return
      }
    }

    const disallowedRoles = Array.isArray(to.meta.disallowedRoles) ? to.meta.disallowedRoles : []
    if (disallowedRoles.length > 0) {
      const normalizedRole = String(userStore.role || userStore.profile?.role || '').toLowerCase().trim()
      if (disallowedRoles.includes(normalizedRole)) {
        console.warn('❌ Route blocked for role:', {
          route: to.path,
          role: normalizedRole,
          disallowedRoles,
        })
        next(getRoleDefaultRoute(normalizedRole || ROLES.GENERAL_USER))
        return
      }
    }

    // Subscription / premium gating (orthogonal to roles). Client-side UX gate
    // only — premium actions are also enforced server-side.
    if (to.meta.requiresFeature && !userStore.hasFeature(to.meta.requiresFeature)) {
      console.log('🔒 Feature not in plan, redirecting to upgrade:', to.meta.requiresFeature)
      next({ name: 'upgrade', query: { feature: to.meta.requiresFeature } })
      return
    }

    next()
  } else {
    // Final check: Try Supabase directly before redirecting to login
    // This handles cases where store hasn't loaded yet but session exists in localStorage
    try {
      const { getSupabase } = await import('@/services/supabaseClient')
      const supabase = getSupabase()
      if (supabase) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (session?.user && !error) {
          console.log('✅ Found session in Supabase, restoring...')
          userStore.session = session
          await userStore.fetchUserProfile()

          // Now that we have session, redirect to role-based route if on homepage
          if (to.name === 'homepage') {
            const { getRoleDefaultRoute } = await import('@/utils/getRoleDefaultRoute')
            const defaultRoute = getRoleDefaultRoute(userStore.role || userStore.profile?.role)
            console.log('✅ Session restored, redirecting to:', defaultRoute)
            next(defaultRoute)
            return
          }

          // Allow access to the requested route
          next()
          return
        }
      }
    } catch (supabaseError) {
      console.warn('⚠️ Could not check Supabase session:', supabaseError)
    }

    // Only redirect to login if we're sure there's no session
    // Don't redirect if user is already on login/register/homepage
    if (to.name !== 'login' && to.name !== 'register' && to.name !== 'homepage') {
      // Add returnTo query param to redirect back after login
      const returnTo = encodeURIComponent(to.fullPath)
      console.log('❌ User not authenticated, redirecting to login')
      next({ name: 'login', query: { returnTo } })
    } else {
      // Allow access to login/register/homepage pages
      next()
    }
  }
})

export default router
