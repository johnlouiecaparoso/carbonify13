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
              <button @click="loadMarketplaceData" class="retry-button">Retry</button>
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

            <!-- Listings Grid -->
            <div v-else class="projects-grid">
              <div
                v-for="listing in filteredListings"
                :key="listing.listing_id"
                class="project-card"
              >
                <div class="project-image">
                  <img
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { getMarketplaceListings, getMarketplaceStats } from '@/services/marketplaceService'

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

    // Options
    const categories = [
      { value: 'all', label: 'All' },
      { value: 'Forestry', label: 'Forestry' },
      { value: 'Renewable Energy', label: 'Renewable Energy' },
      { value: 'Blue Carbon', label: 'Blue Carbon' },
      { value: 'Energy Efficiency', label: 'Energy Efficiency' },
    ]

    const countries = [
      'Brazil',
      'Paraguay',
      'Kenya',
      'India',
      'Indonesia',
      'Costa Rica',
      'Peru',
      'Colombia',
      'Philippines',
      'Malaysia',
      'Thailand',
    ]

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

    // Methods
    async function loadMarketplaceData() {
      console.log('Loading marketplace data...')
      loading.value = true
      error.value = ''

      try {
        const filters = {
          category: selectedCategory.value !== 'all' ? selectedCategory.value : null,
          country: selectedCountry.value,
          search: searchQuery.value,
        }

        console.log('Fetching listings with filters:', filters)
        const [listingsData, statsData] = await Promise.all([
          getMarketplaceListings(filters),
          getMarketplaceStats(),
        ])

        console.log('Received listings data:', listingsData)
        console.log('Received stats data:', statsData)

        listings.value = listingsData
        marketplaceStats.value = statsData
      } catch (err) {
        console.error('Error loading marketplace data:', err)
        error.value = 'Failed to load marketplace data'
      } finally {
        loading.value = false
      }
    }

    function handleSearch() {
      loadMarketplaceData()
    }

    function applyFilters() {
      loadMarketplaceData()
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

    function showPurchaseModalFor() {
      if (!userStore.isAuthenticated) {
        router.push('/login')
        return
      }
      // For now, just show an alert
      alert('Purchase functionality coming soon!')
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

    // Lifecycle
    onMounted(async () => {
      console.log('Marketplace mounted, loading data...')
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
      handleSearch,
      applyFilters,
      applySorting,
      viewProject,
      showPurchaseModalFor,
      formatCurrency,
      formatNumber,
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
</style>
