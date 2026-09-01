---
title: "② The design system: behaviour, styles, display, mocks"
section: BioMap
---

# ② The design system: behaviour, styles, display, mocks

> **Resume line**
>
> Built the design system on **Radix UI, Storybook and CVA** over **MSW mocks**, variants typed off the styles.

## Terms, in one line each

**Radix UI** — a **headless (unstyled)** React interaction library. **Behaviour only, no appearance.**

**Primitive** — the smallest composable building block; here, components like `Dialog` and `DropdownMenu` that own interaction logic and nothing else.

**CVA (class-variance-authority)** — a small library that expresses "which visual branches this component has" as one config and **derives the TypeScript types from that same config**.

**Variant** — one visual branch of a component: a Button's `default` / `destructive` / `outline`.

**Storybook** — a workbench that runs every state of every component **outside any business page**.

**MSW (Mock Service Worker)** — a mocking library that intercepts **at the network layer**: a Service Worker in the browser, a Node server in tests, **both sharing one set of handlers**.

**ARIA** — HTML attributes telling assistive technology what something is and what state it is in, such as `aria-expanded`.

## What this line has to show

A design system's value is not "we wrapped a Button". It is **splitting a component into four non-overlapping concerns**: interaction behaviour, visual variants, isolated display, data environment. **Each has one source of truth, and styles and types are not maintained twice.**

The line names four tools. When you talk about it, **give each one its post and chain them** — do not recite four names side by side.

## What each tool owns

**Radix owns behaviour.** Unstyled interaction primitives: focus management, keyboard handling, Esc to close, ARIA roles and state. **What it looks like is entirely yours.**

**CVA owns the style contract.** Visual variants become one config, **and the component's props types are derived from that config.**

**Storybook owns display.** Every state of a component runs on its own, **without navigating to a page and constructing a particular piece of data to see it.**

**MSW owns the data environment.** It intercepts real requests at the network layer, **so pages and tests share one set of mock handlers.**

**Chained: behaviour → style contract → state catalogue → data environment.** Memorise that sentence; it is the answer to "how do these four relate".

## What "variants typed off the styles" means

```ts
const buttonVariants = cva('inline-flex items-center justify-center rounded-md', {
  variants: {
    variant: { default: '...', destructive: '...', outline: '...',
               secondary: '...', ghost: '...', link: '...' },
    size:    { default: 'h-10 px-4', sm: 'h-9 px-3', lg: 'h-11 px-8', icon: 'h-10 w-10' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

// ↓ the type is not hand-written; it is derived from the config above
interface ButtonProps extends VariantProps<typeof buttonVariants> {}
```

The result: **the `variant` prop's type is automatically the union of those six strings.** Add a style branch and callers gain a legal value; remove one and **every stale usage fails to compile immediately.**

**The point is that there is exactly one copy of that type.** No hand-written union sitting alongside it, drifting — and **a hand-written type that no longer matches the styles** is the most common way a design system rots.

**State the boundary unprompted**: this is **compile-time only**. Strings arriving at runtime from an API or JSON **still need validating**; the type system does not exist at runtime.

## Why Radix rather than writing Dialog and Dropdown yourself

**Drawing a floating panel was never the hard part.** The hard part is: trapping focus inside the dialog, closing on Esc, keeping Tab from cycling out into the background, arrow-key navigation between menu items, keeping `aria-expanded` and `aria-controls` in sync, and getting nesting order right.

**These are accessibility details: fiddly to implement and hard to notice when wrong.** Radix ships them as primitives, so I own the visuals and the product rules and **do not reimplement them — probably worse.**

## What Storybook solves for a team

`default`, `disabled`, `loading`, every size and variant — **all visible without navigating to a page and constructing a particular state.** Design and engineering look at **the same runnable list of states** and can point at it in review.

It has a second use when something breaks: **it separates "the component is broken" from "the page integration is broken" instantly.** If the component is fine in Storybook, the fault is on the page side.

## Why MSW belongs in this line

**It is the substrate that lets the other three run independently.** The browser worker and the test server **share one set of handlers**, and the handlers sit on one in-memory data model.

So **pages and tests see exactly the same API shape** — no drift between one set of fake data for development and another for tests. And the frontend does not wait on the backend; **when the real API lands you turn the mocks off and change no page code.**

## Background

**What Radix's `asChild` costs.** `asChild` merges Radix's behaviour and props **onto the child you pass** instead of wrapping another DOM node. The cost: **the child must spread its props through and must forward its ref**, or the behaviour breaks — **and it breaks silently.** And once you swap the underlying element — `button` for `a` — **the caller owns whether the semantics and keyboard behaviour are still correct.**

**How MSW differs from mocking a function directly.** **MSW intercepts at the network boundary**, so the app still runs its production request code: **URL, method, payload and response handling are all exercised.** Replacing the client function is easier, but **it skips the real integration path, and the test stays green when the API signature changes** — the most dangerous kind of **false green**.

**How to stop a design system becoming a component graveyard.** **Only admit things that recur and whose contract is stable.** A component serving one business area stays inside that feature until a second and third use actually appear. Every shared component needs clear variants, states and an **escape hatch**, rather than absorbing every page's details in the name of consistency.

## The 30-second answer

> I split the design system into four responsibilities. Radix provides unstyled interaction primitives and owns focus, keyboard and ARIA. CVA collects the visual variants into one config, and the component's props types are derived from it with VariantProps, so the styles and the types have a single source of truth. Storybook displays every state outside any business page. Underneath, MSW intercepts at the network layer with one set of handlers shared by the browser and the tests, so components can be built, reviewed and tested without waiting on the backend. When a new variant is added, the styles and the types move together and nothing is missed.

## Self-check

1. Can you state each of Radix, CVA, Storybook and MSW's responsibility in one line, and chain them?
2. Can you explain which duplicate definition `VariantProps` removes?
3. Can you state `asChild`'s requirements on prop spreading and ref forwarding, and why failure is silent?
4. Can you explain what intercepting at the network boundary verifies that mocking a function does not?
5. Can you explain why a variant type is not runtime validation?
