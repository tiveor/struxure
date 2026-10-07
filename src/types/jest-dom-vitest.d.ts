// Vitest 5 changed `Assertion<T>` to `Assertion<R, T>`, but
// @testing-library/jest-dom 7 still augments the old one-parameter signature,
// so its matchers vanish from `expect()` types (see issue #21). Vitest 5 exposes
// `Matchers<R, T>` as the supported extension point, so the jest-dom matchers
// are attached there instead. Delete this file once jest-dom ships Vitest 5 types.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // Declaration merging requires the exact parameter list of Vitest's own
  // `Matchers`, so `T` must stay unused and the body must stay empty.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<unknown, R> {}
}
