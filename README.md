# Figma Component Anatomy — skill for Claude

[Русская версия](README.ru.md)

An agent skill that builds **component anatomy pages** in Figma: the component at 2× with annotations, a Specs table and Usage guidelines. Annotations follow one strict standard and are drawn by scripts, so every page looks the same and no labels collide.

- **Pink** — paddings, gaps, height and width (`#E8457D`)
- **Blue** — text and icon sizes (`#1F6BEB`)
- Values sit in pills, no numbered callouts
- Each example is still a live instance of your component
- A geometry check reports any touching or crossing labels (`conflicts`)

## What you get in Figma

A frame `Documentation / <Name> anatomy`:

1. Header and a two-colour legend.
2. 3–5 blocks, one per structurally different example. Each block has an **Example** (the annotated instance) and **Specs** (dot · name · token · value).
3. **Usage** — ✓ / ✕ guidelines for designers.

## Requirements

- An agent that supports skills (`SKILL.md`): Claude Code, Claude Desktop / claude.ai or another compatible agent.
- A Figma MCP server that exposes the **`use_figma`** tool (runs Figma Plugin API code in your file), connected with edit access to the file. If the Figma `figma-use` skill is available, the agent loads it before writing.
- The component in the file (component set, component or instance). Variables (tokens) are optional but make Specs accurate.
- The **Inter** font, or any family you set in `font`.

## Install

### Claude Code (plugin)

```
/plugin marketplace add kirilly2281/figma-anatomy-skill
/plugin install figma-component-anatomy@figma-anatomy-skill
```

Restart the session or run `/reload-plugins`. The skill is available as `/figma-component-anatomy:component-anatomy`, and Claude also picks it up automatically when you ask for an anatomy page.

### Claude Code (copy the folder)

Copy `plugins/figma-component-anatomy/skills/component-anatomy` to:

- `~/.claude/skills/component-anatomy` — for all your projects, or
- `<your-project>/.claude/skills/component-anatomy` — for one project.

### Claude Desktop / claude.ai

Zip the `component-anatomy` folder (the folder itself, with `SKILL.md` inside) and upload it in the Skills section of the settings.

### Other agents

Copy the `component-anatomy` folder into the agent's skills directory. The scripts are plain Figma Plugin API code and work with any tool that executes it in a file.

## Usage

Open the Figma file, then ask the agent, for example:

> Build the anatomy page for the Button component in this file: https://www.figma.com/design/…?node-id=… Use large with icons, small and focused examples.

The agent will:

1. read the component, its properties and bound tokens;
2. pick 3–5 structurally different examples;
3. run `anatomy-page.js` → the empty frame with blocks;
4. run `anatomy-annotate.js` → annotations and the `conflicts` check;
5. run `anatomy-specs.js` → token names and values per block;
6. write Usage and show you a screenshot of every block.

You can also run the scripts yourself through any `use_figma`-compatible tool: paste a file whole and edit only its `CFG` block.

## Repository layout

```
.claude-plugin/marketplace.json              Claude Code marketplace
plugins/figma-component-anatomy/
  .claude-plugin/plugin.json                 plugin manifest
  skills/component-anatomy/
    SKILL.md                                 standard and workflow
    references/anatomy-guide.md              CFG reference, recipes, troubleshooting
    references/plugin-api-notes.md           Plugin API pitfalls
    scripts/anatomy-page.js                  builds the anatomy frame
    scripts/anatomy-annotate.js              annotations + geometry check
    scripts/anatomy-specs.js                 Specs table
```

## Adapting to your components

Defaults expect a common structure: instance → content frame → icons and text layers named like `Icon`, `Label`, `Text`. For other structures each block takes small options: `rowOf`, `rowsOf`, `boxOf`, `classify`, `edges`, `backdrop`, `focused` and more. Recipes for badges, inputs with labels, dropdowns, checkboxes, pagination and cards are in [anatomy-guide.md](plugins/figma-component-anatomy/skills/component-anatomy/references/anatomy-guide.md#recipes).

## License

[MIT](LICENSE)
