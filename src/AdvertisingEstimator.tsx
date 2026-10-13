import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Calculator,
  Check,
  Clipboard,
  Info,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  calculateAdvertisingEstimate,
  type AdvertisingTarget,
  type CalibrationSample,
} from "./lib/advertisingEstimate";

const DEMO_SAMPLE: CalibrationSample = {
  id: "sample-demo",
  name: "文档演示样本",
  adScore: 4000,
  organicScore: 2000,
  adClicks: 3200,
  adSpend: 3456,
  cpcProxy: 1.2,
  totalOrders: 600,
  adOrders: 300,
};

const DEMO_TARGET: AdvertisingTarget = {
  asin: "假设竞品",
  adScore: 6000,
  organicScore: 4000,
  cpcProxy: 1.3,
  totalOrders: 700,
  observationDays: 30,
};

const EMPTY_SAMPLE: CalibrationSample = {
  id: "sample-empty",
  name: "新校准样本",
  adScore: 0,
  organicScore: 0,
  adClicks: 0,
  adSpend: 0,
  cpcProxy: 0,
  totalOrders: 0,
  adOrders: 0,
};

interface SavedAdvertisingTemplate {
  id: string;
  name: string;
  samples: CalibrationSample[];
  target: AdvertisingTarget;
  site: string;
  channelScope: string;
}

const TEMPLATE_STORAGE_KEY = "amazon-inventory-decision-advertising-templates";
const SITE_CURRENCY: Record<string, { code: string; symbol: string }> = {
  "Amazon US": { code: "USD", symbol: "$" },
  "Amazon CA": { code: "CAD", symbol: "C$" },
  "Amazon UK": { code: "GBP", symbol: "£" },
  "Amazon DE": { code: "EUR", symbol: "€" },
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCalibrationSample(value: unknown): value is CalibrationSample {
  if (!value || typeof value !== "object") return false;
  const sample = value as Partial<CalibrationSample>;
  return typeof sample.id === "string"
    && typeof sample.name === "string"
    && isFiniteNumber(sample.adScore)
    && isFiniteNumber(sample.organicScore)
    && isFiniteNumber(sample.adClicks)
    && isFiniteNumber(sample.adSpend)
    && isFiniteNumber(sample.cpcProxy)
    && isFiniteNumber(sample.totalOrders)
    && isFiniteNumber(sample.adOrders);
}

function isAdvertisingTarget(value: unknown): value is AdvertisingTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Partial<AdvertisingTarget>;
  return typeof target.asin === "string"
    && isFiniteNumber(target.adScore)
    && isFiniteNumber(target.organicScore)
    && isFiniteNumber(target.cpcProxy)
    && (target.totalOrders === null || isFiniteNumber(target.totalOrders))
    && isFiniteNumber(target.observationDays);
}

function isSavedAdvertisingTemplate(value: unknown): value is SavedAdvertisingTemplate {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedAdvertisingTemplate>;
  return typeof item.id === "string"
    && typeof item.name === "string"
    && Array.isArray(item.samples)
    && item.samples.every(isCalibrationSample)
    && isAdvertisingTarget(item.target)
    && typeof item.site === "string"
    && typeof item.channelScope === "string";
}

function readSavedTemplates(): SavedAdvertisingTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter(isSavedAdvertisingTemplate) : [];
  } catch {
    return [];
  }
}

function formatNumber(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatMoney(value: number | null, site: string, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const currency = SITE_CURRENCY[site];
  return currency ? `${currency.symbol}${formatNumber(value, digits)}` : `${formatNumber(value, digits)}（币种待定）`;
}

function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${formatNumber(value * 100, digits)}%`;
}

function numericValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function newSampleId(): string {
  return `sample-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ResultMetric({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "accent" | "success" }) {
  return (
    <div className={`ad-result-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AdvertisingEstimator() {
  const [samples, setSamples] = useState<CalibrationSample[]>([DEMO_SAMPLE]);
  const [target, setTarget] = useState<AdvertisingTarget>(DEMO_TARGET);
  const [site, setSite] = useState("Amazon US");
  const [channelScope, setChannelScope] = useState("SP CPC");
  const [copied, setCopied] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedAdvertisingTemplate[]>(readSavedTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("我的广告测算样板");

  const result = useMemo(() => calculateAdvertisingEstimate(samples, target), [samples, target]);
  const currency = SITE_CURRENCY[site];
  const resultStatus = result.target.estimatedSpend === null
    ? "待校准"
    : result.target.adOrderShare === null
      ? "部分可算"
      : "可计算";

  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(savedTemplates));
    } catch {
      // Private browsing or storage quotas can make browser-local templates unavailable.
    }
  }, [savedTemplates]);

  const updateSample = <K extends keyof CalibrationSample>(id: string, key: K, value: CalibrationSample[K]) => {
    setSamples((current) => current.map((sample) => sample.id === id ? { ...sample, [key]: value } : sample));
  };

  const updateTarget = <K extends keyof AdvertisingTarget>(key: K, value: AdvertisingTarget[K]) => {
    setTarget((current) => ({ ...current, [key]: value }));
  };

  const addSample = () => setSamples((current) => [...current, { ...EMPTY_SAMPLE, id: newSampleId(), name: `校准样本 ${current.length + 1}` }]);
  const removeSample = (id: string) => setSamples((current) => current.length > 1 ? current.filter((sample) => sample.id !== id) : current);
  const loadDemo = () => {
    setSamples([{ ...DEMO_SAMPLE, id: newSampleId() }]);
    setTarget(DEMO_TARGET);
    setSite("Amazon US");
    setChannelScope("SP CPC");
    setSelectedTemplateId("");
  };
  const clearAll = () => {
    setSamples([{ ...EMPTY_SAMPLE, id: newSampleId() }]);
    setTarget({ ...DEMO_TARGET, asin: "", adScore: 0, organicScore: 0, cpcProxy: 0, totalOrders: null });
    setSelectedTemplateId("");
  };

  const saveTemplate = () => {
    const id = selectedTemplateId || newSampleId();
    const nextTemplate: SavedAdvertisingTemplate = {
      id,
      name: templateName.trim() || `广告样板 ${savedTemplates.length + 1}`,
      samples: samples.map((sample) => ({ ...sample })),
      target: { ...target },
      site,
      channelScope,
    };
    setSavedTemplates((current) => [...current.filter((item) => item.id !== id), nextTemplate]);
    setSelectedTemplateId(id);
    setTemplateName(nextTemplate.name);
  };

  const loadTemplate = (id: string) => {
    const template = savedTemplates.find((item) => item.id === id);
    if (!template) {
      setSelectedTemplateId("");
      return;
    }
    setSelectedTemplateId(id);
    setTemplateName(template.name);
    setSamples(template.samples.map((sample) => ({ ...sample })));
    setTarget({ ...template.target });
    setSite(template.site);
    setChannelScope(template.channelScope);
  };

  const deleteTemplate = () => {
    if (!selectedTemplateId) return;
    setSavedTemplates((current) => current.filter((item) => item.id !== selectedTemplateId));
    setSelectedTemplateId("");
  };

  const copyResult = async () => {
    const text = [
      "【广告测算】",
      `站点/渠道：${site} / ${channelScope}`,
      `竞品：${target.asin || "未填写"}`,
      `币种：${currency?.code ?? "未指定"}`,
      `估算观察期广告花费：${formatMoney(result.target.estimatedSpend, site)}`,
      `估算日均广告花费：${formatMoney(result.target.estimatedDailySpend, site)}`,
      `估算 CPC：${formatMoney(result.target.estimatedCpc, site)}`,
      `广告归因订单占比：${formatPercent(result.target.adOrderShare)}`,
      `非广告归因订单占比：${formatPercent(result.target.nonAdOrderShare)}`,
      `估算广告订单：${formatNumber(result.target.estimatedAdOrders, 1)}`,
      `估算非广告归因订单：${formatNumber(result.target.estimatedNonAdOrders, 1)}`,
      "结果类型：Modeled_Estimate，不等同于竞品后台真实报表。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="main-content advertising-estimator-main">
      <header className="topbar advertising-estimator-topbar">
        <div>
          <div className="eyebrow">板块十 · COMPETITOR ADVERTISING ESTIMATOR</div>
          <h1>广告测算</h1>
          <p>用授权样本校准西柚得分，估算竞品广告花费、CPC 与广告归因订单比例</p>
        </div>
        <div className="ad-top-actions">
          <button className="rule-link" type="button" onClick={loadDemo}><Calculator size={15} /> 文档示例</button>
          <button className="rule-link" type="button" onClick={clearAll}><RotateCcw size={15} /> 清空输入</button>
        </div>
      </header>

      <div className="advertising-estimator-page">
        <section className="ad-estimator-hero">
          <div>
            <span>CALIBRATED SCENARIO MODEL</span>
            <strong>把西柚信号变成可复核的估算</strong>
            <p>先用真实广告报表校准点击尺度、CPC 尺度和订单倾向，再把竞品 A/O 得分带入。所有金额与比例都保留为模型估算，不冒充后台实测。</p>
          </div>
          <div className="ad-estimator-hero-status">
            <div><span>校准样本</span><b>{samples.length} 个</b></div>
            <div><span>有效样本</span><b>{result.validSampleCount} 个</b></div>
            <div><span>结果状态</span><b><Check size={14} /> {resultStatus}</b></div>
          </div>
        </section>

        <section className="ad-template-bar" aria-label="广告测算样板">
          <div className="ad-template-title"><Bookmark size={16} /><div><strong>我的输入样板</strong><span>保存在当前浏览器，可随时恢复</span></div></div>
          <div className="ad-template-controls">
            <label><span className="sr-only">样板名称</span><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="输入样板名称" /></label>
            <button className="ad-secondary-button" type="button" onClick={saveTemplate}><Save size={15} /> 保存样板</button>
            <label className="ad-template-select"><span className="sr-only">选择已保存样板</span><select value={selectedTemplateId} onChange={(event) => loadTemplate(event.target.value)}><option value="">选择已保存样板</option>{savedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
            <button className="icon-button" type="button" onClick={deleteTemplate} disabled={!selectedTemplateId} title="删除已选样板" aria-label="删除已选样板"><Trash2 size={15} /></button>
          </div>
        </section>

        <div className="ad-estimator-config-grid">
          <section className="ad-panel ad-target-panel">
            <div className="ad-panel-heading">
              <div><span>01</span><div><h2>竞品输入</h2><p>输入西柚同一窗口的得分和 CPC 代理</p></div></div>
              <TrendingUp size={18} />
            </div>
            <div className="ad-form">
              <div className="ad-form-grid two">
                <label className="ad-field"><span>站点</span><select value={site} onChange={(event) => setSite(event.target.value)}><option>Amazon US</option><option>Amazon CA</option><option>Amazon UK</option><option>Amazon DE</option><option>其他站点</option></select></label>
                <label className="ad-field"><span>渠道范围</span><input value={channelScope} onChange={(event) => setChannelScope(event.target.value)} placeholder="例如：SP CPC" /></label>
              </div>
              <label className="ad-field"><span>竞品 ASIN 或备注</span><input value={target.asin} onChange={(event) => updateTarget("asin", event.target.value)} placeholder="例如：B0XXXXXXX" /></label>
              <div className="ad-form-grid two">
                <label className="ad-field"><span>竞品广告得分 A*</span><input type="number" min="0" step="1" value={target.adScore || ""} onChange={(event) => updateTarget("adScore", numericValue(event.target.value))} /><small>西柚广告流量得分</small></label>
                <label className="ad-field"><span>竞品自然得分 O*</span><input type="number" min="0" step="1" value={target.organicScore || ""} onChange={(event) => updateTarget("organicScore", numericValue(event.target.value))} /><small>必须与 A* 同口径</small></label>
              </div>
              <div className="ad-form-grid two">
                <label className="ad-field"><span>竞品 CPC 代理 b*</span><div className="ad-input-prefix"><b>{currency?.symbol ?? "¤"}</b><input type="number" min="0" step="0.01" value={target.cpcProxy || ""} onChange={(event) => updateTarget("cpcProxy", numericValue(event.target.value))} /></div><small>来自同范围关键词篮子</small></label>
                <label className="ad-field"><span>有效观察天数 D</span><input type="number" min="1" step="1" value={target.observationDays || ""} onChange={(event) => updateTarget("observationDays", numericValue(event.target.value))} /><small>用于日均花费，不等于固定月化</small></label>
              </div>
              <label className="ad-field"><span>竞品同口径总订单 Q <em>可选</em></span><input type="number" min="0" step="1" value={target.totalOrders ?? ""} onChange={(event) => updateTarget("totalOrders", event.target.value === "" ? null : numericValue(event.target.value))} placeholder="没有可靠 Q 时留空" /><small>只有 Q 可用且口径匹配，才计算广告单数量</small></label>
            </div>
          </section>

          <section className="ad-panel ad-result-panel" aria-live="polite">
            <div className="ad-panel-heading">
              <div><span>02</span><div><h2>竞品估算结果</h2><p>当前结果基于 {result.validSampleCount} 个有效校准样本</p></div></div>
              <button className="icon-button" type="button" onClick={copyResult} title="复制测算结果" aria-label="复制测算结果">{copied ? <Check size={17} /> : <Clipboard size={17} />}</button>
            </div>
            <div className="ad-result-grid">
              <ResultMetric label="观察期广告花费" value={formatMoney(result.target.estimatedSpend, site)} detail={`${target.observationDays || 0} 天 · Modeled_Estimate`} tone="accent" />
              <ResultMetric label="估算实际 CPC" value={formatMoney(result.target.estimatedCpc, site)} detail="CPC 代理 × m" />
              <ResultMetric label="日均广告花费" value={formatMoney(result.target.estimatedDailySpend, site)} detail="观察期花费 ÷ D" />
              <ResultMetric label="广告归因单占比" value={formatPercent(result.target.adOrderShare)} detail="p̂ad · 不等于流量占比" tone="success" />
            </div>
            <div className="ad-result-detail-grid">
              <div><span>估算广告点击</span><strong>{formatNumber(result.target.estimatedClicks, 1)}</strong></div>
              <div><span>广告流量得分占比</span><strong>{formatPercent(result.target.trafficShare)}</strong></div>
              <div><span>估算广告归因订单</span><strong>{formatNumber(result.target.estimatedAdOrders, 1)}</strong></div>
              <div><span>非广告归因订单</span><strong>{formatNumber(result.target.estimatedNonAdOrders, 1)}</strong></div>
            </div>
            <div className="ad-model-badge"><Info size={14} /><span>这是校准后的情景估算。非广告归因订单是总订单扣除可匹配广告归因订单的残余口径，不等于纯自然搜索订单，也不代表广告增量因果。</span></div>
          </section>
        </div>

        <section className="ad-panel ad-samples-panel">
          <div className="ad-panel-heading ad-samples-heading">
            <div><span>03</span><div><h2>校准样本</h2><p>每行对应一个授权 ASIN 和同一时间/渠道口径的真实广告报表</p></div></div>
            <div className="ad-sample-actions"><button className="ad-secondary-button" type="button" onClick={addSample}><Plus size={15} /> 增加样本</button><button className="ad-secondary-button" type="button" onClick={() => setSamples([])}><Trash2 size={15} /> 清空样本</button></div>
          </div>
          <div className="ad-table-wrap">
            <table className="ad-sample-table">
              <thead><tr><th>样本</th><th>广告得分 A</th><th>自然得分 O</th><th>真实广告点击 C</th><th>真实花费 S</th><th>CPC 代理 b</th><th>总订单 Q</th><th>广告归因订单</th><th>操作</th></tr></thead>
              <tbody>
                {samples.length === 0 ? <tr><td colSpan={9} className="ad-empty-row">暂无校准样本，请增加样本或载入文档示例。</td></tr> : samples.map((sample) => <tr key={sample.id}>
                  <td><input className="ad-sample-name" value={sample.name} onChange={(event) => updateSample(sample.id, "name", event.target.value)} /></td>
                  <td><input type="number" min="0" step="1" value={sample.adScore || ""} onChange={(event) => updateSample(sample.id, "adScore", numericValue(event.target.value))} /></td>
                  <td><input type="number" min="0" step="1" value={sample.organicScore || ""} onChange={(event) => updateSample(sample.id, "organicScore", numericValue(event.target.value))} /></td>
                  <td><input type="number" min="0" step="1" value={sample.adClicks || ""} onChange={(event) => updateSample(sample.id, "adClicks", numericValue(event.target.value))} /></td>
                  <td><div className="ad-table-money"><b>{currency?.symbol ?? "¤"}</b><input type="number" min="0" step="0.01" value={sample.adSpend || ""} onChange={(event) => updateSample(sample.id, "adSpend", numericValue(event.target.value))} /></div></td>
                  <td><div className="ad-table-money"><b>{currency?.symbol ?? "¤"}</b><input type="number" min="0" step="0.01" value={sample.cpcProxy || ""} onChange={(event) => updateSample(sample.id, "cpcProxy", numericValue(event.target.value))} /></div></td>
                  <td><input type="number" min="0" step="1" value={sample.totalOrders || ""} onChange={(event) => updateSample(sample.id, "totalOrders", numericValue(event.target.value))} /></td>
                  <td><input type="number" min="0" step="1" value={sample.adOrders || ""} onChange={(event) => updateSample(sample.id, "adOrders", numericValue(event.target.value))} /></td>
                  <td><button className="icon-button" type="button" onClick={() => removeSample(sample.id)} title="删除样本" aria-label={`删除${sample.name}`}><Trash2 size={15} /></button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="ad-sample-note"><Scale size={14} /><span>样本的 A/O 必须与竞品输入同站点、同类目、同生命周期和同窗口口径。真实 CPC = S ÷ C；订单倾向只使用 0 &lt; 广告归因订单占比 &lt; 1 的边界内样本。</span></div>
        </section>

        <div className="ad-bottom-grid">
          <section className="ad-panel ad-calibration-panel">
            <div className="ad-panel-heading"><div><span>04</span><div><h2>校准系数</h2><p>中位数用于降低极端样本影响</p></div></div><BarChart3 size={18} /></div>
            <div className="ad-coefficient-list">
              <div><span>点击尺度 k</span><strong>{formatNumber(result.scales.clickScale, 4)}</strong><small>median(C ÷ A) · {result.observations.clickScale.length} 行</small></div>
              <div><span>CPC 尺度 m</span><strong>{formatNumber(result.scales.cpcScale, 4)}</strong><small>median((S ÷ C) ÷ b) · {result.observations.cpcScale.length} 行</small></div>
              <div><span>订单倾向 λ</span><strong>{formatNumber(result.scales.orderTendency, 4)}</strong><small>median(广告赔率 ÷ A/O) · {result.observations.orderTendency.length} 行</small></div>
            </div>
            <div className="ad-formula-list">
              <p><b>点击：</b> Ĉ* = k × A*</p>
              <p><b>花费：</b> ŜT = Ĉ* × ĉ*，日均 = ŜT ÷ D</p>
              <p><b>订单：</b> p̂ad = λA* ÷ (λA* + O*)</p>
            </div>
          </section>

          <section className="ad-panel ad-warning-panel">
            <div className="ad-panel-heading"><div><span>05</span><div><h2>口径与风险提示</h2><p>模型输出前的边界检查</p></div></div><AlertTriangle size={18} /></div>
            <div className="ad-warning-list">{result.warnings.map((warning, index) => <p key={`${warning}-${index}`}><Info size={14} />{warning}</p>)}</div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default AdvertisingEstimator;
