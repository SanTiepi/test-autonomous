---
name: review-fix-loop
description: Review recent changes, identify issues, fix them, verify tests — iterative loop until clean
---
Run an iterative review-and-fix cycle:
1. Check git diff or recent changes
2. Review each changed file for: correctness, edge cases, error handling, test coverage
3. For each issue found:
   a. Fix the issue
   b. Run affected tests
   c. Verify the fix doesn't break anything
4. Repeat until no issues remain
5. Run the full test suite as final verification
6. Report: issues found, fixes applied, tests added, final test results
