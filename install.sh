#!/usr/bin/env bash
# Link every skill in this repo into ~/.claude/skills.
#
# Safe to re-run as the repo grows. Existing links are refreshed, new skills are
# added, and anything that is a real directory rather than a symlink is reported
# and left alone. That last case matters: `ln -sfn` against a real directory does
# not replace it, it silently creates the link *inside* it, and the skill then
# never loads.
set -euo pipefail

repo_skills="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skills"
dest="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

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
        echo "skip      $name, $target exists and is not a symlink. Remove it, then re-run."
        skipped=$((skipped + 1))
    else
        ln -s "$src" "$target"
        echo "linked    $name"
        linked=$((linked + 1))
    fi
done

echo "$linked linked, $refreshed refreshed, $skipped skipped"

# Links into this repo whose target has gone, left by a renamed or deleted skill.
for link in "$dest"/*; do
    [ -L "$link" ] || continue
    case "$(readlink "$link")" in
        "$repo_skills"/*)
            [ -e "$link" ] || echo "dangling  $link, target no longer in the repo"
            ;;
    esac
done
