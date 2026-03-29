---
name: test-gap-hunt
description: Find untested code paths, missing edge cases, and insufficient error handling coverage
---
Hunt for test coverage gaps:
1. Use devtools.analyzeRepo() to get all source files and their exports
2. For each exported function, check if a corresponding test exists
3. For each tested function, check if edge cases are covered:
   - null/undefined inputs
   - empty strings/arrays
   - invalid types
   - boundary values (0, max, negative)
   - error paths (throw, reject)
4. Use devtools.measureCoverage() to get line-level coverage data
5. Prioritize gaps by risk: public API > internal helpers > utilities
6. Output: uncovered functions, missing edge cases, coverage percentage, recommended tests to add
