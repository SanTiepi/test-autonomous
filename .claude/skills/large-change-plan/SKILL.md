---
name: large-change-plan
description: Plan a multi-file change by analyzing impact, dependencies, and test requirements before coding
---
Given a change description, produce an implementation plan:
1. Identify all files that need to change (using devtools.analyzeRepo dependency graph)
2. Identify all tests that will be impacted (using devtools.runTargetedTests logic)
3. Estimate risk level per file (high if many dependents, low if leaf module)
4. Propose implementation order (least dependent first)
5. Identify any new tests needed
6. Identify any breaking changes to exports/API contracts
7. Output a structured plan with: files to change, order, risks, test strategy
