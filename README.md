# rossmc-skills

A collection of custom skills for LLM-powered agents.

## Skills

| Skill | What it does |
|---|---|
| [`parallel-orchestration`](skills/parallel-orchestration/) | Decompose a task into independent units and run them as concurrent subagents. Covers when to split and when not to, model choice per unit, agent return budgets, and what to do when an agent fails. |

## Install

Claude Code loads skills from `~/.claude/skills`. Clone the repo somewhere permanent,
then run the installer:

```bash
git clone <repo-url> ~/Projects/rossmc-skills
~/Projects/rossmc-skills/install.sh
```

That symlinks every skill in `skills/` into `~/.claude/skills`. Re-run it whenever the
repo grows, it adds new skills and refreshes existing links. Set `CLAUDE_SKILLS_DIR` to
install somewhere else.

Symlink rather than copy. A copy goes stale the moment either side changes and you end up
editing one while loading the other. With a link, `git pull` updates the skill in place
with no reinstall step.

Start a new session to pick up a newly linked skill. Skills are read at session start, so
an already-running session won't see it.

### Linking one skill by hand

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
case and tells you rather than making the mess.

### Project-scoped install

To make a skill available in one repo only, link it into that repo instead of your home
directory:

```bash
mkdir -p .claude/skills
ln -s ~/Projects/rossmc-skills/skills/parallel-orchestration .claude/skills/parallel-orchestration
```

Add `.claude/skills/` to that repo's `.gitignore` if the link is just for you.

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
    └── SKILL.md        # frontmatter (name, description) + instructions
install.sh              # symlinks every skill into ~/.claude/skills
```

`SKILL.md` frontmatter needs a `name` and a `description`. The description is the whole
triggering mechanism, it sits in context in every session and decides whether the skill
fires, so it should say both what the skill does and when to use it. The body only loads
once the skill triggers, so that's where the detail belongs.
