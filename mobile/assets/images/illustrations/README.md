# assets/images/illustrations/

Static illustration assets for empty states and feature highlights.

## Required files (to be produced by designer)
| File                          | Used by                               |
|-------------------------------|---------------------------------------|
| `empty_transactions.png`      | No transactions empty state           |
| `empty_team.png`              | No sub-merchants empty state          |
| `empty_notifications.png`     | No notifications empty state          |
| `empty_analytics.png`         | Not enough data for analytics         |
| `empty_search.png`            | No search results                     |
| `verification_success.png`    | Verified result hero (optional)       |

## Style guide
- Flat illustration style, consistent with brand colors.
- Use `#16A34A` and `#39FF14` as accent colors.
- Transparent background (PNG with alpha).
- Max file size: 150KB each.
- Provide @2x and @3x variants (`_2x.png`, `_3x.png`).

## Rules
- No > 200KB assets in bundle.
- Illustrations are loaded via `Image.asset(...)`.
- If an illustration is missing, `AppEmptyState` falls back to an icon.
