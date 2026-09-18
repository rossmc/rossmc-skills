---
name: parallel-orchestration
description: Orchestrate work with subagents when a task splits into independent pieces, or when one noisy step would flood the main context. Use for multiple independent code changes, mirrored or bulk edits across files or entities, multi-part research or codebase exploration, or reviewing a change along several dimensions, even if the user doesn't mention agents or parallelism. Also use when deciding whether to split a task at all. Not for small tasks, sequential steps, or answering a question.
---

# Parallel orchestration

Act as an orchestrator, not a solo worker. Delegate independent units of work to subagents instead of doing them serially yourself.

## Why

- **Context stays lean.** Files read and diffs written in the main session eat context the rest of the task needs. Subagents absorb that churn and return conclusions.
- **Wall-clock time drops.** Independent work done serially wastes the user's time for no quality gain.
- **Quality can go up.** Independent reviewers/researchers don't anchor on each other's findings.

## When to delegate

Split the task when you can name two or more units of work where neither needs the other's output:

- Mirroring a change across several entities, modules, components, or test specs
- Bulk edits following one pattern across many files
- Researching several subsystems, questions, or candidate approaches
- Broad searches across a codebase (use read-only Explore agents)
- Reviewing a change along different dimensions (correctness, security, tests, docs)
- Independent verification steps (lint one package while testing another)

**One unit is enough when the work is noisy.** Delegation buys two things: wall-clock time, which needs two or more independent units, and a clean main context, which needs one. An agent that reads thirty files and hands back a path list earns its spawn. If it has to return most of what it read, you've saved nothing and added a round trip.

Decompose before starting: list the units, mark the dependencies.

## When not to delegate

Work solo when:

- The task is small, a couple of files. Agent overhead would exceed the work.
- Steps are genuinely sequential (each needs the previous result), though a single noisy step can still go to one agent.
- The work needs full conversational context that's expensive to restate in a prompt.
- The task is a conversation, a question, or a judgment call. The user wants *your* answer.

## Model

Set the model explicitly on every spawn. Harnesses inherit the orchestrator's model when you don't, which makes cheap units expensive and, on a weak orchestrator, every unit weak. Pick the cheapest model that can do the unit well, and never use a delegation mode that ignores the choice.

**Claude Code**, on every Agent call:

- `sonnet` by default: searches, reviews against a stated checklist, mirrored edits, anything with a clear contract.
- `opus` only when the unit needs sustained reasoning a cheaper model would get wrong: subtle correctness tracing across many files, design judgement, an ambiguous spec.
- Never Fable. The main session may run on it, delegated work must not.
- Never Haiku.
- Never `subagent_type: "fork"`. A fork ignores the `model` override and inherits the parent model, so on a Fable session every fork is a Fable agent. Skills that fork in the background (`code-review` does) have the same problem, so fold their dimensions into your own agents. If a unit needs the current conversation context, restate it in the prompt.

**Codex**: resolution runs the explicit spawn value, then the `[agents]` default, then the parent's, so omitting it inherits.

Say which model the agents ran on when relaying outcomes. If you can't tell, say that rather than assuming.

## How to do it well

1. **Decompose first, then dispatch.** Decide the exact split, contracts, and file ownership *before* spawning anything.
2. **Disjoint file sets.** Each agent gets files no other agent touches, so writes never collide. Shared files (central config, registries, wiring) get a single owner, usually the main session, edited after the agents return.
3. **Specify contracts up front.** Exact names, signatures, interfaces, and conventions go into each agent's prompt. Agents can't see each other's output, so anything they must agree on, you must state.
4. **Launch concurrently.** Send all independent Agent calls in a single message. One per turn serializes the work you meant to parallelize.
5. **Match agent type to work.** Read-only exploration goes to a read-only agent (Claude Code `Explore`, Codex `explorer`), edits and multi-step tasks to a general-purpose one (`general-purpose`, `worker`).
6. **Prompt each agent as if it knows nothing.** It has no conversation history. Include the goal, the exact files, the contract, what to return, and what *not* to touch.
7. **Bound what comes back.** Give every agent a return budget and shape: at most 15 lines covering files changed, decisions made, anything that blocked it. Agents default to long reports and every line lands in your context. Past about ten agents, run waves and carry a short written state between them.
8. **Verify the combined result yourself.** Edit the shared files, then lint/compile/test the whole. Agents verify their own piece, only you can verify the composition.
9. **Relay outcomes.** Agent reports aren't shown to the user, so summarize what each accomplished and the combined verification result.

## When an agent fails

Pick the policy per unit before dispatching, and state it in the prompt:

- **Retry** once, when the unit is well specified and the failure looks transient. Respawn with the failure noted.
- **Skip**, when the unit is genuinely independent. Take the rest, and say in your summary what didn't land.
- **Abort**, when later work depends on it, or when a partial result is worse than none. Half a rename, half a migration.

The failure that bites is the quiet one, an agent reporting success having done two thirds of the job.

## Example

Task: "Add a `deleted_at` timestamp to the Order, Invoice, and Shipment entities, with matching repository filters and test coverage."

- Decompose: three entities, identical pattern, disjoint files, plus one shared migration/config file.
- Contract in each prompt: column name `deleted_at`, nullable datetime, filter method `excludeDeleted()`, test naming convention.
- Spawn three agents in one message, one per entity (files + tests for that entity only).
- Main session: edits the shared schema/wiring file, then runs the full test suite and reports results.
