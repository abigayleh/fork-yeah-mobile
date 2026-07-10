# CLAUDE.md

## Feature Development Process

Before writing any code for a new feature:
1. Ask clarifying questions until you are 95% confident in the requirements
2. State your intended approach and wait for confirmation before proceeding
3. List all edge cases you've identified and confirm the handling approach with me

Do not write code until this process is complete.

---

## Code Style

### General
- Simple, readable code — optimized for skimming
- Files should be short and concise
- Comments: max 2 lines, only when non-obvious
- Less code is better

### Dependencies
- Avoid adding new dependencies unless absolutely necessary

### Reusability
- Repeated functions → extract to a `hooks/` file and import
- Repeated components → extract to `components/` and reuse
- Never duplicate logic or JSX

### Components
- Complex components or functions → move to their own file in a dedicated folder
- Keep files focused on one responsibility

### Styling
- Minimal styles — only write CSS that overrides a non-default value
- Repeated styles → move to a global stylesheet and reuse via class names
- Prefer global styles over scoped/inline styles
- No style duplication

## Codebase Exploration & Knowledge Sharing

Before starting non-trivial work, especially in an unfamiliar part of the codebase, explore first:

1. **Orient yourself.** Check `package.json`/`pyproject.toml`/etc., directory structure, entry points, and existing tests to understand how the project is organized before editing anything.
2. **Verify, don't assume.** If existing docs (including this file) conflict with what you find in the code, trust the code and flag the discrepancy.
3. **Record what you learn.** After exploring, update this file with anything a future agent would benefit from knowing, such as:
   - Non-obvious architecture or data flow (e.g. "auth logic lives in `lib/auth/`, not `middleware/`")
   - Naming conventions or patterns that aren't self-evident
   - Gotchas, footguns, or things that look wrong but are intentional
   - Where key config, env vars, or feature flags are defined
   - Commands for build/test/lint if not already documented

### Rules for writing to this file
- **Be concise.** One or two lines per finding. This file is a map, not a diary.
- **Update, don't just append.** If a note here is outdated or wrong, fix or remove it rather than adding a contradicting note below it.
- **Only write things that generalize.** Task-specific notes belong in commit messages or PR descriptions, not here.
- **Prefer pointers over duplication.** Link to the relevant file/dir instead of copying code or explaining logic that's clear from reading the file itself.

## Subagents

If you notice a recurring task that would benefit from a dedicated subagent (e.g. a specialized reviewer, tester, or domain-specific helper), proactively create one in `.claude/agents/`. Don't wait to be asked — if you recognize a pattern where a focused subagent would improve quality or efficiency, define it.

When creating a subagent:
- Give it a clear, narrow purpose (single responsibility)
- Use a descriptive filename matching the agent's role (e.g. `test-runner.md`, `code-reviewer.md`)
- Include a concise system prompt defining its scope, tools it should use, and when it should be invoked
- Mention the new agent to me after creating it, and explain why you thought it was needed

## Skills

If you notice a repeatable workflow, convention, or piece of domain knowledge worth capturing, proactively create or update a skill in `.claude/skills/`.

Note: skills live one-per-folder, not in a single file — `.claude/skills/<skill-name>/SKILL.md`.

When creating or updating a skill:
- Give the folder a clear, descriptive name matching what it does (e.g. `.claude/skills/api-conventions/SKILL.md`)
- Start the file with YAML frontmatter (`name`, `description`) — the `description` is what determines when the skill gets auto-loaded, so make it specific about what it covers and when to use it
- Keep the SKILL.md body focused; move detailed reference material into a `references/` subfolder and reusable scripts into `scripts/` so the main file stays lean
- If a skill already exists for the topic, update it in place rather than creating a duplicate
- Mention the new/updated skill to me after saving it, and explain why you thought it was needed