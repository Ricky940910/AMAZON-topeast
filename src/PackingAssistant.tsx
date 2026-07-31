import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Box,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  FileDown,
  FileSpreadsheet,
  Info,
  PackagePlus,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  Ship,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  buildMatrixShipmentRows,
  buildShipmentRows,
  calculateCapacity,
  calculateRecommendedQuantity,
  createCleanPackingPlan,
  createGroupedPackingPlan,
  createIdenticalPackingPlan,
  distributeAverage,
  distributeByCapacity,
  importedSkuSchema,
  maxQuantityDifference,
  parseCartonGroups,
  validateCartons,
  type CartonLine,
  type Dimensions,
  type MultiSkuInput,
  type PackingMatrixPlan,
  type PackingMatrixMode,
  type ShipmentRow,
} from "./lib/packing";
import { numberInputValue } from "./lib/input";

type PackingView = "single" | "multi" | "replenishment";
type PackingMode = "average" | "capacity" | "auto";

interface SingleInput {
  sku: string;
  totalQty: number;
  cartonCount: number;
  qtyPerCarton: number;
  productWeight: number;
  maxCartonWeight: number;
  productDimensions: Dimensions;
  cartonDimensions: Dimensions;
  useWeightLimit: boolean;
  useDimensionLimit: boolean;
}

const DEFAULT_SINGLE: SingleInput = {
  sku: "",
  totalQty: 0,
  cartonCount: 0,
  qtyPerCarton: 0,
  productWeight: 0,
  maxCartonWeight: 0,
  productDimensions: [0, 0, 0],
  cartonDimensions: [0, 0, 0],
  useWeightLimit: false,
  useDimensionLimit: false,
};

const DEFAULT_MULTI: MultiSkuInput[] = [
  { id: "sku-1", sku: "", totalQty: 0, cartonCount: 0, productWeight: 0, productDimensions: [0, 0, 0] },
];

const LIMIT_LABELS = {
  weight: "箱重限制",
  dimensions: "纸箱空间",
  both: "重量与尺寸同时",
  none: "未启用容量限制",
};

function numeric(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function integer(value: string): number {
  return Math.floor(numeric(value));
}

function format(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function createId(): string {
  return `sku-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function downloadRows(rows: ShipmentRow[], filename: string, formatType: "xlsx" | "csv"): Promise<void> {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Packing List");
  XLSX.writeFile(workbook, `${filename}.${formatType}`, formatType === "csv" ? { bookType: "csv" } : undefined);
}

async function downloadMatrixWorkbook(plan: PackingMatrixPlan, shipmentRows: ShipmentRow[]): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const matrixRows = plan.rows.map((row) => ({
    SKU: row.sku,
    备货量: row.totalQty,
    ...Object.fromEntries(row.allocations.map((quantity, index) => [`箱${index + 1}`, quantity || ""])),
  }));
  const cartonRows = plan.cartons.map((carton) => ({
    箱号: carton.cartonNumber,
    箱组: carton.groupNumber,
    总件数: carton.totalQuantity,
    "总重量(kg)": Number(carton.totalWeight.toFixed(3)),
    SKU种类: carton.skuCount,
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(matrixRows), "装箱矩阵");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cartonRows), "纸箱汇总");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(shipmentRows), "Amazon Shipment");
  XLSX.writeFile(workbook, "Packing_Matrix.xlsx");
}

function summarizeAllocation(plan: PackingMatrixPlan, rowIndex: number): string {
  const row = plan.rows[rowIndex];
  if (!row) return "—";
  const summaries = plan.groups.flatMap((group) => {
    const values = row.allocations.slice(group.startCarton - 1, group.endCarton);
    if (values.every((value) => value === 0)) return [];
    const uniqueValues = [...new Set(values)];
    return [`G${group.groupNumber}: ${uniqueValues.length === 1 ? `${uniqueValues[0]}/箱` : values.join("/")}`];
  });
  return summaries.join(" · ") || "未分配";
}

async function downloadImportTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([["SKU", "数量", "重量", "长", "宽", "高", "箱数"]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Import Template");
  XLSX.writeFile(workbook, "Packing_Import_Template.xlsx");
}

function PackingAssistant() {
  const [view, setView] = useState<PackingView>("single");
  const [mode, setMode] = useState<PackingMode>("average");
  const [single, setSingle] = useState(DEFAULT_SINGLE);
  const [multiRows, setMultiRows] = useState(DEFAULT_MULTI);
  const [matrixMode, setMatrixMode] = useState<PackingMatrixMode>("grouped");
  const [groupInput, setGroupInput] = useState("");
  const [cleanDefaultCartons, setCleanDefaultCartons] = useState(0);
  const [multiMaxWeight, setMultiMaxWeight] = useState(0);
  const [multiCartonDimensions, setMultiCartonDimensions] = useState<Dimensions>([0, 0, 0]);
  const [dailySales, setDailySales] = useState(0);
  const [transitDays, setTransitDays] = useState(0);
  const [safetyDays, setSafetyDays] = useState(0);
  const [copied, setCopied] = useState(false);
  const [matrixCopied, setMatrixCopied] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabledCapacity = useMemo(() => calculateCapacity(
    single.useWeightLimit ? single.productWeight : 0,
    single.useWeightLimit ? single.maxCartonWeight : 0,
    single.useDimensionLimit ? single.productDimensions : [0, 0, 0],
    single.useDimensionLimit ? single.cartonDimensions : [0, 0, 0],
  ), [single]);

  const singleResult = useMemo(() => {
    try {
      let cartons: CartonLine[];
      if (mode === "average") {
        cartons = distributeAverage(single.totalQty, single.cartonCount, single.productWeight, single.cartonDimensions);
      } else if (mode === "capacity") {
        cartons = distributeByCapacity(single.totalQty, single.qtyPerCarton, single.productWeight, single.cartonDimensions);
      } else {
        if (enabledCapacity.effectiveCapacity < 1) throw new Error("请至少启用一个有效的箱重或尺寸限制");
        cartons = distributeByCapacity(single.totalQty, enabledCapacity.effectiveCapacity, single.productWeight, single.cartonDimensions, "按限制自动装箱");
      }

      const errors = validateCartons(cartons, single.totalQty, single.useWeightLimit ? single.maxCartonWeight : 0);
      if (single.useDimensionLimit && enabledCapacity.dimensionCapacity === 0) errors.push("产品无法放入当前纸箱");
      const maxQty = Math.max(...cartons.map((carton) => carton.quantity));
      if ((single.useWeightLimit || single.useDimensionLimit) && enabledCapacity.effectiveCapacity > 0 && maxQty > enabledCapacity.effectiveCapacity) {
        errors.push(`当前方案每箱最多 ${maxQty} 件，超过综合容量 ${enabledCapacity.effectiveCapacity} 件`);
      }
      return { cartons, errors, error: null as string | null };
    } catch (error) {
      return { cartons: [] as CartonLine[], errors: [] as string[], error: error instanceof Error ? error.message : "计算失败" };
    }
  }, [enabledCapacity, mode, single]);

  const groupSizes = useMemo(() => parseCartonGroups(groupInput), [groupInput]);
  const multiPlan = useMemo(() => {
    const plan = matrixMode === "identical"
      ? createIdenticalPackingPlan(multiRows, multiMaxWeight)
      : matrixMode === "clean"
        ? createCleanPackingPlan(multiRows, cleanDefaultCartons, multiMaxWeight)
        : createGroupedPackingPlan(multiRows, groupSizes, multiMaxWeight);
    if (plan.totalCartons > 300) {
      plan.errors.push(`当前方案生成 ${plan.totalCartons} 箱，在线矩阵最多展示 300 箱，请调整箱组或清装箱数。`);
    }
    return plan;
  }, [cleanDefaultCartons, groupSizes, matrixMode, multiMaxWeight, multiRows]);
  const singleShipmentRows = useMemo(() => buildShipmentRows([{ sku: single.sku, cartons: singleResult.cartons }]), [single.sku, singleResult.cartons]);
  const multiShipmentRows = useMemo(() => buildMatrixShipmentRows(multiPlan, multiCartonDimensions), [multiCartonDimensions, multiPlan]);
  const recommendedQty = useMemo(() => calculateRecommendedQuantity(dailySales, transitDays, safetyDays), [dailySales, transitDays, safetyDays]);

  const updateSingleDimension = (key: "productDimensions" | "cartonDimensions", index: number, value: string) => {
    setSingle((current) => {
      const dimensions = [...current[key]] as Dimensions;
      dimensions[index] = numeric(value);
      return { ...current, [key]: dimensions };
    });
  };

  const copySingle = async () => {
    const text = [
      `SKU：${single.sku || "未填写"}`,
      `总数量：${single.totalQty}`,
      `总箱数：${singleResult.cartons.length}`,
      `装箱结果：${singleResult.cartons.map((carton) => carton.quantity).join("/")}`,
      `总重量：${format(singleResult.cartons.reduce((sum, carton) => sum + carton.weight, 0))} kg`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const updateMulti = (id: string, update: Partial<MultiSkuInput>) => {
    setMultiRows((rows) => rows.map((row) => row.id === id ? { ...row, ...update } : row));
  };

  const updateMultiDimension = (id: string, index: number, value: string) => {
    setMultiRows((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const dimensions = [...row.productDimensions] as Dimensions;
      dimensions[index] = numeric(value);
      return { ...row, productDimensions: dimensions };
    }));
  };

  const copyMatrix = async () => {
    const header = ["SKU", "备货量", ...multiPlan.cartons.map((carton) => `箱${carton.cartonNumber}`)];
    const rows = multiPlan.rows.map((row) => [row.sku, row.totalQty, ...row.allocations.map((quantity) => quantity || "")]);
    const totals = ["每箱总件数", multiPlan.totalUnits, ...multiPlan.cartons.map((carton) => carton.totalQuantity)];
    await navigator.clipboard.writeText([header, ...rows, totals].map((row) => row.join("\t")).join("\n"));
    setMatrixCopied(true);
    window.setTimeout(() => setMatrixCopied(false), 1600);
  };

  const clearMultiPacking = () => {
    setMultiRows(DEFAULT_MULTI.map((row) => ({ ...row, id: createId(), productDimensions: [...row.productDimensions] as Dimensions })));
    setMatrixMode("grouped");
    setGroupInput("");
    setCleanDefaultCartons(0);
    setMultiMaxWeight(0);
    setMultiCartonDimensions([0, 0, 0]);
  };

  const importWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer());
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
      const parsedRows: MultiSkuInput[] = rawRows.map((row, index) => {
        const parsed = importedSkuSchema.parse({
          sku: String(row.SKU ?? row.sku ?? "").trim(),
          totalQty: Number(row["数量"] ?? row.Quantity ?? row.totalQty),
          productWeight: Number(row["重量"] ?? row.Weight ?? row.productWeight ?? 0),
          productDimensions: [
            Number(row["长"] ?? row.Length ?? 0),
            Number(row["宽"] ?? row.Width ?? 0),
            Number(row["高"] ?? row.Height ?? 0),
          ],
        });
        return {
          id: `${createId()}-${index}`,
          sku: parsed.sku,
          totalQty: parsed.totalQty,
          cartonCount: Math.max(0, Math.floor(Number(row["箱数"] ?? row.Cartons ?? 0))),
          productWeight: parsed.productWeight,
          productDimensions: parsed.productDimensions,
        };
      });
      if (parsedRows.length === 0) throw new Error("文件中没有可导入的数据");
      setMultiRows(parsedRows);
      setImportMessage(`已导入 ${parsedRows.length} 个 SKU`);
    } catch (error) {
      setImportMessage(error instanceof Error ? `导入失败：${error.message}` : "导入失败");
    } finally {
      event.target.value = "";
    }
  };

  const useRecommendedQuantity = () => {
    setSingle((current) => ({ ...current, totalQty: recommendedQty }));
    setMode("average");
    setView("single");
  };

  return (
    <main className="main-content packing-main">
      <header className="topbar packing-topbar">
        <div>
          <div className="eyebrow">板块二 · FBA PACKING ASSISTANT</div>
          <h1>发货装箱助手</h1>
          <p>平均装箱、箱规校验、多 SKU 与 Shipment 数据生成</p>
        </div>
        <div className="packing-top-actions">
          <button className="rule-link" type="button" onClick={() => window.print()}><Printer size={15} /> 打印</button>
          <button className="rule-link" type="button" onClick={downloadImportTemplate}><FileDown size={15} /> 导入模板</button>
        </div>
      </header>

      <div className="packing-page">
        <div className="packing-tabs" role="tablist" aria-label="装箱视图">
          <button className={view === "single" ? "active" : ""} type="button" onClick={() => setView("single")}><Box size={16} /> 单 SKU 装箱</button>
          <button className={view === "multi" ? "active" : ""} type="button" onClick={() => setView("multi")}><Users size={16} /> 多 SKU / Shipment</button>
          <button className={view === "replenishment" ? "active" : ""} type="button" onClick={() => setView("replenishment")}><Sparkles size={16} /> 补货建议</button>
        </div>

        {view === "single" && (
          <div className="packing-workspace">
            <section className="packing-config-panel">
              <div className="panel-heading">
                <div><span>01</span><h2>装箱参数</h2></div>
                <button className="icon-button" type="button" onClick={() => setSingle(DEFAULT_SINGLE)} title="清空数据"><RotateCcw size={17} /></button>
              </div>

              <div className="packing-mode-control">
                <button className={mode === "average" ? "active" : ""} type="button" onClick={() => setMode("average")}>平均分箱</button>
                <button className={mode === "capacity" ? "active" : ""} type="button" onClick={() => setMode("capacity")}>指定每箱</button>
                <button className={mode === "auto" ? "active" : ""} type="button" onClick={() => setMode("auto")}>限制自动</button>
              </div>

              <div className="packing-form">
                <label className="field-label"><span>SKU</span><input value={single.sku} onChange={(event) => setSingle((current) => ({ ...current, sku: event.target.value }))} /></label>
                <label className="field-label"><span>总数量</span><input type="number" min="1" step="1" value={numberInputValue(single.totalQty)} onChange={(event) => setSingle((current) => ({ ...current, totalQty: integer(event.target.value) }))} /></label>
                {mode === "average" && <label className="field-label"><span>计划箱数</span><input type="number" min="1" step="1" value={numberInputValue(single.cartonCount)} onChange={(event) => setSingle((current) => ({ ...current, cartonCount: integer(event.target.value) }))} /></label>}
                {mode === "capacity" && <label className="field-label"><span>每箱数量</span><input type="number" min="1" step="1" value={numberInputValue(single.qtyPerCarton)} onChange={(event) => setSingle((current) => ({ ...current, qtyPerCarton: integer(event.target.value) }))} /></label>}
              </div>

              <div className="packing-limit-block">
                <label className="limit-toggle">
                  <input type="checkbox" checked={single.useWeightLimit} onChange={(event) => setSingle((current) => ({ ...current, useWeightLimit: event.target.checked }))} />
                  <span><Scale size={15} /><b>启用箱重限制</b><small>自动校验或限制每箱件数</small></span>
                </label>
                <div className="packing-form two">
                  <label className="field-label"><span>单件重量（kg）</span><input type="number" min="0" step="0.001" value={numberInputValue(single.productWeight)} onChange={(event) => setSingle((current) => ({ ...current, productWeight: numeric(event.target.value) }))} /></label>
                  <label className="field-label"><span>最大箱重（kg）</span><input disabled={!single.useWeightLimit} type="number" min="0" step="0.01" value={numberInputValue(single.maxCartonWeight)} onChange={(event) => setSingle((current) => ({ ...current, maxCartonWeight: numeric(event.target.value) }))} /></label>
                </div>
              </div>

              <div className="packing-limit-block">
                <label className="limit-toggle">
                  <input type="checkbox" checked={single.useDimensionLimit} onChange={(event) => setSingle((current) => ({ ...current, useDimensionLimit: event.target.checked }))} />
                  <span><PackagePlus size={15} /><b>启用箱规限制</b><small>自动尝试 6 种产品摆放方向</small></span>
                </label>
                <div>
                  <div className="dimension-input-row">
                    <span>产品尺寸（cm）</span>
                    {single.productDimensions.map((value, index) => <input key={`product-${index}`} aria-label={`产品${["长", "宽", "高"][index]}`} type="number" min="0" step="0.01" value={numberInputValue(value)} onChange={(event) => updateSingleDimension("productDimensions", index, event.target.value)} />)}
                  </div>
                  <div className="dimension-input-row">
                    <span>纸箱尺寸（cm）</span>
                    {single.cartonDimensions.map((value, index) => <input key={`carton-${index}`} aria-label={`纸箱${["长", "宽", "高"][index]}`} type="number" min="0" step="0.01" value={numberInputValue(value)} onChange={(event) => updateSingleDimension("cartonDimensions", index, event.target.value)} />)}
                  </div>
                </div>
              </div>
            </section>

            <section className="packing-results" aria-live="polite">
              <div className="packing-result-hero">
                <div>
                  <span>装箱结果</span>
                  <strong>{singleResult.cartons.length}<small> 箱</small></strong>
                  <p>{mode === "average" ? "按计划箱数平均分配" : mode === "capacity" ? `每箱最多 ${single.qtyPerCarton} 件` : `综合容量 ${enabledCapacity.effectiveCapacity} 件/箱`}</p>
                </div>
                <div className="packing-hero-stats">
                  <div><small>平均每箱</small><b>{singleResult.cartons.length ? format(single.totalQty / singleResult.cartons.length) : "0.00"} 件</b></div>
                  <div><small>总重量</small><b>{format(singleResult.cartons.reduce((sum, carton) => sum + carton.weight, 0))} kg</b></div>
                  <div><small>最大数量差</small><b>{maxQuantityDifference(singleResult.cartons)} 件</b></div>
                </div>
              </div>

              {(singleResult.error || singleResult.errors.length > 0) && (
                <div className="packing-alert error"><AlertTriangle size={18} /><div><b>需要调整装箱参数</b><span>{[singleResult.error, ...singleResult.errors].filter(Boolean).join("；")}</span></div></div>
              )}
              {!singleResult.error && singleResult.errors.length === 0 && singleResult.cartons.length > 0 && (
                <div className="packing-alert success"><Check size={18} /><div><b>校验通过</b><span>总数量一致，当前方案未发现空箱或超重。</span></div></div>
              )}

              {(single.useWeightLimit || single.useDimensionLimit) && (
                <div className="capacity-cards">
                  <div><small>重量容量</small><strong>{enabledCapacity.weightCapacity ?? "—"}<span> 件/箱</span></strong></div>
                  <div><small>尺寸容量</small><strong>{enabledCapacity.dimensionCapacity ?? "—"}<span> 件/箱</span></strong></div>
                  <div className="capacity-limit"><small>最终限制</small><strong>{enabledCapacity.effectiveCapacity || "—"}<span> 件/箱</span></strong><em>{LIMIT_LABELS[enabledCapacity.limitingFactor]}</em></div>
                </div>
              )}

              {single.useDimensionLimit && enabledCapacity.orientation && enabledCapacity.orientation.fits && (
                <div className="orientation-strip">
                  <div><small>最佳摆放方向</small><b>{enabledCapacity.orientation.productOrientation.join(" × ")} cm</b></div>
                  <div><small>长 / 宽 / 高方向</small><b>{enabledCapacity.orientation.counts.join(" × ")}</b></div>
                  <div><small>空间容量</small><b>{enabledCapacity.orientation.capacity} 件</b></div>
                </div>
              )}

              <div className="packing-table-wrap">
                <table className="packing-table">
                  <thead><tr><th>箱号</th><th>数量</th><th>重量</th><th>纸箱尺寸</th><th>校验</th></tr></thead>
                  <tbody>
                    {singleResult.cartons.map((carton) => {
                      const overweight = single.useWeightLimit && carton.weight > single.maxCartonWeight + Number.EPSILON;
                      const overCapacity = (single.useWeightLimit || single.useDimensionLimit) && enabledCapacity.effectiveCapacity > 0 && carton.quantity > enabledCapacity.effectiveCapacity;
                      return <tr key={carton.cartonNumber}>
                        <td><span className="carton-number">C{String(carton.cartonNumber).padStart(2, "0")}</span></td>
                        <td><b>{carton.quantity}</b> 件</td>
                        <td>{format(carton.weight)} kg</td>
                        <td>{single.cartonDimensions.join(" × ")} cm</td>
                        <td>{overweight || overCapacity ? <span className="row-status bad"><AlertTriangle size={13} /> 超限</span> : <span className="row-status good"><Check size={13} /> 通过</span>}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
                {singleResult.cartons.length === 0 && <div className="empty-table">请输入有效参数后生成装箱结果。</div>}
              </div>

              <div className="packing-actions">
                <button type="button" onClick={copySingle}><Copy size={15} />{copied ? "已复制" : "复制结果"}</button>
                <button type="button" onClick={() => downloadRows(singleShipmentRows, "Packing_List", "xlsx")} disabled={!singleShipmentRows.length}><FileSpreadsheet size={15} /> 导出 Excel</button>
                <button type="button" onClick={() => downloadRows(singleShipmentRows, "Packing_List", "csv")} disabled={!singleShipmentRows.length}><Download size={15} /> 导出 CSV</button>
              </div>
            </section>
          </div>
        )}

        {view === "multi" && (
          <div className="multi-workspace">
            <section className="multi-toolbar">
              <div><h2>多 SKU 分箱方案</h2><p>按箱组生成可复现的 SKU × 箱号矩阵，支持混装、完全同配和清装。</p></div>
              <div className="toolbar-actions">
                <input ref={fileInputRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={importWorkbook} />
                <button type="button" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> 导入 Excel</button>
                <button type="button" onClick={() => setMultiRows((rows) => [...rows, { id: createId(), sku: "", totalQty: 0, cartonCount: 0, productWeight: 0, productDimensions: [0, 0, 0] }])}><Plus size={15} /> 添加 SKU</button>
                <button type="button" onClick={clearMultiPacking}><RotateCcw size={15} /> 清空</button>
              </div>
            </section>
            {importMessage && <div className={`import-message ${importMessage.startsWith("导入失败") ? "error" : ""}`}><Info size={14} />{importMessage}</div>}

            <section className="matrix-mode-panel">
              <div className="matrix-mode-buttons">
                <button className={matrixMode === "grouped" ? "active" : ""} type="button" onClick={() => setMatrixMode("grouped")}><Users size={16} /><span><b>固定箱组混装</b><small>参考方案 1 / 2</small></span></button>
                <button className={matrixMode === "identical" ? "active" : ""} type="button" onClick={() => setMatrixMode("identical")}><Box size={16} /><span><b>完全同配混装</b><small>参考方案 4</small></span></button>
                <button className={matrixMode === "clean" ? "active" : ""} type="button" onClick={() => setMatrixMode("clean")}><PackagePlus size={16} /><span><b>清装</b><small>参考方案 3</small></span></button>
              </div>
              <div className="multi-settings">
                {matrixMode === "grouped" && <label className="group-input">箱组结构<input value={groupInput} placeholder="用逗号分隔" onChange={(event) => setGroupInput(event.target.value)} /><small>每个数字代表一种重复箱型的箱数</small></label>}
                {matrixMode === "identical" && <div className="matrix-auto-note"><Sparkles size={15} /><span>系统自动以全部 SKU 数量的最大公约数作为箱数。</span></div>}
                {matrixMode === "clean" && <label>默认每 SKU 箱数<input type="number" min="1" step="1" value={numberInputValue(cleanDefaultCartons)} onChange={(event) => setCleanDefaultCartons(integer(event.target.value))} /></label>}
                <label>最大箱重（kg）<input type="number" min="0" step="0.01" value={numberInputValue(multiMaxWeight)} onChange={(event) => setMultiMaxWeight(numeric(event.target.value))} /></label>
                <div className="multi-carton-size"><span>共用纸箱尺寸（cm）</span>{multiCartonDimensions.map((value, index) => <input key={index} aria-label={`多SKU纸箱${["长", "宽", "高"][index]}`} type="number" min="0" step="0.01" value={numberInputValue(value)} onChange={(event) => setMultiCartonDimensions((dimensions) => { const next = [...dimensions] as Dimensions; next[index] = numeric(event.target.value); return next; })} />)}</div>
              </div>
            </section>

            <section className="multi-table-section">
              <div className="packing-table-wrap">
                <table className="packing-table multi-table">
                  <thead><tr><th>SKU</th><th>备货量</th><th>清装箱数</th><th>单件重量 kg</th><th>产品尺寸 cm</th><th>分配摘要</th><th /></tr></thead>
                  <tbody>{multiRows.map((row, rowIndex) => <tr key={row.id}>
                      <td><input value={row.sku} onChange={(event) => updateMulti(row.id, { sku: event.target.value })} /></td>
                      <td><input type="number" min="1" step="1" value={numberInputValue(row.totalQty)} onChange={(event) => updateMulti(row.id, { totalQty: integer(event.target.value) })} /></td>
                      <td><input disabled={matrixMode !== "clean"} type="number" min="0" step="1" value={numberInputValue(row.cartonCount)} onChange={(event) => updateMulti(row.id, { cartonCount: integer(event.target.value) })} /></td>
                      <td><input type="number" min="0" step="0.001" value={numberInputValue(row.productWeight)} onChange={(event) => updateMulti(row.id, { productWeight: numeric(event.target.value) })} /></td>
                      <td><div className="mini-dimensions">{row.productDimensions.map((value, index) => <input key={index} aria-label={`${row.sku || "SKU"}产品${["长", "宽", "高"][index]}`} type="number" min="0" step="0.01" value={numberInputValue(value)} onChange={(event) => updateMultiDimension(row.id, index, event.target.value)} />)}</div></td>
                      <td><div className="packing-sequence"><b>{multiPlan.rows[rowIndex]?.packedQty ?? 0} / {row.totalQty} 件</b><span>{summarizeAllocation(multiPlan, rowIndex)}</span></div></td>
                      <td><button className="delete-row" type="button" title="删除 SKU" onClick={() => setMultiRows((rows) => rows.filter((item) => item.id !== row.id))}><Trash2 size={15} /></button></td>
                    </tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="packing-matrix-section">
              <div className="matrix-heading">
                <div><h2>装箱矩阵</h2><p>{multiPlan.modeLabel} · {multiPlan.totalCartons} 箱 · {multiPlan.totalUnits} 件</p></div>
                <div className="matrix-stats"><span><small>混装箱</small><b>{multiPlan.mixedCartonCount}</b></span><span><small>箱型配置</small><b>{multiPlan.distinctConfigurations}</b></span><span><small>箱组</small><b>{multiPlan.groups.length}</b></span></div>
                <div className="toolbar-actions"><button type="button" onClick={copyMatrix} disabled={multiPlan.errors.length > 0}><Copy size={15} /> {matrixCopied ? "已复制" : "复制矩阵"}</button><button type="button" onClick={() => downloadMatrixWorkbook(multiPlan, multiShipmentRows)} disabled={multiPlan.errors.length > 0}><FileSpreadsheet size={15} /> 导出矩阵</button></div>
              </div>
              {(multiPlan.errors.length > 0 || multiPlan.warnings.length > 0) && <div className={`matrix-message ${multiPlan.errors.length > 0 ? "error" : ""}`}><Info size={15} /><span>{[...multiPlan.errors, ...multiPlan.warnings].join("；")}</span></div>}
              <div className="packing-matrix-wrap">
                <table className="packing-matrix-table">
                  <thead>
                    <tr><th className="matrix-sku-column" rowSpan={2}>SKU</th><th className="matrix-qty-column" rowSpan={2}>备货量</th>{multiPlan.groups.map((group) => <th key={group.groupNumber} colSpan={group.cartonCount}>G{group.groupNumber} · {group.cartonCount} 箱</th>)}</tr>
                    <tr>{multiPlan.cartons.map((carton) => <th key={carton.cartonNumber}>{carton.cartonNumber}</th>)}</tr>
                  </thead>
                  <tbody>
                    {multiPlan.rows.map((row) => <tr key={row.id}><th className="matrix-sku-column">{row.sku}</th><td className="matrix-qty-column">{row.totalQty}</td>{row.allocations.map((quantity, index) => <td className={quantity > 0 ? `filled group-${multiPlan.cartons[index]?.groupNumber % 4}` : ""} key={`${row.id}-${index}`}>{quantity || ""}</td>)}</tr>)}
                    <tr className="matrix-total-row"><th className="matrix-sku-column">每箱总件数</th><td className="matrix-qty-column">{multiPlan.totalUnits}</td>{multiPlan.cartons.map((carton) => <td key={carton.cartonNumber}>{carton.totalQuantity}</td>)}</tr>
                    <tr className="matrix-weight-row"><th className="matrix-sku-column">每箱重量 kg</th><td className="matrix-qty-column">—</td>{multiPlan.cartons.map((carton) => <td className={multiMaxWeight > 0 && carton.totalWeight > multiMaxWeight ? "overweight" : ""} key={carton.cartonNumber}>{format(carton.totalWeight)}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="shipment-section">
              <div className="shipment-heading"><div><Ship size={19} /><span><h2>Amazon Shipment 数据</h2><p>{multiShipmentRows.length} 条 SKU-纸箱记录，由装箱矩阵直接生成。</p></span></div><div className="toolbar-actions"><button type="button" onClick={() => downloadRows(multiShipmentRows, "Packing_List", "xlsx")} disabled={!multiShipmentRows.length || multiPlan.errors.length > 0}><FileSpreadsheet size={15} /> Packing_List.xlsx</button><button type="button" onClick={() => downloadRows(multiShipmentRows, "Amazon_Shipment", "csv")} disabled={!multiShipmentRows.length || multiPlan.errors.length > 0}><Download size={15} /> Shipment.csv</button></div></div>
              <div className="shipment-preview"><table className="packing-table"><thead><tr><th>SKU</th><th>Carton Number</th><th>Quantity</th><th>Weight</th><th>Length</th><th>Width</th><th>Height</th></tr></thead><tbody>{multiShipmentRows.slice(0, 12).map((row, index) => <tr key={`${row.SKU}-${row["Carton Number"]}-${index}`}><td>{row.SKU}</td><td>{row["Carton Number"]}</td><td>{row.Quantity}</td><td>{format(row["Weight (kg)"])} kg</td><td>{row["Length (cm)"]}</td><td>{row["Width (cm)"]}</td><td>{row["Height (cm)"]}</td></tr>)}</tbody></table>{multiShipmentRows.length > 12 && <p>预览前 12 条，导出文件包含全部 {multiShipmentRows.length} 条。</p>}</div>
            </section>
          </div>
        )}

        {view === "replenishment" && (
          <div className="replenishment-workspace">
            <section className="replenishment-form">
              <div className="panel-heading"><div><span>01</span><h2>销量与时效</h2></div></div>
              <div className="replenishment-fields">
                <label className="field-label"><span>日销量</span><input type="number" min="0" step="0.01" value={numberInputValue(dailySales)} onChange={(event) => setDailySales(numeric(event.target.value))} /></label>
                <label className="field-label"><span>运输天数</span><input type="number" min="0" step="1" value={numberInputValue(transitDays)} onChange={(event) => setTransitDays(integer(event.target.value))} /></label>
                <label className="field-label"><span>安全库存天数</span><input type="number" min="0" step="1" value={numberInputValue(safetyDays)} onChange={(event) => setSafetyDays(integer(event.target.value))} /></label>
              </div>
              <div className="formula-box"><span>建议数量</span><b>{format(dailySales, 2)} × ({transitDays} + {safetyDays})</b></div>
            </section>
            <section className="recommendation-card">
              <ClipboardCheck size={32} />
              <span>建议发货数量</span>
              <strong>{recommendedQty}<small> 件</small></strong>
              <p>覆盖 {transitDays + safetyDays} 天需求，其中包含 {safetyDays} 天安全库存。</p>
              <button type="button" onClick={useRecommendedQuantity}><Box size={16} /> 一键平均装箱</button>
            </section>
            <section className="future-note"><Info size={17} /><div><b>V2 补货模型预留</b><span>后续可接入在途、FBA 可售库存、周转天数、多仓库存与销量趋势。</span></div></section>
          </div>
        )}
      </div>
    </main>
  );
}

export default PackingAssistant;
