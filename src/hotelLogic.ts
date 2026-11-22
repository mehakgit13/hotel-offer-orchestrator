import { HotelOffer, SupplierHotel } from "./types";

export function selectBestOffers(
  supplierA: SupplierHotel[],
  supplierB: SupplierHotel[]
): HotelOffer[] {
  const byName = new Map<string, HotelOffer>();

  const add = (hotel: SupplierHotel, supplier: "Supplier A" | "Supplier B") => {
    const key = hotel.name.trim().toLocaleLowerCase();
    if (!key) return;
    const candidate: HotelOffer = {
      name: hotel.name.trim(),
      price: hotel.price,
      supplier,
      commissionPct: hotel.commissionPct
    };
    const existing = byName.get(key);
    if (!existing || candidate.price < existing.price) {
      byName.set(key, candidate);
    }
  };

  supplierA.forEach((hotel) => add(hotel, "Supplier A"));
  supplierB.forEach((hotel) => add(hotel, "Supplier B"));

  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
