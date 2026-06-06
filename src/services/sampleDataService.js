import { getSupabase } from '@/services/supabaseClient'

// Sample data service - DEVELOPMENT ONLY
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

/**
 * Create sample marketplace data for testing
 * DEVELOPMENT ONLY - This function should not be called in production
 */
export async function createSampleMarketplaceData() {
  if (!isDevelopment) {
    console.error('[PROD] Sample data creation is disabled in production')
    throw new Error('Sample data creation is not allowed in production')
  }

  const supabase = getSupabase()

  try {
    console.log('[DEV] Creating sample marketplace data...')

    // First, create some sample projects
    const sampleProjects = [
      {
        title: 'Amazon Rainforest Protection Initiative',
        description:
          'Protecting 10,000 hectares of primary rainforest in the Amazon basin through community-based conservation efforts and sustainable land management practices.',
        category: 'Forestry',
        location: 'Brazil',
        expected_impact:
          'Preventing deforestation of 10,000 hectares, sequestering approximately 50,000 tonnes of CO2 annually.',
        status: 'approved',
        verification_notes:
          'Verified by independent third-party auditor. Project meets VCS standards.',
      },
      {
        title: 'Solar Power Plant - Kenya',
        description:
          'Construction and operation of a 50MW solar photovoltaic power plant in Kenya, replacing fossil fuel-based electricity generation.',
        category: 'Renewable Energy',
        location: 'Kenya',
        expected_impact:
          'Generating 75 GWh of clean electricity annually, reducing CO2 emissions by 45,000 tonnes per year.',
        status: 'approved',
        verification_notes: 'CDM registered project. Annual monitoring reports available.',
      },
      {
        title: 'Mangrove Restoration - Philippines',
        description:
          'Restoration of degraded mangrove ecosystems in the Philippines, improving coastal protection and carbon sequestration.',
        category: 'Blue Carbon',
        location: 'Philippines',
        expected_impact:
          'Restoring 500 hectares of mangroves, sequestering 15,000 tonnes of CO2 over 20 years.',
        status: 'approved',
        verification_notes: 'Blue carbon methodology applied. Verified by marine biology experts.',
      },
      {
        title: 'Energy Efficiency - India',
        description:
          'LED lighting replacement program across 100,000 households in rural India, reducing energy consumption and emissions.',
        category: 'Energy Efficiency',
        location: 'India',
        expected_impact:
          'Reducing energy consumption by 60% in participating households, saving 25,000 tonnes CO2 annually.',
        status: 'approved',
        verification_notes: 'Gold Standard certified. Impact verified through energy audits.',
      },
    ]

    // Insert sample projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .insert(sampleProjects)
      .select()

    if (projectsError) {
      console.error('Error creating sample projects:', projectsError)
      throw new Error('Failed to create sample projects')
    }

    console.log('Created sample projects:', projects.length)

    // Create project credits for each project
    const projectCredits = []
    projects.forEach((project, index) => {
      const creditsPerProject = [5000, 3000, 2000, 4000] // Different amounts per project
      const pricePerCredit = [15.5, 22.0, 18.75, 12.25] // Different prices per project

      projectCredits.push({
        project_id: project.id,
        vintage_year: new Date().getFullYear(),
        quantity_available: creditsPerProject[index],
        quantity_sold: 0,
        price_per_credit: pricePerCredit[index],
        currency: 'PHP',
        verification_standard: index % 2 === 0 ? 'VCS' : 'Gold Standard',
        status: 'active',
      })
    })

    const { data: credits, error: creditsError } = await supabase
      .from('project_credits')
      .insert(projectCredits)
      .select()

    if (creditsError) {
      console.error('Error creating project credits:', creditsError)
      throw new Error('Failed to create project credits')
    }

    console.log('Created project credits:', credits.length)

    // Create marketplace listings
    const listings = credits.map((credit, index) => ({
      project_credit_id: credit.id,
      seller_id: projects[index].user_id, // Assuming projects have user_id
      quantity: credit.quantity_available,
      price_per_credit: credit.price_per_credit,
      currency: credit.currency,
      listing_type: 'sell',
      status: 'active',
      listed_at: new Date().toISOString(),
    }))

    const { data: marketplaceListings, error: listingsError } = await supabase
      .from('credit_listings')
      .insert(listings)
      .select()

    if (listingsError) {
      console.error('Error creating marketplace listings:', listingsError)
      throw new Error('Failed to create marketplace listings')
    }

    console.log('Created marketplace listings:', marketplaceListings.length)

    return {
      projects: projects.length,
      credits: credits.length,
      listings: marketplaceListings.length,
    }
  } catch (error) {
    console.error('Error creating sample marketplace data:', error)
    throw error
  }
}

/**
 * Create sample user data for testing
 * DEVELOPMENT ONLY
 */
export async function createSampleUsers() {
  if (!isDevelopment) {
    throw new Error('Sample user creation is not allowed in production')
  }

  try {
    console.log('[DEV] Creating sample users...')

    const sampleUsers = [
      {
        full_name: 'Demo Project Developer',
        email: 'developer@ecolink.io',
        role: 'project_developer',
        kyc_level: 'verified',
      },
      {
        full_name: 'Demo Verifier',
        email: 'verifier@ecolink.io',
        role: 'verifier',
        kyc_level: 'verified',
      },
      {
        full_name: 'Demo Buyer',
        email: 'buyer@ecolink.io',
        role: 'buyer_investor',
        kyc_level: 'verified',
      },
    ]

    // Note: In a real implementation, you would create actual user accounts
    // For now, we'll just log what would be created
    console.log('Sample users to create:', sampleUsers)

    return sampleUsers
  } catch (error) {
    console.error('Error creating sample users:', error)
    throw error
  }
}

/**
 * Initialize sample data for the application
 * DEVELOPMENT ONLY
 */
export async function initializeSampleData() {
  if (!isDevelopment) {
    throw new Error('Sample data initialization is not allowed in production')
  }

  try {
    console.log('[DEV] Initializing sample data...')

    const results = await createSampleMarketplaceData()
    const users = await createSampleUsers()

    console.log('Sample data initialization complete:', {
      ...results,
      sampleUsers: users.length,
    })

    return {
      success: true,
      data: {
        ...results,
        sampleUsers: users.length,
      },
    }
  } catch (error) {
    console.error('Error initializing sample data:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}
