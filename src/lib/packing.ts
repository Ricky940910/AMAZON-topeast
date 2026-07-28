import { z } from "zod";

export type Dimensions = [number, number, number];

export interface CartonLine {
  cartonNumber: number;
  quantity: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  note: string;
}

export interface OrientationResult {
  productOrientation: Dimensions;
  counts: Dimensions;
  capacity: number;
  fits: boolean;
}

export interface CapacityResult {
  weightCapacity: number | null;
  dimensionCapacity: number | null;
  effectiveCapacity: number;
  limitingFactor: "weight" | "dimensions" | "both" | "none";
  orientation: OrientationResult | null;
}

export interface MultiSkuInput {
  id: string;
  sku: string;
  totalQty: number;
  cartonCount: number;
  productWeight: number;
  productDimensions: Dimensions;
}

export interface MultiSkuResult extends MultiSkuInput {
  cartons: CartonLine[];
  error: string | null;
}

export interface ShipmentRow {
  SKU: string;
  "Carton Number": number;
  Quantity: number;
  "Weight (kg)": number;
  "Length (cm)": number;
  "Width (cm)": number;
  "Height (cm)": number;
  Note: string;
}

export const positiveIntegerSchema = z.number().int("必须为整数").positive("必须大于 0");
export const nonNegativeIntegerSchema = z.number().int("必须为整数").nonnegative("不能小于 0");
export const positiveNumberSchema = z.number().positive("必须大于 0");
export const dimensionsSchema = z.tuple([positiveNumberSchema, positiveNumberSchema, positiveNumberSchema]);

export const importedSkuSchema = z.object({
  sku: z.string().trim().min(1, "SKU 不能为空"),
  totalQty: positiveIntegerSchema,
  productWeight: z.number().nonnegative("重量不能小于 0"),
  productDimensions: z.tuple([
    z.number().nonnegative("尺寸不能小于 0"),
    z.number().nonnegative("尺寸不能小于 0"),
    z.number().nonnegative("尺寸不能小于 0"),
  ]),
});

function assertPositiveInteger(value: number, label: string): void {
  const parsed = positiveIntegerSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${label}${parsed.error.issues[0]?.message ?? "无效"}`);
}

function makeCartons(
  quantities: number[],
  productWeight: number,
  cartonDimensions: Dimensions,
  note = "",
): CartonLine[] {
  return quantities.map((quantity, index) => ({
    cartonNumber: index + 1,
    quantity,
    weight: quantity * Math.max(0, productWeight),
    length: cartonDimensions[0],
    width: cartonDimensions[1],
    height: cartonDimensions[2],
    note,
  }));
}

export function distributeAverage(
  totalQty: number,
  cartonCount: number,
  productWeight = 0,
  cartonDimensions: Dimensions = [0, 0, 0],
): CartonLine[] {
  assertPositiveInteger(totalQty, "总数量");
  assertPositiveInteger(cartonCount, "箱数");
  if (cartonCount > totalQty) throw new Error("箱数不能大于总数量，否则会产生空箱");

  const average = Math.floor(totalQty / cartonCount);
  const remainder = totalQty % cartonCount;
  const quantities = Array.from({ length: cartonCount }, (_, index) => average + (index < remainder ? 1 : 0));
  return makeCartons(quantities, productWeight, cartonDimensions, "平均装箱");
}

export function distributeByCapacity(
  totalQty: number,
  qtyPerCarton: number,
  productWeight = 0,
  cartonDimensions: Dimensions = [0, 0, 0],
  note = "按每箱数量装箱",
): CartonLine[] {
  assertPositiveInteger(totalQty, "总数量");
  assertPositiveInteger(qtyPerCarton, "每箱数量");

  const cartonCount = Math.ceil(totalQty / qtyPerCarton);
  const quantities = Array.from({ length: cartonCount }, (_, index) =>
    index === cartonCount - 1 ? totalQty - qtyPerCarton * index : qtyPerCarton,
  );
  return makeCartons(quantities, productWeight, cartonDimensions, note);
}

function permutations([a, b, c]: Dimensions): Dimensions[] {
  return [
    [a, b, c], [a, c, b], [b, a, c],
    [b, c, a], [c, a, b], [c, b, a],
  ];
}

export function calculateOrientation(productDimensions: Dimensions, cartonDimensions: Dimensions): OrientationResult {
  const productParsed = dimensionsSchema.safeParse(productDimensions);
  const cartonParsed = dimensionsSchema.safeParse(cartonDimensions);
  if (!productParsed.success || !cartonParsed.success) {
    return { productOrientation: productDimensions, counts: [0, 0, 0], capacity: 0, fits: false };
  }

  return permutations(productDimensions).reduce<OrientationResult>((best, orientation) => {
    const counts: Dimensions = [
      Math.floor(cartonDimensions[0] / orientation[0]),
      Math.floor(cartonDimensions[1] / orientation[1]),
      Math.floor(cartonDimensions[2] / orientation[2]),
    ];
    const capacity = counts[0] * counts[1] * counts[2];
    return capacity > best.capacity
      ? { productOrientation: orientation, counts, capacity, fits: capacity > 0 }
      : best;
  }, { productOrientation: productDimensions, counts: [0, 0, 0], capacity: 0, fits: false });
}

export function calculateCapacity(
  productWeight: number,
  maxCartonWeight: number,
  productDimensions: Dimensions,
  cartonDimensions: Dimensions,
): CapacityResult {
  const weightCapacity = productWeight > 0 && maxCartonWeight > 0
    ? Math.floor(maxCartonWeight / productWeight)
    : null;
  const hasDimensions = productDimensions.every((value) => value > 0) && cartonDimensions.every((value) => value > 0);
  const orientation = hasDimensions ? calculateOrientation(productDimensions, cartonDimensions) : null;
  const dimensionCapacity = orientation ? orientation.capacity : null;
  const available = [weightCapacity, dimensionCapacity].filter((value): value is number => value !== null);
  const effectiveCapacity = available.length > 0 ? Math.min(...available) : 0;

  let limitingFactor: CapacityResult["limitingFactor"] = "none";
  if (weightCapacity !== null && dimensionCapacity !== null) {
    limitingFactor = weightCapacity === dimensionCapacity ? "both" : weightCapacity < dimensionCapacity ? "weight" : "dimensions";
  } else if (weightCapacity !== null) {
    limitingFactor = "weight";
  } else if (dimensionCapacity !== null) {
    limitingFactor = "dimensions";
  }

  return { weightCapacity, dimensionCapacity, effectiveCapacity, limitingFactor, orientation };
}

export function validateCartons(cartons: CartonLine[], totalQty: number, maxCartonWeight = 0): string[] {
  const errors: string[] = [];
  const packedQty = cartons.reduce((sum, carton) => sum + carton.quantity, 0);
  if (packedQty !== totalQty) errors.push(`装箱数量 ${packedQty} 与总数量 ${totalQty} 不一致`);
  if (cartons.some((carton) => !Number.isInteger(carton.quantity) || carton.quantity <= 0)) errors.push("每箱数量必须为正整数");
  if (maxCartonWeight > 0 && cartons.some((carton) => carton.weight > maxCartonWeight + Number.EPSILON)) errors.push("存在超重纸箱，请减少装箱数量");
  return errors;
}

export function maxQuantityDifference(cartons: CartonLine[]): number {
  if (cartons.length === 0) return 0;
  const quantities = cartons.map((carton) => carton.quantity);
  return Math.max(...quantities) - Math.min(...quantities);
}

export function calculateMultiSku(
  rows: MultiSkuInput[],
  maxCartonWeight: number,
  cartonDimensions: Dimensions,
): MultiSkuResult[] {
  return rows.map((row) => {
    try {
      const cartons = row.cartonCount > 0
        ? distributeAverage(row.totalQty, row.cartonCount, row.productWeight, cartonDimensions)
        : (() => {
            const capacity = calculateCapacity(row.productWeight, maxCartonWeight, row.productDimensions, cartonDimensions);
            if (capacity.effectiveCapacity < 1) throw new Error("产品无法放入当前纸箱，或重量上限不足一件");
            return distributeByCapacity(row.totalQty, capacity.effectiveCapacity, row.productWeight, cartonDimensions, "自动容量装箱");
          })();
      return { ...row, cartons, error: null };
    } catch (error) {
      return { ...row, cartons: [], error: error instanceof Error ? error.message : "计算失败" };
    }
  });
}

export function buildShipmentRows(results: Array<{ sku: string; cartons: CartonLine[] }>): ShipmentRow[] {
  return results.flatMap((result) => result.cartons.map((carton) => ({
    SKU: result.sku || "UNNAMED-SKU",
    "Carton Number": carton.cartonNumber,
    Quantity: carton.quantity,
    "Weight (kg)": Number(carton.weight.toFixed(3)),
    "Length (cm)": carton.length,
    "Width (cm)": carton.width,
    "Height (cm)": carton.height,
    Note: carton.note,
  })));
}

export function calculateRecommendedQuantity(dailySales: number, transitDays: number, safetyDays: number): number {
  if (dailySales < 0 || transitDays < 0 || safetyDays < 0) return 0;
  return Math.ceil(dailySales * (transitDays + safetyDays));
}
