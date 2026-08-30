---
title: "② Design system: a component contract, not a component folder"
section: BioMap
---

# ② Design system: a component contract, not a component folder

> **Resume line**
>
> Built the design system on **Radix UI, Storybook and CVA** over **MSW mocks**, with component variants typed directly from the styles.

> ⚠️ **Evidence boundary**: the Digital OS design-system repository is not on this machine. The code anchors below come from the reference implementation in my later `Prometheus` project; they demonstrate the design method, not BioMap production source.

## What this bullet actually has to prove

A design system is not valuable because it wraps a Button. It establishes a stable contract: primitives carry interaction and accessibility, visual variants have one source of truth, component states are visible in isolation, and API data can be simulated consistently before the backend is ready.

## First layer: answer these cleanly

### 1. What did Radix UI, CVA, Storybook, and MSW each do?

- **Radix UI** provided unstyled interaction primitives, including focus management, keyboard behaviour, and ARIA roles and states.
- **CVA** expressed visual variants in one configuration and derived TypeScript props from it.
- **Storybook** isolated component states for development, review, and regression checks.
- **MSW** intercepted real requests at the network layer, allowing pages, tests, and Storybook to share the same mock handlers.

They are not four unrelated names. The chain is behaviour → style contract → state catalogue → data environment.

### 2. What does “variants typed off the styles” mean?

In the reference implementation, `Button` and `Badge` define branches such as `variant` and `size` with `cva`, then generate component props through `VariantProps<typeof ...>`. Adding or removing a style variant changes the caller's type automatically, instead of requiring a second handwritten union that can drift.

This rejects invalid values at TypeScript call sites. It does not automatically validate runtime strings arriving from an API or JSON.

### 3. Why use Radix instead of writing Dialog and Dropdown from scratch?

The hard part is not drawing an overlay. It is focus trapping, Escape handling, keyboard navigation, ARIA state, and nested interactions. Radix provides those behaviours as primitives, so I can own the visual and product rules without repeatedly reimplementing accessibility mechanics.

### 4. What did Storybook solve for the team?

It made default, disabled, loading, size, and variant states visible without needing a business page. Design and engineering could review the same running state, and regressions were easier to localise to either the component or its page integration.

### 5. Why is MSW mentioned in the design-system bullet?

It is supporting infrastructure, not the centre of the claim. In the reference implementation, the browser worker and test server share `handlers`, and those handlers use the same in-memory data model. Pages, Storybook, and tests therefore see the same API shape. Frontend states can be demonstrated independently without inventing separate fake data for every environment.

## Second layer: only if they keep digging

### What is the trade-off of Radix `asChild`?

`asChild` merges behaviour and props into its child. A custom child must spread props and forward its ref; after changing the underlying element, the caller also owns whether the resulting semantics remain accessible. Radix supplies primitive behaviour, not product labels or copy.

### How is MSW different from mocking `fetch` directly?

MSW intercepts at the network boundary while the application continues through its production request code. That exercises the URL, method, payload, and response handling together. Replacing a client function is lighter, but it can bypass the real integration path.

### How do I stop a design system becoming a component graveyard?

Only repeated, stable contracts belong there. Business-specific components stay inside their feature until reuse is real. Every public component needs clear variants, states, and an exit path; “consistency” is not a reason to pour page-specific complexity into it.

## Current gaps

- The locally verifiable evidence is the `Prometheus` Button, Badge, Dialog, stories, and MSW handlers, not Digital OS source.
- TypeScript variant types are not runtime validation.
- Accessible primitives still require correct labels, copy, and product-level testing.
- MSW removes a development dependency, but mocks can still drift from the real backend without contract or integration checks.

## 30-second answer

> I treated the design system as a component contract, not a component folder. Radix handled primitive behaviour such as focus, keyboard input, and ARIA; CVA kept visual variants in one source of truth and let TypeScript derive the props directly; Storybook exposed every state; and MSW let those states run against one consistent API shape. Adding a variant therefore changed styles and types together, and a component could be reviewed without waiting for a page or backend to be complete.

## Self-check

1. Can I give one sentence for the role of Radix, CVA, Storybook, and MSW?
2. Can I explain which duplicate source of truth `VariantProps` removes?
3. Can I state the props, ref, and semantic obligations created by `asChild`?
4. Can I explain why MSW is supporting infrastructure and what it cannot solve?
