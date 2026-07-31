import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Info,
  PackageCheck,
  Plane,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Scale,
  Search,
  Send,
  Ship,
  Trash2,
  Truck,
  WalletCards,
} from "lucide-react";
import {
  DESTINATION_CONFIG,
  TRANSPORT_MODE_CONFIG,
  calculateFirstMile,
  type AdditionalFeeItem,
  type DestinationCode,
  type FeeCategory,
  type FirstMileInput,
  type FirstMileResult,
  type TransportMode,
} from "./lib/firstMile";
import {
  US_WAREHOUSE_REGION_LABELS,
  filterAmazonWarehouses,
  findAmazonWarehouse,
  type AmazonWarehouse,
  type UsWarehouseRegion,
} from "./lib/amazonWarehouses";
import { numberInputValue } from "./lib/input";

export interface FirstMileTransfer {
  id: number;
  sourceSku: string;
  currency: string;
  logisticsCostPerUnit: number;
  importTaxPerUnit: number;
  totalLandedCostPerUnit: number;
}

interface FirstMileCalculatorProps {
  onTransferToProfit: (transfer: FirstMileTransfer) => void;
}

const FEE_CATEGORY_LABELS: Record<FeeCategory, string> = {
  origin: "起运地",
  carrier: "承运与文件",
  destination: "目的地",
  tax: "关税 / VAT",
  other: "其它",
};

const ORIGIN_COUNTRIES = ["中国", "越南", "印度", "泰国", "马来西亚", "印度尼西亚", "其他"];
const AMAZON_FULFILLMENT_INBOUND_API_URL = "https://developer-docs.amazon.com/sp-api/reference/fulfillment-inbound-v2024-03-20";

const DEFAULT_FEES: AdditionalFeeItem[] = [
  { id: "pickup", name: "提货费", category: "origin", amount: 0 },
  { id: "customs-declaration", name: "报关费", category: "origin", amount: 0 },
  { id: "inspection", name: "商检费", category: "origin", amount: 0 },
  { id: "document", name: "文件费", category: "carrier", amount: 0 },
  { id: "port", name: "港杂费", category: "carrier", amount: 0 },
  { id: "fuel", name: "燃油附加费", category: "carrier", amount: 0 },
  { id: "ams", name: "AMS / ENS 费用", category: "carrier", amount: 0 },
  { id: "clearance", name: "清关费", category: "destination", amount: 0 },
  { id: "duty", name: "关税", category: "tax", amount: 0 },
  { id: "vat", name: "VAT（欧洲）", category: "tax", amount: 0 },
  { id: "exam", name: "查验费", category: "destination", amount: 0 },
  { id: "destination", name: "目的港费用", category: "destination", amount: 0 },
  { id: "truck", name: "卡车派送费", category: "destination", amount: 0 },
  { id: "ups", name: "UPS 派送费", category: "destination", amount: 0 },
  { id: "appointment", name: "Amazon 预约费", category: "destination", amount: 0 },
  { id: "palletizing", name: "打托费", category: "destination", amount: 0 },
  { id: "pallet", name: "木托盘费", category: "destination", amount: 0 },
  { id: "storage", name: "仓租", category: "destination", amount: 0 },
  { id: "other", name: "其它费用", category: "other", amount: 0 },
];

function createDefaultInput(): FirstMileInput {
  const mode = TRANSPORT_MODE_CONFIG["sea-fast"];
  return {
    sku: "",
    asin: "",
    originCountry: "中国",
    destination: "US",
    amazonWarehouse: "",
    shipDate: "",
    estimatedArrivalDate: "",
    totalUnits: 0,
    unitWeightKg: 0,
    unitLengthCm: 0,
    unitWidthCm: 0,
    unitHeightCm: 0,
    unitsPerCarton: 0,
    cartonCount: 0,
    cartonLengthCm: 0,
    cartonWidthCm: 0,
    cartonHeightCm: 0,
    cartonGrossWeightKg: 0,
    transportMode: "sea-fast",
    ratePerKg: mode.defaultRatePerKg,
    ratePerCbm: mode.defaultRatePerCbm,
    minimumChargeable: mode.defaultMinimum,
    billingIncrement: mode.defaultIncrement,
    volumeWeightDivisor: mode.defaultDivisor,
    fees: DEFAULT_FEES.map((fee) => ({ ...fee })),
    salePrice: 0,
    exchangeRateCnyPerCurrency: 0,
  };
}

function numeric(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function money(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function number(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function percent(value: number): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "0.00%";
}

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function buildExportRows(input: FirstMileInput, result: FirstMileResult, warehouse?: AmazonWarehouse) {
  return [
    { 分区: "基础信息", 项目: "SKU", 数值: input.sku },
    { 分区: "基础信息", 项目: "ASIN", 数值: input.asin },
    { 分区: "基础信息", 项目: "路线", 数值: `${input.originCountry} → ${DESTINATION_CONFIG[input.destination].label}` },
    { 分区: "基础信息", 项目: "Amazon 仓库", 数值: warehouse ? `${warehouse.code} · ${warehouse.city}, ${warehouse.state}` : input.amazonWarehouse },
    { 分区: "基础信息", 项目: "美国仓库区域", 数值: warehouse ? US_WAREHOUSE_REGION_LABELS[warehouse.region] : "未匹配" },
    { 分区: "基础信息", 项目: "官方数据口径", 数值: "实际目的仓以 Amazon 入库计划返回的 Ship-to 地址为准" },
    { 分区: "货物", 项目: "总件数", 数值: input.totalUnits },
    { 分区: "货物", 项目: "箱数", 数值: input.cartonCount },
    { 分区: "货物", 项目: "总毛重（KG）", 数值: number(result.grossWeightKg) },
    { 分区: "货物", 项目: "总体积（CBM）", 数值: number(result.totalVolumeCbm, 4) },
    { 分区: "计费", 项目: "运输方式", 数值: TRANSPORT_MODE_CONFIG[input.transportMode].label },
    { 分区: "计费", 项目: "计费方式", 数值: result.chargeBasis === "weight" ? "按重量" : "按体积" },
    { 分区: "计费", 项目: "生效依据", 数值: result.chargeBasis === "weight" ? (result.weightChargeSource === "dimensional" ? "体积重量" : "实际毛重") : "总体积" },
    { 分区: "计费", 项目: "每公斤报价（CNY/KG）", 数值: money(input.ratePerKg) },
    { 分区: "计费", 项目: "每立方报价（CNY/CBM）", 数值: money(input.ratePerCbm) },
    { 分区: "计费", 项目: `本次采用单价（CNY/${result.chargeUnitLabel}）`, 数值: money(result.appliedRate) },
    { 分区: "计费", 项目: `计费量（${result.chargeUnitLabel}）`, 数值: number(result.billedQuantity) },
    { 分区: "计费", 项目: "运输费用（CNY）", 数值: money(result.freightCost) },
    ...input.fees.filter((fee) => fee.amount > 0).map((fee) => ({ 分区: FEE_CATEGORY_LABELS[fee.category], 项目: fee.name, 数值: money(fee.amount) })),
    { 分区: "成本", 项目: "不含进口税物流成本（CNY）", 数值: money(result.logisticsCostBeforeImportTaxes) },
    { 分区: "成本", 项目: "关税/VAT（CNY）", 数值: money(result.importTaxes) },
    { 分区: "成本", 项目: "头程总费用（CNY）", 数值: money(result.totalFirstMileCost) },
    { 分区: "成本", 项目: "单件不含税头程（CNY）", 数值: money(result.unitLogisticsCostBeforeImportTaxes) },
    { 分区: "成本", 项目: "单件关税/VAT（CNY）", 数值: money(result.unitImportTax) },
    { 分区: "成本", 项目: "单件落地头程（CNY）", 数值: money(result.unitFirstMileCostCny) },
    { 分区: "销售", 项目: "头程占售价", 数值: percent(result.firstMileShareOfSalePrice) },
  ];
}

async function exportWorkbook(input: FirstMileInput, result: FirstMileResult, warehouse?: AmazonWarehouse): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildExportRows(input, result, warehouse)), "头程成本汇总");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(input.fees.map((fee) => ({
    费用项目: fee.name,
    费用分类: FEE_CATEGORY_LABELS[fee.category],
    金额_CNY: fee.amount,
  }))), "附加费用明细");
  XLSX.writeFile(workbook, "First_Mile_Cost.xlsx");
}

function FirstMileCalculator({ onTransferToProfit }: FirstMileCalculatorProps) {
  const [input, setInput] = useState<FirstMileInput>(() => createDefaultInput());
  const [copied, setCopied] = useState(false);
  const [transferred, setTransferred] = useState(false);
  const [warehouseQuery, setWarehouseQuery] = useState("");
  const [warehouseMenuOpen, setWarehouseMenuOpen] = useState(false);
  const [warehouseRegionFilter, setWarehouseRegionFilter] = useState<"all" | UsWarehouseRegion>("all");
  const result = useMemo(() => calculateFirstMile(input), [input]);
  const destination = DESTINATION_CONFIG[input.destination];
  const mode = TRANSPORT_MODE_CONFIG[input.transportMode];
  const selectedWarehouse = useMemo(() => findAmazonWarehouse(input.amazonWarehouse), [input.amazonWarehouse]);
  const warehouseOptions = useMemo(() => filterAmazonWarehouses(warehouseQuery, 30).filter((warehouse) => warehouseRegionFilter === "all" || warehouse.region === warehouseRegionFilter).slice(0, 12), [warehouseQuery, warehouseRegionFilter]);

  const update = <K extends keyof FirstMileInput>(key: K, value: FirstMileInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const updateNumber = (key: keyof FirstMileInput, value: string) => update(key, numeric(value) as never);

  const updateTransportMode = (transportMode: TransportMode) => {
    const config = TRANSPORT_MODE_CONFIG[transportMode];
    setInput((current) => ({
      ...current,
      transportMode,
      ratePerKg: config.defaultRatePerKg,
      ratePerCbm: config.defaultRatePerCbm,
      minimumChargeable: config.defaultMinimum,
      billingIncrement: config.defaultIncrement,
      volumeWeightDivisor: config.defaultDivisor,
    }));
  };

  const updateDestination = (destinationCode: DestinationCode) => {
    setInput((current) => ({
      ...current,
      destination: destinationCode,
      exchangeRateCnyPerCurrency: 0,
      amazonWarehouse: destinationCode === "US" ? current.amazonWarehouse : "",
    }));
    if (destinationCode === "US") {
      setWarehouseQuery("");
    } else {
      setWarehouseQuery("");
      setWarehouseMenuOpen(false);
    }
  };

  const selectWarehouse = (warehouse: AmazonWarehouse) => {
    update("amazonWarehouse", warehouse.code);
    setWarehouseQuery(warehouse.code);
    setWarehouseMenuOpen(false);
  };

  const updateWarehouseQuery = (value: string) => {
    setWarehouseQuery(value);
    update("amazonWarehouse", value.trim().split(/\s|·/)[0].toUpperCase());
    setWarehouseMenuOpen(true);
  };

  const updateFee = (id: string, updateValue: Partial<AdditionalFeeItem>) => {
    setInput((current) => ({ ...current, fees: current.fees.map((fee) => fee.id === id ? { ...fee, ...updateValue } : fee) }));
  };

  const addFee = () => {
    const id = `fee-${Date.now()}`;
    setInput((current) => ({ ...current, fees: [...current.fees, { id, name: "自定义费用", category: "other", amount: 0 }] }));
  };

  const removeFee = (id: string) => setInput((current) => ({ ...current, fees: current.fees.filter((fee) => fee.id !== id) }));

  const copyResult = async () => {
    await writeClipboard([
      "【亚马逊头程费用测算】",
      `SKU：${input.sku || "未填写"}`,
      `路线：${input.originCountry} → ${destination.label}`,
      `Amazon 仓库：${selectedWarehouse ? `${selectedWarehouse.code} · ${selectedWarehouse.city}, ${selectedWarehouse.state} · ${US_WAREHOUSE_REGION_LABELS[selectedWarehouse.region]}` : input.amazonWarehouse || "未填写"}`,
      `运输方式：${mode.label}`,
      `总件数：${input.totalUnits} 件 / ${input.cartonCount} 箱`,
      `总毛重：${money(result.grossWeightKg)} kg`,
      `总体积：${number(result.totalVolumeCbm, 4)} CBM`,
      `计费方式：${result.chargeBasis === "weight" ? `按重量（${result.weightChargeSource === "dimensional" ? "体积重量生效" : "实际毛重生效"}）` : "按体积"}`,
      `采用单价：¥${money(result.appliedRate)} / ${result.chargeUnitLabel}`,
      `计费量：${money(result.billedQuantity)} ${result.chargeUnitLabel}`,
      `运输费用：¥${money(result.freightCost)}`,
      `附加费用：¥${money(result.additionalFeesTotal)}`,
      `头程总费用：¥${money(result.totalFirstMileCost)}`,
      `单件不含税头程：¥${money(result.unitLogisticsCostBeforeImportTaxes)}`,
      `单件关税/VAT：¥${money(result.unitImportTax)}`,
      `单件落地头程：¥${money(result.unitFirstMileCostCny)}`,
    ].join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const transferToProfit = () => {
    onTransferToProfit({
      id: Date.now(),
      sourceSku: input.sku,
      currency: destination.currency,
      logisticsCostPerUnit: result.unitLogisticsCostBeforeImportTaxes / Math.max(1e-9, input.exchangeRateCnyPerCurrency),
      importTaxPerUnit: result.unitImportTax / Math.max(1e-9, input.exchangeRateCnyPerCurrency),
      totalLandedCostPerUnit: result.unitFirstMileCostSalesCurrency,
    });
    setTransferred(true);
    window.setTimeout(() => setTransferred(false), 1800);
  };

  const field = (label: string, key: keyof FirstMileInput, suffix?: string, step = 0.01) => (
    <label className="fm-field"><span>{label}</span><div><input type="number" min="0" step={step} value={numberInputValue(input[key] as number)} onChange={(event) => updateNumber(key, event.target.value)} />{suffix && <em>{suffix}</em>}</div></label>
  );

  return (
    <main className="main-content fm-main">
      <header className="topbar fm-topbar">
        <div><div className="eyebrow">板块五 · FIRST MILE COST ENGINE</div><h1>亚马逊头程费用计算器</h1><p>海运、空运、快递与欧洲陆运的整票及单件落地成本</p></div>
        <div className="fm-top-actions"><button className="rule-link" type="button" onClick={() => window.print()}><Printer size={15} /> 打印</button><button className="rule-link" type="button" onClick={() => exportWorkbook(input, result, selectedWarehouse)}><FileSpreadsheet size={15} /> 导出 Excel</button></div>
      </header>

      <div className="fm-page">
        <section className="fm-hero">
          <div><span>单件落地头程成本</span><strong><sup>¥</sup>{money(result.unitFirstMileCostCny)}</strong><p>{input.sku || "未填写 SKU"} · {input.originCountry} → {destination.label} · {selectedWarehouse ? `${selectedWarehouse.code} ${US_WAREHOUSE_REGION_LABELS[selectedWarehouse.region]}` : mode.label}</p></div>
          <div className="fm-hero-grid"><div><small>头程总费用</small><b>¥{money(result.totalFirstMileCost)}</b></div><div><small>不含税物流/件</small><b>¥{money(result.unitLogisticsCostBeforeImportTaxes)}</b></div><div><small>关税 VAT/件</small><b>¥{money(result.unitImportTax)}</b></div><div><small>头程占售价</small><b>{percent(result.firstMileShareOfSalePrice)}</b></div></div>
          <div className="fm-hero-actions"><button type="button" title="清空数据" onClick={() => { setInput(createDefaultInput()); setWarehouseQuery(""); setWarehouseRegionFilter("all"); }}><RotateCcw size={15} /></button><button type="button" onClick={copyResult}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制"}</button><button type="button" onClick={() => exportWorkbook(input, result, selectedWarehouse)}><Download size={15} /> Excel</button></div>
        </section>

        <div className="fm-workspace">
          <section className="fm-input-panel">
            <div className="fm-section-heading"><PackageCheck size={18} /><div><h2>基础与货物信息</h2><p>路线、SKU、箱数、重量和箱规</p></div></div>
            <div className="fm-form-grid">
              <label className="fm-field"><span>SKU / 产品名称</span><input value={input.sku} onChange={(event) => update("sku", event.target.value)} /></label>
              <label className="fm-field"><span>ASIN（可选）</span><input value={input.asin} onChange={(event) => update("asin", event.target.value)} /></label>
              <label className="fm-field"><span>发货国家</span><select value={input.originCountry} onChange={(event) => update("originCountry", event.target.value)}>{ORIGIN_COUNTRIES.map((country) => <option key={country}>{country}</option>)}</select></label>
              <label className="fm-field"><span>目的国家</span><select value={input.destination} onChange={(event) => updateDestination(event.target.value as DestinationCode)}>{Object.entries(DESTINATION_CONFIG).map(([code, config]) => <option key={code} value={code}>{config.label}</option>)}</select></label>
              <div className="fm-field fm-warehouse-field"><span>Amazon 美国仓库</span><div className="fm-warehouse-search"><Search size={14} /><input disabled={input.destination !== "US"} value={warehouseQuery} placeholder={input.destination === "US" ? "输入代码、城市或州筛选" : "仅支持美国站仓库筛选"} onFocus={() => setWarehouseMenuOpen(input.destination === "US")} onBlur={() => setWarehouseMenuOpen(false)} onChange={(event) => updateWarehouseQuery(event.target.value)} /><select aria-label="仓库区域筛选" disabled={input.destination !== "US"} value={warehouseRegionFilter} onChange={(event) => { setWarehouseRegionFilter(event.target.value as "all" | UsWarehouseRegion); setWarehouseQuery(""); update("amazonWarehouse", ""); setWarehouseMenuOpen(true); }}><option value="all">全部</option><option value="west">美西</option><option value="east">美东</option></select></div>{input.destination === "US" && warehouseMenuOpen && <div className="fm-warehouse-menu">{warehouseOptions.length > 0 ? warehouseOptions.map((warehouse) => <button key={warehouse.code} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectWarehouse(warehouse)}><b>{warehouse.code}</b><span>{warehouse.city}, {warehouse.state}</span><em>{US_WAREHOUSE_REGION_LABELS[warehouse.region]}</em></button>) : <p>未找到匹配仓库，可保留手动代码。</p>}</div>}{selectedWarehouse ? <small className={`fm-region-badge ${selectedWarehouse.region}`}>{selectedWarehouse.city}, {selectedWarehouse.state} · {US_WAREHOUSE_REGION_LABELS[selectedWarehouse.region]}</small> : input.destination === "US" && input.amazonWarehouse ? <small className="fm-region-badge unknown">未在常用仓库索引中匹配，请以入库计划 Ship-to 地址为准</small> : null}</div>
              <label className="fm-field"><span>发货日期</span><input type="date" value={input.shipDate} onChange={(event) => update("shipDate", event.target.value)} /></label>
              <label className="fm-field"><span>预计到仓日期</span><input type="date" value={input.estimatedArrivalDate} onChange={(event) => update("estimatedArrivalDate", event.target.value)} /></label>
              {field("总件数", "totalUnits", "PCS", 1)}
            </div>
            <div className="fm-warehouse-source"><Info size={14} /><span>常用仓库索引用于快速筛选，美中线路按二分区口径归入美东；实时目的仓以 Amazon 入库计划返回的 Ship-to 地址为准。<a href={AMAZON_FULFILLMENT_INBOUND_API_URL} target="_blank" rel="noreferrer">Amazon Fulfillment Inbound API <ExternalLink size={11} /></a></span></div>

            <div className="fm-subsection"><div className="fm-subtitle"><Boxes size={15} />产品参数</div><div className="fm-form-grid three">{field("单件重量", "unitWeightKg", "KG")}{field("单件长", "unitLengthCm", "CM")}{field("单件宽", "unitWidthCm", "CM")}{field("单件高", "unitHeightCm", "CM")}</div></div>
            <div className="fm-subsection"><div className="fm-subtitle"><Scale size={15} />外箱参数</div><div className="fm-form-grid three">{field("单箱装箱数", "unitsPerCarton", "PCS", 1)}{field("箱数", "cartonCount", "箱", 1)}{field("单箱毛重", "cartonGrossWeightKg", "KG")}{field("外箱长", "cartonLengthCm", "CM")}{field("外箱宽", "cartonWidthCm", "CM")}{field("外箱高", "cartonHeightCm", "CM")}</div></div>
          </section>

          <section className="fm-results-column">
            <article className="fm-card">
              <div className="fm-section-heading"><Ship size={18} /><div><h2>运输方式与报价</h2><p>最低计费量和进位规则按承运商报价调整</p></div></div>
              <div className="fm-mode-grid">{Object.entries(TRANSPORT_MODE_CONFIG).map(([value, config]) => <button key={value} className={input.transportMode === value ? "active" : ""} type="button" onClick={() => updateTransportMode(value as TransportMode)}>{config.basis === "weight" ? <Plane size={16} /> : value === "truck-eu" ? <Truck size={16} /> : <Ship size={16} />}<span>{config.label}</span></button>)}</div>
              <div className="fm-form-grid quote">{field("每公斤报价", "ratePerKg", "元/KG")}{field("每立方报价", "ratePerCbm", "元/CBM")}{field(`最低计费量（${mode.unitLabel}）`, "minimumChargeable", mode.unitLabel)}{field(`计费进位（${mode.unitLabel}）`, "billingIncrement", mode.unitLabel)}{mode.basis === "weight" && field("体积重除数", "volumeWeightDivisor", "cm³/kg", 1)}</div>
              <div className="fm-metric-strip five"><div><small>实际毛重</small><strong>{money(result.grossWeightKg)} kg</strong></div><div><small>体积重量</small><strong>{money(result.dimensionalWeightKg)} kg</strong></div><div><small>总体积</small><strong>{number(result.totalVolumeCbm, 4)} CBM</strong></div><div><small>计费依据</small><strong>{mode.basis === "weight" ? (result.weightChargeSource === "dimensional" ? "体积重量" : "实际毛重") : "货物体积"}</strong></div><div><small>最终计费量</small><strong>{money(result.billedQuantity)} {result.chargeUnitLabel}</strong></div></div>
              <div className="fm-formula"><Info size={14} /><span>{mode.basis === "weight" ? `按重量：max(${money(result.grossWeightKg)} kg 实际重, ${money(result.dimensionalWeightKg)} kg 体积重) = ${money(result.rawChargeableWeightKg)} kg，进位后 ${money(result.billedQuantity)} kg × ¥${money(result.appliedRate)}/kg = ¥${money(result.freightCost)}。` : `按体积：max(${number(result.totalVolumeCbm, 4)} CBM, ${input.minimumChargeable} CBM 最低量)，进位后 ${money(result.billedQuantity)} CBM × ¥${money(result.appliedRate)}/CBM = ¥${money(result.freightCost)}。`}{(input.transportMode === "agl-air" || input.transportMode === "agl-sea") && <b> AGL 请以 Seller Central 当前线路报价为准。</b>}</span></div>
            </article>

            <article className="fm-card fee-card">
              <div className="fm-section-heading"><ReceiptText size={18} /><div><h2>附加费用</h2><p>自由增删，关税/VAT 单独归类以供利润联动</p></div><button className="fm-add-button" type="button" onClick={addFee}><Plus size={14} /> 新增</button></div>
              <div className="fm-fee-table"><div className="fm-fee-head"><span>费用项目</span><span>分类</span><span>金额（CNY）</span><span /></div>{input.fees.map((fee) => <div className="fm-fee-row" key={fee.id}><input value={fee.name} onChange={(event) => updateFee(fee.id, { name: event.target.value })} /><select value={fee.category} onChange={(event) => updateFee(fee.id, { category: event.target.value as FeeCategory })}>{Object.entries(FEE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="number" min="0" step="0.01" value={numberInputValue(fee.amount)} onChange={(event) => updateFee(fee.id, { amount: numeric(event.target.value) })} /><button type="button" title="删除费用" onClick={() => removeFee(fee.id)}><Trash2 size={14} /></button></div>)}</div>
              <div className="fm-fee-summary"><div><span>起运地</span><b>¥{money(result.originFees)}</b></div><div><span>承运文件</span><b>¥{money(result.carrierFees)}</b></div><div><span>目的地</span><b>¥{money(result.destinationFees)}</b></div><div><span>关税/VAT</span><b>¥{money(result.importTaxes)}</b></div><div><span>其它</span><b>¥{money(result.otherFees)}</b></div></div>
            </article>

            <article className="fm-card sales-analysis-card">
              <div className="fm-section-heading"><WalletCards size={18} /><div><h2>销售价格分析</h2><p>销售价使用目的站币种，用于计算头程成本占比</p></div></div>
              <div className="fm-form-grid quote sales">{field(`销售价（${destination.currency}）`, "salePrice", destination.symbol)}{field(`汇率（CNY/${destination.currency}）`, "exchangeRateCnyPerCurrency", "CNY")}</div>
            </article>

            <article className="fm-card fm-cost-summary">
              <div className="fm-section-heading"><WalletCards size={18} /><div><h2>最终成本汇总</h2><p>整票、单件及利润系统回填口径</p></div></div>
              <div className="fm-cost-grid"><div><span>运输费用</span><b>¥{money(result.freightCost)}</b></div><div><span>非税附加费用</span><b>¥{money(result.nonTaxAdditionalFees)}</b></div><div><span>关税 / VAT</span><b>¥{money(result.importTaxes)}</b></div><div className="total"><span>头程总费用</span><b>¥{money(result.totalFirstMileCost)}</b></div><div><span>单件不含税物流</span><b>¥{money(result.unitLogisticsCostBeforeImportTaxes)}</b></div><div><span>单件关税 VAT</span><b>¥{money(result.unitImportTax)}</b></div><div className="total"><span>单件落地头程</span><b>¥{money(result.unitFirstMileCostCny)}</b></div><div><span>运输天数</span><b>{result.transitDays === null ? "—" : `${result.transitDays} 天`}</b></div><div><span>装箱空间利用率</span><b>{percent(result.cartonSpaceUtilization)}</b></div><div><span>头程占售价</span><b>{percent(result.firstMileShareOfSalePrice)}</b></div></div>
              <div className="fm-profit-link"><div><ClipboardCheck size={18} /><span><b>利润系统联动</b><small>回填 {destination.currency}：非税头程 {destination.symbol}{money(result.unitLogisticsCostBeforeImportTaxes / Math.max(input.exchangeRateCnyPerCurrency, 1e-9))} + 关税/VAT {destination.symbol}{money(result.unitImportTax / Math.max(input.exchangeRateCnyPerCurrency, 1e-9))}</small></span></div><button type="button" onClick={transferToProfit}>{transferred ? <Check size={15} /> : <Send size={15} />}{transferred ? "已写入利润测算" : "写入利润测算器"}</button></div>
            </article>

            <div className="warning-list fm-warnings">{result.warnings.map((warning) => <p key={warning}><AlertTriangle size={14} />{warning}</p>)}</div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default FirstMileCalculator;
