#!/usr/bin/env bash
# Link every skill in this repo into the skills directory of each agent harness
# found on this machine.
#
#   ./install.sh            link into every harness detected
#   ./install.sh --claude   Claude Code only
#   ./install.sh --codex    Codex only
#
# Safe to re-run as the repo grows. Existing links are refreshed, new skills are
# added, and anything that is a real directory rather than a symlink is reported
# and left alone. That last case matters: `ln -sfn` against a real directory does
# not replace it, it silently creates the link *inside* it and exits 0, so the
# skill looks installed and never loads.
set -euo pipefail

repo_skills="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skills"

# Claude Code reads ~/.claude/skills. Codex reads ~/.agents/skills. Both take the
# same SKILL.md, so one copy serves both.
claude_dir="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
codex_dir="${CODEX_SKILLS_DIR:-$HOME/.agents/skills}"

want="${1:-auto}"
targets=()

case "$want" in
    --claude) targets=("$claude_dir") ;;
    --codex)  targets=("$codex_dir") ;;
    auto)
        # Only install for a harness that is actually set up, so this doesn't
        # conjure a Codex directory on a machine that has never run Codex.
        [ -d "$(dirname "$claude_dir")" ] && targets+=("$claude_dir")
        [ -d "$(dirname "$codex_dir")" ] && targets+=("$codex_dir")
        ;;
    *) echo "usage: install.sh [--claude|--codex]" >&2; exit 2 ;;
esac

if [ ${#targets[@]} -eq 0 ]; then
    echo "No harness found. Expected $(dirname "$claude_dir") or $(dirname "$codex_dir")." >&2
    exit 1
fi

for dest in "${targets[@]}"; do
    echo "==> $dest"
    mkdir -p "$dest"

    linked=0
    refreshed=0
    skipped=0

    for src in "$repo_skills"/*/; do
        src="${src%/}"
        [ -d "$src" ] || continue
        name="$(basename "$src")"
        target="$dest/$name"

        if [ -L "$target" ]; then
            ln -sfn "$src" "$target"
            refreshed=$((refreshed + 1))
        elif [ -e "$target" ]; then
            echo "    skip      $name, $target exists and is not a symlink. Remove it, then re-run."
            skipped=$((skipped + 1))
        else
            ln -s "$src" "$target"
            echo "    linked    $name"
            linked=$((linked + 1))
        fi
    done

    echo "    $linked linked, $refreshed refreshed, $skipped skipped"

    # Links into this repo whose target has gone, left by a renamed or deleted skill.
    for link in "$dest"/*; do
        [ -L "$link" ] || continue
        case "$(readlink "$link")" in
            "$repo_skills"/*)
                [ -e "$link" ] || echo "    dangling  $link, target no longer in the repo"
                ;;
        esac
    done
done
