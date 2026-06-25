<template>
  <div class="marketplace">
    <!-- Header Section -->
    <div class="marketplace-header">
      <div class="container">
        <h1 class="page-title">Carbon Credit Marketplace</h1>
        <p class="page-description">
          Discover and purchase verified carbon credits from projects worldwide
        </p>

        <!-- Main Search Bar -->
        <div class="main-search">
          <div class="search-wrapper">
            <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
            <input
              v-model="searchQuery"
              placeholder="Search projects..."
              class="search-input"
              @input="handleSearch"
            />
          </div>
        </div>

        <!-- Admin Controls -->
        <div v-if="userStore.isAdmin || userStore.role === 'admin'" class="admin-controls">
          <button
            @click="showAdminDelete = !showAdminDelete"
            class="admin-btn"
            :class="{ active: showAdminDelete }"
          >
            🗑️ Admin Delete Mode
          </button>
          <button
            v-if="showAdminDelete && selectedListings.length > 0"
            @click="bulkDeleteListings()"
            class="danger-btn"
          >
            Delete {{ selectedListings.length }} Projects
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="marketplace-content">
      <div class="container">
        <div class="content-layout">
          <!-- Filters Sidebar -->
          <div class="filters-sidebar">
            <div class="filters-card">
              <h3 class="filters-title">Filters</h3>

              <!-- Category Filter -->
              <div class="filter-section">
                <h4 class="filter-label">Category</h4>
                <div class="filter-options">
                  <label v-for="category in categories" :key="category.value" class="filter-option">
                    <input
                      type="radio"
                      :value="category.value"
                      v-model="selectedCategory"
                      @change="applyFilters"
                      class="filter-radio"
                    />
                    <span class="filter-text">{{ category.label }}</span>
                    <span v-if="category.value === selectedCategory" class="checkmark">✓</span>
                  </label>
                </div>
              </div>

              <!-- Country Filter -->
              <div class="filter-section">
                <h4 class="filter-label">Country</h4>
                <select v-model="selectedCountry" @change="applyFilters" class="filter-select">
                  <option value="">All</option>
                  <option v-for="country in countries" :key="country" :value="country">
                    {{ country }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Projects Content -->
          <div class="projects-content">
            <!-- Results Header -->
            <div class="results-header">
              <div class="results-info">
                <span class="results-count"
                  >Showing {{ filteredListings.length }} credit listings</span
                >
              </div>
              <div class="sort-dropdown">
                <select v-model="sortBy" @change="applySorting" class="sort-select">
                  <option value="name">Sort by Name</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="tonnes">Credits Available</option>
                  <option value="year">Year</option>
                </select>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="loading-state">
              <div class="loading-spinner"></div>
              <p>Loading marketplace listings...</p>
              <div class="loading-skeleton">
                <div class="skeleton-card" v-for="n in 6" :key="n">
                  <div class="skeleton-image"></div>
                  <div class="skeleton-content">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="error-state">
              <div class="error-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 3.25 3.75 19.5h16.5L12 3.25Z" stroke-linejoin="round" />
                  <path d="M12 9v4.5" stroke-linecap="round" />
                  <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <h3>Error Loading Marketplace</h3>
              <p>{{ error }}</p>
              <button @click="refreshMarketplaceData" class="retry-button">Retry</button>
            </div>

            <!-- Empty State -->
            <div v-else-if="filteredListings.length === 0" class="empty-state">
              <div class="empty-icon" aria-hidden="true">
                <span class="material-symbols-outlined">forest</span>
              </div>
              <h3>No Credit Listings Found</h3>
              <p v-if="listings.length === 0">
                No carbon credits are currently available for purchase.
              </p>
              <p v-else>
                No listings match your current filters. Try adjusting your search criteria.
              </p>
            </div>

            <!-- Admin Bulk Selection Controls -->
            <div
              v-if="(userStore.isAdmin || userStore.role === 'admin') && showAdminDelete"
              class="admin-bulk-controls"
            >
              <div class="bulk-actions">
                <button @click="selectAllListings()" class="bulk-btn">
                  Select All ({{ filteredListings.length }})
                </button>
                <button @click="clearSelection()" class="bulk-btn">Clear Selection</button>
                <span class="selection-count"> {{ selectedListings.length }} selected </span>
              </div>
            </div>

            <!-- Listings Grid -->
            <div v-else class="projects-grid">
              <div
                v-for="listing in filteredListings"
                :key="listing.listing_id"
                class="project-card"
                :class="{
                  'admin-selected': showAdminDelete && selectedListings.includes(listing.listing_id),
                }"
              >
                <!-- Admin Selection Checkbox -->
                <div
                  v-if="(userStore.isAdmin || userStore.role === 'admin') && showAdminDelete"
                  class="admin-selection"
                  @click.stop
                >
                  <input
                    type="checkbox"
                    :checked="selectedListings.includes(listing.listing_id)"
                    @change="toggleListingSelection(listing.listing_id)"
                    class="admin-checkbox"
                  />
                  <span class="admin-label">Select for deletion</span>
                </div>

                <div class="project-image">
                  <img
                    v-if="listing.project_image"
                    :src="listing.project_image"
                    :alt="listing.project_title"
                  />
                  <img
                    v-else
                    :src="`https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=250&fit=crop&${listing.listing_id}`"
                    :alt="listing.project_title"
                  />
                  <div
                    class="category-badge"
                    :class="listing.category.toLowerCase().replace(' ', '-')"
                  >
                    {{ listing.category }}
                  </div>
                  <div class="vintage-badge">{{ listing.vintage_year }}</div>
                </div>

                <div class="project-content">
                  <h3 class="project-title">{{ listing.project_title }}</h3>
                  <div class="project-price">
                    <span class="price">{{
                      formatCurrency(listing.price_per_credit, listing.currency)
                    }}</span>
                    <span class="price-unit">per credit</span>
                  </div>
                  <p class="project-description">{{ listing.project_description }}</p>

                  <div class="project-details">
                    <div class="detail-item">
                      <span class="material-symbols-outlined detail-icon" aria-hidden="true">location_on</span>
                      <span class="detail-text">{{ listing.location }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="material-symbols-outlined detail-icon" aria-hidden="true">category</span>
                      <span class="detail-text">{{ listing.category }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="material-symbols-outlined detail-icon" aria-hidden="true">inventory_2</span>
                      <span class="detail-text">{{ formatNumber(listing.available_quantity) }} credits available</span>
                    </div>
                    <div class="detail-item">
                      <span class="material-symbols-outlined detail-icon" aria-hidden="true">verified</span>
                      <span class="detail-text">{{ listing.verification_standard }} Verified</span>
                    </div>
                  </div>

                  <div class="seller-info">
                    <span class="seller-label">Sold by:</span>
                    <span class="seller-name">{{ listing.seller_name }}</span>
                  </div>

                  <div class="card-actions">
                    <button class="learn-more-button" @click="viewProject(listing)">
                      Learn More
                    </button>
                    <button
                      class="purchase-button"
                      @click="showPurchaseModalFor(listing)"
                      :disabled="listing.available_quantity <= 0"
                    >
                      {{ listing.available_quantity > 0 ? 'Purchase Credits' : 'Sold Out' }}
                    </button>

                    <!-- Admin Delete Button -->
                    <button
                      v-if="userStore.isAdmin || userStore.role === 'admin'"
                      class="admin-delete-button"
                      @click="adminDeleteListing(listing)"
                    >
                      <span class="material-symbols-outlined" aria-hidden="true">delete_forever</span>
                      <span>Admin Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Purchase Modal -->
    <div v-if="showPurchaseModal" class="modal-overlay" @click="closePurchaseModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Purchase Credits</h3>
          <button class="modal-close" @click="closePurchaseModal">×</button>
        </div>

        <div v-if="selectedListing" class="modal-body">
          <div class="purchase-project-info">
            <h4>{{ selectedListing.project_title }}</h4>
            <p class="project-location">{{ selectedListing.location }}</p>
            <p class="project-category">{{ selectedListing.category }}</p>
          </div>

          <div class="purchase-details">
            <div class="quantity-section">
              <label class="form-label">Quantity:</label>
              <input
                v-model.number="purchaseQuantity"
                type="number"
                min="1"
                :max="selectedListing.available_quantity"
                class="form-input"
                placeholder="Enter quantity"
              />
              <small class="input-help"
                >Available: {{ selectedListing.available_quantity }} credits</small
              >
            </div>

            <div class="payment-section">
              <label class="form-label">Payment Method:</label>
              <div class="payment-options">
                <label class="payment-option">
                  <input
                    v-model="selectedPaymentMethod"
                    type="radio"
                    value="gcash"
                    name="payment"
                  />
                  <span class="payment-label">📱 GCash</span>
                </label>
                <label class="payment-option">
                  <input v-model="selectedPaymentMethod" type="radio" value="maya" name="payment" />
                  <span class="payment-label">💳 Maya</span>
                </label>
              </div>
            </div>

            <div class="purchase-summary">
              <div class="summary-row">
                <span>Price per credit:</span>
                <span>{{ formatCurrency(selectedListing.price_per_credit) }}</span>
              </div>
              <div class="summary-row">
                <span>Quantity:</span>
                <span>{{ purchaseQuantity }}</span>
              </div>
              <div class="summary-row total">
                <span>Total:</span>
                <span>{{
                  formatCurrency(selectedListing.price_per_credit * purchaseQuantity)
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closePurchaseModal">Cancel</button>
          <button
            class="btn btn-primary"
            @click="handlePurchase"
            :disabled="!selectedPaymentMethod || purchaseLoading || purchaseQuantity <= 0"
          >
            {{ purchaseLoading ? 'Processing...' : 'Complete Purchase' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import {
  getMarketplaceListings,
  getMarketplaceStats,
  purchaseCredits,
} from '@/services/marketplaceService'
import { getSimpleMarketplaceListings } from '@/services/simpleMarketplaceService'
import { projectService } from '@/services/projectService'

export default {
  name: 'MarketplaceViewFixed',
  setup() {
    const router = useRouter()
    const userStore = useUserStore()

    // State
    const listings = ref([])
    const loading = ref(false)
    const error = ref('')
    const marketplaceStats = ref({
      totalListings: 0,
      totalCreditsAvailable: 0,
      totalMarketValue: 0,
      recentTransactions: 0,
    })

    // Filters and search
    const searchQuery = ref('')
    const selectedCategory = ref('all')
    const selectedCountry = ref('')
    const sortBy = ref('name')

    // Admin state
    const selectedListings = ref([])
    const showAdminDelete = ref(false)

    // Purchase state
    const showPurchaseModal = ref(false)
    const selectedListing = ref(null)
    const purchaseQuantity = ref(1)
    const purchaseLoading = ref(false)
    const selectedPaymentMethod = ref('')

    // Options
    const categories = computed(() => {
      const availableCategories = Array.from(
        new Set(
          listings.value
            .map((listing) => listing.category)
            .filter((category) => typeof category === 'string' && category.trim().length > 0)
            .map((category) => category.trim()),
        ),
      ).sort((a, b) => a.localeCompare(b))

      return [
        { value: 'all', label: 'All Categories' },
        ...availableCategories.map((category) => ({
          value: category,
          label: category,
        })),
      ]
    })

    const countries = computed(() =>
      Array.from(
        new Set(
          listings.value
            .map((listing) => listing.location)
            .filter((location) => typeof location === 'string' && location.trim().length > 0)
            .map((location) => location.trim()),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    )

    // Computed properties
    const filteredListings = computed(() => {
      let filtered = listings.value

      // Search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(
          (listing) =>
            listing.project_title.toLowerCase().includes(query) ||
            listing.project_description.toLowerCase().includes(query) ||
            listing.location.toLowerCase().includes(query),
        )
      }

      // Category filter
      if (selectedCategory.value !== 'all') {
        filtered = filtered.filter((listing) => listing.category === selectedCategory.value)
      }

      // Country filter
      if (selectedCountry.value) {
        filtered = filtered.filter((listing) =>
          listing.location.toLowerCase().includes(selectedCountry.value.toLowerCase()),
        )
      }

      // Apply sorting
      return applySorting(filtered)
    })

    // Purchase methods
    function showPurchaseModalFor(listing) {
      if (!userStore.isAuthenticated) {
        router.push('/login')
        return
      }

      selectedListing.value = listing
      purchaseQuantity.value = Math.min(1, listing.available_quantity)
      showPurchaseModal.value = true
    }

    function closePurchaseModal() {
      showPurchaseModal.value = false
      selectedListing.value = null
      purchaseQuantity.value = 1
      selectedPaymentMethod.value = ''
    }

    async function handlePurchase() {
      if (!selectedListing.value || purchaseQuantity.value <= 0) return
      if (!selectedPaymentMethod.value) {
        alert('Please select a payment method!')
        return
      }

      purchaseLoading.value = true

      try {
        console.log('🛒 Processing marketplace purchase:', {
          listing: selectedListing.value,
          quantity: purchaseQuantity.value,
          paymentMethod: selectedPaymentMethod.value,
        })

        const purchaseData = {
          quantity: purchaseQuantity.value,
          paymentMethod: selectedPaymentMethod.value,
          paymentData: {
            amount: selectedListing.value.price_per_credit * purchaseQuantity.value,
            currency: selectedListing.value.currency || 'PHP',
            description: `Purchase ${purchaseQuantity.value} credits from ${selectedListing.value.project_title}`,
          },
        }

        const result = await purchaseCredits(selectedListing.value.listing_id, purchaseData)

        console.log('✅ Purchase completed:', result)

        // Show success message
        alert(
          `Purchase successful!\n\n✅ ${result.credits_purchased} credits purchased\n💰 Total cost: ${result.currency} ${result.total_cost.toFixed(2)}\n\nCredits have been added to your portfolio.`,
        )

        // Close modal and reload data
        closePurchaseModal()
        await loadMarketplaceData()
      } catch (err) {
        console.error('❌ Purchase error:', err)
        alert(`Purchase failed: ${err.message || 'Please try again.'}`)
      } finally {
        purchaseLoading.value = false
      }
    }

    // Methods
    async function loadMarketplaceData() {
      console.log('🔍 Loading marketplace data with real database queries...')
      loading.value = true
      error.value = ''

      // Add timeout protection to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      )

      try {
        const filters = {
          category: selectedCategory.value !== 'all' ? selectedCategory.value : null,
          country: selectedCountry.value,
          search: searchQuery.value,
        }

        console.log('📊 Fetching listings with filters:', filters)

        // Use the real marketplace service with step-by-step approach
        let listingsData, statsData

        try {
          // Race against timeout
          ;[listingsData, statsData] = await Promise.race([
            Promise.all([
              getMarketplaceListings({ forceRefresh: true }),
              getMarketplaceStats(),
            ]),
            timeoutPromise,
          ])
        } catch (error) {
          // If timeout, throw immediately
          if (error.message?.includes('timeout')) {
            throw error
          }
          console.warn('⚠️ Main marketplace service failed, trying simple approach:', error)
          // Fallback to simple marketplace service with timeout
          listingsData = await Promise.race([
            getSimpleMarketplaceListings({ forceRefresh: true }),
            timeoutPromise,
          ])
          statsData = {
            totalListings: listingsData?.length || 0,
            totalCreditsAvailable:
              listingsData?.reduce((sum, listing) => sum + (listing.available_quantity || 0), 0) ||
              0,
            totalMarketValue:
              listingsData?.reduce(
                (sum, listing) =>
                  sum + (listing.price_per_credit * listing.available_quantity || 0),
                0,
              ) || 0,
            recentTransactions: 0,
          }
        }

        console.log('✅ Received listings data:', listingsData?.length || 0, 'listings')
        console.log('✅ Received stats data:', statsData)

        listings.value = listingsData || []
        marketplaceStats.value = statsData
      } catch (err) {
        console.error('Error loading marketplace data:', err)
        if (err.message?.includes('timeout')) {
          error.value = 'Request timed out. Please check your connection and try again.'
        } else {
          error.value = 'Failed to load marketplace data. Please try again.'
        }
        listings.value = []
        marketplaceStats.value = {
          totalListings: 0,
          totalCreditsAvailable: 0,
          totalMarketValue: 0,
          recentTransactions: 0,
        }
      } finally {
        loading.value = false
      }
    }

    function handleSearch() {}

    function applyFilters() {}

    function refreshMarketplaceData() {
      return loadMarketplaceData()
    }

    function applySorting(listings) {
      const sorted = [...listings]

      switch (sortBy.value) {
        case 'name':
          return sorted.sort((a, b) => a.project_title.localeCompare(b.project_title))
        case 'price-low':
          return sorted.sort((a, b) => a.price_per_credit - b.price_per_credit)
        case 'price-high':
          return sorted.sort((a, b) => b.price_per_credit - a.price_per_credit)
        case 'tonnes':
          return sorted.sort((a, b) => b.available_quantity - a.available_quantity)
        case 'year':
          return sorted.sort((a, b) => b.vintage_year - a.vintage_year)
        default:
          return sorted
      }
    }

    function viewProject(listing) {
      // Navigate to project detail page
      router.push(`/project/${listing.project_id}`)
    }

    function formatCurrency(amount, currency = 'PHP') {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: currency,
      }).format(amount)
    }

    function formatNumber(number) {
      return new Intl.NumberFormat('en-US').format(number)
    }

    // Admin functions
    function toggleListingSelection(listingId) {
      const index = selectedListings.value.indexOf(listingId)
      if (index > -1) {
        selectedListings.value.splice(index, 1)
      } else {
        selectedListings.value.push(listingId)
      }
    }

    function selectAllListings() {
      selectedListings.value = filteredListings.value.map((l) => l.listing_id)
    }

    function clearSelection() {
      selectedListings.value = []
    }

    async function adminDeleteListing(listing) {
      if (
        !confirm(
          `WARNING: Are you sure you want to delete "${listing.project_title}" from the marketplace? This will remove the project from public view.`,
        )
      ) {
        return
      }

      try {
        // Delete the project (which will cascade to listings)
        await projectService.adminDeleteProject(listing.project_id)
        await loadMarketplaceData()
        console.log('Successfully deleted project from marketplace')
      } catch (err) {
        console.error('Error deleting project from marketplace:', err)
        alert('Failed to delete project from marketplace')
      }
    }

    async function bulkDeleteListings() {
      if (selectedListings.value.length === 0) {
        alert('No listings selected')
        return
      }

      const listingNames = selectedListings.value
        .map((id) => {
          const listing = listings.value.find((l) => l.listing_id === id)
          return listing ? listing.project_title : 'Unknown'
        })
        .join(', ')

      if (
        !confirm(
          `WARNING: Are you sure you want to delete ${selectedListings.value.length} projects from the marketplace?\n\nProjects: ${listingNames}\n\nThis action cannot be undone!`,
        )
      ) {
        return
      }

      try {
        const projectIds = selectedListings.value
          .map((id) => {
            const listing = listings.value.find((l) => l.listing_id === id)
            return listing ? listing.project_id : null
          })
          .filter((id) => id !== null)

        const results = await projectService.adminDeleteMultipleProjects(projectIds)

        if (results.success > 0) {
          console.log(`Successfully deleted ${results.success} projects from marketplace`)
        }

        if (results.failed > 0) {
          console.error(`Failed to delete ${results.failed} projects:`, results.errors)
          alert(`Failed to delete ${results.failed} projects. Check console for details.`)
        }

        await loadMarketplaceData()
        clearSelection()
        showAdminDelete.value = false
      } catch (err) {
        console.error('Error bulk deleting projects:', err)
        alert('Failed to delete projects from marketplace')
      }
    }

    watch(categories, (nextCategories) => {
      const hasSelectedCategory = nextCategories.some(
        (category) => category.value === selectedCategory.value,
      )

      if (!hasSelectedCategory) {
        selectedCategory.value = 'all'
      }
    })

    watch(countries, (nextCountries) => {
      if (selectedCountry.value && !nextCountries.includes(selectedCountry.value)) {
        selectedCountry.value = ''
      }
    })

    // Lifecycle
    onMounted(async () => {
      console.log('Marketplace mounted, loading data...')

      // Debug admin role detection
      console.log('🔍 Admin Debug Info (Marketplace):')
      console.log('- userStore.role:', userStore.role)
      console.log('- userStore.isAdmin:', userStore.isAdmin)

      await loadMarketplaceData()
      console.log('Marketplace data loaded:', listings.value.length, 'listings')
    })

    return {
      listings,
      loading,
      error,
      marketplaceStats,
      searchQuery,
      selectedCategory,
      selectedCountry,
      sortBy,
      categories,
      countries,
      filteredListings,
      loadMarketplaceData,
      refreshMarketplaceData,
      handleSearch,
      applyFilters,
      applySorting,
      viewProject,
      showPurchaseModalFor,
      formatCurrency,
      formatNumber,
      // Purchase functions
      showPurchaseModal,
      selectedListing,
      purchaseQuantity,
      purchaseLoading,
      selectedPaymentMethod,
      closePurchaseModal,
      handlePurchase,
      // Admin functions
      selectedListings,
      showAdminDelete,
      toggleListingSelection,
      selectAllListings,
      clearSelection,
      adminDeleteListing,
      bulkDeleteListings,
    }
  },
}
</script>

<style scoped>
.marketplace {
  min-height: 100vh;
  background: var(--bg-primary);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}

/* Header Section */
.marketplace-header {
  padding: 2rem 0;
  border-bottom: 1px solid var(--border-color);
}

.page-title {
  font-size: var(--font-size-4xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  text-align: center;
}

.page-description {
  font-size: var(--font-size-lg);
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 2rem;
}

.main-search {
  max-width: 32rem;
  margin: 0 auto;
}

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 3rem;
  font-size: var(--font-size-base);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  outline: none;
  transition: var(--transition);
}

.search-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(6, 158, 45, 0.1);
}

/* Main Content */
.marketplace-content {
  padding: 2rem 0;
}

.content-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
}

/* Filters Sidebar */
.filters-sidebar {
  position: sticky;
  top: 2rem;
  height: fit-content;
}

.filters-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.filters-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.filter-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  display: block;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.25rem 0;
}

.filter-radio {
  width: 1rem;
  height: 1rem;
  accent-color: var(--primary-color);
}

.filter-text {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.checkmark {
  color: var(--primary-color);
  font-weight: 600;
}

.filter-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  outline: none;
}

/* Projects Content */
.projects-content {
  min-height: 500px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.results-count {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 500;
}

.sort-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
}

/* Purchase Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #374151;
}

.modal-body {
  padding: 20px;
}

.purchase-project-info {
  margin-bottom: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.purchase-project-info h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 1.1rem;
}

.project-location,
.project-category {
  margin: 4px 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.purchase-details {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.quantity-section,
.payment-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-help {
  color: #6b7280;
  font-size: 0.8rem;
}

.payment-options {
  display: flex;
  gap: 16px;
}

.payment-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.payment-option input[type='radio'] {
  margin: 0;
}

.payment-label {
  font-size: 0.9rem;
  color: #374151;
}

.purchase-summary {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.summary-row.total {
  font-weight: 600;
  color: #1f2937;
  border-top: 1px solid #e5e7eb;
  padding-top: 8px;
  margin-top: 8px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

/* Admin Styles */
.admin-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.admin-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.admin-toggle-label .material-symbols-outlined {
  font-size: 1.3rem;
  color: var(--carbonify-red-500);
}

.admin-btn {
  background: var(--carbonify-orange-500);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-btn:hover {
  background: var(--carbonify-orange-600);
  transform: translateY(-1px);
}

.admin-btn.active {
  background: var(--carbonify-red-500);
  box-shadow: 0 0 0 2px var(--carbonify-red-200);
}

.danger-btn {
  background: var(--carbonify-red-500);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.danger-btn:hover {
  background: var(--carbonify-red-600);
  transform: translateY(-1px);
}

.admin-bulk-controls {
  background: var(--carbonify-red-50);
  border: 1px solid var(--carbonify-red-200);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 24px;
}

.bulk-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
}

.bulk-btn {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bulk-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--carbonify-blue-300);
}

.selection-count {
  font-weight: 600;
  color: var(--carbonify-red-600);
  font-size: 14px;
}

.admin-selection {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.95);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--carbonify-red-300);
  z-index: 10;
}

.admin-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.admin-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--carbonify-red-600);
  cursor: pointer;
}

.project-card.admin-selected {
  border: 2px solid var(--carbonify-red-400);
  background: var(--carbonify-red-50);
  box-shadow: 0 0 0 1px var(--carbonify-red-200);
}

.project-card.admin-selected .project-title {
  color: var(--carbonify-red-700);
}

/* Projects Grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.project-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.project-image {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.project-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.category-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 50px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.category-badge.forestry {
  background: var(--primary-color);
}

.category-badge.renewable-energy {
  background: #3b82f6;
}

.category-badge.blue-carbon {
  background: #06b6d4;
}

.category-badge.energy-efficiency {
  background: #8b5cf6;
}

.project-content {
  padding: 1.5rem;
}

.project-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  line-height: 1.3;
}

.project-price {
  margin-bottom: 0.75rem;
}

.price {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--primary-color);
}

.price-unit {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  margin-left: 0.25rem;
}

.project-description {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 1rem;
}

.project-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.detail-icon {
  font-size: 1.05rem;
  color: var(--text-muted);
}

.detail-text {
  display: inline-flex;
  align-items: center;
  color: var(--text-secondary);
  line-height: 1.4;
}

.seller-info {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--bg-muted);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.seller-label {
  color: var(--text-muted);
  font-weight: 500;
}

.seller-name {
  color: var(--text-primary);
  font-weight: 600;
  margin-left: 0.5rem;
}

.vintage-badge {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.error-icon,
.empty-icon {
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}

.error-icon {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.empty-icon {
  background: rgba(16, 185, 129, 0.12);
  color: var(--primary-color, #069e2d);
}

.error-icon svg,
.empty-icon .material-symbols-outlined {
  width: 1.8rem;
  height: 1.8rem;
}

.retry-button {
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-top: 1rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

/* Card Actions */
.card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.learn-more-button {
  width: 100%;
  padding: 0.75rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.learn-more-button:hover {
  background: var(--primary-hover);
}

.purchase-button {
  width: 100%;
  padding: 0.75rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  margin-top: 0.5rem;
}

.purchase-button:hover:not(:disabled) {
  background: var(--primary-hover);
}

.purchase-button:disabled {
  background: var(--text-muted);
  cursor: not-allowed;
}

.admin-delete-button {
  background: #dc2626;
  color: white;
  border: 1px solid #dc2626;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-delete-button:hover {
  background: #b91c1c;
  border-color: #b91c1c;
  transform: translateY(-1px);
}

/* Animations */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Responsive Design */
@media (max-width: 1024px) {
  .content-layout {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .filters-sidebar {
    position: static;
  }

  .projects-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 768px) {
  .marketplace-header {
    padding: 1.5rem 0;
  }

  .page-title {
    font-size: var(--font-size-3xl);
  }

  .results-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .projects-grid {
    grid-template-columns: 1fr;
  }
}

/* Skeleton Loading */
.loading-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
  width: 100%;
}

.skeleton-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-image {
  width: 100%;
  height: 200px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  margin-bottom: 1rem;
  animation: skeleton-shimmer 1.5s infinite;
}

.skeleton-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-title {
  height: 1.5rem;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: skeleton-shimmer 1.5s infinite;
}

.skeleton-text {
  height: 1rem;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: skeleton-shimmer 1.5s infinite;
}

.skeleton-text.short {
  width: 60%;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
