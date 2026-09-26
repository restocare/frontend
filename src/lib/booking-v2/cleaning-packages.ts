/**
 * Deep Cleaning packages for the flow-2 sample design: the four sub-categories
 * and their sized packages, copied from the prototype
 * (D:\RC\Redesign\Deep_Cleaning\deep-cleaning.html). Static on purpose: the
 * backend catalogue does not have these yet. Prices are pre-tax; `from`
 * marks a starting price that is confirmed at booking.
 */

export type CleaningSubKey = "washroom" | "kitchen" | "sitting" | "full";

export interface CleaningPackage {
  id: string;
  name: string;
  /** The size or scope line under the name. */
  spec: string;
  price: number;
  from?: boolean;
}

export interface CleaningSub {
  key: CleaningSubKey;
  /** Tile label. */
  name: string;
  /** List heading. */
  title: string;
  /** Pricing basis line under the heading. */
  basis: string;
  /** Tile meta, e.g. "3 sizes". */
  meta: string;
  /** Optional note under the list. */
  note?: string;
  packages: CleaningPackage[];
}

export const CLEANING_SUBS: CleaningSub[] = [
  {
    key: "washroom",
    name: "Washroom",
    title: "Washroom Deep Cleaning",
    basis: "Priced by fixture count",
    meta: "3 sizes",
    packages: [
      { id: "wr-essential", name: "Essential", spec: "Up to 1 urinal and 1 WC", price: 1499 },
      { id: "wr-standard", name: "Standard", spec: "2 to 5 urinals, 2 to 3 WCs", price: 2999 },
      { id: "wr-large", name: "Large", spec: "More than 5 urinals, more than 3 WCs", price: 4999 },
    ],
  },
  {
    key: "kitchen",
    name: "Kitchen",
    title: "Kitchen Deep Cleaning",
    basis: "Priced by cleanable sq ft",
    meta: "7 sizes",
    packages: [
      { id: "k-small", name: "Small kitchen", spec: "100 to 150 sq ft", price: 2999 },
      { id: "k-only", name: "Kitchen only", spec: "151 to 300 sq ft", price: 4499 },
      { id: "k-store", name: "Kitchen with attached store", spec: "301 to 500 sq ft", price: 6499 },
      { id: "k-medium", name: "Medium commercial kitchen", spec: "501 to 800 sq ft", price: 8999 },
      { id: "k-large", name: "Large commercial kitchen", spec: "801 to 1,200 sq ft", price: 12499 },
      { id: "k-large-store", name: "Large kitchen with store", spec: "1,201 to 1,800 sq ft", price: 16999 },
      { id: "k-xl-store", name: "Extra-large kitchen with store", spec: "1,801 to 2,500 sq ft", price: 21999 },
    ],
  },
  {
    key: "sitting",
    name: "Sitting & Service Area",
    title: "Sitting & Service Area Deep Cleaning",
    basis: "Priced by area and seating",
    meta: "4 sizes",
    note: "Pick by whichever is larger, area or seating. Ceiling, floor and upholstery details are taken at booking.",
    packages: [
      { id: "s-small", name: "Small", spec: "Up to 300 sq ft, up to 20 seats", price: 2499, from: true },
      { id: "s-medium", name: "Medium", spec: "301 to 600 sq ft, 21 to 50 seats", price: 4499, from: true },
      { id: "s-large", name: "Large", spec: "601 to 1,200 sq ft, 51 to 100 seats", price: 7999, from: true },
      { id: "s-xl", name: "Extra large", spec: "Over 1,200 sq ft, over 100 seats", price: 12999, from: true },
    ],
  },
  {
    key: "full",
    name: "Full Restaurant",
    title: "Full Restaurant Deep Cleaning",
    basis: "Starting prices, book directly",
    meta: "6 types",
    note: "Final price depends on area, zones, washrooms, grease level and access conditions, confirmed at booking.",
    packages: [
      { id: "f-takeaway", name: "Small Takeaway / Cloud Kitchen", spec: "Kitchen, service area, washrooms", price: 2999, from: true },
      { id: "f-cafe", name: "Cafe / QSR", spec: "Kitchen, dining, service area, washrooms", price: 3999, from: true },
      { id: "f-casual", name: "Casual Dining Restaurant", spec: "Kitchen, dining, service area, washrooms", price: 4999, from: true },
      { id: "f-bar", name: "Bar & Restaurant", spec: "Kitchen, bar, dining, washrooms", price: 9999, from: true },
      { id: "f-canteen", name: "Day Canteen / Cafeteria", spec: "Kitchen, dining, service area, washrooms", price: 12999, from: true },
      { id: "f-banquet", name: "Banquet Hall", spec: "Hall, kitchen, service area, washrooms", price: 15999, from: true },
    ],
  },
];

export const CLEANING_PACKAGE_COUNT = CLEANING_SUBS.reduce((n, s) => n + s.packages.length, 0);
