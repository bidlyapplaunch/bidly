## Customization System Overview

The theme and widget customization stack now lives behind a single API surface and shared data model.

### Data Model

- `CustomizationSetting` (`auction-backend/models/CustomizationSetting.js`) stores a `shop`, `type` (`widget` or `marketplace`), normalized `settings`, and `version`.
- Colors are validated as 6-digit hex codes; border radius, box shadow, fonts, and templates are restricted to curated enums.

### Service Layer

`auction-backend/services/customizationService.js` handles:

- Normalizing partial payloads against template defaults (Templates A–D for widget & marketplace).
- 30-second in-memory caching per `shop:type`.
- Input validation + hex checking.
- Preview payloads (`/api/customization/:type/preview?state=`) for admin live previews.
- Meta catalog (fonts, palettes, templates) for the admin UI.

### Endpoints

Mounted under `/api/customization/:type` (`customizationSettings.js`):

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| `GET` | `/api/customization/widget?shop=` | optional | Returns `{ success, shop, type, settings, version, updatedAt }`. Add `includeMeta=1` to receive template, palette, and options metadata. |
| `PUT` | `/api/customization/widget?shop=` | requires | Saves normalized settings, increments version, and returns updated payload. |
| `GET` | `/api/customization/widget/preview?state=` | requires | Provides deterministic preview data for `pending`, `active`, and `ended` states. |
| Same | `/api/customization/marketplace` | | Mirror behavior for marketplace styling. |

`shop` parameter may be supplied via query, headers (`x-shopify-shop-domain`), or request body.

### Admin Frontend

- New hook `useCustomizationSettings` centralizes fetching, saving, preview state, template and palette application, and form state tracking.
- `WidgetCustomizationSettings` & `MarketplaceCustomizationSettings` pages consume the hook, provide live preview (widget uses iframe + CSS variables; marketplace renders sample cards) and template selection UIs.
- Dashboard top-level tab now links out to `/customization/widget` / `/customization/marketplace`.

### Storefront Widget

- `auction-app-embed.js` fetches widget settings once on load (`GET /api/customization/widget?shop=`) and injects scoped CSS variables via `<style id="bidly-widget-theme">`. Re-applies the theme after polling refreshes.
- CSS variables are defined under `.bidly-widget-root`. Additional template classes (`bidly-template-A..D`) allow layout tweaks purely via CSS.

### Marketplace Frontend

- `themeService.loadTheme` now pulls `/api/customization/marketplace?shop=` and injects CSS variables into `:root`, wrapping the layout in `.bidly-marketplace-root`.
- Polaris-based components inherit colors via custom properties; additional overrides ensure customer auth modals respect the theme.

### Cache Busting & Versioning

- Each save increments `version`. Consumers can append `?v=version` to assets if needed; the widgets currently rely on fetching fresh settings when instantiated, but the version is available on the response for future cache strategies.

### Safety

- Validation prevents gradients, colors, or radii outside the curated set.
- Gradient fallback toggles allow disabling header gradients (widget & marketplace) while retaining solid backgrounds.
- Public GET endpoints default to safe templates if the shop has not saved settings.

Refer to `auction-admin/src/hooks/useCustomizationSettings.js` and `auction-backend/services/customizationService.js` for the authoritative schema.


