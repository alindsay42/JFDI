// Starting kit for gyms. Kept apart from gyms.ts so the database can seed from it.
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";

export interface Gym { id: string; kit: JFDIHouseholdEquipment }

export const kit = (name: string, items: JFDIHouseholdEquipment["items"]): JFDIHouseholdEquipment =>
  ({ format: "jfdi-equipment", formatVersion: 1, name, updatedAt: "2026-11-11T12:00:00Z", items });

/** What a brand-new household starts with: easy to change on the Equipment page. */
export const TYPICAL_GYM: JFDIHouseholdEquipment = kit("Home gym", [
  { id: "barbell", name: "Barbell", kind: "bar", barType: "standard", kg: 20 },
  { id: "ez-bar", name: "EZ curl bar", kind: "bar", barType: "ez", kg: 10 },
  { id: "plates", name: "Plates", kind: "plates", plates: [
    { kg: 20, count: 2 }, { kg: 15, count: 2 }, { kg: 10, count: 2 }, { kg: 5, count: 2 }, { kg: 2.5, count: 2 }, { kg: 1.25, count: 2 },
  ] },
  { id: "dumbbells", name: "Dumbbells", kind: "dumbbells", pairsKg: [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30] },
  { id: "rack", name: "Squat rack", kind: "rack" },
  { id: "bench", name: "Bench", kind: "bench" },
  { id: "pull-up-bar", name: "Pull-up bar", kind: "station" },
]);

export const emptyGym = (name: string) => kit(name, []);

