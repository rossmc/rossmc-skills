# rossmc-skills

A collection of custom skills for LLM-powered agents.

Skills follow the [Agent Skills open standard](https://agentskills.io), so one copy
works across harnesses. Claude Code and Codex both read the same `SKILL.md`, they just
look in different places:

| Harness | User scope | Project scope |
|---|---|---|
| Claude Code | `~/.claude/skills` | `.claude/skills` |
| Codex | `~/.agents/skills` | `.agents/skills` |

## Skills

| Skill | What it does |
|---|---|
| [`parallel-orchestration`](skills/parallel-orchestration/) | Decompose a task into independent units and run them as concurrent subagents. Covers when to split and when not to, model choice per unit, agent return budgets, and what to do when an agent fails. |
| [`browser-check`](skills/browser-check/) | Verify, debug or research Hyvä storefront and admin changes in a real browser against a Warden Magento environment. Decides between the Playwright MCP (main session only) and a headless script (every subagent), carries the Warden facts both need, and bundles `run-check.mjs`, a runner for throwaway check modules on the project's own Playwright install. |

## Install

Clone the repo somewhere permanent, then run the installer:

```bash
git clone <repo-url> ~/Projects/rossmc-skills
~/Projects/rossmc-skills/install.sh
```

That symlinks every skill in `skills/` into each harness it finds on the machine. It
only installs for a harness that already exists, so it won't conjure a `~/.agents`
on a box that has never run Codex. Force one with `--claude` or `--codex`, and
override the destinations with `CLAUDE_SKILLS_DIR` and `CODEX_SKILLS_DIR`.

Re-run it whenever the repo grows. New skills are added, existing links refreshed.

Symlink rather than copy. A copy goes stale the moment either side changes and you end
up editing one while loading the other. With a link, `git pull` updates the skill in
place with no reinstall step.

Start a new session to pick up a newly linked skill. Skills are read at session start,
so an already-running session won't see it.

### Linking by hand

```bash
ln -s ~/Projects/rossmc-skills/skills/parallel-orchestration ~/.claude/skills/parallel-orchestration
```

A glob works too, and re-running it does pick up newly added skills, though it prints
`File exists` for each one already linked and exits non-zero:

```bash
ln -s ~/Projects/rossmc-skills/skills/* ~/.claude/skills/
```

**Careful with `ln -sfn` if a real directory is already sitting at the target.** It does
not replace the directory. It creates the link *inside* it, prints nothing, and exits 0,
so the skill quietly never loads. Delete the directory first. `install.sh` detects this
case and reports it rather than making the mess.

Codex doesn't merge skills that share a `name`, both show up in the picker, so watch for
a clash if you already keep skills in `~/.agents/skills` from elsewhere.

### Project-scoped install

To make a skill available in one repo only, link it into that repo instead of your home
directory:

```bash
mkdir -p .claude/skills
ln -s ~/Projects/rossmc-skills/skills/parallel-orchestration .claude/skills/parallel-orchestration
```

Use `.agents/skills` for the same thing under Codex. Add the directory to that repo's
`.gitignore` if the link is just for you.

### Verify

```bash
ls -l ~/.claude/skills/parallel-orchestration
head -5 ~/.claude/skills/parallel-orchestration/SKILL.md
```

A broken symlink shows in red under `ls` and the skill silently won't load. Claude Code's
`/skill-doctor` command also reports on installed skills.

## Layout

```
skills/
└── <skill-name>/
    ├── SKILL.md        # frontmatter (name, description) + instructions
    ├── references/     # optional: detail loaded only when SKILL.md points at it
    ├── scripts/        # optional: executables the skill runs
    └── evals/          # optional: test prompts for skill-creator
install.sh              # symlinks every skill into each harness found
```

`SKILL.md` frontmatter needs a `name` and a `description`. The description is the whole
triggering mechanism, it sits in context in every session and decides whether the skill
fires, so it should say both what the skill does and when to use it. The body only loads
once the skill triggers, so that's where the detail belongs.
