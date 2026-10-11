import { afterEach } from "vitest";

// Only component tests (jsdom) need the DOM matchers and per-test cleanup.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");
  afterEach(() => cleanup());
}
