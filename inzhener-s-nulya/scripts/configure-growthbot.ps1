$ErrorActionPreference = 'Stop'

$ExpectedUsername = 'AnimaTactusGrowthBot'
$PublicUrl = 'https://inzhener-s-nulya.vercel.app'
$AvatarPath = Join-Path $PSScriptRoot '..\engineer_avatar_512.jpg'

function Read-TokenFromFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
    foreach ($line in Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue) {
        if ($line -match '^\s*(TELEGRAM_BOT_TOKEN|ANIMA_TACTUS_TELEGRAM_BOT_TOKEN|GROWTH_TELEGRAM_BOT_TOKEN)\s*=\s*(.+?)\s*$') {
            $value = ([string]$matches[2]).Trim().Trim('"').Trim("'")
            if ($value) { return $value }
        }
    }
    return ''
}

function Get-Candidates {
    $items = New-Object System.Collections.Generic.List[object]
    foreach ($name in @('GROWTH_TELEGRAM_BOT_TOKEN','TELEGRAM_BOT_TOKEN','ANIMA_TACTUS_TELEGRAM_BOT_TOKEN')) {
        foreach ($scope in @('Process','User','Machine')) {
            $t = [Environment]::GetEnvironmentVariable($name,$scope)
            if ($t) { $items.Add([pscustomobject]@{ Source="$name [$scope]"; Token=$t.Trim() }) }
        }
    }

    $roots = @(
        [string]$env:ANIMA_TACTUS_REPO,
        (Join-Path $env:USERPROFILE 'Desktop\Anima Tactus'),
        (Join-Path $env:USERPROFILE 'Desktop\Anima-Tactus'),
        (Join-Path $env:USERPROFILE 'Documents\Codex\2026-07-20\Anima Tactus'),
        (Join-Path $env:USERPROFILE 'OneDrive\Documents\Anima Tactus\dev001')
    ) | Where-Object { $_ } | Select-Object -Unique

    $paths = New-Object System.Collections.Generic.List[string]
    foreach ($root in $roots) {
        foreach ($relative in @('.env','.env.local','config\.env','.maestro-local\telegram.env')) {
            $paths.Add((Join-Path $root $relative))
        }
    }
    $paths.Add((Join-Path $env:LOCALAPPDATA 'AnimaTactus\telegram.env'))
    $paths.Add((Join-Path $env:APPDATA 'AnimaTactus\telegram.env'))

    foreach ($path in ($paths | Select-Object -Unique)) {
        $t = Read-TokenFromFile -Path $path
        if ($t) { $items.Add([pscustomobject]@{ Source=$path; Token=$t }) }
    }
    return $items
}

function Invoke-Tg {
    param([string]$Token,[string]$Method,[hashtable]$Body=@{})
    $uri = "https://api.telegram.org/bot$Token/$Method"
    $json = $Body | ConvertTo-Json -Compress -Depth 8
    $r = Invoke-RestMethod -Method Post -Uri $uri -Body $json -ContentType 'application/json' -TimeoutSec 30
    if (-not $r.ok) { throw "Telegram API rejected $Method" }
    return $r.result
}

$token = ''
$source = ''
$seen = @{}
foreach ($item in Get-Candidates) {
    if ($seen[$item.Token]) { continue }
    $seen[$item.Token] = $true
    try {
        $me = Invoke-Tg -Token $item.Token -Method 'getMe'
        if ($me.username -eq $ExpectedUsername) {
            $token = $item.Token
            $source = $item.Source
            break
        }
    } catch {}
}

if (-not $token) {
    Write-Host "SAFE_STOP: token for @$ExpectedUsername was not found locally." -ForegroundColor Yellow
    Write-Host 'Nothing was changed.'
    exit 2
}

Write-Host "Verified @$ExpectedUsername from: $source" -ForegroundColor Green

Invoke-Tg -Token $token -Method 'setMyName' -Body @{ name='Инженер с нуля' } | Out-Null
Invoke-Tg -Token $token -Method 'setMyShortDescription' -Body @{ short_description='AutoCAD и Primavera P6 с нуля — практика, бесплатный старт и помощь 24/7.' } | Out-Null
Invoke-Tg -Token $token -Method 'setMyDescription' -Body @{ description='Практический помощник проекта «Инженер с нуля». Бесплатный старт по AutoCAD и Primavera P6, ответы по курсам, оплате и доступу. Без обещаний трудоустройства и дохода.' } | Out-Null

$commands = @(
    @{ command='start'; description='Начать' },
    @{ command='autocad'; description='Бесплатный старт AutoCAD' },
    @{ command='primavera'; description='Бесплатный старт Primavera P6' },
    @{ command='courses'; description='Курсы и цены' },
    @{ command='support'; description='Помощник 24/7' },
    @{ command='access'; description='Доступ после оплаты' }
)
Invoke-Tg -Token $token -Method 'setMyCommands' -Body @{ commands=$commands } | Out-Null
Invoke-Tg -Token $token -Method 'setChatMenuButton' -Body @{
    menu_button=@{
        type='web_app'
        text='Открыть'
        web_app=@{ url="$PublicUrl/support?src=tg_menu" }
    }
} | Out-Null

if (Test-Path -LiteralPath $AvatarPath) {
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        $photoJson = '{"type":"static","photo":"attach://avatar"}'
        $args = @('-sS','-X','POST',"https://api.telegram.org/bot$token/setMyProfilePhoto",'-F',"photo=$photoJson",'-F',"avatar=@$AvatarPath;type=image/jpeg")
        $out = & $curl.Source @args
        try {
            $parsed = $out | ConvertFrom-Json
            if (-not $parsed.ok) { throw 'setMyProfilePhoto failed' }
            Write-Host 'Avatar updated.' -ForegroundColor Green
        } catch {
            Write-Host 'Profile text/commands updated; avatar upload failed. Use BotFather -> Edit Bot -> Edit Botpic.' -ForegroundColor Yellow
        }
    } else {
        Write-Host 'Profile text/commands updated; curl.exe not found, avatar skipped.' -ForegroundColor Yellow
    }
} else {
    Write-Host "Profile text/commands updated; avatar file not found at $AvatarPath." -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'DONE: bot profile, description, commands and menu configured.' -ForegroundColor Green
Write-Host 'Token was not printed.'
