<template>
  <div class="detail-page">
    <div class="container">
      <router-link to="/marketplace" class="back-link">← Back to marketplace</router-link>

      <div v-if="loading" class="state">Loading project…</div>
      <div v-else-if="error" class="state error">{{ error }}</div>

      <template v-else-if="project">
        <header class="detail-header">
          <div>
            <h1 class="title">{{ project.title }}</h1>
            <p class="subtitle">
              <span class="muted">{{ project.category || 'Uncategorized' }}</span>
              <span v-if="project.location"> · {{ project.location }}</span>
            </p>
          </div>
          <span class="source-badge" :class="sourceClass">{{ sourceLabel }}</span>
        </header>

        <p v-if="project.description" class="description">{{ project.description }}</p>

        <div class="grid">
          <!-- Left: details -->
          <div class="col">
            <section class="card">
              <h2>Project Details</h2>
              <dl class="facts">
                <div><dt>Methodology</dt><dd>{{ project.methodology || '—' }}</dd></div>
                <div><dt>Vintage</dt><dd>{{ project.vintage || '—' }}</dd></div>
                <div><dt>Feasibility score</dt><dd>{{ project.feasibility_score ?? '—' }}</dd></div>
                <div><dt>Social impact</dt><dd>{{ project.social_impact_score ?? '—' }}</dd></div>
                <div><dt>Climate risk</dt><dd>{{ project.climate_risk_rating || '—' }}</dd></div>
                <div><dt>Estimated credits</dt><dd>{{ project.estimated_credits ?? '—' }}</dd></div>
              </dl>
            </section>

            <section class="card">
              <h2>Co-benefits & SDGs</h2>
              <div v-if="coBenefits.length" class="chips">
                <span v-for="(c, i) in coBenefits" :key="i" class="chip">{{ c }}</span>
              </div>
              <p v-else class="muted">No co-benefits recorded for this project.</p>
            </section>

            <section class="card">
              <h2>Documents</h2>
              <ul v-if="documents.length" class="docs">
                <li v-for="(doc, i) in documents" :key="i">
                  <a :href="doc.url" target="_blank" rel="noopener noreferrer">
                    {{ doc.name || 'Document ' + (i + 1) }}
                  </a>
                  <span v-if="doc.type" class="muted"> · {{ doc.type }}</span>
                </li>
              </ul>
              <p v-else class="muted">No documents attached.</p>
            </section>
          </div>

          <!-- Right: map + listings -->
          <div class="col">
            <section class="card">
              <h2>Location</h2>
              <div v-if="hasMap" ref="mapEl" class="map"></div>
              <p v-else class="muted">No map coordinates for this project.</p>
            </section>

            <section class="card">
              <h2>Available Listings</h2>
              <ul v-if="listings.length" class="listings">
                <li v-for="l in listings" :key="l.id">
                  <span class="lst-price">₱{{ Number(l.price_per_credit).toLocaleString() }}/credit</span>
                  <span class="muted"> · {{ l.quantity }} available</span>
                  <span class="source-badge sm" :class="badgeClass(l.source)">{{ l.source || 'local' }}</span>
                </li>
              </ul>
              <p v-else class="muted">No active listings.</p>
              <router-link to="/marketplace" class="buy-link">Go to marketplace →</router-link>
            </section>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getProject } from '@/services/projectService'
import { marketplaceIntegrationService } from '@/services/marketplaceIntegrationService'

const props = defineProps({ id: { type: String, required: true } })

const loading = ref(true)
const error = ref('')
const project = ref(null)
const listings = ref([])
const mapEl = ref(null)
let map = null

const documents = computed(() => {
  const docs = project.value?.supporting_documents
  return Array.isArray(docs) ? docs : []
})

const coBenefits = computed(() => {
  const cb = project.value?.co_benefits
  if (Array.isArray(cb)) return cb.map((c) => (typeof c === 'string' ? c : c?.label || c?.sdg)).filter(Boolean)
  return []
})

// A project is 'supplier'-sourced if any of its listings are.
const sourceLabel = computed(() =>
  listings.value.some((l) => l.source === 'supplier') ? 'Registry-backed' : 'Local credit',
)
const sourceClass = computed(() =>
  listings.value.some((l) => l.source === 'supplier') ? 'supplier' : 'local',
)
function badgeClass(source) {
  return source === 'supplier' ? 'supplier' : 'local'
}

const coords = computed(() => {
  const v = project.value?.geo_coordinates
  if (!v || typeof v !== 'string') return null
  const [lat, lng] = v.split(',').map((p) => parseFloat(p.trim()))
  if ([lat, lng].some((n) => isNaN(n))) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
})
const hasMap = computed(() => !!coords.value || !!project.value?.boundary)

async function renderMap() {
  await nextTick()
  if (!mapEl.value || map) return
  const center = coords.value || { lat: 12.8797, lng: 121.774 }
  map = L.map(mapEl.value).setView([center.lat, center.lng], coords.value ? 11 : 6)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  }).addTo(map)

  if (coords.value) {
    L.circleMarker([coords.value.lat, coords.value.lng], {
      radius: 9,
      color: '#069e2d',
      fillColor: '#10b981',
      fillOpacity: 0.8,
      weight: 2,
    }).addTo(map)
  }

  if (project.value?.boundary) {
    try {
      const layer = L.geoJSON(project.value.boundary, { style: { color: '#069e2d', weight: 2, fillOpacity: 0.1 } })
      layer.addTo(map)
      map.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 13 })
    } catch (err) {
      console.warn('Invalid project boundary GeoJSON:', err)
    }
  }
}

onMounted(async () => {
  try {
    project.value = await getProject(props.id, { includeAll: true })
    try {
      listings.value = (await marketplaceIntegrationService.getProjectListings(props.id)) || []
    } catch {
      listings.value = []
    }
    if (hasMap.value) await renderMap()
  } catch (err) {
    console.error('Project detail load error:', err)
    error.value = 'Failed to load this project.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.detail-page {
  padding: 1.5rem 0 3rem;
}
.container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 1.25rem;
}
.back-link {
  color: #069e2d;
  text-decoration: none;
  font-size: 0.875rem;
}
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin: 1rem 0 0.5rem;
}
.title {
  margin: 0;
  font-size: 1.6rem;
}
.subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.95rem;
}
.muted {
  color: #6b7280;
}
.description {
  color: #374151;
  line-height: 1.6;
  margin: 0.5rem 0 1.5rem;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.25rem;
}
.card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}
.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
  margin: 0;
}
.facts dt {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.facts dd {
  margin: 0;
  font-weight: 600;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.chip {
  background: #e8f5e8;
  color: #069e2d;
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
}
.docs,
.listings {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.listings {
  list-style: none;
  padding-left: 0;
}
.lst-price {
  color: #069e2d;
  font-weight: 700;
}
.map {
  height: 280px;
  border-radius: 0.5rem;
}
.source-badge {
  border-radius: 999px;
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}
.source-badge.sm {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  margin-left: 0.4rem;
}
.source-badge.local {
  background: #eef2ff;
  color: #4338ca;
}
.source-badge.supplier {
  background: #ecfdf5;
  color: #047857;
}
.buy-link {
  display: inline-block;
  margin-top: 0.75rem;
  color: #069e2d;
  font-weight: 600;
  text-decoration: none;
}
.state {
  padding: 3rem 0;
  text-align: center;
  color: #6b7280;
}
.state.error {
  color: #dc2626;
}
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
