# InviteUrlInput Component

A React component that allows users to join rooms using full invite URLs, specifically designed for PWA environments where the URL bar is not visible.

## Features

- **Full Invite URL Support**: Accepts complete invite URLs with optional role parameters
- **Clipboard Integration**: One-click paste from clipboard
- **URL Validation**: Validates invite URL format
- **Error Handling**: Clear error messages for invalid inputs
- **Loading States**: Visual feedback during navigation
- **PWA Optimized**: Perfect for Progressive Web Apps without visible URL bars
- **Direct Navigation**: Navigates directly to the full URL without modification

## Usage

```tsx
import { InviteUrlInput } from "@/features/rooms";

function Lobby() {
  return (
    <div>
      {/* Other lobby content */}
      <InviteUrlInput />
    </div>
  );
}
```

## Supported URL Format

**Full Invite URLs**: `https://<base_url>/invite/<room_id>?role=<role>`

Examples:
- `https://example.com/invite/room123?role=band_member`
- `https://example.com/invite/room456?role=audience`
- `https://example.com/invite/room789` (without role parameter)

## Role Parameter Validation

The component validates the `role` query parameter when present:
- **Valid roles**: `band_member`, `audience`
- **Invalid roles**: Any other value will show an error
- **Optional**: URLs without role parameter are accepted

## Component Structure

- `InviteUrlInput/index.tsx` - Main component
- `InviteUrlInput.test.tsx` - Comprehensive test suite
- `../hooks/useInviteUrl.ts` - Business logic hook

## Hook: useInviteUrl

The component uses the `useInviteUrl` hook which provides:

- URL parsing and validation
- Navigation handling
- Error state management
- Clipboard integration

## Testing

The component includes comprehensive tests covering:

- Rendering and basic functionality
- URL format validation
- Navigation behavior
- Error handling
- Clipboard integration
- User interactions

Run tests with:
```bash
npm test -- InviteUrlInput.test.tsx
```

## Integration

The component is integrated into the Lobby page below the room list, providing an alternative way to join rooms when users have invite URLs but can't access the browser's address bar (common in PWA mode).