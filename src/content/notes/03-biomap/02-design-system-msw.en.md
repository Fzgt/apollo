---
title: "② Design system: behaviour, styles, examples, and mocks"
section: BioMap
---

# ② Design system: behaviour, styles, examples, and mocks

> **Resume line**
>
> Built the design system on **Radix UI, Storybook and CVA** over **MSW mocks**, with component variants typed directly from the styles.

> ⚠️ **Evidence limit**: the Digital OS design-system code is not on this machine. `Prometheus` is a later example that can help explain Radix, CVA, Storybook, and MSW. It cannot prove the number of BioMap components, the Storybook setup, or the MSW handlers used there.

## What this bullet needs to show

I kept component behaviour, visual choices, examples, and API mocks as separate parts. This made component behaviour more stable, kept styles and TypeScript types together, and let frontend work continue before the real API was ready.

## First layer: answer these clearly

### 1. What did each tool do?

- **Radix UI** provided behaviour and accessibility for unstyled components such as Dialog and Dropdown.
- **CVA** kept `variant` and `size` styles in one place and created TypeScript types from them.
- **Storybook** showed components and their states without opening a full product page.
- **MSW** caught network requests and provided mock APIs for development and tests.

Storybook and MSW are separate tools. Do not say Storybook used the same MSW handlers unless the original project really had that setup.

### 2. What does “variants typed off the styles” mean?

The allowed variants are first defined with CVA. `VariantProps` then creates the component props from that definition. When a style option is added or removed, the TypeScript type changes with it. There is no second list of strings to keep in sync.

This only checks values used in TypeScript code. A string from an API or JSON still needs a runtime check.

### 3. Why use Radix instead of writing Dialog from the start?

The hard parts of Dialog are keyboard use, focus handling, Escape to close, ARIA data, and screen-reader support. Radix handles the base behaviour, and the team adds the product styles.

### 4. What problem did Storybook solve?

Developers and designers could view Button, Dialog, and other components in different variants, sizes, and disabled states. A component issue could be shown and discussed without going through a business page.

Do not claim automatic visual tests or a loading story unless you remember that BioMap really had them.

### 5. How did MSW help frontend and backend work at the same time?

MSW catches real HTTP requests, so the page still uses its normal request code. The frontend can work against an agreed API shape. When the backend is ready, the mock can be turned off without changing page logic.

## Second layer: useful concepts

### What should I watch when using Radix `asChild`?

The child component must accept the given props and pass the ref to its HTML element. After changing a button into a link or another element, the HTML meaning and keyboard use must still be correct.

### How is MSW different from mocking one function?

MSW works at the network edge and can check the URL, method, payload, and response together. Mocking one function is simpler, but it may skip the real request flow.

### How do I stop a design system from becoming too large?

Only repeated components with a stable API should move into the design system. A component used by one feature should stay there until more parts of the product truly need it.

## What we cannot prove from local code

- The real BioMap components, stories, and MSW setup are not available here.
- In `Prometheus`, the browser app and tests share handlers, but Storybook does not load MSW. The old note said all three shared one setup, which was wrong.
- Do not present the later Storybook 8 or MSW 2 code as the exact BioMap API used in 2022.

## 30-second answer

> I split the design system into four parts. Radix handled base behaviour and accessibility. CVA kept visual variants in one place and created the TypeScript props. Storybook showed component states by themselves. MSW provided mock APIs for development and tests. This kept styles and types in sync, made components easier to review, and let frontend work continue before every backend API was ready.

## Self-check

1. Can I explain the role of each tool in one sentence?
2. Can I explain which repeated definition `VariantProps` removes?
3. Can I explain that Storybook and MSW are separate tools?
4. Can I avoid presenting later Storybook 8 and MSW 2 examples as BioMap source code?
