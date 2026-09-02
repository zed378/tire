# Layout Fixes - Navbar Sticky Implementation

## Problem Fixed

Navbar (header) ikut scroll saat user scroll content. Seharusnya header tetap visible di atas.

## Root Cause

1. **Parent container overflow issue**: `<div className="flex flex-1 flex-col">` tidak punya `min-h-dvh` sehingga tidak proper manage height
2. **Z-index conflict**: z-30 tidak cukup dominant
3. **Flex layout confusion**: Main content punya `overflow-y-auto` tetapi parent flex container tidak cukup constrain

## Solution Implemented

### 1. **AppShell Layout (app-shell.tsx)**

**Changes:**
- Added `min-h-dvh` ke inner flex container untuk proper height management
- Changed header z-index dari `z-30` → `z-40` untuk proper stacking
- Added `flex-shrink-0` ke header agar tidak compress
- Ensured `overflow-y-auto` hanya di main element, bukan parent

**Structure:**
```
<div className="flex min-h-dvh"> (outer container)
  <Sidebar /> (fixed width, no scroll)
  <div className="flex flex-1 flex-col min-h-dvh"> (flex column with min height)
    <header className="sticky top-0 z-40 flex-shrink-0"> (sticky, no scroll)
      ...
    </header>
    <main className="flex-1 overflow-y-auto"> (scrollable content)
      ...
    </main>
  </div>
</div>
```

### 2. **Sidebar Layout (sidebar.tsx)**

**Changes:**
- Removed `md:` responsive conditional dari outer div
- Made desktop sidebar `hidden md:flex` (hidden mobile, flex on md+)
- Added `flex-shrink-0` ke header dan footer sections agar tidak compress
- Ensured sidebar adalah fixed width `w-64` on desktop, hidden on mobile
- Mobile menu handled via fixed positioning overlay (unchanged)

**Structure:**
```
<aside className="hidden md:flex h-dvh w-64 flex-shrink-0"> (fixed width, no scroll)
  <div className="...flex-shrink-0"> (header - no compress)
    ...
  </div>
  <nav className="flex-1 overflow-y-auto"> (scrollable navigation)
    ...
  </nav>
  <div className="...flex-shrink-0"> (footer - no compress)
    ...
  </div>
</aside>
```

## Key CSS Classes Used

| Class | Purpose |
|-------|---------|
| `sticky top-0` | Header stays at top during scroll |
| `z-40` | Ensures header stays above content |
| `flex-shrink-0` | Prevents header/footer from compressing |
| `min-h-dvh` | Minimum height of viewport |
| `overflow-y-auto` | Content area scrolls, not parent |
| `hidden md:flex` | Desktop sidebar, hidden mobile |
| `fixed inset-0 z-50` | Mobile menu overlay |

## Layout Flow

### Desktop View (md+)
```
┌─────────────────────────────────────────┐
│ Sidebar (fixed, w-64)    │ Header (sticky, z-40) │
│ - Logo                   ├─────────────────────────┤
│ - Nav (scrollable)       │                         │
│ - User info              │ Main Content (scrollable)
│                          │                         │
│                          │                         │
└─────────────────────────────────────────┘
```

### Mobile View
```
┌─────────────────────────┐
│ Header (sticky, z-40)   │
├─────────────────────────┤
│ Main Content (scrollable)
│                         │
│                         │
└─────────────────────────┘

[Sidebar overlay on top when open]
```

## Testing

✅ Header should NOT scroll with content
✅ Header should be visible at top always
✅ Sidebar (desktop) should NOT scroll with main content
✅ Main content scrolls independently
✅ Mobile menu overlay works properly
✅ Z-index stacking correct (header above content, mobile menu above header)
✅ No layout jumps or flickering

## Browser Compatibility

- Works on all modern browsers
- Uses `dvh` (dynamic viewport height) for better mobile support
- Flexbox layout widely supported
- Sticky positioning widely supported

## Related Files Modified

- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/components/layout/sidebar.tsx`

## No Breaking Changes

All changes are layout/CSS only. No JavaScript logic or component behavior changed.
