# SWAAR UI · v0.1

A light-theme web design system for productivity software. The default is Cobalt. The Plum theme demonstrates a second client identity. All sample records are fictional.

## Try the packing queue

Unzip the entire folder, then open `example.html` in a current browser. The example loads its font, icons, CSS, and JavaScript from the folder. Filter to Ready, search a customer, choose Mark packed, and choose Undo. Change Theme to compare two client palettes. New pick list opens a two-field form. Each reload restores the sample data.

## Add it to a web app

Copy `tokens.css`, `components.css`, and `assets/` together into your project. Preserve the relative path from tokens.css to the font. Retain `licenses/` with distributions. Import the CSS once at your app entry point. The HTML and JavaScript files demonstrate behavior and do not need to ship with your app.

```tsx
import './ui/tokens.css';
import './ui/components.css';

type PackingActionProps = {
  orderId: string;
  onPack: (orderId: string) => void;
};

export function PackingAction({orderId, onPack}: PackingActionProps) {
  return (
    <button type="button" className="sw-btn sw-btn--quiet"
      aria-label={`Mark ${orderId} packed`} onClick={() => onPack(orderId)}>
      Mark packed
    </button>
  );
}
```

Put `className="sw-ui"` on the application root. Put `data-sw-theme="plum"` on the same root to try the alternate theme. Scope `data-sw-density="compact"` to a container around a table for desk-based work. The default table rows are 48 px, compact rows are 40 px, and coarse-pointer targets grow to 44 px. At phone widths the sample table groups each record across several lines. Row heights are minimums and grow to fit content.

## Give a client their own accent

Add a theme to a stylesheet loaded after tokens.css. Define all five color roles together. The default assigns blue to brand actions and a separate blue-gray pair to informational status. The Plum sample keeps the status colors consistent. A logo or a client name belongs in the workspace header.

```css
[data-sw-theme="orchard"] {
  --sw-accent: #315D49;
  --sw-accent-hover: #234735;
  --sw-accent-soft: #EAF3EC;
  --sw-on-accent: #FFFFFF;
  --sw-focus: #315D49;
}
```

Check button text on accent and hover, action text on white and the soft tint, and the focus ring against the surrounding surface. For normal text target at least 4.5:1. Aim for at least 3:1 for visible input boundaries and focus indicators against adjacent colors. Distinguish progress with an icon and a text label when the brand shares a hue with a status.

## Component contracts

| Element | Default behavior |
| --- | --- |
| Button | A verb and its object. Use one filled primary action within a task area. Use quiet buttons for repeated row actions. Show the pending label and suppress duplicate submissions while saving. |
| Search and filter | Keep frequent filters visible. Apply each change immediately. Preserve filters, scroll position, and keyboard focus after inline edits. When a record leaves the filtered list, focus the next available action. |
| Reversible change | Show the changed record and an Undo action. The example supports the latest packing change until the next mutation or reload. In a connected app, show a pending state, reconcile with the server, and restore the prior value on failure. |
| Committed action | Before posting an invoice or booking a shipment, show the order ID, quantity, destination, and consequence. Use a specific action label such as Book shipment. |
| Field | Keep a visible label above the field. Use `aria-describedby` to associate help or inline error text. Preserve entered values on errors and move focus to the first invalid field on submit. |
| Dialog | Use for a short task with a clear completion point. Give it a heading, focus the first meaningful field, support Escape and Cancel, and restore focus on close. |
| Status | Neutral for routine, green for completed, amber for attention, red for blocked/error, blue-gray for information. Pair the color with words. Reserve badges for status that changes the next decision. |
| Table | Left-align names and IDs. Right-align quantities, prices, and amounts with tabular figures. Use a quiet row divider. Give bulk actions a visible count of the selected records. |
| Loading, empty, error | Match loading placeholders to the expected layout and announce progress. Distinguish a new list (“Create your first pick list”) from filtered results (“Clear filters”). On failure retain input, name what failed and provide Retry. |
| Keyboard and motion | Use native buttons, inputs, and dialogs. Keep DOM and visual order aligned, keep a visible focus ring, and support reduced motion. Use 120 ms for small feedback and up to 180 ms for a panel. |

## Files and portability

- `tokens.css` provides the web defaults. Dimensions use rem where text scaling matters.
- `tokens.json` carries the same core design values as numbers and hex colors. Web values use CSS pixels at a 16 px root. In an Expo app, map the type roles to Text styles with font scaling enabled and test touch targets on device.
- `components.css` supplies reusable typography, buttons, fields, statuses, dialogs, and tables, scoped to `.sw-ui`.
- `assets/icons/` contains 16 individual Lucide SVGs on a 24-unit grid. Use 16 px beside text, 20 px in navigation, and 24 px for a standalone symbol. Use an accessible name for icon-only buttons and hide decorative icons from assistive technology. For JSX, use the equivalent named icons from lucide-react if you already use it.
- `example.html`, `example.css`, and `example.js` make up the self-contained reference workflow. The SVG symbols used by the example are embedded to support opening it directly from disk.
- The PDF field guide provides visual specimens and usage rules for design reviews.

## References and licenses

Inter by The Inter Project Authors, SIL Open Font License 1.1. [Typeface](https://rsms.me/inter/). See licenses/Inter.txt.

Lucide, with Feather-derived icons. [Design guide](https://lucide.dev/contribute/icons/design-principles). See licenses/Lucide.txt.

W3C. [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
