export type UsWarehouseRegion = "west" | "east";

export interface AmazonWarehouse {
  code: string;
  city: string;
  state: string;
  region: UsWarehouseRegion;
}

export const US_WAREHOUSE_REGION_LABELS: Record<UsWarehouseRegion, string> = {
  west: "美西",
  east: "美东",
};

// Common US FBA destinations. The shipment plan returned by Amazon remains the source of truth.
export const AMAZON_US_WAREHOUSES = ([
  { code: "ABE8", city: "Florence", state: "NJ", region: "east" },
  { code: "AVP1", city: "Hazleton", state: "PA", region: "east" },
  { code: "AVP3", city: "Easton", state: "PA", region: "east" },
  { code: "BDL2", city: "Windsor", state: "CT", region: "east" },
  { code: "BWI2", city: "North East", state: "MD", region: "east" },
  { code: "CLT2", city: "Charlotte", state: "NC", region: "east" },
  { code: "CLT4", city: "Concord", state: "NC", region: "east" },
  { code: "EWR4", city: "Robbinsville", state: "NJ", region: "east" },
  { code: "EWR9", city: "Carteret", state: "NJ", region: "east" },
  { code: "FTW1", city: "Dallas", state: "TX", region: "east" },
  { code: "FTW6", city: "Coppell", state: "TX", region: "east" },
  { code: "HOU2", city: "Houston", state: "TX", region: "east" },
  { code: "IND9", city: "Greenwood", state: "IN", region: "east" },
  { code: "LAS1", city: "Henderson", state: "NV", region: "west" },
  { code: "LAS7", city: "Las Vegas", state: "NV", region: "west" },
  { code: "LAX9", city: "Fontana", state: "CA", region: "west" },
  { code: "MEM1", city: "Memphis", state: "TN", region: "east" },
  { code: "MDW2", city: "Joliet", state: "IL", region: "east" },
  { code: "MDW7", city: "Monee", state: "IL", region: "east" },
  { code: "ONT6", city: "Moreno Valley", state: "CA", region: "west" },
  { code: "ONT8", city: "Moreno Valley", state: "CA", region: "west" },
  { code: "ONT9", city: "Redlands", state: "CA", region: "west" },
  { code: "PHX3", city: "Phoenix", state: "AZ", region: "west" },
  { code: "PHX6", city: "Phoenix", state: "AZ", region: "west" },
  { code: "RIC2", city: "Chester", state: "VA", region: "east" },
  { code: "SAT2", city: "San Marcos", state: "TX", region: "east" },
  { code: "SCK4", city: "Stockton", state: "CA", region: "west" },
  { code: "SCK8", city: "Stockton", state: "CA", region: "west" },
  { code: "SDF8", city: "Jeffersonville", state: "IN", region: "east" },
  { code: "SMF3", city: "Stockton", state: "CA", region: "west" },
  { code: "TEB3", city: "Logan Township", state: "NJ", region: "east" },
  { code: "TEB6", city: "Cranbury", state: "NJ", region: "east" },
] satisfies AmazonWarehouse[]).sort((a, b) => a.code.localeCompare(b.code));

export function findAmazonWarehouse(code: string): AmazonWarehouse | undefined {
  const normalizedCode = code.trim().toUpperCase();
  return AMAZON_US_WAREHOUSES.find((warehouse) => warehouse.code === normalizedCode);
}

export function filterAmazonWarehouses(query: string, limit = 10): AmazonWarehouse[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return AMAZON_US_WAREHOUSES.slice(0, limit);

  return AMAZON_US_WAREHOUSES
    .filter((warehouse) => [
      warehouse.code,
      warehouse.city,
      warehouse.state,
      US_WAREHOUSE_REGION_LABELS[warehouse.region],
    ].some((value) => value.toLowerCase().includes(normalizedQuery)))
    .slice(0, limit);
}
