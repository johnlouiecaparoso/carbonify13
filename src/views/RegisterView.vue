<script setup>
import RegisterForm from '@/components/auth/RegisterForm.vue'

/**
 * Roles that can't simply be self-selected at signup — each is reviewed. Farmer
 * leads because it is the lowest-friction path (no business registration, no
 * accreditation) and the audience least likely to hunt for a link.
 */
const specialistRoles = [
  {
    to: '/register/farmer',
    icon: 'agriculture',
    title: 'I am a farmer',
    description: 'Sell your biomass, log deliveries, and track what you are paid.',
  },
  {
    to: { path: '/apply', query: { role: 'project_developer' } },
    icon: 'engineering',
    title: 'I develop carbon projects',
    description: 'Register projects, report monitoring data, and issue credits.',
  },
  {
    to: { path: '/apply', query: { role: 'verifier' } },
    icon: 'verified',
    title: 'I am a verifier',
    description: 'Review projects and approve verified emission reductions.',
  },
]
</script>

<template>
  <div class="auth-layout">
    <section class="auth-hero">
      <div class="hero-card">
        <div class="brand">
          <div class="brand-badge">
            <div class="auth-logo-container">
              <img
                src="/carbonify-logo.png"
                alt="Carbonify"
                class="auth-logo-image"
              />
            </div>
          </div>
          <div class="brand-text">
            <h1 class="brand-title">CARBONIFY</h1>
            <p class="brand-subtitle">Join the network accelerating climate-positive projects.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="auth-panel">
      <div class="panel-card">
        <RegisterForm />

        <!-- Roles that need review before approval. Each says plainly what it's
             for, so nobody applies as a Verifier when they meant Developer. -->
        <div class="apply-specialist">
          <span class="apply-specialist__label">Joining as something specific?</span>
          <div class="role-cards">
            <router-link
              v-for="role in specialistRoles"
              :key="role.to"
              :to="role.to"
              class="role-card"
            >
              <span class="material-symbols-outlined role-card__icon" aria-hidden="true">{{ role.icon }}</span>
              <span class="role-card__body">
                <span class="role-card__title">{{ role.title }}</span>
                <span class="role-card__desc">{{ role.description }}</span>
              </span>
              <span class="material-symbols-outlined role-card__chevron" aria-hidden="true">chevron_right</span>
            </router-link>
          </div>
          <p class="apply-specialist__note">
            These roles are reviewed before approval. You'll create an account first either way.
          </p>
        </div>

        <div class="panel-footer">
          <span class="panel-desc">Already have an account?</span>
          <router-link class="muted-link" to="/login">Sign in</router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Enhanced Auth Layout with Modern Styling */
.auth-layout {
  height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #ffffff;
  position: relative;
  overflow: hidden;
}


/* Mobile responsive */
@media (max-width: 768px) {
  .auth-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}

/* Enhanced Auth Hero Section */
.auth-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--primary-color, #069e2d);
  color: white;
  position: relative;
  overflow: hidden;
  z-index: 1;
  height: 100%;
}

.hero-card {
  max-width: 32rem;
  position: relative;
  z-index: 2;
}

.brand {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
}

.brand-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Enhanced Logo Styling */
.auth-logo-container {
  height: 5rem !important;
  width: 5rem !important;
  min-width: 5rem !important;
  max-width: 5rem !important;
  min-height: 5rem !important;
  max-height: 5rem !important;
  border-radius: 50% !important;
  border: 2px solid rgba(209, 250, 229, 0.9);
  padding: 0;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.auth-logo-image {
  height: 100% !important;
  width: 100% !important;
  object-fit: cover !important;
  display: block !important;
  border-radius: 50% !important;
}

.brand-title {
  font-size: 3rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.brand-subtitle {
  font-size: 1rem;
  margin: 0;
  color: #ffffff;
  font-weight: 400;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Enhanced Auth Panel */
.auth-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  background: #ffffff;
  height: 100%;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* Enhanced Panel Card */
.panel-card {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  box-sizing: border-box;
}

/* Apply as Developer/Verifier */
.apply-specialist {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.apply-specialist__label {
  display: block;
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.apply-specialist {
  text-align: left;
}

.apply-specialist__label {
  text-align: center;
}

.role-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.role-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.role-card:hover,
.role-card:focus-visible {
  border-color: var(--primary-color, #069e2d);
  background: #f0fdf4;
  transform: translateY(-1px);
}

.role-card__icon {
  color: var(--primary-color, #069e2d);
  font-size: 1.5rem;
  flex-shrink: 0;
}

.role-card__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.role-card__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #111827;
}

.role-card__desc {
  font-size: 0.78rem;
  color: #6b7280;
  line-height: 1.35;
}

.role-card__chevron {
  color: #9ca3af;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.apply-specialist__note {
  margin: 0.875rem 0 0;
  font-size: 0.75rem;
  color: #9ca3af;
  text-align: center;
  line-height: 1.45;
}

/* Enhanced Footer */
.panel-footer {
  padding: 1rem 0 0 0;
  text-align: center;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.panel-desc {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  font-weight: 400;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.muted-link {
  color: var(--primary-color, #069e2d);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  transition: color 0.2s ease;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.muted-link:hover {
  color: var(--primary-hover, #058e3f);
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .auth-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .auth-hero {
    padding: 1.5rem 1rem;
    min-height: auto;
    height: auto;
  }

  .auth-panel {
    padding: 1rem;
    height: auto;
    overflow: hidden;
  }

  .panel-card {
    max-width: 100%;
    border-radius: 16px;
    padding: 1.5rem;
  }

  .brand {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .brand-title {
    font-size: 2.5rem;
  }

  .brand-subtitle {
    font-size: 0.875rem;
  }

  .auth-logo-container {
    width: 5rem !important;
    height: 5rem !important;
    min-width: 5rem !important;
    min-height: 5rem !important;
    max-width: 5rem !important;
    max-height: 5rem !important;
  }

  .panel-footer {
    padding: 1rem 0 0 0;
    gap: 0.5rem;
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .auth-hero {
    padding: 1.5rem 1rem;
  }

  .auth-panel {
    padding: 0.75rem;
  }

  .panel-card {
    border-radius: 16px;
    padding: 1.25rem;
  }

  .brand-title {
    font-size: 2rem;
  }

  .auth-logo-container {
    width: 4.5rem !important;
    height: 4.5rem !important;
    min-width: 4.5rem !important;
    min-height: 4.5rem !important;
    max-width: 4.5rem !important;
    max-height: 4.5rem !important;
  }

  .panel-footer {
    padding: 0.75rem 0 0 0;
    gap: 0.5rem;
    flex-direction: column;
  }
}
</style>
