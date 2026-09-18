param(
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$siteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\dist"))
if (-not (Test-Path -LiteralPath $siteRoot)) {
  throw "dist 폴더가 없습니다. 먼저 scripts/build-site.ps1을 실행해주세요."
}

$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "로컬 확인 주소: http://localhost:$Port/"
Write-Host "종료하려면 Ctrl+C를 누르세요."

$mimeTypes = @{
  ".css" = "text/css; charset=utf-8"
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart("/")
      if (-not $relativePath) { $relativePath = "index.html" }
      $candidate = [IO.Path]::GetFullPath((Join-Path $siteRoot $relativePath))
      $sitePrefix = $siteRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

      if ($candidate -ne $siteRoot -and -not $candidate.StartsWith($sitePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "허용되지 않은 경로입니다."
      }
      if (Test-Path -LiteralPath $candidate -PathType Container) {
        $candidate = Join-Path $candidate "index.html"
      }
      if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        $context.Response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes("Not Found")
      } else {
        $extension = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
        $context.Response.ContentType = if ($mimeTypes[$extension]) { $mimeTypes[$extension] } else { "application/octet-stream" }
        $bytes = [IO.File]::ReadAllBytes($candidate)
      }
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $context.Response.StatusCode = 500
    } finally {
      $context.Response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
