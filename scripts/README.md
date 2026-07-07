# Scripts Directory

This directory contains all utility scripts, setup scripts, and test scripts for the Carbonify project.

## 📁 Directory Structure

```
scripts/
├── setup/           # Setup and initialization scripts
├── test/            # Test scripts
│   ├── integration/ # Integration tests
│   ├── components/  # Component-specific tests
│   └── workflows/   # Workflow tests
└── archive/         # Archived/obsolete scripts
```

## 🚀 Setup Scripts (`setup/`)

Scripts for setting up the development environment and database:

- **`setup-supabase.js`** - Supabase setup and verification
  - Run: `npm run setup:supabase`
  - Tests Supabase connection and database setup

- **`setup-test-accounts.js`** - Create test user accounts
  - Run: `npm run setup:accounts`
  - Creates test accounts for different user roles

## 🧪 Test Scripts (`test/`)

### Integration Tests (`test/integration/`)

Main integration and end-to-end tests:

- **`test-supabase-integration.js`** - Supabase integration test
  - Run: `npm run test:supabase`

- **`test-complete-integration.js`** - Complete integration test
  - Run: `npm run test:integration`

- **`test-integration-fixed.js`** - Fixed integration test
  - Run: `npm run test:integration:fixed`

- **`simple-integration-test.js`** - Simple integration test
  - Run: `npm run test:simple`

- **`test-complete-workflow-final.js`** - Final workflow test
- **`test-final-marketplace-integration.js`** - Marketplace integration test
- **`test-complete-approval-workflow.js`** - Approval workflow test

### Component Tests (`test/components/`)

Component-specific test scripts:

- **`test-assignment-modal.js`** - Assignment modal tests
- **`test-certificate-functions.js`** - Certificate function tests
- **`test-opaque-modal.js`** - Opaque modal tests
- **`test-verifier-layout.js`** - Verifier layout tests
- **`test-verifier-panel.js`** - Verifier panel tests
- **`test-wallet-modal.js`** - Wallet modal tests

### Workflow Tests (`test/workflows/`)

Workflow-specific test scripts:

- **`test-verifier-approval-workflow.js`** - Verifier approval workflow tests

## 📦 Archived Scripts (`archive/`)

These scripts are archived because they are:

- Obsolete/duplicate versions
- Browser console scripts (not Node.js)
- One-time fixes that are no longer needed
- Debug scripts that aren't actively used

### Archived Test Scripts

- `test-complete-workflow.js` (old version)
- `test-complete-workflow-fixed.js` (intermediate version)
- `test-marketplace-integration.js` (old version)
- `test-fixed-marketplace-integration.js` (intermediate version)

### Archived Debug/Fix Scripts

- `DEBUG_LOADING_ISSUE.js` - Browser console debug script
- `clear-auth-state.js` - Browser console script
- `debug-verifier-panel.js` - Browser console script
- `fix-authentication.js` - Browser console script
- `nuclear-auth-fix.js` - Browser console script
- `force-refresh-certificate-service.js` - Browser console script
- `fix-console-issues.js` - Not used in codebase
- `fix-marketplace-integration.js` - Not used in codebase

**Note:** Browser console scripts should be run directly in the browser console, not as Node.js scripts.

## 🔧 Usage

### Running Setup Scripts

```bash
# Setup Supabase
npm run setup:supabase

# Setup test accounts
npm run setup:accounts
```

### Running Test Scripts

```bash
# Run specific integration tests
npm run test:supabase
npm run test:integration
npm run test:simple

# Or run directly
node scripts/test/integration/test-supabase-integration.js
```

### Browser Console Scripts

If you need the browser console scripts from the archive:

1. Open your browser console
2. Copy the script content
3. Paste and run in the console

## 📝 Notes

- All setup scripts require a `.env` file with Supabase credentials
- Test scripts verify database connectivity and functionality
- Archived scripts are kept for reference but are not actively maintained
