$content = Get-Content -Raw "data.js"
$matches = [regex]::Matches($content, '(https://upload\.wikimedia\.org/[^"''\s]+)')
$urls = $matches | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique

New-Item -ItemType Directory -Force -Path "images"

$counter = 1
foreach ($url in $urls) {
    Write-Host "Downloading $url"
    $filename = "images/iglesia_$counter.jpg"
    try {
        Invoke-WebRequest -Uri $url -OutFile $filename -UseBasicParsing -Headers @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        $content = $content.Replace($url, "./$filename")
        Write-Host "Saved as $filename"
    } catch {
        Write-Host "Error downloading $url - $_"
    }
    $counter++
}

Set-Content -Path "data.js" -Value $content
Write-Host "data.js updated."
