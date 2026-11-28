# Shop Solution design system

[Product brief](PRODUCT.md) · [Frontend conventions](docs/constitution.md)

Shop Solution uses teal actions, blue-gray text, and light surfaces. Spacious customer pages give products and prices room to breathe. Staff workflows use the same controls and colors with compact tables, filters, and forms. These are layout choices within one theme.

## Theme and typography

Use the semantic variables in [tokens.css](src/app/tokens.css). Tailwind maps them to utilities in [globals.css](src/app/globals.css).

| Use                | Tokens                                                   | Current value                                                                                                  |
| ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Page and panel     | `background`, `card`                                     | Pale blue-gray `#f4f8f9` and white `#ffffff`                                                                   |
| Text               | `foreground`, `muted-foreground`                         | Deep blue-gray `#1c303d`, secondary text `#526876`                                                             |
| Action and link    | `primary`, `primary-foreground`, `primary-hover`, `link` | Teal `#008083` with white on filled buttons. Deep teal `#00696d` for link text and button hover.               |
| Highlights         | `highlight`, `secondary`, `muted`, `accent`              | Bright teal `#00a19c` for decorative accents. Pale teal and slate tints for selection, hover, or grouping.     |
| Borders and focus  | `border`, `border-emphasis`, `input`, `ring`             | Soft separators, slate `#91a3b1` for emphasis, darker slate `#708090` for control borders, teal keyboard focus |
| Destructive action | `destructive`, `destructive-foreground`                  | Deep red `#a22a36` with ivory text                                                                             |

Use the system sans-serif stack for controls, body copy, data, and staff workspaces. Use `font-display` (Georgia) for major public and documentation headings. Use tabular numbers for prices and numeric table columns when alignment matters. The fonts are available locally with system fallbacks.

Base layouts on Tailwind’s 4px spacing scale. Start with 20px horizontal gutters on small screens and 32px on larger ones. The shared home and docs use `max-w-6xl`; content that needs reading width or form focus can use a narrower column. Use `rounded-md` for controls and `rounded-xl` for panels.

## Components and behavior

- Use the components under [src/shared/components/ui/](src/shared/components/ui/). Prefer one filled primary action per section. Use outline or plain links for secondary actions.
- Keep visible labels on forms and retain entered values after a recoverable error. Put the message near the field and explain how to proceed. Announce async results with `role="status"` and immediate errors with `role="alert"`.
- Put actions in buttons and navigation in links. Icon-only controls need an accessible name. Use a visible focus indicator, avoid color-only status, and give key touch controls at least 44px of height.
- Show progress, empty, and error states with the affected content region. Keep filters and other user inputs available when the user can recover. Keep status terms consistent with the feature contract.
- Use real product imagery when the catalog provides it. Give product cards a consistent image ratio and use meaningful alt text where the image adds information. Keep prices, availability, actions, and status readable without the image.
- On small screens, stack form sections in task order. Let data tables scroll inside their own region or replace rows with a smaller list view. Keep page navigation and main actions visible without horizontal page scrolling.
- Keep wording plain. Use the same names for catalog products, seller offers, orders, payments, and shipments across screens.

## Reference surfaces

| Surface                     | Design direction                                                                                                                      | Current status                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Project home and docs hub   | Clear navigation to working modules, team contracts, and integration tools.                                                           | Theme applied at `/` and `/docs`.                                                                      |
| Product listing             | Search and filters first. Cards show product name, price and availability, with visible filters and a clear no-results state.         | Discovery workbench is available as a fixture-backed reference. Customer storefront is a team feature. |
| Checkout                    | Put delivery and payment progress in task order. Keep the order summary, final total, and recovery action easy to find.               | Team design and shared order/payment contracts to be agreed.                                           |
| Seller and staff workspaces | Prioritize lists, filters, line-item statuses, and actionable details. Use the same type, focus and controls as the rest of the shop. | Logistics is live in the local demo. Marketplace has a dashboard PR.                                   |

For each UI PR, state the target task, shared components used, and checks at mobile and desktop widths. Include the keyboard path and any relevant loading, empty, error, or permission state.
