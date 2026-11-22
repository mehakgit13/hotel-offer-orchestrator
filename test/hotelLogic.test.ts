import { describe, expect, it } from "vitest";
import { selectBestOffers } from "../src/hotelLogic";
import { SupplierHotel } from "../src/types";

const a: SupplierHotel[] = [
  { hotelId: "a1", name: "Holton", price: 6000, city: "delhi", commissionPct: 10 },
  { hotelId: "a2", name: "Radison", price: 5900, city: "delhi", commissionPct: 13 },
  { hotelId: "a3", name: "Only A", price: 5000, city: "delhi", commissionPct: 8 }
];
const b: SupplierHotel[] = [
  { hotelId: "b1", name: "Holton", price: 5340, city: "delhi", commissionPct: 20 },
  { hotelId: "b2", name: "Radison", price: 6100, city: "delhi", commissionPct: 15 },
  { hotelId: "b3", name: "Only B", price: 4500, city: "delhi", commissionPct: 9 }
];

describe("selectBestOffers", () => {
  it("keeps the cheaper supplier for overlapping hotel names", () => {
    const result = selectBestOffers(a, b);
    expect(result.find((hotel) => hotel.name === "Holton")).toMatchObject({
      price: 5340, supplier: "Supplier B", commissionPct: 20
    });
    expect(result.find((hotel) => hotel.name === "Radison")).toMatchObject({
      price: 5900, supplier: "Supplier A", commissionPct: 13
    });
  });

  it("retains hotels found in only one supplier", () => {
    const result = selectBestOffers(a, b);
    expect(result.map((hotel) => hotel.name)).toContain("Only A");
    expect(result.map((hotel) => hotel.name)).toContain("Only B");
    expect(result).toHaveLength(4);
  });

  it("deduplicates names case-insensitively", () => {
    const result = selectBestOffers(
      [{ ...a[0], name: "HOLTON" }],
      [{ ...b[0], name: "holton", price: 5400 }]
    );
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(5340);
  });
});
