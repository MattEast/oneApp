# DevOps Engineer Onboarding (Junior/Trainee)

## Role Purpose
Build and maintain reliable, low-friction delivery pipelines and runtime guardrails that keep quality high while the platform migrates to the target architecture.

## What You Own
- CI workflows in .github/workflows/
- Build/test contract checks and pipeline reliability
- Dependency and environment hygiene (ignore rules, reproducible installs)
- Early infrastructure scaffolding in infra/
- Operational documentation and rollout safety checks

## Current vs Target Platform
- Current: local prototype backend/frontend and GitHub Actions CI
- Target: Docker + Terraform + AWS + stronger observability and worker jobs
- Rule: improve reliability now without introducing avoidable complexity

## First Week Outcomes
1. Understand all active workflow files and required checks.
2. Reproduce CI locally using project scripts.
3. Fix one reliability issue and add a preventive guardrail.
4. Document runbook notes for common incidents.

## Local Setup
Run from repository root:

1. npm install
2. npm run test:backend
3. npm run test:frontend
4. npm run lint:contracts

Review workflow files:
- .github/workflows/ci.yml
- .github/workflows/backend-ci.yml
- .github/workflows/branch-name.yml

## Day-to-Day Checklist
- Keep checks deterministic and fast.
- Prefer repository scripts over duplicated workflow shell logic.
- Ensure branch/PR policies remain enforceable.
- Add safeguards for recurring failure classes.
- Keep pipeline behavior aligned with documented ways of working.

## Engineering Standards
- Avoid hidden side effects in CI steps.
- Pin tool versions where major-version drift causes breakages.
- Fail fast on repository hygiene violations (for example, tracked node_modules).
- Keep mandatory checks meaningful; make temporary advisory checks explicit and time-boxed.

## Operational Focus Areas
- CI runtime deprecations and action version upgrades
- Node/npm reproducibility and lockfile discipline
- Guardrails for contract drift and branch naming
- Port/process troubleshooting guidance for local dev reliability

## Common Pitfalls to Avoid
- Allowing workflow commands to diverge from local scripts
- Relying on global tools not declared in the project
- Introducing broad permissions or insecure secrets handling
- Leaving temporary CI relaxations undocumented

## Suggested Starter Tasks
- Add runbook section for top CI failure patterns
- Add pipeline timing and flaky-step visibility notes
- Tighten branch protection + required checks mapping
- Define first Terraform folder conventions for environments

## PR Requirements
- Branch format: story/<id>-<slug>, fix/<id>-<slug>, or chore/<slug>
- Include risk and rollback notes in PR description
- Include before/after pipeline behavior evidence
