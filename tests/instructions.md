# Tests

## Scope
- Covers only centralized test files under caracal/tests/.

## Required
- Must place tests by language first, then test type, then component.
- Must use tests/typescript/unit for TypeScript unit tests.
- Must use tests/typescript/integration, tests/typescript/e2e, tests/typescript/contract, tests/typescript/fuzz, tests/typescript/regression, tests/typescript/property, tests/typescript/smoke, tests/typescript/performance, and tests/typescript/security for matching TypeScript test types.
- Must use tests/go/unit for Go unit test source files.
- Must use tests/go/integration, tests/go/e2e, tests/go/contract, tests/go/fuzz, tests/go/regression, tests/go/property, tests/go/smoke, tests/go/performance, and tests/go/security for matching Go test types.
- Must use tests/python/unit for Python unit tests.
- Must use tests/python/integration, tests/python/e2e, tests/python/contract, tests/python/fuzz, tests/python/regression, tests/python/property, tests/python/smoke, tests/python/performance, and tests/python/security for matching Python test types.
- Must keep shared fixtures under tests/shared/fixtures.
- Must keep reusable test helpers under tests/shared/test-utils.
- Must keep mocks under tests/shared/mocks.
- Must keep test data under tests/shared/test-data.
- Must update package test scripts when adding a new component path.

## Forbidden
- Must not add new test source files under apps/, packages/, services/, or infra/.
- Must not duplicate test files outside this directory.
- Must not mix languages in the same test-type directory.
- Must not store production source code in this directory.
