import { describe, expect, it } from "vitest";
import { tickX } from "./Plot";

// The uncertainty view's x ticks were written with a decimal point in Spanish (gate G11 on /benchmark, U8).
describe("tickX", () => {
  it("writes three significant figures with the language's decimal separator", () => {
    expect(tickX(14.2857, "en")).toBe("14.3");
    expect(tickX(14.2857, "es")).toBe("14,3");
    expect(tickX(42.8571, "es")).toBe("42,9");
  });
  it("keeps whole ticks whole and small ticks precise", () => {
    expect(tickX(100, "es")).toBe("100");
    expect(tickX(0, "es")).toBe("0");
    expect(tickX(0.12345, "es")).toBe("0,123");
  });
});
