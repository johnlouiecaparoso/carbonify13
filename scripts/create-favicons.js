/**
 * Script to create favicon files from EcoLink logo
 * This script copies and resizes the logo to create favicon files
 * 
 * Usage: node scripts/create-favicons.js
 * 
 * Requirements: sharp package (install with: npm install sharp --save-dev)
 */

const fs = require('fs')
const path = require('path')

// Check if sharp is available (optional - will use file copy if not)
let sharp = null
try {
  sharp = require('sharp')
} catch {
  console.log('⚠️  Sharp not installed. Using file copy method.')
  console.log('   Install sharp for better image resizing: npm install sharp --save-dev')
}

const sourceLogo = path.join(__dirname, '../src/assets/images/ecolink-logo.png')
const publicDir = path.join(__dirname, '../public')

// Favicon sizes to create
const faviconSizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
]

async function createFavicons() {
  try {
    // Check if source logo exists
    if (!fs.existsSync(sourceLogo)) {
      console.error(`❌ Source logo not found: ${sourceLogo}`)
      console.error('   Please ensure the logo exists at: src/assets/images/ecolink-logo.png')
      process.exit(1)
    }

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
    }

    if (sharp) {
      // Use sharp for proper resizing
      console.log('📦 Creating favicon files with sharp...')
      
      for (const { name, size } of faviconSizes) {
        const outputPath = path.join(publicDir, name)
        
        await sharp(sourceLogo)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .png()
          .toFile(outputPath)
        
        console.log(`✅ Created ${name} (${size}x${size})`)
      }

      // Also create favicon.ico (copy the 32x32 version)
      const favicon32Path = path.join(publicDir, 'favicon-32x32.png')
      const faviconIcoPath = path.join(publicDir, 'favicon.ico')
      
      if (fs.existsSync(favicon32Path)) {
        fs.copyFileSync(favicon32Path, faviconIcoPath)
        console.log('✅ Created favicon.ico (from 32x32)')
      }
    } else {
      // Fallback: copy the original logo to all sizes
      console.log('📦 Copying logo files (install sharp for proper resizing)...')
      
      for (const { name } of faviconSizes) {
        const outputPath = path.join(publicDir, name)
        fs.copyFileSync(sourceLogo, outputPath)
        console.log(`✅ Copied ${name}`)
      }

      // Copy as favicon.ico
      const faviconIcoPath = path.join(publicDir, 'favicon.ico')
      fs.copyFileSync(sourceLogo, faviconIcoPath)
      console.log('✅ Copied favicon.ico')
    }

    console.log('\n✅ All favicon files created successfully!')
    console.log('   Refresh your browser to see the new favicon.')
    console.log('   (You may need to hard refresh: Ctrl+Shift+R or Ctrl+F5)')
    
  } catch (error) {
    console.error('❌ Error creating favicons:', error.message)
    process.exit(1)
  }
}

// Run the script
createFavicons()

