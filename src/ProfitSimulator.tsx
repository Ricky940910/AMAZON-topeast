import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Gauge,
  Info,
  Megaphone,
  Package,
  Percent,
  Printer,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import {
  AMAZON_DEAL_PROMOTION_GUIDANCE_URL,
  calculateProfit,
  calculateScenarios,
  DEAL_TYPE_LABELS,
  getStackedPromotionsHelpUrl,
  MARKETPLACE_CONFIG,
  SELLER_PROMOTION_TYPE_LABELS,
  type CurrencyCode,
  type DealType,
  type PromotionStackingSetting,
  type ProductLifecycle,
  type ProfitGrade,
  type ProfitInput,
  type SalesSite,
  type SellerPromotionType,
} from "./lib/profit";
import type { FirstMileTransfer } from "./FirstMileCalculator";
import { numberInputValue } from "./lib/input";

type ProfitTab = "product" | "cost" | "ads" | "promotion" | "simulation" | "dashboard";

interface ProfitSimulatorProps {
  firstMileTransfer?: FirstMileTransfer | null;
  onFirstMileTransferApplied?: () => void;
}

const DEFAULT_INPUT: ProfitInput = {
  productName: "",
  asinSku: "",
  category: MARKETPLACE_CONFIG.US.categories[0],
  salesSite: "US",
  currency: "USD",
  lifecycle: "new",
  listingPrice: 0,
  targetMonthlyOrders: 0,
  monthlyGrowthRate: 0,
  couponRate: 0,
  couponOrderShare: 0,
  dealRate: 0,
  dealOrderShare: 0,
  dealType: "lightning-deal",
  sellerPromotionEnabled: false,
  sellerPromotionType: "percentage-off",
  sellerPromotionRate: 0,
  sellerPromotionOrderShare: 0,
  sellerPromotionBuyQuantity: 0,
  sellerPromotionFreeQuantity: 0,
  couponPromotionStacking: "prevent",
  adOrderShare: 0,
  adSalesShare: 0,
  acos: 0,
  targetTacos: 0,
  cpc: 0,
  adBudget: 0,
  purchaseCost: 0,
  packagingCost: 0,
  accessoryCost: 0,
  domesticShippingCost: 0,
  otherProductCost: 0,
  firstMileCost: 0,
  lastMileCost: 0,
  customsDuty: 0,
  referralFee: 0,
  fbaFee: 0,
  storageFee: 0,
  otherAmazonFee: 0,
  returnRate: 0,
  unsellableRate: 0,
  returnProcessingCost: 0,
};

const GRADE_LABELS: Record<ProfitGrade, string> = {
  S: "S 级",
  A: "A 级",
  B: "B 级",
  watch: "观察级",
  eliminate: "淘汰",
};

const SITE_LABELS: Record<SalesSite, string> = {
  US: "美国站",
  CA: "加拿大站",
  UK: "英国站",
  DE: "德国站",
  JP: "日本站",
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  CAD: "C$",
  GBP: "£",
  EUR: "€",
  JPY: "¥",
};

function positive(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function money(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function number(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function percent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
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

function buildSummaryRows(input: ProfitInput, result: ReturnType<typeof calculateProfit>) {
  return [
    { 分区: "产品", 指标: "产品名称", 数值: input.productName },
    { 分区: "产品", 指标: "ASIN/SKU", 数值: input.asinSku },
    { 分区: "产品", 指标: "站点", 数值: SITE_LABELS[input.salesSite] },
    { 分区: "产品", 指标: "币种", 数值: input.currency },
    { 分区: "产品", 指标: "Amazon 顶级类目", 数值: input.category },
    { 分区: "销售", 指标: "Listing 售价", 数值: money(input.listingPrice) },
    { 分区: "销售", 指标: "月订单数量", 数值: result.monthlyOrders },
    { 分区: "销售", 指标: "实际成交均价", 数值: money(result.averageSellingPrice) },
    { 分区: "销售", 指标: "月销售额", 数值: money(result.netSalesRevenue) },
    { 分区: "促销", 指标: "Deal 类型", 数值: DEAL_TYPE_LABELS[input.dealType] },
    { 分区: "促销", 指标: "Coupon + Deal", 数值: "Amazon 自动叠加" },
    { 分区: "促销", 指标: "Coupon + Deal 叠加订单", 数值: number(result.couponDealStackedOrders) },
    { 分区: "促销", 指标: "Seller Central Promotion", 数值: input.sellerPromotionEnabled ? SELLER_PROMOTION_TYPE_LABELS[input.sellerPromotionType] : "未启用" },
    { 分区: "促销", 指标: "Coupon + Promotion 设置", 数值: input.sellerPromotionEnabled ? input.couponPromotionStacking === "allow" ? "允许叠加" : "不允许叠加，取较高折扣" : "不适用" },
    { 分区: "成本", 指标: "单件产品成本", 数值: money(result.productCostPerUnit) },
    { 分区: "成本", 指标: "单件物流及进口税", 数值: money(result.logisticsCostPerUnit) },
    { 分区: "成本", 指标: "单件 Amazon 费用", 数值: money(result.amazonFeePerUnit) },
    { 分区: "成本", 指标: "单件退货损耗", 数值: money(result.returnLossPerUnit) },
    { 分区: "广告", 指标: "广告订单", 数值: number(result.adOrders) },
    { 分区: "广告", 指标: "广告销售额", 数值: money(result.adSalesRevenue) },
    { 分区: "广告", 指标: "广告花费", 数值: money(result.adSpend) },
    { 分区: "广告", 指标: "ACOS", 数值: percent(result.actualAcos) },
    { 分区: "广告", 指标: "TACOS", 数值: percent(result.actualTacos) },
    { 分区: "利润", 指标: "单件净利润", 数值: money(result.unitProfit) },
    { 分区: "利润", 指标: "利润率", 数值: percent(result.profitMargin) },
    { 分区: "利润", 指标: "毛利率", 数值: percent(result.grossMargin) },
    { 分区: "利润", 指标: "月利润", 数值: money(result.netProfit) },
    { 分区: "安全线", 指标: "盈亏平衡售价", 数值: money(result.breakEvenPrice) },
    { 分区: "安全线", 指标: "盈亏平衡 ACOS", 数值: percent(result.breakEvenAcos) },
    { 分区: "安全线", 指标: "最大可接受广告花费", 数值: money(result.maxAffordableAdSpend) },
    { 分区: "决策", 指标: "SKU 等级", 数值: result.gradeTitle },
    { 分区: "决策", 指标: "运营建议", 数值: result.recommendation },
  ];
}

async function exportProfitWorkbook(input: ProfitInput): Promise<void> {
  const XLSX = await import("xlsx");
  const result = calculateProfit(input);
  const scenarios = calculateScenarios(input);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildSummaryRows(input, result)), "利润汇总");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scenarios.map((scenario) => ({
    情景: scenario.label,
    月订单: scenario.result.monthlyOrders,
    成交均价: money(scenario.result.averageSellingPrice),
    销售额: money(scenario.result.netSalesRevenue),
    广告花费: money(scenario.result.adSpend),
    单件利润: money(scenario.result.unitProfit),
    利润率: percent(scenario.result.profitMargin),
    月利润: money(scenario.result.netProfit),
    SKU等级: scenario.result.gradeTitle,
  }))), "情景模拟");
  XLSX.writeFile(workbook, "Amazon_Profit_Simulator.xlsx");
}

async function exportProfitCsv(input: ProfitInput): Promise<void> {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(buildSummaryRows(input, calculateProfit(input)));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Profit");
  XLSX.writeFile(workbook, "Amazon_Profit_Simulator.csv", { bookType: "csv" });
}

function ProfitSimulator({ firstMileTransfer, onFirstMileTransferApplied }: ProfitSimulatorProps) {
  const [tab, setTab] = useState<ProfitTab>("dashboard");
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => calculateProfit(input), [input]);
  const scenarios = useMemo(() => calculateScenarios(input), [input]);
  const maxScenarioProfit = Math.max(1, ...scenarios.map((scenario) => Math.abs(scenario.result.netProfit)));
  const marketplace = MARKETPLACE_CONFIG[input.salesSite];
  const currencySymbol = CURRENCY_SYMBOLS[input.currency];
  const stackedPromotionsHelpUrl = getStackedPromotionsHelpUrl(input.salesSite);

  const formattedMoney = (value: number) => `${currencySymbol}${money(value)}`;

  const update = <K extends keyof ProfitInput>(key: K, value: ProfitInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const updatePercent = (key: keyof ProfitInput, value: string) => {
    update(key, Math.min(1, positive(value) / 100) as never);
  };

  const updateSalesSite = (salesSite: SalesSite) => {
    const nextMarketplace = MARKETPLACE_CONFIG[salesSite];
    setInput((current) => ({
      ...current,
      salesSite,
      currency: nextMarketplace.currency,
      category: nextMarketplace.categories.includes(current.category) ? current.category : nextMarketplace.categories[0],
    }));
  };

  useEffect(() => {
    if (!firstMileTransfer) return;
    const matchingSite = Object.entries(MARKETPLACE_CONFIG).find(([, config]) => config.currency === firstMileTransfer.currency)?.[0] as SalesSite | undefined;
    setInput((current) => ({
      ...current,
      ...(matchingSite ? {
        salesSite: matchingSite,
        currency: MARKETPLACE_CONFIG[matchingSite].currency,
        category: MARKETPLACE_CONFIG[matchingSite].categories.includes(current.category) ? current.category : MARKETPLACE_CONFIG[matchingSite].categories[0],
      } : {}),
      asinSku: firstMileTransfer.sourceSku || current.asinSku,
      firstMileCost: firstMileTransfer.logisticsCostPerUnit,
      customsDuty: firstMileTransfer.importTaxPerUnit,
    }));
    onFirstMileTransferApplied?.();
  }, [firstMileTransfer, onFirstMileTransferApplied]);

  const copySummary = async () => {
    await writeClipboard([
      "【亚马逊利润测算】",
      `产品：${input.productName}`,
      `ASIN/SKU：${input.asinSku}`,
      `销售币种：${input.currency}`,
      `月销售额：${formattedMoney(result.netSalesRevenue)}`,
      `月订单：${result.monthlyOrders}`,
      `单件净利润：${formattedMoney(result.unitProfit)}`,
      `利润率：${percent(result.profitMargin)}`,
      `月利润：${formattedMoney(result.netProfit)}`,
      `广告花费：${formattedMoney(result.adSpend)}`,
      `ACOS：${percent(result.actualAcos)}`,
      `TACOS：${percent(result.actualTacos)}`,
      `盈亏平衡售价：${formattedMoney(result.breakEvenPrice)}`,
      `盈亏平衡 ACOS：${percent(result.breakEvenAcos)}`,
      `SKU 等级：${result.gradeTitle}`,
      `建议：${result.recommendation}`,
    ].join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const numberField = (label: string, key: keyof ProfitInput, options?: { prefix?: string; suffix?: string; step?: number }) => (
    <label className="profit-field">
      <span>{label}</span>
      <div className="profit-input-wrap">
        {options?.prefix && <b>{options.prefix}</b>}
        <input type="number" min="0" step={options?.step ?? 0.01} value={numberInputValue(input[key] as number)} onChange={(event) => update(key, positive(event.target.value) as never)} />
        {options?.suffix && <em>{options.suffix}</em>}
      </div>
    </label>
  );

  const percentField = (label: string, key: keyof ProfitInput) => (
    <label className="profit-field">
      <span>{label}</span>
      <div className="profit-input-wrap suffix"><input type="number" min="0" max="100" step="0.1" value={numberInputValue((input[key] as number) * 100)} onChange={(event) => updatePercent(key, event.target.value)} /><em>%</em></div>
    </label>
  );

  return (
    <main className="main-content profit-main">
      <header className="topbar profit-topbar">
        <div>
          <div className="eyebrow">板块四 · OPERATIONS PROFIT SIMULATOR</div>
          <h1>亚马逊利润测算器</h1>
          <p>新品立项、老品复盘、广告安全线与 SKU 运营决策</p>
        </div>
        <div className="profit-top-actions">
          <button className="rule-link" type="button" onClick={() => window.print()}><Printer size={15} /> 打印</button>
          <button className="rule-link" type="button" onClick={() => exportProfitWorkbook(input)}><FileSpreadsheet size={15} /> 导出 Excel</button>
        </div>
      </header>

      <div className="profit-page">
        <div className="profit-tabs" role="tablist" aria-label="利润测算视图">
          <button className={tab === "product" ? "active" : ""} type="button" onClick={() => setTab("product")}><Package size={15} /> 产品输入</button>
          <button className={tab === "cost" ? "active" : ""} type="button" onClick={() => setTab("cost")}><ReceiptText size={15} /> 成本模型</button>
          <button className={tab === "ads" ? "active" : ""} type="button" onClick={() => setTab("ads")}><Megaphone size={15} /> 广告模型</button>
          <button className={tab === "promotion" ? "active" : ""} type="button" onClick={() => setTab("promotion")}><Percent size={15} /> 促销模型</button>
          <button className={tab === "simulation" ? "active" : ""} type="button" onClick={() => setTab("simulation")}><Activity size={15} /> 利润模拟</button>
          <button className={tab === "dashboard" ? "active" : ""} type="button" onClick={() => setTab("dashboard")}><BarChart3 size={15} /> 利润驾驶舱</button>
        </div>

        <section className={`profit-kpi-hero grade-${result.grade}`}>
          <div className="profit-primary-kpi">
            <span>预计月利润</span>
            <strong><sup>{currencySymbol}</sup>{money(result.netProfit)}</strong>
            <p>{input.productName || "未命名产品"} · {SITE_LABELS[input.salesSite]} · {input.currency} · {result.monthlyOrders} 单/月</p>
          </div>
          <div className="profit-kpi-grid">
            <div><small>单件净利润</small><b className={result.unitProfit >= 0 ? "positive" : "negative"}>{formattedMoney(result.unitProfit)}</b></div>
            <div><small>利润率</small><b>{percent(result.profitMargin)}</b></div>
            <div><small>预计 TACOS</small><b>{percent(result.actualTacos)}</b></div>
            <div><small>盈亏平衡 ACOS</small><b>{percent(result.breakEvenAcos)}</b></div>
          </div>
          <div className="profit-grade-block">
            <small>运营评级</small><strong>{GRADE_LABELS[result.grade]}</strong><span>{result.recommendation}</span>
          </div>
          <div className="profit-hero-actions">
            <button type="button" onClick={() => setInput(DEFAULT_INPUT)} title="清空数据"><RotateCcw size={15} /></button>
            <button type="button" onClick={copySummary}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制"}</button>
            <button type="button" onClick={() => exportProfitCsv(input)}><Download size={15} /> CSV</button>
          </div>
        </section>

        {tab === "product" && <div className="profit-workspace two-panel">
          <section className="profit-panel">
            <div className="profit-panel-heading"><Package size={18} /><div><h2>产品基础信息</h2><p>定义站点、生命周期、售价和目标销量</p></div></div>
            <div className="profit-form-grid">
              <label className="profit-field"><span>产品名称</span><input value={input.productName} onChange={(event) => update("productName", event.target.value)} /></label>
              <label className="profit-field"><span>ASIN / SKU</span><input value={input.asinSku} onChange={(event) => update("asinSku", event.target.value)} /></label>
              <label className="profit-field"><span>销售站点</span><select value={input.salesSite} onChange={(event) => updateSalesSite(event.target.value as SalesSite)}>{Object.entries(SITE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="profit-field"><span>Amazon 顶级类目节点</span><select value={input.category} onChange={(event) => update("category", event.target.value)}>{marketplace.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              {numberField("Listing 售价", "listingPrice", { prefix: currencySymbol })}
              {numberField("目标月销量", "targetMonthlyOrders", { suffix: "件", step: 1 })}
              {percentField("预计月增长率", "monthlyGrowthRate")}
              <label className="profit-field"><span>销售币种</span><input value={`${input.currency} (${currencySymbol})`} disabled /></label>
            </div>
            <p className="marketplace-note"><Info size={14} /> 类目使用各站点 Amazon 顶级 Browse Node。细分类目与最终节点以上架时 Seller Central 类目树为准；切换站点不会自动换算金额汇率。</p>
            <div className="lifecycle-control"><span>产品生命周期</span><div><button className={input.lifecycle === "new" ? "active" : ""} type="button" onClick={() => update("lifecycle", "new" as ProductLifecycle)}>新品</button><button className={input.lifecycle === "mature" ? "active" : ""} type="button" onClick={() => update("lifecycle", "mature" as ProductLifecycle)}>成熟品</button></div></div>
          </section>

          <section className="profit-panel">
            <div className="profit-panel-heading"><ShoppingCart size={18} /><div><h2>订单结构模型</h2><p>广告/自然与促销订单是两个独立维度</p></div></div>
            <div className="order-structure-visual">
              <div className="order-donut" style={{ "--ad-share": `${result.adOrders / Math.max(1, result.monthlyOrders) * 360}deg` } as React.CSSProperties}><span><b>{result.monthlyOrders}</b><small>月订单</small></span></div>
              <div className="order-legend"><div><i className="ad" /><span>广告订单</span><b>{number(result.adOrders, 0)} / {percent(input.adOrderShare)}</b></div><div><i className="natural" /><span>自然订单</span><b>{number(result.naturalOrders, 0)} / {percent(1 - input.adOrderShare)}</b></div></div>
            </div>
            <div className="profit-metric-grid three">
              <div><small>日均订单</small><strong>{number(result.dailyOrders)} 单</strong></div>
              <div><small>Coupon 订单</small><strong>{number(result.couponOrders, 0)} 单</strong></div>
              <div><small>Deal 订单</small><strong>{number(result.dealOrders, 0)} 单</strong></div>
              <div><small>广告销售额</small><strong>{formattedMoney(result.adSalesRevenue)}</strong></div>
              <div><small>自然销售额</small><strong>{formattedMoney(result.naturalSalesRevenue)}</strong></div>
              <div><small>自然贡献利润</small><strong>{formattedMoney(result.naturalContributionProfit)}</strong></div>
              <div><small>折扣订单销售额</small><strong>{formattedMoney(result.discountSalesRevenue)}</strong></div>
            </div>
          </section>
        </div>}

        {tab === "cost" && <div className="profit-workspace cost-workspace">
          <section className="profit-panel">
            <div className="profit-panel-heading"><Package size={18} /><div><h2>产品成本</h2><p>采购、包装、配件与国内段成本</p></div></div>
            <div className="profit-form-grid">{numberField("采购成本", "purchaseCost", { prefix: currencySymbol })}{numberField("包装成本", "packagingCost", { prefix: currencySymbol })}{numberField("配件成本", "accessoryCost", { prefix: currencySymbol })}{numberField("国内运输", "domesticShippingCost", { prefix: currencySymbol })}{numberField("其他成本", "otherProductCost", { prefix: currencySymbol })}</div>
            <div className="panel-total"><span>单件产品总成本</span><strong>{formattedMoney(result.productCostPerUnit)}</strong></div>
          </section>
          <section className="profit-panel">
            <div className="profit-panel-heading"><WalletCards size={18} /><div><h2>物流与 Amazon 费用</h2><p>FBA 费用采用上游测算结果输入</p></div></div>
            <div className="profit-form-grid">{numberField("头程物流/件", "firstMileCost", { prefix: currencySymbol })}{numberField("关税 / VAT/件", "customsDuty", { prefix: currencySymbol })}{numberField("尾程成本/件", "lastMileCost", { prefix: currencySymbol })}{numberField("Referral Fee", "referralFee", { prefix: currencySymbol })}{numberField("FBA 配送费", "fbaFee", { prefix: currencySymbol })}{numberField("仓储费/件", "storageFee", { prefix: currencySymbol })}{numberField("其他 Amazon 费", "otherAmazonFee", { prefix: currencySymbol })}</div>
            <div className="double-total"><div><span>物流及进口税/件</span><b>{formattedMoney(result.logisticsCostPerUnit)}</b></div><div><span>Amazon 费用/件</span><b>{formattedMoney(result.amazonFeePerUnit)}</b></div></div>
          </section>
          <section className="profit-panel return-panel">
            <div className="profit-panel-heading"><ReceiptText size={18} /><div><h2>退货损耗模型</h2><p>不可售货值损失 + 每笔退货处理成本</p></div></div>
            <div className="profit-form-grid">{percentField("退货率", "returnRate")}{percentField("不可二次销售比例", "unsellableRate")}{numberField("退货处理成本", "returnProcessingCost", { prefix: currencySymbol })}</div>
            <div className="return-result-grid"><div><small>预计退货数量</small><b>{number(result.returnQuantity)} 件</b></div><div><small>不可售数量</small><b>{number(result.unsellableQuantity)} 件</b></div><div><small>月退货损失</small><b>{formattedMoney(result.returnLoss)}</b></div><div><small>单件摊销</small><b>{formattedMoney(result.returnLossPerUnit)}</b></div></div>
          </section>
        </div>}

        {tab === "ads" && <div className="profit-workspace two-panel">
          <section className="profit-panel">
            <div className="profit-panel-heading"><Megaphone size={18} /><div><h2>广告成本参数</h2><p>按广告销售额与 ACOS 推导所需花费</p></div></div>
            <div className="profit-form-grid">{percentField("广告订单占比", "adOrderShare")}{percentField("广告销售占比", "adSalesShare")}{percentField("ACOS", "acos")}{percentField("TACOS 目标", "targetTacos")}{numberField("平均 CPC", "cpc", { prefix: currencySymbol })}{numberField("月广告预算", "adBudget", { prefix: currencySymbol })}</div>
            <p className="profit-note"><Info size={14} /> 广告预算是约束线，不直接替代广告花费；预计花费 = 广告销售额 × ACOS。</p>
          </section>
          <section className="profit-panel ad-output-panel">
            <div className="profit-panel-heading"><Gauge size={18} /><div><h2>广告效率输出</h2><p>订单、销售、成本和预算覆盖能力</p></div></div>
            <div className="ad-main-amount"><span>预计广告花费</span><strong>{formattedMoney(result.adSpend)}</strong><small>预算 {result.budgetGap >= 0 ? "富余" : "缺口"} {result.budgetGap >= 0 ? "+" : ""}{formattedMoney(result.budgetGap)}</small></div>
            <div className="budget-meter"><div><span>预算覆盖率</span><b>{percent(result.budgetCoverage)}</b></div><i><em style={{ width: `${Math.min(100, result.budgetCoverage * 100)}%` }} /></i></div>
            <div className="profit-metric-grid three"><div><small>广告订单</small><strong>{number(result.adOrders, 0)} 单</strong></div><div><small>广告销售额</small><strong>{formattedMoney(result.adSalesRevenue)}</strong></div><div><small>单广告订单成本</small><strong>{formattedMoney(result.adCostPerOrder)}</strong></div><div><small>预计点击</small><strong>{number(result.estimatedClicks, 0)}</strong></div><div><small>隐含转化率</small><strong>{percent(result.impliedConversionRate)}</strong></div><div><small>实际 TACOS</small><strong>{percent(result.actualTacos)}</strong></div></div>
          </section>
          <section className="profit-panel ad-safety-panel">
            <div className="profit-panel-heading"><ShieldCheck size={18} /><div><h2>广告安全线</h2><p>净利润降至 0 前的最大广告空间</p></div></div>
            <div className="safety-line-grid"><div><small>盈亏平衡 ACOS</small><strong>{percent(result.breakEvenAcos)}</strong><span>当前 {percent(result.actualAcos)}</span></div><div><small>盈亏平衡 TACOS</small><strong>{percent(result.breakEvenTacos)}</strong><span>当前 {percent(result.actualTacos)}</span></div><div><small>最大广告花费</small><strong>{formattedMoney(result.maxAffordableAdSpend)}</strong><span>余量 {formattedMoney(result.maxAffordableAdSpend - result.adSpend)}</span></div><div><small>最大安全 CPC</small><strong>{formattedMoney(result.maxAffordableCpc)}</strong><span>当前 {formattedMoney(input.cpc)}</span></div></div>
          </section>
        </div>}

        {tab === "promotion" && <div className="profit-workspace two-panel">
          <section className="profit-panel">
            <div className="profit-panel-heading"><Percent size={18} /><div><h2>Coupon 与 Deal</h2><p>叠加资格与计算顺序直接采用 Amazon 官方规则</p></div></div>
            <div className="promotion-rule-status"><ShieldCheck size={18} /><div><span>Amazon 自动判定：始终叠加</span><small>Coupon + 秒杀/Z 划算依次应用，用户不能关闭</small></div><a href={stackedPromotionsHelpUrl} target="_blank" rel="noreferrer">官方规则 <ExternalLink size={13} /></a></div>
            <div className="promotion-input-block"><div><b>Coupon</b><span>适用于 {number(result.couponOrders, 0)} 单</span></div><div className="profit-form-grid">{percentField("Coupon 折扣比例", "couponRate")}{percentField("Coupon 订单比例", "couponOrderShare")}</div></div>
            <div className="promotion-input-block deal">
              <div><b>Deal</b><span>适用于 {number(result.dealOrders, 0)} 单</span></div>
              <div className="profit-form-grid">
                <label className="profit-field"><span>Deal 类型</span><select value={input.dealType} onChange={(event) => update("dealType", event.target.value as DealType)}>{Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                {percentField("Deal 折扣比例", "dealRate")}
                {percentField("Deal 订单比例", "dealOrderShare")}
              </div>
            </div>
            <div className="promotion-overlap-block"><div><small>自动估算叠加订单</small><strong>{number(result.couponDealStackedOrders, 0)} 单</strong><span>{percent(result.couponDealOverlapShare)} = Coupon 占比 × Deal 占比</span></div><div><small>叠加成交价</small><strong>{formattedMoney(result.stackedFinalPrice)}</strong><span>{formattedMoney(input.listingPrice)} × (1-{percent(input.couponRate)}) × (1-{percent(input.dealRate)})</span></div></div>
            <p className="profit-note promotion-policy-note"><Info size={14} /> Amazon 决定是否叠加；计算器仅用两个订单占比的乘积估算未来订单交集，实际交集以 Seller Central 数据为准。</p>
          </section>

          <section className="profit-panel seller-promotion-panel">
            <div className="profit-panel-heading"><BadgeDollarSign size={18} /><div><h2>Seller Central Promotion</h2><p>百分比折扣或买 X 赠 Y（BXGY）</p></div></div>
            <div className="promotion-rule-status neutral"><Info size={18} /><div><span>Deal + Promotion：不叠加</span><small>秒杀/Best Deal 与 Seller Central Promotion 按互斥订单计算</small></div><a href={AMAZON_DEAL_PROMOTION_GUIDANCE_URL} target="_blank" rel="noreferrer">官方说明 <ExternalLink size={13} /></a></div>
            <div className="promotion-stack-control">
              <div><span>是否使用 Promotion</span><small>与 Deal 订单占比分开建模</small></div>
              <div className="stack-segment"><button className={!input.sellerPromotionEnabled ? "active" : ""} type="button" onClick={() => update("sellerPromotionEnabled", false)}>未使用</button><button className={input.sellerPromotionEnabled ? "active" : ""} type="button" onClick={() => update("sellerPromotionEnabled", true)}>已使用</button></div>
            </div>
            {input.sellerPromotionEnabled && <>
              <div className="profit-form-grid seller-promotion-fields">
                <label className="profit-field"><span>Promotion 类型</span><select value={input.sellerPromotionType} onChange={(event) => update("sellerPromotionType", event.target.value as SellerPromotionType)}>{Object.entries(SELLER_PROMOTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                {percentField("Promotion 订单比例", "sellerPromotionOrderShare")}
                {input.sellerPromotionType === "percentage-off" ? percentField("Promotion 折扣比例", "sellerPromotionRate") : <>
                  {numberField("购买数量 X", "sellerPromotionBuyQuantity", { suffix: "件", step: 1 })}
                  {numberField("赠送数量 Y", "sellerPromotionFreeQuantity", { suffix: "件", step: 1 })}
                </>}
              </div>
              <div className="promotion-stack-control official-setting">
                <div><span>Seller Central 叠加设置</span><small>请与创建该 Promotion 时保存的官方选项保持一致</small></div>
                <div className="stack-segment"><button className={input.couponPromotionStacking === "prevent" ? "active" : ""} type="button" onClick={() => update("couponPromotionStacking", "prevent" as PromotionStackingSetting)}>不允许</button><button className={input.couponPromotionStacking === "allow" ? "active" : ""} type="button" onClick={() => update("couponPromotionStacking", "allow" as PromotionStackingSetting)}>允许叠加</button></div>
              </div>
              <div className="promotion-overlap-block"><div><small>Promotion 有效折扣</small><strong>{percent(result.sellerPromotionEffectiveRate)}</strong><span>{input.sellerPromotionType === "buy-x-get-y" ? `按 ${input.sellerPromotionBuyQuantity} + ${input.sellerPromotionFreeQuantity} 件折算` : `${formattedMoney(result.sellerPromotionAmountPerOrder)} / 单`}</span></div><div><small>Coupon + Promotion 命中</small><strong>{number(result.couponPromotionOverlapOrders, 0)} 单</strong><span>{input.couponPromotionStacking === "allow" ? `依次折后价 ${formattedMoney(result.couponPromotionFinalPrice)}` : `仅取较高折扣，成交价 ${formattedMoney(result.couponPromotionFinalPrice)}`}</span></div></div>
            </>}
            <p className="profit-note promotion-policy-note"><Info size={14} /> Coupon + Promotion：允许时依次应用，不允许时只应用金额更高的一项。<a href={stackedPromotionsHelpUrl} target="_blank" rel="noreferrer">查看 Amazon 规则 <ExternalLink size={12} /></a></p>
          </section>

          <section className="profit-panel">
            <div className="profit-panel-heading"><BadgeDollarSign size={18} /><div><h2>成交价格瀑布</h2><p>三类促销分别核算，避免重复扣减收入</p></div></div>
            <div className="price-waterfall promotion-four"><div><span>Listing 月销售额</span><strong>{formattedMoney(result.grossListingRevenue)}</strong></div><div className="coupon"><span>Coupon 损失</span><strong>-{formattedMoney(result.couponLoss)}</strong><small>{formattedMoney(result.couponAmountPerOrder)} / Coupon 单</small></div><div className="deal"><span>Deal 损失</span><strong>-{formattedMoney(result.dealLoss)}</strong><small>叠加后平均 {formattedMoney(result.averageDealAmountPerOrder)} / Deal 单</small></div><div className="promotion"><span>Promotion 损失</span><strong>-{formattedMoney(result.sellerPromotionLoss)}</strong><small>{input.sellerPromotionEnabled ? SELLER_PROMOTION_TYPE_LABELS[input.sellerPromotionType] : "未启用"}</small></div><div className="final"><span>实际销售额</span><strong>{formattedMoney(result.netSalesRevenue)}</strong><small>均价 {formattedMoney(result.averageSellingPrice)}</small></div></div>
            <div className="promotion-summary three"><div><span>促销总损失</span><b>{formattedMoney(result.promotionLoss)}</b></div><div><span>折扣占 Listing 销售额</span><b>{percent(result.grossListingRevenue > 0 ? result.promotionLoss / result.grossListingRevenue : 0)}</b></div><div><span>自动叠加订单</span><b>{number(result.couponDealStackedOrders + result.couponPromotionStackedOrders, 0)} 单</b></div></div>
          </section>
        </div>}

        {tab === "simulation" && <div className="profit-workspace simulation-workspace">
          <section className="scenario-intro"><div><Sparkles size={22} /><span><h2>运营情景模拟</h2><p>同一成本结构下，比较销量、广告、促销和退货变化后的利润结果。</p></span></div><div className="scenario-current"><small>当前正常模式</small><b>{formattedMoney(result.netProfit)} / 月</b></div></section>
          <div className="scenario-grid">{scenarios.map((scenario) => <article key={scenario.mode} className={`scenario-card ${scenario.mode}`}><div className="scenario-card-head"><span>{scenario.label}</span><strong className={scenario.result.netProfit >= 0 ? "positive" : "negative"}>{formattedMoney(scenario.result.netProfit)}</strong><p>{scenario.description}</p></div><div className="scenario-profit-bar"><i style={{ width: `${Math.max(3, Math.abs(scenario.result.netProfit) / maxScenarioProfit * 100)}%` }} /></div><dl><div><dt>月订单</dt><dd>{scenario.result.monthlyOrders}</dd></div><div><dt>成交均价</dt><dd>{formattedMoney(scenario.result.averageSellingPrice)}</dd></div><div><dt>广告花费</dt><dd>{formattedMoney(scenario.result.adSpend)}</dd></div><div><dt>单件利润</dt><dd>{formattedMoney(scenario.result.unitProfit)}</dd></div><div><dt>利润率</dt><dd>{percent(scenario.result.profitMargin)}</dd></div><div><dt>运营评级</dt><dd>{GRADE_LABELS[scenario.result.grade]}</dd></div></dl></article>)}</div>
          <section className="profit-panel scenario-table-panel"><div className="profit-panel-heading"><Activity size={18} /><div><h2>情景对比表</h2><p>最大增长利润不等于最佳利润率，需同时看现金投入和风险</p></div></div><div className="profit-table-wrap"><table className="profit-table"><thead><tr><th>模式</th><th>月订单</th><th>销售额</th><th>广告花费</th><th>单件利润</th><th>利润率</th><th>月利润</th><th>评级</th></tr></thead><tbody>{scenarios.map((scenario) => <tr key={scenario.mode}><td><b>{scenario.label}</b></td><td>{scenario.result.monthlyOrders}</td><td>{formattedMoney(scenario.result.netSalesRevenue)}</td><td>{formattedMoney(scenario.result.adSpend)}</td><td>{formattedMoney(scenario.result.unitProfit)}</td><td>{percent(scenario.result.profitMargin)}</td><td><b>{formattedMoney(scenario.result.netProfit)}</b></td><td>{GRADE_LABELS[scenario.result.grade]}</td></tr>)}</tbody></table></div></section>
        </div>}

        {tab === "dashboard" && <div className="profit-workspace dashboard-workspace">
          <section className="dashboard-metrics">
            <div><span>实际销售额</span><strong>{formattedMoney(result.netSalesRevenue)}</strong><small>Listing {formattedMoney(result.grossListingRevenue)}</small></div>
            <div><span>单件利润</span><strong className={result.unitProfit >= 0 ? "positive" : "negative"}>{formattedMoney(result.unitProfit)}</strong><small>成交均价 {formattedMoney(result.averageSellingPrice)}</small></div>
            <div><span>利润率</span><strong>{percent(result.profitMargin)}</strong><small>毛利率 {percent(result.grossMargin)}</small></div>
            <div><span>广告花费</span><strong>{formattedMoney(result.adSpend)}</strong><small>预算覆盖 {percent(result.budgetCoverage)}</small></div>
            <div><span>ACOS / TACOS</span><strong>{percent(result.actualAcos)} / {percent(result.actualTacos)}</strong><small>目标 TACOS {percent(input.targetTacos)}</small></div>
            <div><span>盈亏平衡售价</span><strong>{formattedMoney(result.breakEvenPrice)}</strong><small>当前 {formattedMoney(input.listingPrice)}</small></div>
          </section>

          <section className="profit-panel profit-bridge-panel">
            <div className="profit-panel-heading"><TrendingUp size={18} /><div><h2>月利润桥</h2><p>从成交销售额逐项扣除真实运营成本</p></div></div>
            <div className="profit-bridge"><div className="revenue"><span>成交销售额</span><strong>{formattedMoney(result.netSalesRevenue)}</strong></div><div><span>产品成本</span><strong>-{formattedMoney(result.totalProductCost)}</strong></div><div><span>物流成本</span><strong>-{formattedMoney(result.totalLogisticsCost)}</strong></div><div><span>Amazon 费用</span><strong>-{formattedMoney(result.totalAmazonFees)}</strong></div><div><span>退货损耗</span><strong>-{formattedMoney(result.returnLoss)}</strong></div><div><span>广告花费</span><strong>-{formattedMoney(result.adSpend)}</strong></div><div className="net"><span>月净利润</span><strong>{formattedMoney(result.netProfit)}</strong></div></div>
          </section>

          <section className={`sku-decision-card grade-${result.grade}`}>
            <div className="grade-seal"><span>SKU</span><strong>{GRADE_LABELS[result.grade]}</strong></div>
            <div><span>运营可行性判断</span><h2>{result.gradeTitle}</h2><p>{result.recommendation}</p></div>
            <div className="resource-actions"><div><Target size={16} /><span><b>广告安全线</b><small>ACOS 不高于 {percent(result.breakEvenAcos)}</small></span></div><div><Zap size={16} /><span><b>售价空间</b><small>较盈亏平衡价高 {formattedMoney(input.listingPrice - result.breakEvenPrice)}</small></span></div><div><Gauge size={16} /><span><b>资源池判断</b><small>{result.grade === "S" || result.grade === "A" ? "可进入重点资源池" : result.grade === "B" ? "优化后再放大" : "暂缓新增投入"}</small></span></div></div>
          </section>

          <section className="profit-panel dashboard-detail-panel">
            <div className="profit-panel-heading"><BarChart3 size={18} /><div><h2>核心指标清单</h2><p>立项、复盘与预算审批所需指标</p></div></div>
            <div className="dashboard-detail-grid"><div><small>订单数量</small><b>{result.monthlyOrders} 单</b></div><div><small>广告订单</small><b>{number(result.adOrders, 0)} 单</b></div><div><small>自然订单</small><b>{number(result.naturalOrders, 0)} 单</b></div><div><small>促销损失</small><b>{formattedMoney(result.promotionLoss)}</b></div><div><small>Coupon + Deal 叠加</small><b>{number(result.couponDealStackedOrders, 0)} 单</b></div><div><small>Coupon + Promotion 命中</small><b>{number(result.couponPromotionOverlapOrders, 0)} 单</b></div><div><small>退货损耗</small><b>{formattedMoney(result.returnLoss)}</b></div><div><small>最大广告花费</small><b>{formattedMoney(result.maxAffordableAdSpend)}</b></div><div><small>盈亏平衡 ACOS</small><b>{percent(result.breakEvenAcos)}</b></div><div><small>盈亏平衡 TACOS</small><b>{percent(result.breakEvenTacos)}</b></div><div><small>最大安全 CPC</small><b>{formattedMoney(result.maxAffordableCpc)}</b></div><div><small>月利润</small><b>{formattedMoney(result.netProfit)}</b></div></div>
          </section>
        </div>}

        <div className="warning-list profit-warnings">{result.warnings.map((warning) => <p key={warning}><AlertTriangle size={14} />{warning}</p>)}</div>
      </div>
    </main>
  );
}

export default ProfitSimulator;
