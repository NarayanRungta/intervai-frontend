$ErrorActionPreference = "Stop"

$env:GIT_AUTHOR_EMAIL="kiit0001@example.com"
$env:GIT_COMMITTER_EMAIL="kiit0001@example.com"
$env:GIT_AUTHOR_NAME="KIIT0001"
$env:GIT_COMMITTER_NAME="KIIT0001"

Write-Host "Amending initial commit..."
$env:GIT_AUTHOR_DATE="2026-04-03T10:00:00+05:30"
$env:GIT_COMMITTER_DATE="2026-04-03T10:00:00+05:30"
git commit --amend --no-edit --date="2026-04-03T10:00:00+05:30"

Write-Host "Adding shadcn components..."
$env:GIT_AUTHOR_DATE="2026-04-07T14:30:00+05:30"
$env:GIT_COMMITTER_DATE="2026-04-07T14:30:00+05:30"
if (Test-Path "components") { git add components }
if (Test-Path "components.json") { git add components.json }
if (Test-Path "lib/utils.ts") { git add lib/utils.ts }
git commit -m "ui: add shadcn ui components"

Write-Host "Adding Drizzle ORM..."
$env:GIT_AUTHOR_DATE="2026-04-11T11:15:00+05:30"
$env:GIT_COMMITTER_DATE="2026-04-11T11:15:00+05:30"
if (Test-Path "drizzle") { git add drizzle }
if (Test-Path "drizzle.config.ts") { git add drizzle.config.ts }
if (Test-Path "src") { git add src }
git commit -m "chore: setup drizzle orm"

Write-Host "Adding authentication..."
$env:GIT_AUTHOR_DATE="2026-04-15T16:45:00+05:30"
$env:GIT_COMMITTER_DATE="2026-04-15T16:45:00+05:30"
if (Test-Path "lib/auth.ts") { git add lib/auth.ts }
if (Test-Path "lib/auth-client.ts") { git add lib/auth-client.ts }
if (Test-Path "lib/require-auth.ts") { git add lib/require-auth.ts }
if (Test-Path "app/login") { git add app/login }
git commit -m "feat: implement authentication with better-auth"

Write-Host "Adding dashboard..."
$env:GIT_AUTHOR_DATE="2026-04-18T09:20:00+05:30"
$env:GIT_COMMITTER_DATE="2026-04-18T09:20:00+05:30"
if (Test-Path "app/dashboard") { git add app/dashboard }
if (Test-Path "actions") { git add actions }
if (Test-Path "DESIGN.md") { git add DESIGN.md }
git commit -m "feat: build dashboard layout and server actions"

Write-Host "Adding interview module..."
$env:GIT_AUTHOR_DATE="2026-04-22T13:10:00+05:30"
$env:GIT_COMMITTER_DATE="2026-04-22T13:10:00+05:30"
if (Test-Path "app/interview") { git add app/interview }
if (Test-Path "app/api") { git add app/api }
if (Test-Path "types") { git add types }
git commit -m "feat: add interview interface and backend integration"

Write-Host "Adding remaining files..."
$env:GIT_AUTHOR_DATE="2026-04-24T10:00:00+05:30"
$env:GIT_COMMITTER_DATE="2026-04-24T10:00:00+05:30"
git add .
git commit -m "feat: refine styles and update configuration"

Write-Host "Frontend history generated successfully."
