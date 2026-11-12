param(
    [string]$ImagePath = "artautas.jpg",
    [string]$OutputPath = "avatar-artautas.png",
    [string]$AccentHex = "#C8D2DC",
    [string]$BgHex = "#0F2B4C"
)

Add-Type -AssemblyName System.Drawing

$srcPath = Resolve-Path $ImagePath
if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found: $ImagePath"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)
Write-Output "Source Image Loaded: $($srcImg.Width) x $($srcImg.Height)"

$targetSize = 300
$bmp = New-Object System.Drawing.Bitmap $targetSize, $targetSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# 1. Fill Deep Sapphire Canvas
$bgColor = [System.Drawing.ColorTranslator]::FromHtml($BgHex)
$bgBrush = New-Object System.Drawing.SolidBrush $bgColor
$g.FillRectangle($bgBrush, 0, 0, $targetSize, $targetSize)
$bgBrush.Dispose()

# 2. Square Face Crop from Source Image
$minDim = [Math]::Min($srcImg.Width, $srcImg.Height)
$srcX = [int](($srcImg.Width - $minDim) / 2)
# Subtle facial crop bias towards top (20% offset)
$srcY = [int]([Math]::Max(0, ($srcImg.Height - $minDim) * 0.2))

# 3. Clip to Inner Circle (radius 142)
$clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$innerRadius = 142
$innerDiameter = $innerRadius * 2
$clipX = 150 - $innerRadius
$clipY = 150 - $innerRadius
$clipPath.AddEllipse($clipX, $clipY, $innerDiameter, $innerDiameter)
$g.SetClip($clipPath)

# Draw image into clipped region
$destRect = New-Object System.Drawing.Rectangle $clipX, $clipY, $innerDiameter, $innerDiameter
$srcRect = New-Object System.Drawing.Rectangle $srcX, $srcY, $minDim, $minDim
$g.DrawImage($srcImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.ResetClip()
$clipPath.Dispose()

# 4. Draw 8px Matte Silver Accent Ring
$ringColor = [System.Drawing.ColorTranslator]::FromHtml($AccentHex)
$ringPen = New-Object System.Drawing.Pen $ringColor, 8.0
$ringPen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center

# Center line of 8px pen at radius 141 so it covers 137 to 145 cleanly inside 300x300
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
$srcImg.Dispose()

$outFullPath = Join-Path (Get-Location) $OutputPath
$bmp.Save($outFullPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Successfully generated: $outFullPath (300x300 with 8px $AccentHex ring on $BgHex)"
