param(
  [Parameter(Mandatory = $true)]
  [string]$DocumentPath
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$cardsPath = Join-Path $projectRoot "app/cards.json"
$zip = [System.IO.Compression.ZipFile]::OpenRead($DocumentPath)

try {
  $entry = $zip.GetEntry("word/document.xml")
  $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
  [xml]$document = $reader.ReadToEnd()
  $reader.Dispose()

  $namespaces = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
  $namespaces.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
  $cards = @()

  foreach ($row in $document.SelectNodes("//w:tbl/w:tr", $namespaces)) {
    $cells = $row.SelectNodes("./w:tc", $namespaces)
    if ($cells.Count -ne 3) { continue }

    $id = (($cells[0].SelectNodes(".//w:t", $namespaces) | ForEach-Object { $_.InnerText }) -join "").Trim()
    if ($id -notmatch "^\d+$") { continue }

    $titleLines = @($cells[1].SelectNodes("./w:p", $namespaces) | ForEach-Object {
      (($_.SelectNodes(".//w:t", $namespaces) | ForEach-Object { $_.InnerText }) -join "").Trim()
    } | Where-Object { $_ })
    $guideLines = @($cells[2].SelectNodes("./w:p", $namespaces) | ForEach-Object {
      (($_.SelectNodes(".//w:t", $namespaces) | ForEach-Object { $_.InnerText }) -join "").Trim()
    } | Where-Object { $_ })

    $number = [int]$id
    $category = if ($number -le 26) { "살림" }
      elseif ($number -le 41) { "관리" }
      elseif ($number -le 61) { "아이돌봄" }
      elseif ($number -le 79) { "아이교육" }
      elseif ($number -le 98) { "가족돌봄" }
      else { "우리집카드" }

    $card = [ordered]@{
      id = $id
      category = $category
      title = $titleLines[0]
    }
    if ($titleLines.Count -gt 1) { $card.desc = $titleLines[1] }

    $notes = @($guideLines | Where-Object { $_ -notmatch "^[①②③④]" })
    $steps = @($guideLines | Where-Object { $_ -match "^[①②③④]" })
    if ($notes.Count) { $card.note = $notes -join " " }
    if ($steps.Count) { $card.steps = $steps }
    $cards += [pscustomobject]$card
  }

  if ($cards.Count -ne 100) {
    throw "카드가 100장이 아닙니다: $($cards.Count)장"
  }

  $json = $cards | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText(
    $cardsPath,
    $json + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-Output "함께카드 100장을 반영했습니다."
}
finally {
  $zip.Dispose()
}
