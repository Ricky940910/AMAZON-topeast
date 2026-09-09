export type CargoDimensionUnit = "cm" | "in";

export interface CargoDeclarationInput {
  boxLength: number;
  boxWidth: number;
  boxHeight: number;
  dimensionUnit: CargoDimensionUnit;
  unitsPerCarton: number;
}

export interface CargoOrientation {
  lengthIndex: number;
  widthIndex: number;
  heightIndex: number;
  axisCounts: [number, number, number];
  cartons: number;
  boxDimensionsCm: [number, number, number];
  placementLabel: string;
}

export interface CargoDeclarationResult {
  containerDimensionsCm: [number, number, number];
  containerDimensionsIn: [number, number, number];
  boxDimensionsCm: [number, number, number];
  valid: boolean;
  bestOrientation: CargoOrientation | null;
  allOrientations: CargoOrientation[];
  cartonsPerContainer: number;
  productsPerContainer: number;
  declarationBase: number;
  declarationPerProduct: number;
  warnings: string[];
}

// Standard 40HQ internal reference size. Actual usable space varies by carrier and loading plan.
export const FORTY_HQ_INTERNAL_CM: [number, number, number] = [1203, 235, 269];
export const DECLARATION_BASE_AMOUNT = 7856;

const DIMENSION_LABELS = ["箱长", "箱宽", "箱高"] as const;
const PERMUTATIONS: Array<[number, number, number]> = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function uniquePermutations(values: [number, number, number]): Array<[number, number, number]> {
  const seen = new Set<string>();
  return PERMUTATIONS.filter((permutation) => {
    const key = permutation.map((index) => values[index]).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function convertToCm(value: number, unit: CargoDimensionUnit): number {
  return unit === "in" ? value * 2.54 : value;
}

function formatDimension(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function calculateCargoDeclaration(input: CargoDeclarationInput): CargoDeclarationResult {
  const sourceDimensionsCm: [number, number, number] = [
    convertToCm(positive(input.boxLength), input.dimensionUnit),
    convertToCm(positive(input.boxWidth), input.dimensionUnit),
    convertToCm(positive(input.boxHeight), input.dimensionUnit),
  ];
  const unitsPerCarton = Math.floor(positive(input.unitsPerCarton));
  const valid = sourceDimensionsCm.every((value) => value > 0) && unitsPerCarton > 0;
  const allOrientations: CargoOrientation[] = [];

  if (valid) {
    uniquePermutations(sourceDimensionsCm).forEach(([lengthIndex, widthIndex, heightIndex]) => {
      const boxDimensionsCm: [number, number, number] = [
        sourceDimensionsCm[lengthIndex],
        sourceDimensionsCm[widthIndex],
        sourceDimensionsCm[heightIndex],
      ];
      const axisCounts: [number, number, number] = [
        Math.floor(FORTY_HQ_INTERNAL_CM[0] / boxDimensionsCm[0]),
        Math.floor(FORTY_HQ_INTERNAL_CM[1] / boxDimensionsCm[1]),
        Math.floor(FORTY_HQ_INTERNAL_CM[2] / boxDimensionsCm[2]),
      ];
      allOrientations.push({
        lengthIndex,
        widthIndex,
        heightIndex,
        axisCounts,
        cartons: axisCounts.reduce((total, count) => total * count, 1),
        boxDimensionsCm,
        placementLabel: `${DIMENSION_LABELS[lengthIndex]}→柜长，${DIMENSION_LABELS[widthIndex]}→柜宽，${DIMENSION_LABELS[heightIndex]}→柜高`,
      });
    });
  }

  allOrientations.sort((a, b) => b.cartons - a.cartons || b.axisCounts[0] - a.axisCounts[0] || b.axisCounts[1] - a.axisCounts[1]);
  const bestOrientation = allOrientations[0] ?? null;
  const cartonsPerContainer = bestOrientation?.cartons ?? 0;
  const productsPerContainer = cartonsPerContainer * unitsPerCarton;
  const warnings: string[] = [];

  if (!valid) warnings.push("请填写大于 0 的箱长、箱宽、箱高和每箱产品数量。");
  if (valid && cartonsPerContainer === 0) warnings.push("当前纸箱尺寸无法放入标准 40HQ 内部尺寸，请检查单位或箱规。");
  if (valid && bestOrientation && bestOrientation.axisCounts.some((count) => count === 0)) warnings.push("当前箱规至少有一个方向超过 40HQ 内部尺寸。");
  warnings.push("装箱数量为按 40HQ 内尺寸进行的规则整齐排布理论值，实际装柜需预留托盘、加固、门框和装卸空间。");

  return {
    containerDimensionsCm: FORTY_HQ_INTERNAL_CM,
    containerDimensionsIn: FORTY_HQ_INTERNAL_CM.map((value) => value / 2.54) as [number, number, number],
    boxDimensionsCm: sourceDimensionsCm,
    valid,
    bestOrientation,
    allOrientations,
    cartonsPerContainer,
    productsPerContainer,
    declarationBase: DECLARATION_BASE_AMOUNT,
    declarationPerProduct: productsPerContainer > 0 ? DECLARATION_BASE_AMOUNT / productsPerContainer : 0,
    warnings,
  };
}

export function formatCargoDimension(value: number): string {
  return formatDimension(value);
}
