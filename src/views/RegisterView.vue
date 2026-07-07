<script setup>
import RegisterForm from '@/components/auth/RegisterForm.vue'
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
        <div class="apply-specialist">
          <span class="apply-specialist__label">Want to join as a specialist?</span>
          <div class="apply-specialist__links">
            <router-link :to="{ path: '/apply', query: { role: 'project_developer' } }" class="apply-specialist__link">
              Apply as Developer
            </router-link>
            <router-link :to="{ path: '/apply', query: { role: 'verifier' } }" class="apply-specialist__link">
              Apply as Verifier
            </router-link>
          </div>
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
  height: 4.25rem !important;
  width: auto !important;
  max-width: 11rem !important;
  min-height: 4.25rem !important;
  max-height: 4.25rem !important;
  border-radius: 14px !important;
  border: 1px solid rgba(209, 250, 229, 0.9);
  padding: 0.55rem 0.9rem;
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
  height: auto !important;
  width: auto !important;
  object-fit: contain !important;
  display: block !important;
  max-width: 100% !important;
  max-height: 100% !important;
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

.apply-specialist__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.apply-specialist__link {
  color: var(--primary-color, #069e2d);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border: 1px solid var(--primary-color, #069e2d);
  border-radius: 8px;
  transition: background 0.2s ease, color 0.2s ease;
}

.apply-specialist__link:hover {
  background: var(--primary-color, #069e2d);
  color: #fff;
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
    width: auto !important;
    height: 5rem !important;
    min-width: 0 !important;
    min-height: 5rem !important;
    max-width: 100% !important;
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
    width: auto !important;
    height: 4.5rem !important;
    min-width: 0 !important;
    min-height: 4.5rem !important;
    max-width: 100% !important;
    max-height: 4.5rem !important;
  }

  .panel-footer {
    padding: 0.75rem 0 0 0;
    gap: 0.5rem;
    flex-direction: column;
  }
}
</style>
