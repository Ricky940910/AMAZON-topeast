import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Box,
  Calculator,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Info,
  Layers3,
  PackageCheck,
  RotateCcw,
  Ruler,
  Scale,
  Sparkles,
  Warehouse,
} from "lucide-react";
import {
  calculateFba,
  formatNumber,
  shouldAutoApplySurcharge,
  type FbaInput,
  type LengthUnit,
  type ProductType,
  type WeightUnit,
} from "./lib/fba";

const DEFAULT_INPUT: FbaInput = {
  length: 32,
  width: 18,
  height: 15,
  lengthUnit: "cm",
  weight: 560,
  weightUnit: "g",
  price: 29.99,
  productType: "general",
  feeDate: "2026-07-28",
  includeSurcharge: true,
};

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  general: "普通商品",
  apparel: "服装",
  dangerous: "危险品",
};

const PRICE_BAND_LABELS = {
  low: "售价 < $10",
  mid: "售价 $10–$50",
  high: "售价 > $50",
};

const PERIOD_LABELS = {
  nonPeak: "2026 非旺季",
  peak: "2026 旺季",
};

function positiveNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function App() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => calculateFba(input), [input]);
  const { classification, fee } = result;

  const updateNumber = (key: "length" | "width" | "height" | "weight" | "price", value: string) => {
    setInput((current) => ({ ...current, [key]: positiveNumber(value) }));
  };

  const updateDate = (feeDate: string) => {
    setInput((current) => ({ ...current, feeDate, includeSurcharge: shouldAutoApplySurcharge(feeDate) }));
  };

  const reset = () => setInput(DEFAULT_INPUT);

  const copyResult = async () => {
    const text = [
      "【Amazon FBA 基础测算】",
      `原始尺寸：${input.length} × ${input.width} × ${input.height} ${input.lengthUnit}`,
      `原始重量：${input.weight} ${input.weightUnit}`,
      `标准尺寸：${result.dimensionsIn.map(formatNumber).join(" × ")} in`,
      `实际重量：${formatNumber(result.actualWeightLb)} lb`,
      `Size Tier：${classification.tier}`,
      `体积重量：${formatNumber(classification.adjustedDimensionalWeight)} lb`,
      `计费重量：${formatNumber(classification.feeShippingWeight)} lb`,
      `基础配送费：$${formatNumber(fee.baseFee)}`,
      `燃油物流附加费：$${formatNumber(fee.surcharge)}`,
      `预计 FBA 配送费：$${formatNumber(fee.totalFee)}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const originalDimensionText = `${input.length} × ${input.width} × ${input.height} ${input.lengthUnit}`;
  const dimensionDifference = classification.adjustedDimensionalWeight - result.actualWeightLb;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><PackageCheck size={22} /></div>
          <div>
            <strong>TOPEAST</strong>
            <span>AMAZON OPS</span>
          </div>
        </div>

        <nav className="module-nav" aria-label="工具板块">
          <span className="nav-label">工具板块</span>
          <button className="nav-item active" type="button">
            <Calculator size={18} />
            <span><b>FBA 费用测算</b><small>基础测算引擎</small></span>
            <ChevronRight size={16} />
          </button>
          <button className="nav-item" type="button" disabled>
            <Box size={18} />
            <span><b>平均装箱</b><small>筹备中</small></span>
          </button>
          <button className="nav-item" type="button" disabled>
            <Warehouse size={18} />
            <span><b>仓储与移除</b><small>筹备中</small></span>
          </button>
          <button className="nav-item" type="button" disabled>
            <CircleDollarSign size={18} />
            <span><b>利润模拟</b><small>筹备中</small></span>
          </button>
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          <div><b>规则版本</b><small>US · 2026</small></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">板块一 · FOUNDATION COST ENGINE</div>
            <h1>FBA 基础测算</h1>
            <p>单位转换、尺寸分级、计费重量与配送费匹配</p>
          </div>
          <a className="rule-link" href="https://sellercentral.amazon.com/help/hub/reference/external/GABBX6GZPA8MSZGW" target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Amazon 官方规则
          </a>
        </header>

        <div className="workspace">
          <section className="input-panel" aria-labelledby="input-title">
            <div className="panel-heading">
              <div><span>01</span><h2 id="input-title">产品数据</h2></div>
              <button className="icon-button" type="button" onClick={reset} title="恢复示例数据"><RotateCcw size={17} /></button>
            </div>

            <div className="form-section">
              <div className="section-label"><Ruler size={15} /> 包装后尺寸</div>
              <div className="dimension-grid">
                {(["length", "width", "height"] as const).map((key, index) => (
                  <label key={key}>
                    <span>{["长", "宽", "高"][index]}</span>
                    <input type="number" min="0" step="0.01" value={input[key]} onChange={(event) => updateNumber(key, event.target.value)} />
                  </label>
                ))}
              </div>
              <label className="field-label">
                <span>尺寸单位</span>
                <select value={input.lengthUnit} onChange={(event) => setInput((current) => ({ ...current, lengthUnit: event.target.value as LengthUnit }))}>
                  <option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option><option value="in">inch</option><option value="ft">ft</option>
                </select>
              </label>
            </div>

            <div className="form-section two-columns">
              <label className="field-label">
                <span><Scale size={15} /> 包装后重量</span>
                <input type="number" min="0" step="0.01" value={input.weight} onChange={(event) => updateNumber("weight", event.target.value)} />
              </label>
              <label className="field-label">
                <span>重量单位</span>
                <select value={input.weightUnit} onChange={(event) => setInput((current) => ({ ...current, weightUnit: event.target.value as WeightUnit }))}>
                  <option value="g">g</option><option value="kg">kg</option><option value="oz">oz</option><option value="lb">lb</option>
                </select>
              </label>
            </div>

            <div className="form-section">
              <label className="field-label">
                <span>产品类型</span>
                <select value={input.productType} onChange={(event) => setInput((current) => ({ ...current, productType: event.target.value as ProductType }))}>
                  <option value="general">普通商品 / 非服装</option>
                  <option value="apparel">服装</option>
                  <option value="dangerous">危险品 / Hazmat</option>
                </select>
              </label>
              <label className="field-label money-field">
                <span>产品售价（USD）</span>
                <div><b>$</b><input type="number" min="0" step="0.01" value={input.price} onChange={(event) => updateNumber("price", event.target.value)} /></div>
              </label>
              <label className="field-label">
                <span>预计出库日期</span>
                <input type="date" value={input.feeDate} onChange={(event) => updateDate(event.target.value)} />
              </label>
            </div>

            <label className="switch-row">
              <span><b>3.5% 燃油与物流附加费</b><small>2026-04-17 起适用</small></span>
              <input type="checkbox" checked={input.includeSurcharge} onChange={(event) => setInput((current) => ({ ...current, includeSurcharge: event.target.checked }))} />
              <i aria-hidden="true" />
            </label>
          </section>

          <section className="results" aria-live="polite">
            <div className="result-hero">
              <div className="hero-copy">
                <span className="result-kicker">预计 FBA 配送费</span>
                <div className="fee-total"><sup>$</sup>{formatNumber(fee.totalFee)}<small>/ 件</small></div>
                <div className="fee-meta">
                  <span>{classification.tier}</span>
                  <span>{formatNumber(classification.feeShippingWeight)} lb 计费</span>
                  <span>{PERIOD_LABELS[fee.period]}</span>
                </div>
              </div>
              <div className="package-visual" aria-hidden="true">
                <Box size={58} strokeWidth={1.35} />
                <span className="visual-length">{formatNumber(classification.longest)} in</span>
                <span className="visual-width">{formatNumber(classification.median)} in</span>
                <span className="visual-height">{formatNumber(classification.shortest)} in</span>
              </div>
              <button className="copy-button" type="button" onClick={copyResult}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "已复制" : "复制结果"}</button>
            </div>

            <div className="summary-strip">
              <div><span>基础配送费</span><strong>${formatNumber(fee.baseFee)}</strong></div>
              <div><span>燃油物流附加费</span><strong>${formatNumber(fee.surcharge)}</strong></div>
              <div><span>体积重量差</span><strong className={dimensionDifference > 0 ? "warning-text" : "success-text"}>{dimensionDifference > 0 ? "+" : ""}{formatNumber(dimensionDifference)} lb</strong></div>
            </div>

            <div className="calculation-flow">
              <article className="calculation-section">
                <div className="step-head"><span>01</span><div><h3>单位标准化</h3><p>保留原始输入，统一转换为 Amazon 计费单位</p></div></div>
                <div className="original-data">
                  <div><small>产品尺寸（原始）</small><strong>{originalDimensionText}</strong></div>
                  <div><small>产品重量（原始）</small><strong>{input.weight} {input.weightUnit}</strong></div>
                </div>
                <div className="data-table four-columns">
                  <div><span>Length</span><b>{formatNumber(result.dimensionsIn[0])} in</b><small>{formatNumber(result.dimensionsCm[0])} cm</small></div>
                  <div><span>Width</span><b>{formatNumber(result.dimensionsIn[1])} in</b><small>{formatNumber(result.dimensionsCm[1])} cm</small></div>
                  <div><span>Height</span><b>{formatNumber(result.dimensionsIn[2])} in</b><small>{formatNumber(result.dimensionsCm[2])} cm</small></div>
                  <div><span>Weight</span><b>{formatNumber(result.actualWeightLb)} lb</b><small>{formatNumber(result.actualWeightKg)} kg</small></div>
                </div>
              </article>

              <article className="calculation-section">
                <div className="step-head"><span>02</span><div><h3>Amazon Size Tier</h3><p>尺寸自动排序后逐级匹配，不支持手动指定</p></div></div>
                <div className="tier-banner"><Layers3 size={20} /><div><small>识别结果</small><strong>{classification.tier}</strong></div><span className="qualified"><Check size={14} /> 符合</span></div>
                <div className="data-table four-columns compact">
                  <div><span>最长边</span><b>{formatNumber(classification.longest)} in</b></div>
                  <div><span>中边</span><b>{formatNumber(classification.median)} in</b></div>
                  <div><span>短边</span><b>{formatNumber(classification.shortest)} in</b></div>
                  <div><span>Length + Girth</span><b>{formatNumber(classification.lengthPlusGirth)} in</b></div>
                </div>
                <p className="formula-line">Girth = 2 × ({formatNumber(classification.median)} + {formatNumber(classification.shortest)}) = {formatNumber(classification.girth)} in</p>
              </article>

              <article className="calculation-section">
                <div className="step-head"><span>03</span><div><h3>Shipping Weight</h3><p>先计算体积重，再应用尺寸等级对应的计费规则</p></div></div>
                <div className="weight-comparison">
                  <div><Scale size={18} /><span>Actual Weight</span><strong>{formatNumber(result.actualWeightLb)} lb</strong></div>
                  <span className="versus">VS</span>
                  <div><Archive size={18} /><span>Dim Weight</span><strong>{formatNumber(classification.adjustedDimensionalWeight)} lb</strong></div>
                  <span className="equals">=</span>
                  <div className="selected-weight"><PackageCheck size={18} /><span>Shipping Weight</span><strong>{formatNumber(classification.feeShippingWeight)} lb</strong></div>
                </div>
                <p className="formula-line">Dim Weight = {formatNumber(classification.longest)} × {formatNumber(classification.minimumTwoInchesApplied ? Math.max(classification.median, 2) : classification.median)} × {formatNumber(classification.minimumTwoInchesApplied ? Math.max(classification.shortest, 2) : classification.shortest)} ÷ 139 = {formatNumber(classification.adjustedDimensionalWeight)} lb</p>
                {classification.minimumTwoInchesApplied && <p className="rule-note"><Info size={14} /> Bulky / Extra Large 体积重的中边和短边最低按 2 in。</p>}
                {(classification.tier === "Small Standard" || classification.tier === "Extra Large 150+ lb") && <p className="rule-note"><Info size={14} /> 根据 Amazon 例外规则，该等级配送费仅使用实际重量。</p>}
              </article>

              <article className="calculation-section">
                <div className="step-head"><span>04</span><div><h3>FBA 配送费匹配</h3><p>按产品类型、售价、周期、尺寸等级与重量阶梯计费</p></div></div>
                <div className="fee-breakdown">
                  <div><span>产品类型</span><b>{PRODUCT_TYPE_LABELS[input.productType]}</b></div>
                  <div><span>售价区间</span><b>{PRICE_BAND_LABELS[fee.priceBand]}</b></div>
                  <div><span>重量阶梯</span><b>{fee.weightTierLabel}</b></div>
                  <div><span>费率周期</span><b>{PERIOD_LABELS[fee.period]}</b></div>
                </div>
                <div className="invoice-lines">
                  <div><span>2026 官方基础费率</span><b>${formatNumber(fee.baseFee)}</b></div>
                  <div><span>Fuel & Logistics Surcharge（3.5%）</span><b>${formatNumber(fee.surcharge)}</b></div>
                  <div className="invoice-total"><span>预计配送费</span><b>${formatNumber(fee.totalFee)}</b></div>
                </div>
                <p className="formula-line">收费依据：{classification.tier} · {fee.weightTierLabel} · {fee.rateExplanation}</p>
              </article>

              <article className="calculation-section recommendation-section">
                <div className="step-head"><span>05</span><div><h3>包装优化建议</h3><p>逐边模拟缩减 0.25 in，寻找首个真实降费方案</p></div></div>
                {classification.dimensionalWeightUsedForFee ? (
                  <div className="analysis-status warning"><AlertTriangle size={20} /><div><b>当前采用体积重量计费</b><span>体积重量比实际重量高 {formatNumber(Math.max(0, dimensionDifference))} lb，包装体积正在推高配送成本。</span></div></div>
                ) : (
                  <div className="analysis-status success"><Check size={20} /><div><b>当前未因体积重增加配送费</b><span>实际重量不低于适用体积重量，或当前等级按实际重量计费。</span></div></div>
                )}
                {result.suggestion ? (
                  <div className="suggestion-grid">
                    <div><small>建议优化</small><strong>{result.suggestion.dimensionLabel}减少 {formatNumber(result.suggestion.reduction)} in</strong></div>
                    <div><small>预计体积重</small><strong>{formatNumber(result.suggestion.projectedDimensionalWeight)} lb</strong></div>
                    <div><small>预计配送费</small><strong>${formatNumber(result.suggestion.projectedFee)}</strong></div>
                    <div className="saving"><small>预计每件节省</small><strong>${formatNumber(result.suggestion.savings)}</strong></div>
                  </div>
                ) : (
                  <div className="no-suggestion"><Sparkles size={18} /> 在单边缩减 40%（最多 12 in）的范围内，未发现可降低当前配送费阶梯的方案。</div>
                )}
              </article>
            </div>

            <div className="warning-list">
              {result.warnings.map((warning) => <p key={warning}><Info size={14} />{warning}</p>)}
            </div>

            <footer className="source-footer">
              <span>规则来源</span>
              <a href="https://sellercentral.amazon.com/help/hub/reference/external/GG5KW835AHDJCH8W" target="_blank" rel="noreferrer">Product size tiers <ExternalLink size={12} /></a>
              <a href="https://sellercentral.amazon.com/help/hub/reference/external/G53Z9EKF8VVZVH29" target="_blank" rel="noreferrer">Dimensional weight <ExternalLink size={12} /></a>
              <a href="https://sellercentral.amazon.com/help/hub/reference/external/GABBX6GZPA8MSZGW" target="_blank" rel="noreferrer">2026 FBA fees <ExternalLink size={12} /></a>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
