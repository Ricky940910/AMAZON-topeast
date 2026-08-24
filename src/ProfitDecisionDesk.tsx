import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calculator,
  Check,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Gauge,
  LineChart,
  Settings2,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { MARKETPLACE_CONFIG, type SalesSite } from "./lib/profit";
import { getDefaultReferralCategory, getReferralFeeCategories } from "./lib/referralFees";
import { numberInputValue } from "./lib/input";
import NumberInput from "./NumberInput";
import {
  DEFAULT_PROMOTION_PHASES,
  DEFAULT_SCENARIOS,
  calculateSimulation,
  compareScenarios,
  getLogisticsCostPerUnit,
  getProductCostPerUnit,
  resolveMonthlyPlan,
  validateSimulationInput,
  type MonthlyPlanOverride,
  type ScenarioAdjustment,
  type SimulationInput,
} from "./lib/simulation";

type DeskTab = "inputs" | "timeline" | "scenarios" | "targets";

const DEFAULT_INPUT: SimulationInput = {
  product: {
    asin: "",
    sku: "",
    name: "",
    salesSite: "US",
    category: "",
    referralCategory: "",
    lifecycle: "new",
    plannedMonths: 6,
  },
  sales: {
    listPrice: 0,
    monthlyOrders: 0,
    couponRate: 0,
    couponOrderShare: 0,
    dealRate: 0,
    dealOrderShare: 0,
    promotionEnabled: false,
    promotionRate: 0,
    promotionOrderShare: 0,
    promotionStacking: "prevent",
    adOrderShare: 0,
    advertisingMode: "acos",
    acos: 0,
    monthlyAdSpend: 0,
  },
  costs: {
    productCost: 0,
    packagingCost: 0,
    firstMileCost: 0,
    fbaFee: 0,
    storageFee: 0,
    otherAmazonFee: 0,
    returnRate: 0,
    refundWithoutReturnRate: 0,
    unsellableReturnRate: 0,
    averageReturnLoss: 0,
    otherAfterSalesLossPerOrder: 0,
    otherPromotionCost: 0,
    fixedOperatingCost: 0,
  },
  targets: { targetProfitMargin: 0, targetMonthlyProfit: 0, maximumAllowedLoss: 0 },
  phases: DEFAULT_PROMOTION_PHASES,
  monthlyPlans: Array.from({ length: 6 }, (_, index) => ({ month: index + 1 })),
};

const percentKeys = new Set([
  "couponRate", "couponOrderShare", "dealRate", "dealOrderShare", "promotionRate", "promotionOrderShare",
  "adOrderShare", "returnRate", "refundWithoutReturnRate", "unsellableReturnRate", "targetProfitMargin",
  "acos",
]);

function parsePositive(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseFinite(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundDisplay(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function monthLabel(month: number | null): string {
  return month === null ? "周期内未实现" : `M${month}`;
}

function Currency({ symbol, value, compact = false }: { symbol: string; value: number; compact?: boolean }) {
  if (!Number.isFinite(value)) return <>--</>;
  if (compact && Math.abs(value) >= 10000) return <>{symbol}{(value / 10000).toFixed(1)}万</>;
  return <>{symbol}{roundDisplay(value)}</>;
}

interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

function SimulationChart({ months, series, markers = [] }: { months: string[]; series: ChartSeries[]; markers?: Array<{ index: number; label: string }> }) {
  const width = 920;
  const height = 250;
  const padding = { top: 24, right: 22, bottom: 34, left: 62 };
  const allValues = series.flatMap((item) => item.values).concat(0);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const x = (index: number) => padding.left + (months.length <= 1 ? 0 : index * (width - padding.left - padding.right) / (months.length - 1));
  const y = (value: number) => padding.top + (max - value) * (height - padding.top - padding.bottom) / span;
  const ticks = Array.from({ length: 5 }, (_, index) => max - index * span / 4);

  return (
    <div className="sim-chart-wrap">
      <svg className="sim-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map((item) => item.label).join("与")}> 
        {ticks.map((tick) => <g key={tick}><line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} className="sim-grid-line" /><text x={padding.left - 10} y={y(tick) + 4} textAnchor="end">{Math.round(tick).toLocaleString("zh-CN")}</text></g>)}
        <line x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} className="sim-zero-line" />
        {markers.filter((marker) => marker.index >= 0 && marker.index < months.length).map((marker) => <g key={`${marker.index}-${marker.label}`}><line x1={x(marker.index)} x2={x(marker.index)} y1={padding.top} y2={height - padding.bottom} className="sim-marker-line" /><text x={x(marker.index) + 5} y={padding.top + 10} className="sim-marker-text">{marker.label}</text></g>)}
        {series.map((item) => {
          const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
          return <g key={item.label}><polyline points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{item.values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="3.8" fill="#fff" stroke={item.color} strokeWidth="2.5" />)}</g>;
        })}
        {months.map((month, index) => <text key={month} x={x(index)} y={height - 10} textAnchor="middle">{month}</text>)}
      </svg>
      <div className="sim-chart-legend">{series.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}</div>
    </div>
  );
}

function ProfitDecisionDesk() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [activeTab, setActiveTab] = useState<DeskTab>("inputs");
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [scenarioConfigs, setScenarioConfigs] = useState<ScenarioAdjustment[]>(DEFAULT_SCENARIOS);
  const [showPhases, setShowPhases] = useState(false);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => calculateSimulation(input), [input]);
  const scenarios = useMemo(() => compareScenarios(input, scenarioConfigs), [input, scenarioConfigs]);
  const errors = useMemo(() => validateSimulationInput(input), [input]);
  const currentMonth = result.months.at(-1);
  const selectedPlan = resolveMonthlyPlan(input, selectedMonth);
  const marketplace = MARKETPLACE_CONFIG[input.product.salesSite];
  const symbol = marketplace.symbol;
  const referralCategories = getReferralFeeCategories(input.product.salesSite);
  const categories = marketplace.categories;

  const updateProduct = (key: keyof SimulationInput["product"], value: string | number) => {
    setInput((current) => ({ ...current, product: { ...current.product, [key]: value } }));
  };

  const updateSite = (salesSite: SalesSite) => {
    setInput((current) => ({
      ...current,
      product: { ...current.product, salesSite, category: "", referralCategory: "" },
    }));
  };

  const updateCategory = (category: string) => {
    setInput((current) => ({
      ...current,
      product: { ...current.product, category, referralCategory: getDefaultReferralCategory(current.product.salesSite, category) },
    }));
  };

  const updateNumber = (section: "sales" | "costs" | "targets", key: string, rawValue: string) => {
    const value = parsePositive(rawValue);
    const normalized = percentKeys.has(key) ? value / 100 : value;
    setInput((current) => ({ ...current, [section]: { ...current[section], [key]: normalized } }));
  };

  const updateMonths = (rawValue: string) => {
    const plannedMonths = Math.min(12, Math.max(1, Math.floor(parsePositive(rawValue) || 1)));
    setInput((current) => ({
      ...current,
      product: { ...current.product, plannedMonths },
      monthlyPlans: Array.from({ length: plannedMonths }, (_, index) => current.monthlyPlans.find((plan) => plan.month === index + 1) ?? { month: index + 1 }),
    }));
    setSelectedMonth((month) => Math.min(month, plannedMonths));
  };

  const updateMonthlyPlan = (key: keyof Omit<MonthlyPlanOverride, "month">, rawValue: string, percentage = false) => {
    const value = percentage ? parsePositive(rawValue) / 100 : parsePositive(rawValue);
    setInput((current) => ({
      ...current,
      monthlyPlans: current.monthlyPlans.map((plan) => plan.month === selectedMonth ? { ...plan, [key]: value } : plan),
    }));
  };

  const clearMonthlyOverride = () => {
    setInput((current) => ({ ...current, monthlyPlans: current.monthlyPlans.map((plan) => plan.month === selectedMonth ? { month: selectedMonth } : plan) }));
  };

  const clearAllData = () => {
    setInput(DEFAULT_INPUT);
    setScenarioConfigs(DEFAULT_SCENARIOS);
    setSelectedMonth(1);
    setActiveTab("inputs");
    setShowPhases(false);
    setCopied(false);
  };

  const updatePhase = (id: string, key: "name" | "endDay" | "objective", rawValue: string) => {
    setInput((current) => ({
      ...current,
      phases: current.phases.map((phase) => phase.id === id ? { ...phase, [key]: key === "endDay" ? (rawValue === "" ? null : parsePositive(rawValue)) : rawValue } : phase),
    }));
  };

  const updateScenario = (id: string, key: "priceMultiplier" | "couponDelta" | "ordersMultiplier" | "acosMultiplier" | "adOrderShareDelta" | "returnRateMultiplier" | "months", rawValue: string, scale = 1) => {
    const allowsNegative = key === "couponDelta" || key === "adOrderShareDelta";
    const nextValue = (allowsNegative ? parseFinite(rawValue) : parsePositive(rawValue)) / scale;
    setScenarioConfigs((current) => current.map((scenario) => scenario.id === id ? { ...scenario, [key]: nextValue } : scenario));
  };

  const copyConclusion = async () => {
    const conclusion = [
      "【经营结论】",
      `产品：${input.product.name || "未填写"}`,
      `当前利润状态：${result.decision.statusText}`,
      `推广阶段：${result.decision.currentStage}`,
      `预计单月盈亏平衡：${monthLabel(result.monthlyBreakEvenMonth)}`,
      `预计累计回本：${monthLabel(result.paybackMonth)}`,
      `最大累计亏损：${symbol}${roundDisplay(result.maximumCumulativeLoss)}`,
      `最终利润：${symbol}${roundDisplay(result.totalOperatingProfit)}`,
      `最终利润率：${roundDisplay(result.finalProfitMargin * 100, 1)}%`,
      `风险等级：${result.decision.riskLabel}`,
      "主要利润压力：",
      ...result.decision.pressureFactors.map((item, index) => `${index + 1}. ${item}`),
      "建议：",
      ...result.decision.recommendations.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n");
    await navigator.clipboard.writeText(conclusion);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const field = (label: string, section: "sales" | "costs" | "targets", key: string, options: { percent?: boolean; prefix?: string; suffix?: string } = {}) => {
    const raw = Number(input[section][key as keyof typeof input[typeof section]] ?? 0);
    const value = options.percent ? raw * 100 : raw;
    return <label className="sim-field"><span>{label}</span><div>{options.prefix && <b>{options.prefix}</b>}<NumberInput min="0" step={options.percent ? "0.1" : "0.01"} value={value} onRawChange={(rawValue) => updateNumber(section, key, rawValue)} />{options.suffix && <em>{options.suffix}</em>}</div></label>;
  };

  const monthField = (label: string, key: keyof Omit<MonthlyPlanOverride, "month">, options: { percent?: boolean; prefix?: string; suffix?: string } = {}) => {
    const raw = Number(selectedPlan[key as keyof typeof selectedPlan] ?? 0);
    const value = options.percent ? raw * 100 : raw;
    return <label className="sim-field"><span>{label}</span><div>{options.prefix && <b>{options.prefix}</b>}<NumberInput min="0" step={options.percent ? "0.1" : "0.01"} value={value} onRawChange={(rawValue) => updateMonthlyPlan(key, rawValue, options.percent)} />{options.suffix && <em>{options.suffix}</em>}</div></label>;
  };

  return (
    <main className="main-content sim-main">
      <header className="topbar sim-topbar">
        <div><div className="eyebrow">板块六 · PROFIT & PROMOTION DECISION DESK</div><h1>推演</h1><p>亚马逊利润、推广生命周期、资金缺口与回本决策系统</p></div>
        <div className="sim-top-actions"><button className="rule-link" type="button" onClick={clearAllData} title="清零全部推演数据"><RefreshCcw size={15} /> 一键清零</button><button className="rule-link" type="button" onClick={copyConclusion}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制结论"}</button></div>
      </header>

      <div className="sim-page">
        <section className={`sim-hero risk-${result.decision.riskLevel}`}>
          <div className="sim-hero-title"><span>当前经营结果</span><strong>{currentMonth ? <Currency symbol={symbol} value={currentMonth.operatingProfit} /> : "--"}</strong><p>末月单月经营利润 · {currentMonth ? `${roundDisplay(currentMonth.profitMargin * 100, 1)}%` : "0.0%"}</p></div>
          <div className="sim-hero-metrics">
            <div><small>当前售价</small><b><Currency symbol={symbol} value={currentMonth?.listPrice ?? input.sales.listPrice} /></b></div>
            <div><small>实际成交价</small><b>{currentMonth ? <Currency symbol={symbol} value={currentMonth.actualSellingPrice} /> : "--"}</b></div>
            <div><small>单件利润</small><b><Currency symbol={symbol} value={currentMonth?.unitProfit ?? 0} /></b></div>
            <div><small>末月销量</small><b>{currentMonth?.orders.toLocaleString("zh-CN") ?? 0} 单</b></div>
            <div><small>末月销售额</small><b><Currency symbol={symbol} value={currentMonth?.netSales ?? 0} compact /></b></div>
            <div><small>最大资金缺口</small><b className="danger"><Currency symbol={symbol} value={result.maximumFundingGap} compact /></b></div>
            <div><small>单月转正</small><b>{monthLabel(result.monthlyBreakEvenMonth)}</b></div>
            <div><small>累计回本</small><b>{monthLabel(result.paybackMonth)}</b></div>
            <div><small>项目最终利润</small><b className={result.totalOperatingProfit >= 0 ? "" : "danger"}><Currency symbol={symbol} value={result.totalOperatingProfit} compact /></b></div>
          </div>
          <div className="sim-risk-block"><span className={`sim-risk-dot ${result.decision.riskLevel}`} /><small>风险等级</small><strong>{result.decision.riskLabel}</strong><p>{result.decision.currentStage}</p></div>
        </section>

        <nav className="sim-tabs" aria-label="推演页面">
          {([
            ["inputs", SlidersHorizontal, "基础参数"], ["timeline", LineChart, "M1-M12 推演"], ["scenarios", BarChart3, "情景沙盘"], ["targets", Target, "目标反推"],
          ] as const).map(([tab, Icon, label]) => <button key={tab} className={activeTab === tab ? "active" : ""} type="button" onClick={() => setActiveTab(tab)}><Icon size={16} />{label}</button>)}
        </nav>

        {errors.length > 0 && <div className="sim-validation"><AlertTriangle size={17} /><div><b>输入尚未完整</b><span>{Array.from(new Set(errors)).slice(0, 4).join("；")}</span></div></div>}

        {activeTab === "inputs" && <div className="sim-input-layout">
          <section className="sim-card">
            <div className="sim-card-head"><CircleDollarSign size={18} /><div><h2>产品与销售</h2><p>站点决定币种，类目节点自动推荐佣金规则</p></div></div>
            <div className="sim-form-grid three">
              <label className="sim-field"><span>ASIN *</span><input value={input.product.asin} onChange={(event) => updateProduct("asin", event.target.value)} /></label>
              <label className="sim-field"><span>SKU</span><input value={input.product.sku} onChange={(event) => updateProduct("sku", event.target.value)} /></label>
              <label className="sim-field"><span>产品名称 *</span><input value={input.product.name} onChange={(event) => updateProduct("name", event.target.value)} /></label>
              <label className="sim-field"><span>Amazon 站点</span><select value={input.product.salesSite} onChange={(event) => updateSite(event.target.value as SalesSite)}>{Object.entries(MARKETPLACE_CONFIG).map(([site, config]) => <option key={site} value={site}>{site} · {config.currency}</option>)}</select></label>
              <label className="sim-field"><span>产品类目节点</span><select value={input.product.category} onChange={(event) => updateCategory(event.target.value)}><option value="">请选择类目节点</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="sim-field"><span>Referral Fee 类目</span><select value={input.product.referralCategory} onChange={(event) => updateProduct("referralCategory", event.target.value)}><option value="">请选择佣金类目</option>{referralCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
              <label className="sim-field"><span>生命周期</span><select value={input.product.lifecycle} onChange={(event) => updateProduct("lifecycle", event.target.value)}><option value="new">新品</option><option value="growth">成长期</option><option value="mature">成熟期</option><option value="decline">衰退期</option></select></label>
              <label className="sim-field"><span>计划推演周期</span><div><input type="number" min="1" max="12" value={input.product.plannedMonths} onChange={(event) => updateMonths(event.target.value)} /><em>个月</em></div></label>
              {field("List Price", "sales", "listPrice", { prefix: symbol })}
              {field("基础月销量", "sales", "monthlyOrders", { suffix: "单" })}
              {field("Coupon", "sales", "couponRate", { percent: true, suffix: "%" })}
              {field("Coupon 订单占比", "sales", "couponOrderShare", { percent: true, suffix: "%" })}
              {field("Deal 折扣", "sales", "dealRate", { percent: true, suffix: "%" })}
              {field("Deal 订单占比", "sales", "dealOrderShare", { percent: true, suffix: "%" })}
              {field("广告订单占比（自然单自动补足）", "sales", "adOrderShare", { percent: true, suffix: "%" })}
            </div>
            <div className="sim-promotion-row"><label className="sim-switch"><input type="checkbox" checked={input.sales.promotionEnabled} onChange={(event) => setInput((current) => ({ ...current, sales: { ...current.sales, promotionEnabled: event.target.checked } }))} /><i /><span><b>Seller Central Promotion</b><small>Deal 与 Promotion 互斥；Coupon 按活动设置叠加或择优</small></span></label>{input.sales.promotionEnabled && <div className="sim-inline-fields">{field("Promotion", "sales", "promotionRate", { percent: true, suffix: "%" })}{field("订单占比", "sales", "promotionOrderShare", { percent: true, suffix: "%" })}<label className="sim-field"><span>与 Coupon</span><select value={input.sales.promotionStacking} onChange={(event) => setInput((current) => ({ ...current, sales: { ...current.sales, promotionStacking: event.target.value as "allow" | "prevent" } }))}><option value="prevent">不叠加，取更高优惠</option><option value="allow">依次叠加</option></select></label></div>}</div>
          </section>

          <section className="sim-card">
            <div className="sim-card-head"><Calculator size={18} /><div><h2>成本、广告与目标</h2><p>单位成本、月度固定成本和百分比严格分开</p></div></div>
            <div className="sim-subhead">产品与物流成本 / 件</div>
            <div className="sim-form-grid three">{field("采购成本", "costs", "productCost", { prefix: symbol })}{field("包装成本", "costs", "packagingCost", { prefix: symbol })}{field("头程成本", "costs", "firstMileCost", { prefix: symbol })}</div>
            <div className="sim-cost-summary"><span>产品总成本 / 件 <b><Currency symbol={symbol} value={getProductCostPerUnit(input.costs)} /></b></span><span>物流总成本 / 件 <b><Currency symbol={symbol} value={getLogisticsCostPerUnit(input.costs)} /></b></span></div>
            <div className="sim-subhead">Amazon 与售后成本</div>
            <div className="sim-form-grid four">{field("FBA Fee / 件", "costs", "fbaFee", { prefix: symbol })}{field("仓储费 / 件", "costs", "storageFee", { prefix: symbol })}{field("其他 Amazon 费 / 件", "costs", "otherAmazonFee", { prefix: symbol })}{field("退货率", "costs", "returnRate", { percent: true, suffix: "%" })}{field("仅退款率", "costs", "refundWithoutReturnRate", { percent: true, suffix: "%" })}{field("退货不可售率", "costs", "unsellableReturnRate", { percent: true, suffix: "%" })}{field("平均退货处理损失", "costs", "averageReturnLoss", { prefix: symbol })}{field("其他售后损失 / 单", "costs", "otherAfterSalesLossPerOrder", { prefix: symbol })}</div>
            <div className="sim-subhead">广告模式与经营目标</div>
            <div className="sim-ad-mode"><button className={input.sales.advertisingMode === "acos" ? "active" : ""} type="button" onClick={() => setInput((current) => ({ ...current, sales: { ...current.sales, advertisingMode: "acos" } }))}>ACOS 反推花费</button><button className={input.sales.advertisingMode === "spend" ? "active" : ""} type="button" onClick={() => setInput((current) => ({ ...current, sales: { ...current.sales, advertisingMode: "spend" } }))}>直接输入广告花费</button></div>
            <div className="sim-form-grid four">{input.sales.advertisingMode === "acos" ? field("基础 ACOS", "sales", "acos", { percent: true, suffix: "%" }) : field("月广告花费", "sales", "monthlyAdSpend", { prefix: symbol })}{field("其他推广成本 / 月", "costs", "otherPromotionCost", { prefix: symbol })}{field("固定经营成本 / 月", "costs", "fixedOperatingCost", { prefix: symbol })}{field("目标利润率", "targets", "targetProfitMargin", { percent: true, suffix: "%" })}{field("目标月利润", "targets", "targetMonthlyProfit", { prefix: symbol })}{field("最大允许亏损", "targets", "maximumAllowedLoss", { prefix: symbol })}</div>
          </section>
        </div>}

        {activeTab === "timeline" && <div className="sim-timeline-layout">
          <aside className="sim-card sim-month-editor">
            <div className="sim-card-head"><Activity size={18} /><div><h2>月度参数</h2><p>选中月份后覆盖基础值</p></div></div>
            <div className="sim-month-selector">{result.months.map((month) => <button key={month.month} type="button" className={`${selectedMonth === month.month ? "active" : ""} ${month.operatingProfit >= 0 ? "positive" : "negative"}`} onClick={() => setSelectedMonth(month.month)}>M{month.month}<small>{month.stage}</small></button>)}</div>
            <div className="sim-month-form">{monthField("售价", "listPrice", { prefix: symbol })}{monthField("销量", "orders", { suffix: "单" })}{monthField("Coupon", "couponRate", { percent: true, suffix: "%" })}{monthField("广告订单占比", "adOrderShare", { percent: true, suffix: "%" })}{input.sales.advertisingMode === "acos" ? monthField("ACOS", "acos", { percent: true, suffix: "%" }) : monthField("广告花费", "adSpend", { prefix: symbol })}{monthField("退货率", "returnRate", { percent: true, suffix: "%" })}{monthField("其他推广成本", "otherPromotionCost", { prefix: symbol })}<button className="sim-clear-month" type="button" onClick={clearMonthlyOverride}><RefreshCcw size={14} /> 恢复基础值</button></div>
            <button className="sim-phase-toggle" type="button" onClick={() => setShowPhases((visible) => !visible)}><Settings2 size={14} /> 推广阶段设置 <ChevronDown size={13} className={showPhases ? "open" : ""} /></button>
            {showPhases && <div className="sim-phase-editor">{input.phases.map((phase, index) => <div key={phase.id} className="sim-phase-row"><span>{index + 1}</span><input aria-label={`阶段 ${index + 1} 名称`} value={phase.name} onChange={(event) => updatePhase(phase.id, "name", event.target.value)} /><input aria-label={`阶段 ${index + 1} 结束天数`} type="number" min="1" value={numberInputValue(phase.endDay ?? 0)} placeholder="持续" onChange={(event) => updatePhase(phase.id, "endDay", event.target.value)} /><input aria-label={`阶段 ${index + 1} 目标`} value={phase.objective} onChange={(event) => updatePhase(phase.id, "objective", event.target.value)} /></div>)}</div>}
          </aside>
          <div className="sim-timeline-results">
            <section className="sim-card"><div className="sim-card-head"><LineChart size={18} /><div><h2>生命周期利润曲线</h2><p>单月利润与累计利润，标注关键经营节点</p></div></div><SimulationChart months={result.months.map((month) => `M${month.month}`)} series={[{ label: "单月利润", color: "#d39a3a", values: result.months.map((month) => month.operatingProfit) }, { label: "累计利润", color: "#315a46", values: result.months.map((month) => month.cumulativeProfit) }]} markers={[{ index: (result.monthlyBreakEvenMonth ?? 0) - 1, label: "单月转正" }, { index: (result.maximumLossMonth ?? 0) - 1, label: "最大亏损" }, { index: (result.paybackMonth ?? 0) - 1, label: "累计回本" }]} /></section>
            <section className="sim-card"><div className="sim-card-head"><TrendingUp size={18} /><div><h2>推广资金曲线</h2><p>累计推广投入、累计正向回收与项目累计利润</p></div></div><SimulationChart months={result.months.map((month) => `M${month.month}`)} series={[{ label: "累计推广投入", color: "#9b684f", values: result.months.map((month) => month.cumulativePromotionSpend) }, { label: "累计回收", color: "#4d8067", values: result.months.map((month) => month.cumulativeRecovery) }, { label: "累计利润", color: "#d39a3a", values: result.months.map((month) => month.cumulativeProfit) }]} /></section>
            <section className="sim-card sim-table-card"><div className="sim-card-head"><BarChart3 size={18} /><div><h2>月度经营明细</h2><p>所有内部计算保持原始精度，表格仅格式化展示</p></div></div><div className="sim-table-wrap"><table><thead><tr><th>月份</th><th>阶段</th><th>销量</th><th>成交价</th><th>标价销售额</th><th>折后销售额</th><th>广告花费</th><th>ACOS</th><th>TACOS</th><th>单件利润</th><th>单月利润</th><th>累计利润</th><th>状态</th></tr></thead><tbody>{result.months.map((month) => <tr key={month.month}><td>M{month.month}</td><td>{month.stage}</td><td>{month.orders.toLocaleString("zh-CN")}</td><td><Currency symbol={symbol} value={month.actualSellingPrice} /></td><td><Currency symbol={symbol} value={month.grossListingSales} /></td><td><Currency symbol={symbol} value={month.netSales} /></td><td><Currency symbol={symbol} value={month.advertisingCost} /></td><td>{roundDisplay(month.actualAcos * 100, 1)}%</td><td>{roundDisplay(month.tacos * 100, 1)}%</td><td><Currency symbol={symbol} value={month.unitProfit} /></td><td className={month.operatingProfit >= 0 ? "positive-text" : "negative-text"}><Currency symbol={symbol} value={month.operatingProfit} /></td><td className={month.cumulativeProfit >= 0 ? "positive-text" : "negative-text"}><Currency symbol={symbol} value={month.cumulativeProfit} /></td><td><span className={`sim-status ${month.status}`}>{month.status === "loss" ? "亏损" : month.status === "monthly-break-even" ? "单月转正" : "累计盈利"}</span></td></tr>)}</tbody></table></div></section>
          </div>
        </div>}

        {activeTab === "scenarios" && <div className="sim-scenario-page">
          <section className="sim-card"><div className="sim-card-head"><Sparkles size={18} /><div><h2>三方案经营沙盘</h2><p>推荐顺序：不超亏损线、达到目标、尽快单月转正、尽快回本、降低资金占用、最大化最终利润</p></div></div><div className="sim-scenario-grid">{scenarios.map(({ scenario, result: scenarioResult, recommended, reason }) => <article key={scenario.id} className={`sim-scenario ${recommended ? "recommended" : ""}`}><header><div><span>{scenario.name}</span><p>{scenario.description}</p></div>{recommended && <b><Check size={13} /> 推荐方案</b>}</header><div className="sim-scenario-controls"><label>售价系数<input type="number" min="0" step="1" value={roundDisplay(scenario.priceMultiplier * 100, 0)} onChange={(event) => updateScenario(scenario.id, "priceMultiplier", event.target.value, 100)} /><em>%</em></label><label>Coupon 调整<input type="number" step="0.1" value={roundDisplay(scenario.couponDelta * 100, 1)} onChange={(event) => updateScenario(scenario.id, "couponDelta", event.target.value, 100)} /><em>pt</em></label><label>销量系数<input type="number" min="0" step="1" value={roundDisplay(scenario.ordersMultiplier * 100, 0)} onChange={(event) => updateScenario(scenario.id, "ordersMultiplier", event.target.value, 100)} /><em>%</em></label><label>ACOS 系数<input type="number" min="0" step="1" value={roundDisplay(scenario.acosMultiplier * 100, 0)} onChange={(event) => updateScenario(scenario.id, "acosMultiplier", event.target.value, 100)} /><em>%</em></label><label>广告单调整<input type="number" step="0.1" value={roundDisplay(scenario.adOrderShareDelta * 100, 1)} onChange={(event) => updateScenario(scenario.id, "adOrderShareDelta", event.target.value, 100)} /><em>pt</em></label><label>退货率系数<input type="number" min="0" step="1" value={roundDisplay(scenario.returnRateMultiplier * 100, 0)} onChange={(event) => updateScenario(scenario.id, "returnRateMultiplier", event.target.value, 100)} /><em>%</em></label><label>推演周期<input type="number" min="1" max="12" step="1" value={scenario.months} onChange={(event) => updateScenario(scenario.id, "months", event.target.value)} /><em>月</em></label></div><div className="sim-scenario-metrics"><div><small>最大资金缺口</small><strong><Currency symbol={symbol} value={scenarioResult.maximumFundingGap} /></strong></div><div><small>单月转正</small><strong>{monthLabel(scenarioResult.monthlyBreakEvenMonth)}</strong></div><div><small>累计回本</small><strong>{monthLabel(scenarioResult.paybackMonth)}</strong></div><div><small>最终利润</small><strong className={scenarioResult.totalOperatingProfit >= 0 ? "positive-text" : "negative-text"}><Currency symbol={symbol} value={scenarioResult.totalOperatingProfit} /></strong></div><div><small>最终利润率</small><strong>{roundDisplay(scenarioResult.finalProfitMargin * 100, 1)}%</strong></div><div><small>推广投入</small><strong><Currency symbol={symbol} value={scenarioResult.totalPromotionInvestment} /></strong></div><div><small>项目 ROI</small><strong>{roundDisplay(scenarioResult.projectRoi * 100, 1)}%</strong></div></div><footer>{reason}</footer></article>)}</div></section>
          <section className="sim-card sim-comparison-table"><div className="sim-table-wrap"><table><thead><tr><th>指标</th>{scenarios.map(({ scenario }) => <th key={scenario.id}>{scenario.name}</th>)}</tr></thead><tbody><tr><td>最大亏损</td>{scenarios.map(({ scenario, result: item }) => <td key={scenario.id}><Currency symbol={symbol} value={item.maximumCumulativeLoss} /></td>)}</tr><tr><td>单月盈亏平衡</td>{scenarios.map(({ scenario, result: item }) => <td key={scenario.id}>{monthLabel(item.monthlyBreakEvenMonth)}</td>)}</tr><tr><td>累计回本</td>{scenarios.map(({ scenario, result: item }) => <td key={scenario.id}>{monthLabel(item.paybackMonth)}</td>)}</tr><tr><td>最终利润</td>{scenarios.map(({ scenario, result: item }) => <td key={scenario.id}><Currency symbol={symbol} value={item.totalOperatingProfit} /></td>)}</tr><tr><td>资金上限校验</td>{scenarios.map(({ scenario, result: item }) => <td key={scenario.id}>{item.maximumFundingGap <= input.targets.maximumAllowedLoss ? "通过" : "超过"}</td>)}</tr></tbody></table></div></section>
        </div>}

        {activeTab === "targets" && <div className="sim-target-page">
          <section className="sim-target-grid">
            <article className="sim-target-card"><Target size={20} /><span>目标利润率最低售价</span><strong><Currency symbol={symbol} value={result.reverse.minimumSellingPrice} /></strong><small>当前售价安全空间 <Currency symbol={symbol} value={result.reverse.priceSafetySpace} /></small></article>
            <article className="sim-target-card"><Gauge size={20} /><span>最大允许 ACOS</span><strong>{Number.isFinite(result.reverse.maximumAcos) ? `${roundDisplay(result.reverse.maximumAcos * 100, 1)}%` : "无限制"}</strong><small>最大广告成本 <Currency symbol={symbol} value={result.reverse.maximumAdSpend} /></small></article>
            <article className="sim-target-card"><CircleDollarSign size={20} /><span>最大 Coupon</span><strong>{roundDisplay(result.reverse.maximumCouponRate * 100, 1)}%</strong><small>推荐控制在 {roundDisplay(result.reverse.recommendedCouponRate * 100, 1)}% 以内</small></article>
            <article className="sim-target-card"><TrendingUp size={20} /><span>目标利润所需销量</span><strong>{Number.isFinite(result.reverse.requiredMonthlyOrders) ? `${result.reverse.requiredMonthlyOrders.toLocaleString("zh-CN")} 单/月` : "当前无正贡献"}</strong><small>{Number.isFinite(result.reverse.requiredDailyOrders) ? `约 ${roundDisplay(result.reverse.requiredDailyOrders, 1)} 单/日` : "先修复单位贡献利润"}</small></article>
            <article className="sim-target-card"><ShieldCheck size={20} /><span>资金线内月广告预算</span><strong><Currency symbol={symbol} value={result.reverse.maximumMonthlyAdBudget} /></strong><small>基于最大允许亏损反推</small></article>
            <article className="sim-target-card"><Activity size={20} /><span>项目最终 ROI</span><strong>{roundDisplay(result.projectRoi * 100, 1)}%</strong><small>经营利润 / 项目现金成本</small></article>
          </section>
          <section className={`sim-budget-alert ${result.maximumFundingGap > input.targets.maximumAllowedLoss ? "danger" : "safe"}`}>{result.maximumFundingGap > input.targets.maximumAllowedLoss ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}<div><b>{result.maximumFundingGap > input.targets.maximumAllowedLoss ? "推广方案超过资金承受能力" : "推广方案在资金承受范围内"}</b><span>预测最大资金缺口 <Currency symbol={symbol} value={result.maximumFundingGap} />，允许上限 <Currency symbol={symbol} value={input.targets.maximumAllowedLoss} />。</span></div></section>
        </div>}

        <section className="sim-decision-panel">
          <div className="sim-decision-head"><Sparkles size={20} /><div><span>经营结论</span><strong>{result.decision.statusText}</strong></div><b className={`risk-${result.decision.riskLevel}`}>{result.decision.riskLabel}</b></div>
          <div className="sim-decision-body"><div><h3>关键节点</h3><p>当前阶段：{result.decision.currentStage}</p><p>单月转正：{monthLabel(result.monthlyBreakEvenMonth)}</p><p>累计回本：{monthLabel(result.paybackMonth)}</p><p>最大资金缺口：<Currency symbol={symbol} value={result.maximumFundingGap} /></p></div><div><h3>主要利润压力</h3>{result.decision.pressureFactors.map((item, index) => <p key={item}>{index + 1}. {item}</p>)}</div><div><h3>建议动作</h3>{result.decision.recommendations.map((item, index) => <p key={item}>{index + 1}. {item}</p>)}</div></div>
        </section>
      </div>
    </main>
  );
}

export default ProfitDecisionDesk;
