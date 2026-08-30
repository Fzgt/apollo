---
title: "① Architecture boundaries: putting the rules into ESLint"
section: BioMap
---

# ① Architecture boundaries: putting the rules into ESLint

> **Resume line**
>
> Led the **React 18 and TypeScript architecture** for Digital OS, the team's core consumer-facing product, enforcing feature boundaries with **five custom ESLint import zones: no feature can reach into another**.

## What this line has to show

Code is organised by business feature. Dependencies only flow one way. And that direction is not a note in the README that people have to remember — it is an ESLint rule that stops you in the editor and in CI.

## Layer one: answer these without thinking

### 1. What is Digital OS? What does "led the architecture" mean?

Digital OS is the team's core consumer product. "Led" does not mean I wrote every page. It means I decided three things: how the code is layered, how features are organised, and which imports are not allowed — plus how that gets checked automatically.

### 2. What is the dependency direction?

```
app  →  features  →  components / hooks / lib / types / utils
```

- `app`: routes, providers, the global entry point. It wires things together.
- `features`: one folder per business capability, each with its own `api/`, `components/`, `hooks/`, `types/`.
- The shared folders: stable, general code with no business meaning.

An upper layer may depend on a lower one. A lower layer must never know about an upper one. And two features must never reach into each other's files.

### 3. What do the five import zones protect?

This uses `import/no-restricted-paths` from `eslint-plugin-import`:

```js
'import/no-restricted-paths': [
  'error',
  {
    zones: [
      // Zones 1-3: each feature may only import from itself
      { target: './src/features/blog',     from: './src/features', except: ['./blog'] },
      { target: './src/features/comments', from: './src/features', except: ['./comments'] },
      { target: './src/features/theme',    from: './src/features', except: ['./theme'] },

      // Zone 4: features may not import from app
      { target: './src/features', from: './src/app' },

      // Zone 5: shared code may not import from features or app
      {
        target: './src/(components|hooks|lib|types|utils)',
        from: './src/(features|app)',
      },
    ],
  },
],
```

How to read it: `target` is "who", `from` is "what it may not touch", `except` is "apart from its own folder".

The first three keep features apart, one rule per feature. The fourth stops a lower layer depending on the entry layer. The fifth stops shared components depending on business code. Next to them sits `import/no-cycle: 'error'`, which catches circular imports the zones do not cover.

> If they ask "why five and not one": feature isolation needs one rule per feature, because `except` has to point at that feature's own folder. More features means more zones.

### 4. Why ESLint instead of the README?

A README only reminds you. Someone has to remember it, or a reviewer has to happen to notice. ESLint shows a red line while you type and blocks the merge in CI. The rule stops being an agreement and becomes a check that runs on every commit.

### 5. What if two features need to work together?

Three legal ways, pick one:

1. Call the other feature through its **public entry point** (the barrel export). Never touch its internal files.
2. **Compose** them one level up, in `app` or in the page.
3. Move the genuinely general part **down into the shared layer**.

The boundary limits how you depend on code, not whether features can work together.

## Layer two: extra background

### Why is feature-first better than folders by file type?

With `components/`, `hooks/`, `services/` spread sideways, one feature's code sits in three or four folders. You cannot see what a change affects, and deleting a feature means searching the whole project. With feature folders, the API, components, hooks and types live together. You can move the whole folder, or delete the whole folder.

### TypeScript already checks types. Why also ESLint?

TypeScript decides whether an import compiles. It does not decide whether this layer should know about that layer. An import can be perfectly typed and still break the architecture. Correct types and correct architecture are two different things.

### What does a barrel export cost?

A feature's `index.ts` decides what the outside world can use. If the entry is too wide, internal code slowly becomes a public API and you can no longer refactor it. A narrow entry is what makes the inside safe to change.

### Are the boundaries too strict?

Sometimes. So the rules have to grow with the real dependency graph. If the same cross-feature need keeps coming back, it usually means a public API or a shared module is missing — not that the rule should be turned off.

## The 30-second answer

> Once Digital OS grew, I did not want module boundaries to depend on team memory. I organised the code by business feature, fixed the dependency direction as app → features → shared layer, then locked it in with five ESLint import zones. The first three let each feature import only from itself. The fourth stops features importing from app. The fifth stops shared code knowing about business code. A separate rule catches circular imports. A bad import goes red in the editor and blocks the merge in CI. When two features need each other, they go through a public entry point, get composed one level up, or share code that moved down — never straight into another feature's folder.

## Self-check

1. Without the notes, can you draw app → features → shared layer?
2. Can you explain what `target`, `from` and `except` each mean?
3. Can you say what each of the five zones protects, and why feature isolation needs one rule per feature?
4. Can you give the three legal ways for two features to work together?
5. Can you explain the split between ESLint boundaries and TypeScript type checking?
