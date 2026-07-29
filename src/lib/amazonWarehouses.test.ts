import { describe, expect, it } from "vitest";
import { filterAmazonWarehouses, findAmazonWarehouse } from "./amazonWarehouses";

describe("Amazon warehouse directory", () => {
  it("matches a warehouse code to its US region", () => {
    expect(findAmazonWarehouse("ont8")?.region).toBe("west");
    expect(findAmazonWarehouse("EWR9")?.region).toBe("east");
    expect(findAmazonWarehouse("FTW1")?.region).toBe("east");
  });

  it("filters by code, city, state and Chinese region label", () => {
    expect(filterAmazonWarehouses("LAX").some((warehouse) => warehouse.code === "LAX9")).toBe(true);
    expect(filterAmazonWarehouses("Moreno").map((warehouse) => warehouse.code)).toEqual(expect.arrayContaining(["ONT6", "ONT8"]));
    expect(filterAmazonWarehouses("NJ").every((warehouse) => warehouse.state === "NJ")).toBe(true);
    expect(filterAmazonWarehouses("美东").every((warehouse) => warehouse.region === "east")).toBe(true);
  });
});
