---
title: "② The design system: behaviour, styles, display, mocks"
section: BioMap
---

# ② The design system: behaviour, styles, display, mocks

> **Resume line**
>
> Built the design system on **Radix UI, Storybook and CVA** over **MSW mocks**, variants typed off the styles.

## What this line has to show

The value of a design system is not "we wrapped a Button". It is that a component is split into four non-overlapping concerns — interaction behaviour, visual variants, isolated display, and the data environment — each with a single source of truth, so the styles and the types are never maintained twice. This line names four tools, so when you talk about it, give each one its own job and chain them together. Do not just recite four names side by side.

## What each tool owns

**Radix UI owns behaviour.** It gives you unstyled interaction primitives: focus management, keyboard handling, close on Escape, ARIA roles and states. What it looks like is entirely yours.

**CVA owns the style contract.** `class-variance-authority` puts the visual variants in one config and derives the component's TypeScript props straight from that config.

**Storybook owns display.** Every state of a component runs on its own, without first navigating to some page and manufacturing some particular condition.

**MSW owns the data environment.** It intercepts real requests at the network layer, so the app and the tests share one set of mock handlers.

Chained: behaviour, then the style contract, then the state catalogue, then the data environment. Memorise that chain — it is the answer to "how do these four relate".

## What "variants typed off the styles" means

First `cva` defines the allowed style branches — say six variants (default, destructive, outline, secondary, ghost, link), four sizes (default, sm, lg, icon), each mapping to a class string, plus a set of defaults. Then `VariantProps`, the helper type cva ships, generates the component's props from that same definition.

So the `variant` prop's type *is* the union of those six strings. Add a style branch and callers automatically get a new legal value; remove one and every old usage fails to compile.

The point is that there is only one copy of this type. There is no hand-written union sitting beside the styles, slowly drifting out of sync — and that drift is the most common way a design system rots.

State the boundary out loud too: this only covers TypeScript callers. A runtime string arriving from an API or a JSON blob still has to be validated, because the type system does not exist at runtime.

## Why Radix instead of writing Dialog and Dropdown myself

Drawing an overlay was never the hard part. The hard part is trapping focus inside the dialog, closing on Escape, keeping Tab from wandering into the background, arrow-key navigation between menu items, keeping `aria-expanded` and `aria-controls` in sync, and getting the layering right for nested overlays.

These are accessibility details: fiddly to implement, and easy to get wrong without noticing. Radix ships them as primitives, so I only own the visuals and the product rules instead of reimplementing all of that — most likely worse.

## What Storybook solves for the team

Default, disabled, loading, every size and every variant are visible without navigating to a business page and manufacturing a state first. Design and engineering look at the same runnable list of states and can point at them in review.

It has a second use when something breaks: it separates "the component is broken" from "the page integration is broken". If the component is fine in Storybook, the problem is on the page side.

## Why MSW belongs in this line

It is the substrate that lets the other three run independently. The browser worker and the test server share one set of handlers, and those handlers sit on the same in-memory data model.

So the app and the tests see exactly the same API shape. You never end up with one set of fake data in development and a different set in tests, quietly diverging. And the frontend does not have to wait for the backend: when the real API lands you turn the mocks off, and no page code changes.

## Background

**What `asChild` costs.** `asChild` merges Radix's behaviour and props onto the child element you pass instead of wrapping another DOM node. The cost is that the child must forward its props and forward its ref, or the behaviour silently stops working. And once you swap the underlying element — a `button` for an `a` — whether the semantics and keyboard behaviour are still correct is the caller's problem.

**MSW versus just mocking a function.** MSW intercepts at the network boundary, so the app still runs its production request code — URL, method, payload and response handling are all verified along with it. Replacing the client function is easier but skips the real integration path, so when the API signature changes the test stays green. That is the most dangerous kind of green.

**How to stop a design system becoming a component graveyard.** Only take in things that recur *and* have a stable contract. A component serving one feature stays inside that feature until a second and third use actually appear. Every shared component needs clear variants, clear states and a clear escape hatch, rather than absorbing every page's details in the name of consistency.

## The 30-second answer

> I split the design system into four responsibilities. Radix provides unstyled interaction primitives and owns focus, keyboard and ARIA. CVA keeps the visual variants in one config, and the component's props are derived from that config, so the styles and the types have a single source of truth. Storybook shows every state on its own, outside any business page. Underneath, MSW intercepts at the network layer so the browser and the tests share one set of handlers — components can be built, reviewed and tested without waiting for the backend. When someone adds a variant, the styles and the types move together and nothing is missed.

## Self-check

1. Can you state each of Radix, CVA, Storybook and MSW's job in one sentence?
2. Can you explain which duplicate definition `VariantProps` removes?
3. Can you say what `asChild` requires of prop forwarding and refs?
4. Can you explain why intercepting at the network layer verifies more than mocking a function?
5. Can you explain why a variant type is not runtime validation?
