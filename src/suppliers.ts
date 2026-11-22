import { Router, Request, Response } from "express";
import { config } from "./config";
import { SupplierHotel } from "./types";

const router = Router();

// Static mock data intentionally contains overlapping hotel names and
// different prices so the comparison and cheaper-supplier selection are visible.
const supplierAData: SupplierHotel[] = [
  { hotelId: "a1", name: "Holton", price: 6000, city: "delhi", commissionPct: 10 },
  { hotelId: "a2", name: "Radison", price: 5900, city: "delhi", commissionPct: 13 },
  { hotelId: "a3", name: "The Grand", price: 7200, city: "delhi", commissionPct: 12 },
  { hotelId: "a4", name: "City Comfort", price: 4200, city: "mumbai", commissionPct: 9 }
];

const supplierBData: SupplierHotel[] = [
  { hotelId: "b1", name: "Holton", price: 5340, city: "delhi", commissionPct: 20 },
  { hotelId: "b2", name: "Radison", price: 6100, city: "delhi", commissionPct: 15 },
  { hotelId: "b3", name: "Blue Orchid", price: 4800, city: "delhi", commissionPct: 11 },
  { hotelId: "b4", name: "City Comfort", price: 4100, city: "mumbai", commissionPct: 8 }
];

function supplierHandler(
  supplier: "A" | "B",
  data: SupplierHotel[],
  enabled: boolean
) {
  return (req: Request, res: Response) => {
    if (!enabled) {
      return res.status(503).json({
        error: `Supplier ${supplier} is temporarily unavailable`,
        supplier: `Supplier ${supplier}`
      });
    }
    const city = String(req.query.city ?? "").trim().toLowerCase();
    if (!city) return res.status(400).json({ error: "city query parameter is required" });
    return res.json(data.filter((hotel) => hotel.city.toLowerCase() === city));
  };
}

router.get("/supplierA/hotels", supplierHandler("A", supplierAData, config.supplierAEnabled));
router.get("/supplierB/hotels", supplierHandler("B", supplierBData, config.supplierBEnabled));

export default router;
