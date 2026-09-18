---
name: parallel-orchestration
description: Orchestrate work with parallel subagents whenever a task decomposes into independent pieces. Use this whenever a task involves multiple independent code changes, edits across several files or entities, bulk/mirrored edits, multi-part research or codebase exploration, reviewing something from several angles, or any work where two or more steps don't depend on each other's output — even if the user doesn't mention agents or parallelism. Also use it when deciding whether a task should be split at all.
---

# Parallel orchestration

Act as an orchestrator, not a solo worker. When a task contains independent units of work, delegate them to subagents running concurrently instead of doing everything serially in the main session.

## Why

- **Context stays lean.** Every file you read and every diff you write in the main session consumes context that the rest of the task needs. Subagents absorb the file-reading and editing churn and return only conclusions.
- **Wall-clock time drops.** Independent work done serially wastes the user's time for no quality gain.
- **Quality can go up.** Independent reviewers/researchers don't anchor on each other's findings.

## When to parallelize

Split the task when you can name two or more units of work where neither needs the other's output:

- Mirroring a change across several entities, modules, components, or test specs
- Bulk edits following one pattern across many files
- Researching several subsystems, questions, or candidate approaches
- Broad searches across a codebase (use read-only Explore agents)
- Reviewing a change along different dimensions (correctness, security, tests, docs)
- Independent verification steps (lint one package while testing another)

When in doubt, spend a moment decomposing before starting work: list the units, mark the dependencies. If the dependency graph has parallel branches, orchestrate them.

## When NOT to parallelize

Don't force it. Work solo when:

- The task is small — a couple of files, a few minutes of work. Agent overhead would exceed the work itself.
- Steps are genuinely sequential (each needs the previous result).
- The work needs full conversational context that's expensive to restate in a prompt.
- The task is a conversation, a question, or a judgment call — the user wants *your* answer.

## Model

Always pass `model` explicitly on every Agent call. Pick the most efficient model that can do the unit well:

- `sonnet` by default: searches, reviews against a stated checklist, mirrored edits, anything with a clear contract.
- `opus` only when the unit needs sustained reasoning a cheaper model would get wrong: subtle correctness tracing across many files, design judgement, an ambiguous spec.
- Never Fable. The main session may run on it, delegated work must not.
- Never Haiku.
- Never `subagent_type: "fork"`. A fork ignores the `model` override and inherits the parent model, so on a Fable session every fork is a Fable agent. Skills that fork in the background (`code-review` does) have the same problem, so fold their dimensions into your own agents instead of launching them. If a unit needs the current conversation context, restate that context in the prompt.

Say which model the agents ran on when relaying outcomes.

## How to do it well

1. **Decompose first, then dispatch.** Decide the exact split, contracts, and file ownership *before* spawning anything.
2. **Disjoint file sets.** Each agent gets files no other agent touches, so writes never collide. Shared files (central config, registries, barrel files, `di.xml`-style wiring) get a single owner — usually the main session, edited after the agents return.
3. **Specify contracts up front.** Exact names, signatures, interfaces, and conventions go into each agent's prompt, so parallel work stays mutually consistent. Agents can't see each other's output — anything they must agree on, you must state.
4. **Launch concurrently.** Send all independent Agent calls in a single message so they actually run in parallel. Spawning them one turn at a time serializes the work you meant to parallelize.
5. **Match agent type to work, and set the model.** Read-only exploration → Explore agents; edits and multi-step tasks → general-purpose. Both with `model` set per the Model section above. Never fork.
6. **Prompt each agent as if it knows nothing.** It has no conversation history. Include the goal, the exact files, the contract, what to return, and what *not* to touch.
7. **Verify the combined result yourself.** After agents return, the main session integrates: edit the shared files, then lint/compile/test the whole. Agents verify their own piece; only you can verify the composition.
8. **Relay outcomes.** Agent reports aren't shown to the user — summarize what each accomplished and the combined verification result.

## Example

Task: "Add a `deleted_at` timestamp to the Order, Invoice, and Shipment entities, with matching repository filters and test coverage."

- Decompose: three entities, identical pattern, disjoint files — plus one shared migration/config file.
- Contract in each prompt: column name `deleted_at`, nullable datetime, filter method `excludeDeleted()`, test naming convention.
- Spawn three agents in one message, one per entity (files + tests for that entity only).
- Main session: edits the shared schema/wiring file, then runs the full test suite and reports results.
