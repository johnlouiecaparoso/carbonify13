# PowerShell script to create favicon files from Carbonify logo
# This script copies the logo to the public folder with different names
# 
# Usage: .\scripts\create-favicons.ps1

$sourceLogo = "src\assets\images\carbonify-logo.png"
$publicDir = "public"

# Check if source logo exists
if (-not (Test-Path $sourceLogo)) {
    Write-Host "Source logo not found: $sourceLogo" -ForegroundColor Red
    Write-Host "Please ensure the logo exists at: src/assets/images/carbonify-logo.png" -ForegroundColor Yellow
    exit 1
}

# Ensure public directory exists
if (-not (Test-Path $publicDir)) {
    New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
}

Write-Host "Copying logo files to public folder..." -ForegroundColor Cyan

# Create favicon files by copying the logo
$faviconFiles = @(
    @{ Name = "favicon-16x16.png"; Source = $sourceLogo },
    @{ Name = "favicon-32x32.png"; Source = $sourceLogo },
    @{ Name = "apple-touch-icon.png"; Source = $sourceLogo },
    @{ Name = "favicon.ico"; Source = $sourceLogo }
)

foreach ($file in $faviconFiles) {
    $destPath = Join-Path $publicDir $file.Name
    Copy-Item -Path $file.Source -Destination $destPath -Force
    Write-Host "Created $($file.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "All favicon files created successfully!" -ForegroundColor Green
Write-Host "Refresh your browser to see the new favicon." -ForegroundColor Yellow
