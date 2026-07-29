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

export type PackingMatrixMode = "grouped" | "identical" | "clean";

export interface PackingGroup {
  groupNumber: number;
  cartonCount: number;
  startCarton: number;
  endCarton: number;
  label: string;
}

export interface PackingMatrixRow {
  id: string;
  sku: string;
  totalQty: number;
  productWeight: number;
  allocations: number[];
  packedQty: number;
}

export interface PackingCartonSummary {
  cartonNumber: number;
  groupNumber: number;
  totalQuantity: number;
  totalWeight: number;
  skuCount: number;
}

export interface PackingMatrixPlan {
  mode: PackingMatrixMode;
  modeLabel: string;
  groups: PackingGroup[];
  rows: PackingMatrixRow[];
  cartons: PackingCartonSummary[];
  totalCartons: number;
  totalUnits: number;
  mixedCartonCount: number;
  distinctConfigurations: number;
  errors: string[];
  warnings: string[];
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

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(Math.floor(a));
  let right = Math.abs(Math.floor(b));
  while (right !== 0) {
    [left, right] = [right, left % right];
  }
  return left;
}

export function calculateCommonCartonCount(quantities: number[]): number {
  const valid = quantities.filter((quantity) => Number.isInteger(quantity) && quantity > 0);
  return valid.reduce((common, quantity) => greatestCommonDivisor(common, quantity), 0);
}

export function parseCartonGroups(value: string): number[] {
  return value
    .split(/[,，/、\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function buildGroups(cartonCounts: number[], labels?: string[]): PackingGroup[] {
  let nextCarton = 1;
  return cartonCounts.map((cartonCount, index) => {
    const startCarton = nextCarton;
    const endCarton = startCarton + cartonCount - 1;
    nextCarton = endCarton + 1;
    return {
      groupNumber: index + 1,
      cartonCount,
      startCarton,
      endCarton,
      label: labels?.[index] ?? `箱组 ${index + 1}`,
    };
  });
}

function enumerateGroupedAllocations(totalQty: number, groupSizes: number[], limit = 256): number[][] {
  const allocations: number[][] = [];
  const current = Array(groupSizes.length).fill(0);

  const visit = (groupIndex: number, remaining: number) => {
    if (allocations.length >= limit) return;
    if (groupIndex === groupSizes.length - 1) {
      if (remaining % groupSizes[groupIndex] === 0) {
        current[groupIndex] = remaining / groupSizes[groupIndex];
        allocations.push([...current]);
        current[groupIndex] = 0;
      }
      return;
    }
    const maximum = Math.floor(remaining / groupSizes[groupIndex]);
    const center = maximum / 2;
    const counts = Array.from({ length: maximum + 1 }, (_, count) => count).sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    for (const count of counts) {
      current[groupIndex] = count;
      visit(groupIndex + 1, remaining - count * groupSizes[groupIndex]);
      if (allocations.length >= limit) break;
    }
    current[groupIndex] = 0;
  };

  if (groupSizes.length > 0) visit(0, totalQty);
  return allocations;
}

interface GroupedPlanState {
  allocations: number[][];
  groupQuantities: number[];
  groupWeights: number[];
  groupSkuCounts: number[];
}

function groupedPlanScore(state: GroupedPlanState, final: boolean): number[] {
  const load = state.groupWeights.some((weight) => weight > 0) ? state.groupWeights : state.groupQuantities;
  const average = load.reduce((sum, value) => sum + value, 0) / Math.max(1, load.length);
  const variance = load.reduce((sum, value) => sum + (value - average) ** 2, 0);
  const emptyGroups = state.groupQuantities.filter((quantity) => quantity === 0).length;
  const mixedGroups = state.groupSkuCounts.filter((count) => count > 1).length;
  const splitCount = state.allocations.reduce((sum, allocation) => sum + Math.max(0, allocation.filter((quantity) => quantity > 0).length - 1), 0);
  return [final ? emptyGroups : 0, Math.max(0, ...load), variance, -mixedGroups, splitCount];
}

function compareScores(left: number[], right: number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    if (Math.abs(left[index] - right[index]) < 1e-9) continue;
    return left[index] - right[index];
  }
  return 0;
}

function solveGroupedAllocations(skuRows: MultiSkuInput[], groupSizes: number[]): number[][] | null {
  let states: GroupedPlanState[] = [{
    allocations: [],
    groupQuantities: Array(groupSizes.length).fill(0),
    groupWeights: Array(groupSizes.length).fill(0),
    groupSkuCounts: Array(groupSizes.length).fill(0),
  }];

  for (const row of skuRows) {
    const options = enumerateGroupedAllocations(Math.floor(row.totalQty), groupSizes);
    if (options.length === 0) return null;
    const expanded = states.flatMap((state) => options.map<GroupedPlanState>((allocation) => ({
      allocations: [...state.allocations, allocation],
      groupQuantities: state.groupQuantities.map((quantity, index) => quantity + allocation[index]),
      groupWeights: state.groupWeights.map((weight, index) => weight + allocation[index] * Math.max(0, row.productWeight)),
      groupSkuCounts: state.groupSkuCounts.map((count, index) => count + (allocation[index] > 0 ? 1 : 0)),
    })));
    expanded.sort((left, right) => compareScores(groupedPlanScore(left, false), groupedPlanScore(right, false)));
    states = expanded.slice(0, 3000);
  }

  states.sort((left, right) => compareScores(groupedPlanScore(left, true), groupedPlanScore(right, true)));
  return states[0]?.allocations ?? null;
}

function distributeToMatrix(totalQty: number, cartonCount: number, offset: number, totalCartons: number): number[] {
  const allocations = Array(totalCartons).fill(0);
  const average = Math.floor(totalQty / cartonCount);
  const remainder = totalQty % cartonCount;
  for (let index = 0; index < cartonCount; index += 1) {
    allocations[offset + index] = average + (index < remainder ? 1 : 0);
  }
  return allocations;
}

function finalizeMatrixPlan(
  mode: PackingMatrixMode,
  modeLabel: string,
  groups: PackingGroup[],
  rows: PackingMatrixRow[],
  errors: string[],
  warnings: string[],
  maxCartonWeight: number,
): PackingMatrixPlan {
  const totalCartons = groups.reduce((sum, group) => sum + group.cartonCount, 0);
  const cartons = Array.from({ length: totalCartons }, (_, cartonIndex) => {
    const group = groups.find((item) => cartonIndex + 1 >= item.startCarton && cartonIndex + 1 <= item.endCarton);
    const positiveRows = rows.filter((row) => row.allocations[cartonIndex] > 0);
    return {
      cartonNumber: cartonIndex + 1,
      groupNumber: group?.groupNumber ?? 0,
      totalQuantity: positiveRows.reduce((sum, row) => sum + row.allocations[cartonIndex], 0),
      totalWeight: positiveRows.reduce((sum, row) => sum + row.allocations[cartonIndex] * row.productWeight, 0),
      skuCount: positiveRows.length,
    };
  });
  const signatures = cartons
    .filter((carton) => carton.totalQuantity > 0)
    .map((carton) => rows.map((row) => `${row.sku}:${row.allocations[carton.cartonNumber - 1]}`).join("|"));
  const overweightCartons = maxCartonWeight > 0
    ? cartons.filter((carton) => carton.totalWeight > maxCartonWeight + Number.EPSILON).map((carton) => carton.cartonNumber)
    : [];
  const emptyCartons = cartons.filter((carton) => carton.totalQuantity === 0).map((carton) => carton.cartonNumber);
  if (emptyCartons.length > 0) errors.push(`箱号 ${emptyCartons.join("、")} 为空箱，请减少或调整箱组。`);
  if (overweightCartons.length > 0) warnings.push(`箱号 ${overweightCartons.join("、")} 超过 ${maxCartonWeight.toFixed(2)} kg 箱重限制。`);

  return {
    mode,
    modeLabel,
    groups,
    rows,
    cartons,
    totalCartons,
    totalUnits: rows.reduce((sum, row) => sum + row.totalQty, 0),
    mixedCartonCount: cartons.filter((carton) => carton.skuCount > 1).length,
    distinctConfigurations: new Set(signatures).size,
    errors,
    warnings,
  };
}

export function createGroupedPackingPlan(
  skuRows: MultiSkuInput[],
  groupSizes: number[],
  maxCartonWeight = 0,
): PackingMatrixPlan {
  const errors: string[] = [];
  const warnings = ["同一箱组内每箱 SKU 配置完全一致；不同箱组允许采用不同配置。", "该矩阵用于优化箱型配置，是否产生 0 入库配置费仍以 Seller Central 入库计划显示为准。"];
  if (groupSizes.length === 0) errors.push("请至少输入一个有效箱组，例如 5,5,6,7。");
  const groups = buildGroups(groupSizes);
  const totalCartons = groupSizes.reduce((sum, count) => sum + count, 0);
  const validRows = skuRows.filter((row) => row.sku.trim() && Number.isInteger(row.totalQty) && row.totalQty > 0);
  const groupedAllocations = groupSizes.length > 0 && validRows.length === skuRows.length ? solveGroupedAllocations(skuRows, groupSizes) : null;

  const rows = skuRows.map<PackingMatrixRow>((row, rowIndex) => {
    const totalQty = Math.floor(row.totalQty);
    let allocations = Array(totalCartons).fill(0);
    if (!row.sku.trim() || totalQty < 1) {
      errors.push(`${row.sku || "未命名 SKU"} 的备货量必须为正整数。`);
    } else if (groupSizes.length > 0 && groupedAllocations) {
      const groupedAllocation = groupedAllocations[rowIndex];
      if (groupedAllocation) {
        groups.forEach((group, groupIndex) => {
          const perCarton = groupedAllocation[groupIndex];
          for (let carton = group.startCarton; carton <= group.endCarton; carton += 1) allocations[carton - 1] = perCarton;
        });
      }
    }
    return { id: row.id, sku: row.sku || "UNNAMED-SKU", totalQty, productWeight: Math.max(0, row.productWeight), allocations, packedQty: allocations.reduce((sum, quantity) => sum + quantity, 0) };
  });
  if (!groupedAllocations && groupSizes.length > 0 && validRows.length === skuRows.length) {
    errors.push(`当前 SKU 数量无法由箱组 ${groupSizes.join("/")} 组成，请调整箱组结构。`);
  }

  return finalizeMatrixPlan("grouped", "混装 · 固定箱组", groups, rows, errors, warnings, maxCartonWeight);
}

export function createIdenticalPackingPlan(skuRows: MultiSkuInput[], maxCartonWeight = 0): PackingMatrixPlan {
  const errors: string[] = [];
  const quantities = skuRows.map((row) => Math.floor(row.totalQty));
  if (skuRows.some((row) => !row.sku.trim() || !Number.isInteger(row.totalQty) || row.totalQty < 1)) errors.push("SKU 与备货量必须完整，备货量必须为正整数。");
  const commonCartonCount = calculateCommonCartonCount(quantities);
  if (commonCartonCount < 1) errors.push("无法计算完全同配箱数。");
  const effectiveCartonCount = commonCartonCount > 1 ? commonCartonCount : 0;
  const groups = effectiveCartonCount > 0 ? buildGroups([effectiveCartonCount], ["完全同配箱组"]) : [];
  const rows = skuRows.map<PackingMatrixRow>((row) => {
    const totalQty = Math.floor(row.totalQty);
    const perCarton = effectiveCartonCount > 0 ? totalQty / effectiveCartonCount : 0;
    const allocations = Array(effectiveCartonCount).fill(Number.isInteger(perCarton) ? perCarton : 0);
    return { id: row.id, sku: row.sku || "UNNAMED-SKU", totalQty, productWeight: Math.max(0, row.productWeight), allocations, packedQty: allocations.reduce((sum, quantity) => sum + quantity, 0) };
  });
  const warnings = commonCartonCount === 1
    ? ["这些 SKU 的数量最大公约数为 1，不建议把全部货装入 1 箱，请改用固定箱组或清装。"]
    : [`以全部 SKU 数量的最大公约数 ${commonCartonCount} 作为箱数，所有箱子的 SKU 配置完全相同。`];
  if (commonCartonCount === 1) errors.push("当前数量没有大于 1 的共同箱数，无法生成实用的完全同配方案。");
  return finalizeMatrixPlan("identical", "混装 · 完全同配", groups, rows, errors, warnings, maxCartonWeight);
}

export function createCleanPackingPlan(
  skuRows: MultiSkuInput[],
  defaultCartonCount: number,
  maxCartonWeight = 0,
): PackingMatrixPlan {
  const errors: string[] = [];
  const cartonCounts = skuRows.map((row) => Math.floor(row.cartonCount) || Math.floor(defaultCartonCount));
  cartonCounts.forEach((cartonCount, index) => {
    if (cartonCount < 1) errors.push(`${skuRows[index].sku || "未命名 SKU"} 的清装箱数必须大于 0。`);
    if (cartonCount > skuRows[index].totalQty) errors.push(`${skuRows[index].sku || "未命名 SKU"} 的清装箱数不能大于备货量，否则会产生空箱。`);
  });
  if (errors.length > 0) {
    const rows = skuRows.map<PackingMatrixRow>((row) => ({ id: row.id, sku: row.sku || "UNNAMED-SKU", totalQty: Math.floor(row.totalQty), productWeight: Math.max(0, row.productWeight), allocations: [], packedQty: 0 }));
    return finalizeMatrixPlan("clean", "清装 · SKU 独占箱组", [], rows, errors, ["每个 SKU 独占连续箱号；不能整除时，同一 SKU 的单箱数量差不超过 1。"], maxCartonWeight);
  }
  const groups = buildGroups(cartonCounts, skuRows.map((row) => `${row.sku || "未命名 SKU"} 清装`));
  const totalCartons = groups.reduce((sum, group) => sum + group.cartonCount, 0);
  const rows = skuRows.map<PackingMatrixRow>((row, rowIndex) => {
    const cartonCount = cartonCounts[rowIndex];
    const allocations = cartonCount > 0 && cartonCount <= row.totalQty
      ? distributeToMatrix(Math.floor(row.totalQty), cartonCount, groups[rowIndex].startCarton - 1, totalCartons)
      : Array(totalCartons).fill(0);
    return { id: row.id, sku: row.sku || "UNNAMED-SKU", totalQty: Math.floor(row.totalQty), productWeight: Math.max(0, row.productWeight), allocations, packedQty: allocations.reduce((sum, quantity) => sum + quantity, 0) };
  });
  return finalizeMatrixPlan("clean", "清装 · SKU 独占箱组", groups, rows, errors, ["每个 SKU 独占连续箱号；不能整除时，同一 SKU 的单箱数量差不超过 1。"], maxCartonWeight);
}

export function buildMatrixShipmentRows(plan: PackingMatrixPlan, cartonDimensions: Dimensions): ShipmentRow[] {
  return plan.rows.flatMap((row) => row.allocations.flatMap((quantity, cartonIndex) => {
    if (quantity <= 0) return [];
    const carton = plan.cartons[cartonIndex];
    return [{
      SKU: row.sku,
      "Carton Number": cartonIndex + 1,
      Quantity: quantity,
      "Weight (kg)": Number(carton.totalWeight.toFixed(3)),
      "Length (cm)": cartonDimensions[0],
      "Width (cm)": cartonDimensions[1],
      "Height (cm)": cartonDimensions[2],
      Note: `${plan.modeLabel} · 箱组 ${carton.groupNumber}`,
    }];
  }));
}

export function calculateRecommendedQuantity(dailySales: number, transitDays: number, safetyDays: number): number {
  if (dailySales < 0 || transitDays < 0 || safetyDays < 0) return 0;
  return Math.ceil(dailySales * (transitDays + safetyDays));
}
