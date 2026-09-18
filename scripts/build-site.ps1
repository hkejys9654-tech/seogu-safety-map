param(
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))

$envFile = Join-Path $root ".env.local"
if (Test-Path -LiteralPath $envFile) {
  foreach ($rawLine in Get-Content -LiteralPath $envFile -Encoding UTF8) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { continue }
    $parts = $line.Split("=", 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if (-not [Environment]::GetEnvironmentVariable($name)) {
      [Environment]::SetEnvironmentVariable($name, $value)
    }
  }
}

$kakaoKey = [Environment]::GetEnvironmentVariable("KAKAO_MAP_JAVASCRIPT_KEY")
if ([string]::IsNullOrWhiteSpace($kakaoKey)) {
  throw "KAKAO_MAP_JAVASCRIPT_KEY가 없습니다. 로컬은 .env.local, GitHub는 Actions secret에 JavaScript 키를 설정해주세요."
}
if ($kakaoKey -match '\s') {
  throw "KAKAO_MAP_JAVASCRIPT_KEY에 공백이 포함되어 있습니다."
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = if ($env:OUTPUT_DIR) { $env:OUTPUT_DIR } else { Join-Path $root "dist" }
}
$output = [IO.Path]::GetFullPath($OutputDir)
$rootPrefix = $root.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $output.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "출력 폴더는 프로젝트 내부여야 합니다: $output"
}

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Recurse -Force
}
New-Item -ItemType Directory -Path $output | Out-Null

$staticFiles = @(
  ".nojekyll",
  "index.html",
  "styles.css",
  "app.js",
  "kakao-map.js",
  "map-data.js",
  "landmarks-data.js",
  "firebase-config.js",
  "firebase-service.js",
  "firebase.json",
  "firestore.rules",
  "manifest.webmanifest"
)
foreach ($relativePath in $staticFiles) {
  $source = Join-Path $root $relativePath
  if (Test-Path -LiteralPath $source) {
    Copy-Item -LiteralPath $source -Destination (Join-Path $output $relativePath)
  }
}

foreach ($directory in @("admin", "assets")) {
  Copy-Item -LiteralPath (Join-Path $root $directory) -Destination (Join-Path $output $directory) -Recurse
}

$jsonKey = ConvertTo-Json ([string]$kakaoKey) -Compress
$runtimeConfig = "window.SAFETY_MAP_RUNTIME_CONFIG = Object.freeze({`n  kakaoJavaScriptKey: $jsonKey`n});`n"
[IO.File]::WriteAllText((Join-Path $output "runtime-config.js"), $runtimeConfig, [Text.UTF8Encoding]::new($false))

Write-Host "정적 사이트 빌드 완료: $output"
