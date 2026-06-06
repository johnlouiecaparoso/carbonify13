#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync } from 'fs'

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function runCommand(command, description) {
  log(`\n${colors.bold}${description}${colors.reset}`)
  log(`Running: ${command}`, 'blue')

  try {
    execSync(command, { stdio: 'inherit' })
    log(`✅ ${description} completed successfully`, 'green')
    return true
  } catch (error) {
    log(`❌ ${description} failed`, 'red')
    console.error(error.message)
    return false
  }
}

async function main() {
  log('🧪 Starting EcoLink Test Suite', 'bold')
  log('================================', 'bold')

  const results = {
    lint: false,
    unit: false,
    e2e: false,
    lighthouse: false,
  }

  // Check if we're in the right directory
  if (!existsSync('package.json')) {
    log('❌ Please run this script from the project root directory', 'red')
    process.exit(1)
  }

  // 1. Linting
  results.lint = runCommand('npm run lint', 'Code Linting')

  // 2. Unit Tests
  results.unit = runCommand('npm run test:run', 'Unit Tests')

  // 3. End-to-End Tests
  results.e2e = runCommand('npm run test:e2e', 'End-to-End Tests')

  // 4. Performance Tests (Lighthouse)
  results.lighthouse = runCommand('npm run lighthouse', 'Performance Tests')

  // Summary
  log('\n📊 Test Results Summary', 'bold')
  log('========================', 'bold')

  const passed = Object.values(results).filter(Boolean).length
  const total = Object.keys(results).length

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌'
    const color = passed ? 'green' : 'red'
    log(`${status} ${test.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`, color)
  })

  log(`\nOverall: ${passed}/${total} test suites passed`, passed === total ? 'green' : 'yellow')

  if (passed === total) {
    log('\n🎉 All tests passed! Your application is ready for production.', 'green')
    process.exit(0)
  } else {
    log('\n⚠️  Some tests failed. Please fix the issues before deploying.', 'yellow')
    process.exit(1)
  }
}

main().catch((error) => {
  log(`\n❌ Test runner failed: ${error.message}`, 'red')
  process.exit(1)
})








