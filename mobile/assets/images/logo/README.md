# assets/images/logo/

Yene Verify logo assets.

## Required files
| File                    | Use                                      |
|-------------------------|------------------------------------------|
| `logo_light.svg`        | Full logo (mark + wordmark), light bg    |
| `logo_dark.svg`         | Full logo (mark + wordmark), dark bg     |
| `logo_mono.svg`         | Monochrome (black or white)              |
| `mark_light.svg`        | Icon mark only, light bg                 |
| `mark_dark.svg`         | Icon mark only, dark bg                  |
| `wordmark.svg`          | Text only, no mark                       |
| `app_icon_1024.png`     | App store icon (1024×1024, no alpha)     |
| `splash_light.png`      | Splash screen logo, light                |
| `splash_dark.png`       | Splash screen logo, dark                 |

## Logo brief (for designer)
- Mark: shield or receipt-edge checkmark, or stylized "Y" that doubles as a checkmark.
- Wordmark: geometric sans-serif, medium weight, tight tracking.
- "Yene" = regular weight. "Verify" = semibold.
- Accent variant: `#39FF14` as the checkmark stroke only.
- App icon: rounded square, `#16A34A` background, white "Y-check" mark, no text.
- Clear space: min 1× cap-height around logo.
- Min size: 24px height for mark, 120px width for wordmark.

## Rules
- SVG for all vector assets (optimize with svgo).
- PNG only for splash and app icon.
- No asset > 200KB. Larger = download on demand.
