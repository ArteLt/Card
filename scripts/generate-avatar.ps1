param(
    [string]$ImagePath = "artautas.jpg",
    [string]$OutputPath = "avatar-artautas.png",
    [string]$AccentHex = "#C8D2DC",
    [string]$BgHex = "#0F2B4C",
    [string]$Initials = ""
)

Add-Type -AssemblyName System.Drawing

$targetSize = 300
$bmp = New-Object System.Drawing.Bitmap $targetSize, $targetSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# 1. Fill Theme Canvas (walletBgHex)
$bgColor = [System.Drawing.ColorTranslator]::FromHtml($BgHex)
$bgBrush = New-Object System.Drawing.SolidBrush $bgColor
$g.FillRectangle($bgBrush, 0, 0, $targetSize, $targetSize)
$bgBrush.Dispose()

$hasSourceImage = $false
if ($ImagePath -and (Test-Path $ImagePath)) {
    $hasSourceImage = $true
}

if ($hasSourceImage) {
    $srcPath = Resolve-Path $ImagePath
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    Write-Output "Source Image Loaded: $($srcImg.Width) x $($srcImg.Height)"

    # 2. Square Face Crop from Source Image
    $minDim = [Math]::Min($srcImg.Width, $srcImg.Height)
    $srcX = [int](($srcImg.Width - $minDim) / 2)
    $srcY = [int]([Math]::Max(0, ($srcImg.Height - $minDim) * 0.2))

    # 3. Clip to Inner Circle (radius 142)
    $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $innerRadius = 142
    $innerDiameter = $innerRadius * 2
    $clipX = 150 - $innerRadius
    $clipY = 150 - $innerRadius
    $clipPath.AddEllipse($clipX, $clipY, $innerDiameter, $innerDiameter)
    $g.SetClip($clipPath)

    $destRect = New-Object System.Drawing.Rectangle $clipX, $clipY, $innerDiameter, $innerDiameter
    $srcRect = New-Object System.Drawing.Rectangle $srcX, $srcY, $minDim, $minDim
    $g.DrawImage($srcImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $g.ResetClip()
    $clipPath.Dispose()
    $srcImg.Dispose()
} elseif ($Initials) {
    # Monogram fallback inside inner circle
    $fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
    $font = New-Object System.Drawing.Font $fontFamily, 84, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $txtColor = [System.Drawing.ColorTranslator]::FromHtml($AccentHex)
    $txtBrush = New-Object System.Drawing.SolidBrush $txtColor
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rectF = New-Object System.Drawing.RectangleF 0, 4, $targetSize, $targetSize
    $g.DrawString($Initials.ToUpper(), $font, $txtBrush, $rectF, $sf)
    $sf.Dispose()
    $txtBrush.Dispose()
    $font.Dispose()
    $fontFamily.Dispose()
} else {
    Write-Error "Source image not found and no Initials provided: $ImagePath"
    exit 1
}

# 4. Draw 8px Profile Metallic Accent Ring
$ringColor = [System.Drawing.ColorTranslator]::FromHtml($AccentHex)
$ringPen = New-Object System.Drawing.Pen $ringColor, 8.0
$ringPen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center

$ringRadius = 141
$ringDiameter = $ringRadius * 2
$ringX = 150 - $ringRadius
$ringY = 150 - $ringRadius
$g.DrawEllipse($ringPen, $ringX, $ringY, $ringDiameter, $ringDiameter)
$ringPen.Dispose()

# Subtle inner specular highlight ring (1px at inner edge for metallic feel)
$specColor = [System.Drawing.Color]::FromArgb(90, 255, 255, 255)
$specPen = New-Object System.Drawing.Pen $specColor, 1.0
$g.DrawEllipse($specPen, [float](150 - 137), [float](150 - 137), [float](137 * 2), [float](137 * 2))
$specPen.Dispose()

$g.Dispose()

$outFullPath = Join-Path (Get-Location) $OutputPath
$bmp.Save($outFullPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Successfully generated: $outFullPath (300x300 with 8px $AccentHex ring on $BgHex)"
