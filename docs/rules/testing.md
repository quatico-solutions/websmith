<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Testing Rules

Covers unit test structure, naming, isolation, assertions, mocks, and the test infrastructure of the monorepo.

## CRITICAL: Assemble / Act / Assert

**The Rule:** Every unit test MUST follow the three-part structure "assemble", "act", "assert". Each part is
separated by exactly one blank line. NO comments mark the parts (no `// Assemble`, `// Act`, `// Assert`).

**Why?** The blank-line structure makes every test scannable in the same way. Comments that name the parts add
noise without information and drift when tests are edited.

### Wrong

```typescript
// ❌ NEVER DO THIS
it("should work", () => {
    // Assemble - DON'T ADD THESE COMMENTS
    const testObj = new MyClass();

    // Act
    const actual = testObj.method();

    // Assert
    expect(actual).toBe(true);
});
```

### Correct

```typescript
// ✅ Template
it("should [behavior description]", () => {
    const whatever = "meaningless-value";
    const testObj = new ClassUnderTest(whatever);

    const actual = testObj.methodUnderTest();

    expect(actual).toBe(expectedValue);
});
```

## CRITICAL: Variable Naming

**The Rule:**

- The object under test is ALWAYS called `testObj`.
- The outcome/result of the `testObj` is ALWAYS called `actual`, regardless of whether it is returned, yielded,
  or observed as a side effect.
- If the outcome is observed through another object, that object is called `target`, whether it is passed as a
  parameter or returned by `testObj` functions.
- Values required by the API but meaningless to the test are called `whatever`.

**Why?** Fixed names let a reader find the subject and the observed value instantly, in any test file.

### Wrong

```typescript
// ❌ Unclear variable names
it("should work", () => {
    const obj = new MyClass(); // Should be testObj
    const result = obj.method(); // Should be actual
    expect(result).toBe(true);
});
```

### Correct

```typescript
// ✅ Following all rules
it("should work", () => {
    const testObj = new MyClass();

    const actual = testObj.method();

    expect(actual).toBe(true);
});
```

### Target as Parameter

```typescript
// ✅ Outcome observed through a target passed in
it("should append item to target collection", () => {
    const target = [];
    const newItem = "test-item";
    const testObj = new CollectionManager();

    testObj.addItem(target, newItem);
    const actual = target.length;

    expect(actual).toBe(1);
});
```

### Target as Return Value

```typescript
// ✅ Outcome observed through a target returned by testObj
it("should create configured target", () => {
    const config = { size: 10 };
    const testObj = new TargetFactory();

    const target = testObj.create(config);
    const actual = target.getSize();

    expect(actual).toBe(10);
});
```

### Whatever Values

```typescript
// ✅ Irrelevant constructor input named whatever
it("should process data correctly", () => {
    const whatever = { irrelevant: "config" };
    const importantData = [1, 2, 3];
    const testObj = new DataProcessor(whatever);

    const actual = testObj.process(importantData);

    expect(actual).toEqual([2, 4, 6]);
});
```

## CRITICAL: Test Isolation

**The Rule:** Each unit test MUST create its own `testObj` instance. NO shared `testObj` variables between tests.
Each test is completely independent.

**Why?** Shared instances leak state between tests, make failures order-dependent, and hide what a test really
sets up.

### Wrong

```typescript
// ❌ Shared testObj
describe("MyClass", () => {
    let testObj: MyClass; // DON'T DO THIS

    beforeEach(() => {
        testObj = new MyClass();
    });
});
```

### Correct

```typescript
// ✅ Each test builds its own testObj
it("should return transformed value", () => {
    const input = "test input";
    const testObj = new StringTransformer();

    const actual = testObj.transform(input);

    expect(actual).toBe("TRANSFORMED: test input");
});
```

## Assertions: One Actual per Test

**The Rule:** Every unit test should assert only ONE `actual` value. If multiple assertions are absolutely
necessary, use multiple `actual` variables (`actual1`, `actual2`, ...).

**Why?** One observed value per test gives one reason to fail and a precise test name.

```typescript
// ✅ Multiple actuals, only when unavoidable
it("should return both count and sum", () => {
    const numbers = [1, 2, 3, 4];
    const testObj = new NumberAnalyzer();

    const result = testObj.analyze(numbers);
    const actual1 = result.count;
    const actual2 = result.sum;

    expect(actual1).toBe(4);
    expect(actual2).toBe(10);
});
```

## Special Cases

### Mock / Spy Setup

```typescript
// ✅ The mock call count is the actual
it("should call dependency method", () => {
    const mockDependency = { method: jest.fn() };
    const testObj = new MyClass(mockDependency);

    testObj.performAction();
    const actual = mockDependency.method.mock.calls.length;

    expect(actual).toBe(1);
});
```

Jest is configured with `resetMocks: true` and `clearMocks: true` (`jest-base.config.ts`), so mock state never
survives between tests. Do not rely on it doing so.

### Async Tests

```typescript
// ✅ Await in the act part
it("should handle async operation", async () => {
    const testObj = new AsyncProcessor();

    const actual = await testObj.processAsync();

    expect(actual).toBe("processed");
});
```

### Error Testing

```typescript
// ✅ The thunk is the actual
it("should throw error for invalid input", () => {
    const invalidInput = null;
    const testObj = new Validator();

    const actual = () => testObj.validate(invalidInput);

    expect(actual).toThrow("Invalid input");
});
```

## Test Infrastructure

- **Unit and integration tests**: each package keeps `*.spec.ts` and `*.test.ts` files next to the sources in
  `src/`. Jest picks up `src/.*\.(test|spec)\.ts$`. `*.spec.ts` holds unit tests; `*.test.ts` holds broader
  integration-style tests (e.g. `Compiler.test.ts`).
- **E2E tests**: `packages/compiler-test` (CLI) and `packages/webpack-test` (loader). Run with `pnpm test:e2e`.
- **Examples as fixtures**: `packages/example-addons` doubles as a reference and test fixture set.
- **Helpers**: `packages/testing` provides `compileSystem`, `createFs`/`resetFs`, `ReporterMock` and `tsLibMocks`;
  inside core, `createSystem(files, { virtual: true })` from `src/environment` builds an in-memory `ts.System`.
  Prefer these over hand-rolled `ts.System` fakes.
- **Snapshots**: update with `pnpm test:update-snapshots`, never by editing snapshot files by hand.
- **Relaxed lint in tests**: `any`, non-null assertions, `console` and long lines are allowed in test files.

### Wrong

```typescript
// ❌ Touches the real file system in a unit test
const content = fs.readFileSync("/tmp/test.ts", "utf-8");
```

### Correct

```typescript
// ✅ In-memory ts.System (core: createSystem from src/environment)
const target = createSystem({ "tsconfig.json": "{}", "src/test.ts": "export const test = 'hello';" }, { virtual: true });
```

**Related:** See `workflow.md` for the CI commands and `addons.md` for testing addons.
