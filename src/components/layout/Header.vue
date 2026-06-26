<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <header class="header">
    <div class="header-container">
      <!-- Mobile Header Layout -->
      <div class="mobile-header-layout">
        <!-- Left Section: Hamburger Menu -->
        <div class="mobile-left-section">
          <button @click="toggleMobileMenu" class="mobile-hamburger-btn">
            <svg class="hamburger-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>
        </div>

        <!-- Center Section: Empty for cleaner look -->
        <div class="mobile-center-section">
          <!-- Search moved to hamburger menu -->
        </div>

        <!-- Right Section: Logo -->
        <div class="mobile-right-section">
          <router-link to="/" class="mobile-logo">
            <img
              src="/carbonify-logo.png"
              alt="Carbonify"
              class="brand-wordmark brand-wordmark--mobile"
            />
          </router-link>
        </div>
      </div>

      <!-- Desktop Navigation (Hidden on Mobile) -->
      <div class="desktop-header-layout">
        <!-- Logo -->
        <router-link to="/" class="logo desktop-logo">
          <img
            src="/carbonify-logo.png"
            alt="Carbonify"
            class="brand-wordmark"
          />
        </router-link>

        <!-- Desktop Navigation -->
        <nav class="desktop-nav">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            :class="['nav-link', { active: isActive(item.path) }]"
          >
            {{ item.label }}
          </router-link>
        </nav>

        <!-- Desktop Actions -->
        <div class="desktop-actions">
        <div v-if="userStore.isAuthenticated" class="notifications-menu">
          <button class="notifications-button" @click="toggleNotificationMenu" type="button">
            <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
            <span v-if="unreadNotificationCount > 0" class="notifications-badge">
              {{ unreadNotificationCount > 99 ? '99+' : unreadNotificationCount }}
            </span>
          </button>
          <div v-if="showNotificationMenu" class="notifications-dropdown">
            <div class="notifications-header-row">
              <strong>Notifications</strong>
              <button
                class="mark-all-read-btn"
                type="button"
                @click="markAllAsRead"
                :disabled="unreadNotificationCount === 0"
              >
                Mark all read
              </button>
            </div>

            <div v-if="notificationItems.length === 0" class="notifications-empty">
              No notifications yet.
            </div>

            <button
              v-for="notification in notificationItems"
              :key="notification.id"
              type="button"
              class="notification-item"
              :class="{ unread: !notification.is_read }"
              @click="openNotification(notification)"
            >
              <span class="notification-title">{{ notification.title }}</span>
              <span class="notification-message">{{ notification.message }}</span>
              <span class="notification-time">{{ formatNotificationTime(notification.created_at) }}</span>
            </button>
          </div>
        </div>

        <div v-if="userStore.isAuthenticated" class="user-menu">
            <div class="user-info">
              <span class="user-name">
                {{ userStore.profile?.full_name || 'User' }}
                <VerifiedBadge v-if="isKycVerified" type="kyc" icon-only />
              </span>
              <span class="user-role">{{ getRoleDisplayName(userStore.role) }}</span>
            </div>
          <div
            class="user-avatar user-avatar-thumb"
            :class="{ 'has-image': showAvatarImage }"
            @click="showUserMenu = !showUserMenu"
          >
            <img
              v-if="showAvatarImage"
              :src="avatarUrl"
              alt="User avatar"
              class="avatar-img"
              @error.stop="onAvatarError"
            />
            <span v-else class="avatar-initials">{{ avatarInitials }}</span>
          </div>
            <!-- User Dropdown Menu -->
            <div v-if="showUserMenu" class="user-dropdown">
              <router-link to="/profile" class="dropdown-item" @click="showUserMenu = false">
                Profile Settings
              </router-link>

              <template v-if="showAccountLinks">
                <div class="dropdown-divider"></div>
                <router-link
                  v-for="link in accountLinks"
                  :key="link.path"
                  :to="link.path"
                  class="dropdown-item"
                  @click="showUserMenu = false"
                >
                  {{ link.label }}
                </router-link>
              </template>

              <!-- Admin Tools moved to Admin Dashboard page -->

              <!-- Hidden for now: Preferences, Analytics, Social Impact -->
              <!-- <router-link to="/preferences" class="dropdown-item" @click="showUserMenu = false">
                Preferences
              </router-link>
              <router-link to="/analytics" class="dropdown-item" @click="showUserMenu = false">
                Analytics
              </router-link>
              <router-link to="/social" class="dropdown-item" @click="showUserMenu = false">
                Social Impact
              </router-link> -->

              <div class="dropdown-divider"></div>
              <button @click="handleLogout" class="dropdown-item logout">Logout</button>
            </div>
          </div>
          <div v-else class="auth-buttons">
            <router-link to="/login" class="auth-link">Login</router-link>
            <router-link to="/register" class="auth-link primary">Sign Up</router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Menu Overlay -->
    <div v-if="mobileMenuOpen" class="mobile-overlay" @click="mobileMenuOpen = false">
      <div class="mobile-menu" @click.stop>
        <div class="mobile-content">
          <!-- Header with Logo and Name -->
          <div
            style="
              padding: 1rem !important;
              background: #e8f5e8 !important;
              border-bottom: 2px solid #4caf50 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: space-between !important;
            "
          >
            <div
              style="
                display: flex !important;
                align-items: center !important;
                gap: 0.75rem !important;
              "
            >
              <img
                src="/carbonify-logo.png"
                alt="Carbonify"
                style="
                  height: 26px !important;
                  width: auto !important;
                  border-radius: 0 !important;
                "
              />
              <h3
                style="
                  margin: 0 !important;
                  color: #2d5a2d !important;
                  font-size: 1.2rem !important;
                  font-weight: 600 !important;
                "
              >
                Carbonify
              </h3>
            </div>
            <button
              @click="mobileMenuOpen = false"
              style="
                background: none !important;
                border: none !important;
                font-size: 1.5rem !important;
                cursor: pointer !important;
                color: #2d5a2d !important;
                padding: 0.25rem !important;
              "
            >
              ×
            </button>
          </div>

          <!-- NAVIGATION LINKS -->
          <div style="padding: 1rem !important; background: white !important">
            <div
              style="
                display: flex !important;
                flex-direction: column !important;
                gap: 0.5rem !important;
              "
            >
              <router-link
                v-for="item in navItems"
                :key="item.path"
                :to="item.path"
                @click="mobileMenuOpen = false"
                style="
                  display: block !important;
                  padding: 0.75rem !important;
                  background: #e8f5e8 !important;
                  border: 1px solid #4caf50 !important;
                  border-radius: 6px !important;
                  text-decoration: none !important;
                  color: #2d5a2d !important;
                  font-weight: 500 !important;
                "
              >
                {{ item.label }}
              </router-link>

              <router-link
                v-if="userStore.isAuthenticated"
                to="/profile"
                @click="mobileMenuOpen = false"
                style="
                  display: block !important;
                  padding: 0.75rem !important;
                  background: #e8f5e8 !important;
                  border: 1px solid #4caf50 !important;
                  border-radius: 6px !important;
                  text-decoration: none !important;
                  color: #2d5a2d !important;
                  font-weight: 500 !important;
                "
              >
                Profile Settings
              </router-link>

              <router-link
                v-for="link in (showAccountLinks ? accountLinks : [])"
                :key="link.path"
                :to="link.path"
                @click="mobileMenuOpen = false"
                style="
                  display: block !important;
                  padding: 0.75rem !important;
                  background: #e8f5e8 !important;
                  border: 1px solid #4caf50 !important;
                  border-radius: 6px !important;
                  text-decoration: none !important;
                  color: #2d5a2d !important;
                  font-weight: 500 !important;
                "
              >
                {{ link.label }}
              </router-link>

              <button
                v-if="userStore.isAuthenticated"
                @click="handleLogout"
                style="
                  display: block !important;
                  padding: 0.75rem !important;
                  background: #fee2e2 !important;
                  border: 1px solid #ef4444 !important;
                  border-radius: 6px !important;
                  text-decoration: none !important;
                  color: #b91c1c !important;
                  font-weight: 600 !important;
                "
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { useCartStore } from '@/store/cartStore'
import { getRoleDisplayName } from '@/constants/roles'
import { getUserInitials } from '@/services/profileService'
import VerifiedBadge from '@/components/ui/VerifiedBadge.vue'
import { getSupabase } from '@/services/supabaseClient'
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notificationService'

const route = useRoute()
const userStore = useUserStore()
const cartStore = useCartStore()
const isKycVerified = computed(() => Number(userStore.profile?.kyc_level) >= 2)

const mobileMenuOpen = ref(false)
const showUserMenu = ref(false)
const showNotificationMenu = ref(false)
const avatarError = ref(false)
const notificationItems = ref([])
const notificationPollTimer = ref(null)
const notificationChannel = ref(null)

// Toggle mobile menu
const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

// Role-based navigation items
const navItems = computed(() => {
  const baseItems = [
    { path: '/', label: 'Home' },
    { path: '/marketplace', label: 'Marketplace' },
    { path: '/registry', label: 'Registry' },
    { path: '/about', label: 'About' },
  ]

  if (!userStore.isAuthenticated) {
    return baseItems
  }

  const items = [...baseItems]

  // About lives in the profile dropdown (accountLinks) for every signed-in role,
  // so drop it from the top nav here. Guests (handled above) keep it in the nav.
  const aboutIndex = items.findIndex((item) => item.path === '/about')
  if (aboutIndex !== -1) items.splice(aboutIndex, 1)

  // Project developers access the map from their profile dropdown instead.
  if (!userStore.isProjectDeveloper) {
    items.push({ path: '/map', label: 'Project Map' })
  }

  const hideFinanceAndCertificateNav =
    userStore.isAdmin || userStore.isVerifier || userStore.isProjectDeveloper

  if (!hideFinanceAndCertificateNav) {
    // Saved, Cart, Wallet, Receipts, Certificates and KYC all live in the profile
    // dropdown (see accountLinks) to keep the top nav uncluttered for buyers.
    // Portfolio (a buyer's owned/retired credits + ESG export) and the Carbon
    // Calculator are prominent enough to keep in the top nav.
    items.push({ path: '/credit-portfolio', label: 'Portfolio' })
    items.push({ path: '/carbon-calculator', label: 'Carbon Calculator' })
  }

  if (userStore.isAdmin) {
    items.push({ path: '/admin', label: 'Admin Dashboard' })
    return items
  }

  if (userStore.isProjectDeveloper) {
    items.push({ path: '/submit-project', label: 'Submit Project' })
    items.push({ path: '/developer/projects', label: 'My Project Dashboard' })
    // Project Map + Monitoring (MRV) live in the profile dropdown (accountLinks).
  }

  if (userStore.isVerifier) {
    items.push({ path: '/verifier', label: 'Verifier Panel' })
  }

  if (userStore.isLguUser) {
    items.push({ path: '/lgu', label: 'LGU Tools' })
  }

  return items
})

// Role-aware links shown under "Profile Settings" in the profile dropdown to
// keep the top nav uncluttered.
const accountLinks = computed(() => {
  if (!userStore.isAuthenticated) return []

  // About sits in the profile dropdown for every signed-in role.
  const aboutLink = { path: '/about', label: 'About' }

  // Project developers: map + monitoring tucked under the profile menu.
  if (userStore.isProjectDeveloper) {
    return [
      { path: '/map', label: 'Project Map' },
      { path: '/monitoring', label: 'Monitoring (MRV)' },
      aboutLink,
    ]
  }

  // Buyers / general users: account pages ordered by importance. KYC gates
  // transacting, so it leads; the relocated About, Saved and Cart sit beneath it
  // alongside the existing wallet, receipts and certificate pages.
  if (!(userStore.isAdmin || userStore.isVerifier)) {
    return [
      { path: '/kyc', label: 'KYC Verification' },
      { path: '/wallet', label: 'Wallet' },
      {
        path: '/cart',
        label: cartStore.count > 0 ? `Cart (${cartStore.count})` : 'Cart',
      },
      { path: '/watchlist', label: 'Saved' },
      { path: '/receipts', label: 'Receipts' },
      { path: '/certificates', label: 'Certificates' },
      aboutLink,
    ]
  }

  // Admins / verifiers: About under the profile menu.
  return [aboutLink]
})

const showAccountLinks = computed(() => accountLinks.value.length > 0)

function isActive(path) {
  return route.path === path
}

function handleLogout() {
  console.log('🚨 LOGOUT BUTTON CLICKED! Starting logout process...')

  // Close the dropdown menu immediately
  showUserMenu.value = false

  // Clear all storage immediately
  try {
    if (typeof window !== 'undefined') {
      // Clear localStorage
      localStorage.clear()
      // Clear sessionStorage
      sessionStorage.clear()
      console.log('Storage cleared')
    }
  } catch (storageError) {
    console.warn('Storage clear error:', storageError)
  }

  // Perform logout from user store (don't wait for it)
  userStore.logout().catch((error) => {
    console.error('User store logout error:', error)
  })

  // Force immediate redirect to login page
  console.log('Redirecting to login page...')

  // Use the most reliable redirect method with a longer delay
  setTimeout(() => {
    console.log('Executing redirect now...')
    try {
      // Force a complete page reload to the login page
      window.location.replace('/login')
      console.log('Redirect initiated successfully')
    } catch (error) {
      console.error('Redirect failed, trying alternative:', error)
      window.location.href = '/login'
    }
  }, 200)
}

const avatarUrl = computed(() => {
  const profileAvatar = userStore.profile?.avatar_url || userStore.profile?.avatarUrl
  const metadata = userStore.session?.user?.user_metadata || {}
  const metadataAvatar = metadata.avatar_url || metadata.avatarUrl || metadata.avatar

  return profileAvatar || metadataAvatar || null
})

const showAvatarImage = computed(() => Boolean(avatarUrl.value && !avatarError.value))

const avatarInitials = computed(() => {
  const metadata = userStore.session?.user?.user_metadata || {}
  const name =
    userStore.profile?.full_name ||
    userStore.profile?.fullName ||
    metadata.full_name ||
    metadata.fullName ||
    metadata.name ||
    ''
  const fallback = userStore.session?.user?.email || 'User'

  return getUserInitials(name || fallback)
})

watch(avatarUrl, () => {
  avatarError.value = false
})

function onAvatarError() {
  avatarError.value = true
}

const unreadNotificationCount = computed(
  () => notificationItems.value.filter((notification) => !notification.is_read).length,
)

async function loadNotifications() {
  const userId = userStore.session?.user?.id
  if (!userStore.isAuthenticated || !userId) {
    notificationItems.value = []
    return
  }

  try {
    notificationItems.value = await getUserNotifications(userId, 20)
  } catch (error) {
    console.error('Failed to load notifications:', error)
  }
}

function stopNotificationSubscription() {
  const supabase = getSupabase()

  if (supabase && notificationChannel.value) {
    supabase.removeChannel(notificationChannel.value)
  }

  notificationChannel.value = null
}

function startNotificationSubscription() {
  stopNotificationSubscription()

  const supabase = getSupabase()
  const userId = userStore.session?.user?.id

  if (!supabase || !userStore.isAuthenticated || !userId) {
    return
  }

  notificationChannel.value = supabase
    .channel(`system_notifications_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'system_notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        loadNotifications()
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'system_notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        loadNotifications()
      },
    )
    .subscribe()
}

async function markAllAsRead() {
  const userId = userStore.session?.user?.id
  if (!userId || unreadNotificationCount.value === 0) return

  try {
    await markAllNotificationsAsRead(userId)
    notificationItems.value = notificationItems.value.map((item) => ({
      ...item,
      is_read: true,
      read_at: item.read_at || new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error)
  }
}

function toggleNotificationMenu() {
  showNotificationMenu.value = !showNotificationMenu.value
  showUserMenu.value = false

  if (showNotificationMenu.value) {
    loadNotifications()
  }
}

async function openNotification(notification) {
  const userId = userStore.session?.user?.id
  if (!notification || !userId) return

  try {
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id, userId)
      notificationItems.value = notificationItems.value.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true, read_at: new Date().toISOString() }
          : item,
      )
    }

    showNotificationMenu.value = false
    const targetPath = notification.link || '/'
    if (route.path !== targetPath) {
      window.location.assign(targetPath)
    }
  } catch (error) {
    console.error('Failed to open notification:', error)
  }
}

function formatNotificationTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function startNotificationPolling() {
  if (notificationPollTimer.value) {
    clearInterval(notificationPollTimer.value)
  }

  if (!userStore.isAuthenticated) {
    return
  }

  notificationPollTimer.value = setInterval(() => {
    loadNotifications()
  }, 15000)
}

onMounted(() => {
  loadNotifications()
  startNotificationPolling()
  startNotificationSubscription()
})

onUnmounted(() => {
  if (notificationPollTimer.value) {
    clearInterval(notificationPollTimer.value)
    notificationPollTimer.value = null
  }

  stopNotificationSubscription()
})

watch(
  () => userStore.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      notificationItems.value = []
      showNotificationMenu.value = false
    } else {
      loadNotifications()
    }
    startNotificationPolling()
    startNotificationSubscription()
  },
)

watch(
  () => userStore.session?.user?.id,
  () => {
    loadNotifications()
    startNotificationSubscription()
  },
)

watch(
  () => route.path,
  () => {
    showNotificationMenu.value = false
    showUserMenu.value = false
    loadNotifications()
  },
)
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  width: 100%;
  border-bottom: 2px solid var(--border-green-light);
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-green);
}

.header-container {
  max-width: 100%;
  margin: 0;
  display: flex;
  height: 5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  position: relative;
  width: 100%;
}

/* Logo */
.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--text-primary);
}

/* Carbonify wordmark logo */
.brand-wordmark {
  height: 2.25rem;
  width: auto;
  display: block;
  margin: 0;
  padding: 0.5rem 1rem;
}

.brand-wordmark--mobile {
  height: 1.9rem;
  padding: 0.25rem 0;
}

.logo-container {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0.5rem 1rem;
  width: auto;
}

.logo-image-container {
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  border: 3px solid #10b981;
  padding: 0.35rem;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  transition: all 0.3s ease;
  margin: 0;
}

.logo-image-container:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
}

.logo-name {
  font-weight: 800;
  font-size: 1.25rem;
  color: #10b981;
  letter-spacing: 0.05em;
  text-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.logo-buildings {
  position: absolute;
  bottom: 0.2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 0.15rem;
}

.building {
  background: #006400;
  border-radius: 0.1rem 0.1rem 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.1rem 0.05rem 0.05rem 0.05rem;
  gap: 0.05rem;
}

.building-left {
  width: 0.4rem;
  height: 0.8rem;
}

.building-right {
  width: 0.3rem;
  height: 0.6rem;
}

.window {
  width: 0.08rem;
  height: 0.08rem;
  background: #90ee90;
  border-radius: 0.02rem;
}

.logo-leaf {
  position: absolute;
  bottom: -0.1rem;
  left: 0.1rem;
  width: 0.3rem;
  height: 0.4rem;
  background: linear-gradient(45deg, #90ee90 0%, #228b22 100%);
  border-radius: 0 100% 0 100%;
  transform: rotate(-45deg);
}

.logo-leaf::before {
  content: '';
  position: absolute;
  top: 0.25rem;
  left: 0.1rem;
  width: 0.05rem;
  height: 0.15rem;
  background: #228b22;
  border-radius: 0.025rem;
}

.sparkles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  background: #90ee90;
  border-radius: 50%;
  animation: sparkle 2s ease-in-out infinite;
}

.sparkle-1 {
  width: 0.08rem;
  height: 0.08rem;
  top: 0.2rem;
  right: 0.3rem;
  animation-delay: 0s;
}

.sparkle-2 {
  width: 0.06rem;
  height: 0.06rem;
  top: 0.4rem;
  left: 0.2rem;
  animation-delay: 0.5s;
}

.sparkle-3 {
  width: 0.05rem;
  height: 0.05rem;
  top: 0.1rem;
  left: 0.4rem;
  animation-delay: 1s;
}

.sparkle-4 {
  width: 0.07rem;
  height: 0.07rem;
  top: 0.5rem;
  right: 0.1rem;
  animation-delay: 1.5s;
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* Desktop Navigation */
.desktop-nav {
  display: none;
  align-items: center;
  gap: 1.5rem;
}

.nav-link {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  text-decoration: none;
  transition: var(--transition);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  position: relative;
}

.nav-link:hover:not(.active) {
  color: var(--primary-color);
  background: var(--bg-green-light);
  transform: translateY(-1px);
}

.nav-link.active {
  color: var(--text-light);
  background: var(--primary-color);
  font-weight: 600;
  box-shadow: var(--shadow-green);
}

.nav-link.active:hover {
  background: var(--primary-hover);
  color: var(--text-light);
}

/* Admin navigation items removed - admin features accessible via profile dropdown */

/* Desktop Actions */
.desktop-actions {
  display: none;
  align-items: center;
  gap: 1rem;
  margin: 0;
  padding: 0.5rem 1rem;
  width: auto;
}

.notifications-menu {
  position: relative;
}

.notifications-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  position: relative;
}

.notifications-button .material-symbols-outlined {
  font-size: 1.2rem;
}

.notifications-badge {
  position: absolute;
  top: -0.25rem;
  right: -0.35rem;
  min-width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: #dc2626;
  color: #fff;
  font-size: 0.6rem;
  line-height: 1rem;
  padding: 0 0.2rem;
  font-weight: 700;
}

.notifications-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: min(340px, calc(100vw - 1rem));
  max-height: 380px;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.notifications-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid var(--border-light);
}

.mark-all-read-btn {
  border: none;
  background: transparent;
  color: var(--primary-color);
  font-size: 0.75rem;
  cursor: pointer;
}

.mark-all-read-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.notifications-empty {
  padding: 1rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.notification-item {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  display: grid;
  gap: 0.25rem;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item.unread {
  background: rgba(16, 185, 129, 0.08);
}

.notification-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.notification-message {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.notification-time {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.user-menu {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.user-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.user-role {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: capitalize;
}

.user-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
}

.user-avatar-thumb {
  overflow: hidden;
  position: relative;
  color: var(--text-light);
  font-weight: 600;
}

.user-avatar-thumb.has-image {
  background: transparent;
}

.user-avatar-thumb .avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.user-avatar-thumb .avatar-initials {
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.03em;
}

.user-avatar:hover {
  background: var(--bg-accent);
}

.avatar-icon {
  width: 1rem;
  height: 1rem;
  color: var(--text-muted);
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  min-width: 14rem;
  max-width: 18rem;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  text-decoration: none;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  transition: var(--transition);
  border-bottom: 1px solid var(--border-light);
  box-sizing: border-box;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: var(--bg-secondary);
  color: var(--primary-color);
}

.dropdown-item.logout {
  color: var(--text-muted);
}

.dropdown-item.logout:hover {
  color: #dc2626;
  background: #fef2f2;
}

/* Admin Dropdown Items */
.dropdown-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0.5rem 0;
}

.dropdown-section-title {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f3f4f6;
  border-bottom: 1px solid #d1d5db;
}

.dropdown-item.admin-item {
  background: #f9fafb;
  color: #4b5563;
  border-left: 3px solid #9ca3af;
  font-weight: 500;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item.admin-item:hover {
  background: #e5e7eb;
  color: #374151;
  border-left-color: #6b7280;
}

.auth-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.auth-link {
  padding: 0.5rem 0.75rem;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  text-decoration: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: var(--transition);
}

.auth-link:hover {
  background: var(--bg-accent);
}

.auth-link.primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.auth-link.primary:hover {
  background: var(--primary-hover);
}

/* Mobile Header Layout */
.mobile-header-layout {
  display: none;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0;
  padding: 0;
  margin: 0;
}

/* Show mobile header on mobile screens */
@media (max-width: 1024px) {
  .mobile-header-layout {
    display: flex !important;
  }
}

.mobile-left-section {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  margin: 0;
  padding: 0.5rem 1rem;
  width: auto;
}

.mobile-hamburger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: var(--transition);
  border-radius: var(--radius-md);
}

.mobile-hamburger-btn:hover {
  background: var(--bg-accent);
  color: var(--primary-color);
}

.hamburger-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--text-primary);
}

.mobile-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.mobile-logo-container {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 3px solid #10b981;
  padding: 0.3rem;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}

.mobile-logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
}

.mobile-home-btn {
  background: var(--primary-color);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-lg);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.875rem;
  transition: var(--transition);
  white-space: nowrap;
}

.mobile-home-btn:hover {
  background: var(--primary-hover);
  color: white;
}

/* Mobile center section - empty for cleaner header */
.mobile-center-section {
  flex: 1;
}

.mobile-right-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  margin: 0;
  padding: 0.5rem 1rem;
  width: auto;
}

/* Removed old mobile user section styles - now integrated into hamburger menu */

/* Desktop Header Layout */
.desktop-header-layout {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

/* Hide desktop header on mobile */
@media (max-width: 1024px) {
  .desktop-header-layout {
    display: none !important;
  }
}

/* Mobile Actions Container */
.mobile-actions-left {
  display: none;
}

@media (max-width: 1024px) {
  .mobile-actions-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: absolute;
    top: 50%;
    left: var(--spacing-md);
    transform: translateY(-50%);
  }

  /* Hide logo on mobile */
  .desktop-logo {
    display: none;
  }
}

/* Extra small screens */
@media (max-width: 480px) {
  .mobile-header-layout {
    padding: 0.25rem 0;
    gap: 0.25rem;
  }

  .mobile-left-section {
    gap: 0.5rem;
  }

  .mobile-logo-container {
    width: 1.75rem;
    height: 1.75rem;
  }

  .mobile-home-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
  }

  .mobile-nav-item {
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
  }

  .mobile-user-name {
    font-size: 0.7rem;
  }

  .mobile-user-role {
    font-size: 0.65rem;
  }

  .mobile-user-avatar {
    width: 1.5rem;
    height: 1.5rem;
  }

  .mobile-avatar-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .mobile-auth-link {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  .notifications-dropdown {
    right: -0.25rem;
    width: min(320px, calc(100vw - 0.75rem));
    max-height: min(70vh, 380px);
  }
}

/* Clean Mobile Menu Styles */
.mobile-menu-header-clean {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: #e8f5e8;
  border-radius: 8px;
  margin-bottom: 1rem;
  border-bottom: 2px solid #4caf50;
}

.mobile-menu-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mobile-menu-title h3 {
  margin: 0;
  color: #2d5a2d;
  font-size: 1.1rem;
  font-weight: 600;
}

.mobile-menu-logo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.mobile-close-btn {
  background: none;
  border: none;
  color: #2d5a2d;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background 0.2s ease;
}

.mobile-close-btn:hover {
  background: rgba(45, 90, 45, 0.1);
}

.mobile-user-section-clean {
  margin-bottom: 1.5rem;
}

.user-info-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #e8f5e8;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: #4caf50;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  color: white;
  font-weight: bold;
  font-size: 1.1rem;
}

.user-details {
  flex: 1;
}

.user-name {
  font-weight: 600;
  color: #2d5a2d;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.user-role {
  font-size: 0.8rem;
  color: #666;
}

.nav-section-title {
  color: #2d5a2d;
  font-size: 0.9rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-links-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mobile-nav-link-clean {
  display: flex !important;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  text-decoration: none;
  color: #333;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.mobile-nav-link-clean:hover {
  background: #e8f5e8;
  border-color: #4caf50;
  color: #2d5a2d;
  transform: translateX(4px);
}

.nav-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.section-divider {
  height: 1px;
  background: #e9ecef;
  margin: 1rem 0;
}

.mobile-auth-section-clean {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

.logout-btn-clean {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-btn-clean:hover {
  background: #fecaca;
  transform: translateX(4px);
}

.login-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.login-link {
  background: #e8f5e8 !important;
  border-color: #e9ecef !important;
}

.signup-link {
  background: #4caf50 !important;
  border-color: #4caf50 !important;
  color: white !important;
}

.signup-link:hover {
  background: #45a049 !important;
  color: white !important;
}

/* Very small screens adjustments */
@media (max-width: 360px) {
  .mobile-left-section,
  .mobile-right-section {
    padding: 0.5rem 0.75rem;
  }

  .mobile-logo-container {
    width: 2rem;
    height: 2rem;
  }

  .mobile-menu {
    width: 260px;
  }

  .mobile-menu-header-clean {
    padding: 0.75rem;
  }

  .mobile-search-clean {
    padding: 0.75rem;
  }

  .user-info-header {
    padding: 0.75rem;
  }

  .mobile-nav-link-clean {
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
  }

  .mobile-profile-header {
    padding: 0.5rem 0.75rem;
  }

  .mobile-profile-name {
    font-size: 1rem;
  }

  .mobile-nav-link {
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
  }
}

/* Mobile Menu Button */
.mobile-menu-button {
  display: none;
}

@media (max-width: 1024px) {
  .mobile-menu-button {
    display: block;
  }
}

/* Mobile Home Button */
.mobile-home-button {
  display: none;
}

@media (max-width: 1024px) {
  .mobile-home-button {
    display: block;
  }
}

.menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: var(--transition);
  border-radius: var(--radius-md);
}

.menu-toggle:hover {
  background: var(--bg-accent);
  color: var(--primary-color);
}

.menu-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-primary);
}

.home-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: var(--transition);
  border-radius: var(--radius-md);
  text-decoration: none;
}

.home-button:hover {
  background: var(--bg-accent);
  color: var(--primary-color);
}

.home-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-primary);
}

/* Mobile Menu Overlay */
.mobile-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 9999 !important;
  background: rgba(0, 0, 0, 0.5) !important;
  display: flex !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
}

.mobile-menu {
  position: relative !important;
  width: 300px !important;
  max-width: 90vw !important;
  height: 100vh !important;
  background: white !important;
  border-right: 2px solid #4caf50 !important;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
  z-index: 10000 !important;
  overflow-y: auto !important;
  display: flex !important;
  flex-direction: column !important;
}

.mobile-content {
  display: flex !important;
  flex-direction: column;
  background: white !important;
  flex: 1;
  overflow-y: auto;
  width: 100%;
  height: 100%;
}

.mobile-header {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 2px solid #4caf50;
  margin-bottom: 1rem;
  background: #e8f5e8 !important;
  border-radius: 8px;
}

.mobile-title-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mobile-logo {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid #10b981;
  padding: 0.2rem;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
}

.mobile-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--primary-color);
  margin: 0;
}

.mobile-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
}

.mobile-close:hover {
  background: var(--bg-green-light);
  color: var(--primary-color);
}

.close-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.mobile-nav {
  display: flex !important;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
  flex: 1;
  overflow-y: auto;
  background: #f9f9f9 !important;
  border-radius: 8px;
  margin: 0.5rem 0;
}

.mobile-nav-link {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  color: #333;
  text-decoration: none;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.9rem;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  margin: 0.25rem 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 2.5rem;
}

.mobile-nav-link:hover {
  background: #e8f5e8;
  color: #2d5a2d;
  border-color: #4caf50;
  transform: translateX(4px);
}

.mobile-nav-link.active {
  background: var(--primary-color);
  color: white;
  font-weight: 600;
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(6, 158, 45, 0.2);
}

/* Mobile User Profile Section */
.mobile-user-profile {
  margin-bottom: 0.5rem;
}

.mobile-profile-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--primary-light);
  border-radius: var(--radius-md);
  margin: 0 0.5rem 0.5rem 0.5rem;
}

.mobile-profile-avatar {
  width: 3rem;
  height: 3rem;
  background: var(--primary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-avatar-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: white;
}

.mobile-profile-info {
  flex: 1;
}

.mobile-profile-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.mobile-profile-role {
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.mobile-profile-links {
  margin-bottom: 0.5rem;
}

.mobile-nav-link.profile-link {
  background: var(--bg-muted);
  border-color: var(--border-light);
  margin: 0.125rem 0.5rem;
  font-size: 0.85rem;
  padding: 0.5rem 0.75rem;
  min-height: 2rem;
}

.mobile-nav-link.profile-link:hover {
  background: var(--primary-lighter);
  border-color: var(--primary-color);
}

.mobile-profile-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0.5rem 1rem;
}

/* Mobile Auth Section */
.mobile-auth-section {
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.mobile-nav-link.logout-link {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
  margin: 0.25rem 0.5rem;
}

.mobile-nav-link.logout-link:hover {
  background: #fecaca;
  border-color: #dc2626;
}

.mobile-nav-link.auth-link {
  margin: 0.25rem 0.5rem;
}

.mobile-nav-link.auth-link.primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.mobile-nav-link.auth-link.primary:hover {
  background: var(--primary-hover);
}

/* Responsive Design */
@media (min-width: 768px) {
  .desktop-nav {
    display: flex;
  }

  .desktop-actions {
    display: flex;
  }

  .mobile-menu-button {
    display: none;
  }
}

/* Mobile Styles */
@media (max-width: 1024px) {
  .mobile-menu-button {
    display: block;
  }

  .desktop-nav {
    display: none;
  }

  .desktop-actions {
    display: none;
  }
}
</style>
