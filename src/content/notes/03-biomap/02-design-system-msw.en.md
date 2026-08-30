---
title: "② Design system: behaviour, styles, display, mocks"
section: BioMap
---

# ② Design system: behaviour, styles, display, mocks

> **Resume line**
>
> Built the design system on **Radix UI, Storybook and CVA** over **MSW mocks**, variants typed off the styles.

## What this line has to show

A design system is not "we wrapped a Button". It splits a component into four jobs that do not overlap: interaction behaviour, visual variants, standalone display, and data. Each job has one source of truth, so styles and types are never written twice.

## Layer one: answer these without thinking

### 1. What does each of the four tools do?

- **Radix UI**: unstyled interaction primitives. Focus handling, keyboard, Esc to close, ARIA roles and state.
- **CVA** (class-variance-authority): keeps all visual variants in one config, and derives the TypeScript props from that config.
- **Storybook**: shows every state of a component on its own, outside any business page.
- **MSW**: intercepts real network requests, so pages and tests share the same mock handlers.

The chain is: **behaviour → style contract → state catalogue → data**.

### 2. What does "variants typed off the styles" mean?

First define the allowed style branches with `cva`, then derive the props from that same definition with `VariantProps`:

```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:     'border border-input bg-background hover:bg-accent',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:       'hover:bg-accent hover:text-accent-foreground',
        link:        'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 rounded-md px-3 text-xs',
        lg:      'h-10 rounded-md px-8',
        icon:    'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;
```

`VariantProps<typeof buttonVariants>` turns `variant` into `'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'`. Add a style branch and callers get a new valid value straight away. Remove one and every old use turns red.

**There is only one copy of that type.** No hand-written union sitting next to the styles, slowly drifting out of date.

One limit worth saying out loud: this only checks TypeScript callers. A string arriving from an API or JSON still needs a runtime check.

### 3. Why use Radix instead of writing Dialog and Dropdown yourself?

Drawing the box was never the hard part. The hard part is trapping focus inside the dialog, closing on Esc, keeping Tab from walking into the background, arrow-key navigation in a menu, keeping `aria-expanded` and `aria-controls` in sync, and layering nested overlays. Radix ships that as primitives. I only add the visuals and the product rules, instead of rebuilding accessibility details and probably getting them wrong.

### 4. What does Storybook solve for a team?

Default, disabled, loading, every size and variant — you can see them all without first walking into some page and setting up that exact state. Design and engineering look at the same running state. When something breaks, you can tell straight away whether the component broke or the page integration broke.

### 5. Why does MSW belong in this line?

It is the base layer that lets the other three run on their own. The browser worker and the test server share one set of `handlers`, and the handlers sit on one in-memory data model:

```ts
// mocks/handlers.ts — one set of handlers
export const handlers = [...postsHandlers, ...commentsHandlers];

// mocks/browser.ts — development
export const worker = setupWorker(...handlers);

// mocks/server.ts — tests
export const server = setupServer(...handlers);
```

Pages and tests then see exactly the same API shape. You never end up with one set of fake data for development and a different one for tests. It also means the frontend does not wait for the backend: when the real API lands you switch the mock off, and no page code changes.

## Layer two: extra background

### What does Radix's `asChild` cost?

`asChild` merges Radix's behaviour and props into the child you pass, instead of adding another DOM layer. The cost: your child component must pass props through and must use `forwardRef`, or the behaviour silently stops working. And once you swap the underlying element (a button for a link, say), keeping the semantics and keyboard behaviour correct is your job, not Radix's.

### How is MSW different from just mocking a function?

MSW intercepts at the network boundary, so the app still runs the request code it uses in production. URL, method, payload and response handling all get exercised. Replacing a client function is easier, but it skips the real path — change the API signature and the test stays green.

### How do you stop a design system turning into a component graveyard?

Only take in things that repeat and whose contract is stable. A component that serves one feature stays inside that feature until there is a second and third use. Every shared component needs clear variants, clear states and a clear way out — rather than absorbing every page detail in the name of consistency.

## The 30-second answer

> I split the design system into four jobs. Radix gives unstyled interaction primitives and owns focus, keyboard and ARIA. CVA keeps every visual variant in one config, and the component props are derived from that config with `VariantProps`, so styles and types have a single source. Storybook shows each state on its own, away from business pages. Underneath, MSW intercepts requests at the network layer, and the browser and the tests share the same handlers — so components can be built, reviewed and tested without waiting for the backend. Add a variant and the styles and the types move together.

## Self-check

1. Can you say in one sentence what Radix, CVA, Storybook and MSW each own?
2. Can you explain which duplicated definition `VariantProps` removes?
3. Can you say what `asChild` requires around prop forwarding and refs?
4. Can you explain what MSW checks that mocking a function does not?
5. Can you explain why variant types are not runtime validation?
