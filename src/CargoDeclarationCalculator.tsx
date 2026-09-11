import { useMemo, useState } from "react";
import { Box, Check, ClipboardCopy, Info, PackageCheck, RotateCcw, Ruler, Ship, Sparkles } from "lucide-react";
import NumberInput from "./NumberInput";
import { numberInputValue } from "./lib/input";
import {
  calculateCargoDeclaration,
  formatCargoDimension,
  type CargoDeclarationInput,
  type CargoDimensionUnit,
} from "./lib/cargoDeclaration";

const DEFAULT_INPUT: CargoDeclarationInput = {
  boxLength: 0,
  boxWidth: 0,
  boxHeight: 0,
  dimensionUnit: "cm",
  unitsPerCarton: 0,
  declarationBase: 0,
};

function positiveNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function CargoDeclarationCalculator() {
  const [input, setInput] = useState<CargoDeclarationInput>(DEFAULT_INPUT);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => calculateCargoDeclaration(input), [input]);

  const updateNumber = (key: "boxLength" | "boxWidth" | "boxHeight" | "unitsPerCarton" | "declarationBase", value: string) => {
    setInput((current) => ({ ...current, [key]: positiveNumber(value) }));
  };

  const reset = () => setInput(DEFAULT_INPUT);

  const copyResult = async () => {
    const best = result.bestOrientation;
    const text = [
      "【货物申报金额】",
      `纸箱尺寸：${input.boxLength} × ${input.boxWidth} × ${input.boxHeight} ${input.dimensionUnit}`,
      `每箱产品数量：${input.unitsPerCarton} 件`,
      `40HQ 装箱数：${result.cartonsPerContainer} 箱`,
      `摆放方式：${best?.placementLabel ?? "未计算"}`,
      `柜装产品数量：${result.productsPerContainer} 件`,
      `申报基数：${result.declarationBase > 0 ? formatNumber(result.declarationBase) : "未填写"}`,
      `单个产品申报金额：${result.declarationPerProduct > 0 ? formatNumber(result.declarationPerProduct) : "未计算"}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const dimensionField = (label: string, key: "boxLength" | "boxWidth" | "boxHeight") => (
    <label className="cargo-field">
      <span>{label}</span>
      <NumberInput
        min="0"
        step="0.01"
        value={input[key]}
        placeholder="请输入"
        onRawChange={(value) => updateNumber(key, value)}
      />
    </label>
  );

  return (
    <main className="main-content cargo-main">
      <header className="topbar cargo-topbar">
        <div>
          <div className="eyebrow">板块七 · CARGO DECLARATION</div>
          <h1>货物申报金额</h1>
          <p>40HQ 装箱排布、柜装数量与单件申报金额测算</p>
        </div>
        <div className="cargo-top-actions">
          <button className="rule-link" type="button" onClick={copyResult}><ClipboardCopy size={15} /> {copied ? "已复制" : "复制结果"}</button>
          <button className="rule-link" type="button" onClick={reset} title="清空数据"><RotateCcw size={15} /> 清空</button>
        </div>
      </header>

      <div className="cargo-page">
        <section className="cargo-hero">
          <div className="cargo-hero-title">
            <span>单个产品申报金额</span>
            <strong>{result.declarationPerProduct > 0 ? formatNumber(result.declarationPerProduct) : "—"}</strong>
            <p>按手动填写的整柜申报基数 ÷ 40HQ 柜装产品数量计算</p>
          </div>
          <div className="cargo-hero-stats">
            <div><small>40HQ 装箱数</small><b>{formatNumber(result.cartonsPerContainer, 0)} 箱</b></div>
            <div><small>每箱产品数量</small><b>{formatNumber(Math.floor(input.unitsPerCarton), 0)} 件</b></div>
            <div><small>柜装产品数量</small><b>{formatNumber(result.productsPerContainer, 0)} 件</b></div>
            <div><small>申报基数</small><b>{result.declarationBase > 0 ? formatNumber(result.declarationBase, 2) : "—"}</b></div>
          </div>
          <div className="cargo-hero-icon"><Ship size={58} strokeWidth={1.35} /><Box size={27} strokeWidth={1.4} /></div>
        </section>

        <div className="cargo-workspace">
          <section className="cargo-input-panel">
            <div className="cargo-section-heading"><PackageCheck size={18} /><div><h2>装箱数据</h2><p>输入外箱尺寸和每箱产品数量</p></div></div>
            <div className="cargo-form">
              <div className="cargo-subtitle"><Ruler size={15} /> 外箱尺寸</div>
              <div className="cargo-dimension-grid">{dimensionField("长", "boxLength")}{dimensionField("宽", "boxWidth")}{dimensionField("高", "boxHeight")}</div>
              <label className="cargo-field"><span>尺寸单位</span><select value={input.dimensionUnit} onChange={(event) => setInput((current) => ({ ...current, dimensionUnit: event.target.value as CargoDimensionUnit }))}><option value="cm">cm</option><option value="in">inch</option></select></label>
              <label className="cargo-field"><span>每箱装产品数量</span><NumberInput min="0" step="1" value={input.unitsPerCarton} placeholder="请输入" onRawChange={(value) => updateNumber("unitsPerCarton", value)} /></label>
              <label className="cargo-field"><span>整柜申报基数</span><NumberInput min="0" step="0.01" value={input.declarationBase} placeholder="请输入" onRawChange={(value) => updateNumber("declarationBase", value)} /></label>
            </div>
            <div className="cargo-reference"><Info size={15} /><div><b>40HQ 标准内尺寸参考</b><span>1203 × 235 × 269 cm · 约 47.36 × 92.52 × 105.91 inch</span></div></div>
          </section>

          <section className="cargo-results">
            <article className="cargo-card">
              <div className="cargo-card-heading"><div><span>01</span><div><h2>40HQ 装箱结果</h2><p>自动比较箱体六种旋转方向，取整齐排布的最大装箱数</p></div></div><Check size={17} /></div>
              <div className="cargo-result-grid">
                <div><small>40HQ 可装箱数</small><strong>{formatNumber(result.cartonsPerContainer, 0)}<em> 箱</em></strong></div>
                <div><small>柜装产品数量</small><strong>{formatNumber(result.productsPerContainer, 0)}<em> 件</em></strong></div>
                <div><small>每箱产品数量</small><strong>{formatNumber(Math.floor(input.unitsPerCarton), 0)}<em> 件</em></strong></div>
              </div>
              <div className="cargo-placement"><span>推荐摆放方式</span><b>{result.bestOrientation?.placementLabel ?? "填写完整箱规后自动生成"}</b>{result.bestOrientation && <small>柜长方向 {result.bestOrientation.axisCounts[0]} 箱 × 柜宽方向 {result.bestOrientation.axisCounts[1]} 箱 × 柜高方向 {result.bestOrientation.axisCounts[2]} 箱</small>}</div>
              {result.bestOrientation && <div className="cargo-formula">{formatCargoDimension(result.bestOrientation.boxDimensionsCm[0])} cm × {formatCargoDimension(result.bestOrientation.boxDimensionsCm[1])} cm × {formatCargoDimension(result.bestOrientation.boxDimensionsCm[2])} cm 排布：{result.bestOrientation.axisCounts.join(" × ")} = {result.bestOrientation.cartons} 箱</div>}
            </article>

            <article className="cargo-card">
              <div className="cargo-card-heading"><div><span>02</span><div><h2>单个产品申报金额</h2><p>整柜申报基数由你手动填写，避免固定业务口径限制</p></div></div><Sparkles size={17} /></div>
              <div className="cargo-declaration-flow"><div><small>整柜申报基数</small><strong>{result.declarationBase > 0 ? formatNumber(result.declarationBase) : "—"}</strong></div><b>÷</b><div><small>柜装产品数量</small><strong>{formatNumber(result.productsPerContainer, 0)} 件</strong></div><b>=</b><div className="cargo-declaration-total"><small>单个产品申报金额</small><strong>{result.declarationPerProduct > 0 ? formatNumber(result.declarationPerProduct) : "—"}</strong></div></div>
              <p className="cargo-note">计算公式：整柜申报基数 ÷（40HQ 装箱数 × 每箱装产品数量）</p>
            </article>

            <article className="cargo-card cargo-orientation-card">
              <div className="cargo-card-heading"><div><span>03</span><div><h2>摆放方式对比</h2><p>仅列出可放入 40HQ 的整齐排列方案</p></div></div><Box size={17} /></div>
              {result.allOrientations.length > 0 ? <div className="cargo-orientation-table"><div className="cargo-orientation-head"><span>摆放方式</span><span>方向数量</span><span>装箱数</span></div>{result.allOrientations.map((orientation) => <div className={`cargo-orientation-row ${orientation === result.bestOrientation ? "best" : ""}`} key={`${orientation.lengthIndex}-${orientation.widthIndex}-${orientation.heightIndex}`}><span>{orientation.placementLabel}</span><span>{orientation.axisCounts.join(" × ")}</span><b>{formatNumber(orientation.cartons, 0)} 箱</b></div>)}</div> : <div className="cargo-empty"><Box size={20} /> 填写箱长、箱宽、箱高后自动比较摆放方式。</div>}
            </article>

            <div className="cargo-warnings">{result.warnings.map((warning) => <p key={warning}><Info size={14} />{warning}</p>)}</div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default CargoDeclarationCalculator;
