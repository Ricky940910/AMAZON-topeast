export interface CalibrationSample {
  id: string;
  name: string;
  adScore: number;
  organicScore: number;
  adClicks: number;
  adSpend: number;
  cpcProxy: number;
  totalOrders: number;
  adOrders: number;
}

export interface AdvertisingTarget {
  asin: string;
  adScore: number;
  organicScore: number;
  cpcProxy: number;
  totalOrders: number | null;
  observationDays: number;
}

export interface RatioObservation {
  sampleId: string;
  sampleName: string;
  value: number;
}

export interface AdvertisingEstimate {
  scales: {
    clickScale: number | null;
    cpcScale: number | null;
    orderTendency: number | null;
  };
  observations: {
    clickScale: RatioObservation[];
    cpcScale: RatioObservation[];
    orderTendency: RatioObservation[];
  };
  target: {
    trafficShare: number | null;
    estimatedClicks: number | null;
    estimatedCpc: number | null;
    estimatedSpend: number | null;
    estimatedDailySpend: number | null;
    adOrderShare: number | null;
    nonAdOrderShare: number | null;
    estimatedAdOrders: number | null;
    estimatedNonAdOrders: number | null;
  };
  validSampleCount: number;
  warnings: string[];
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function observation(sample: CalibrationSample, value: number): RatioObservation {
  return { sampleId: sample.id, sampleName: sample.name, value };
}

export function calculateAdvertisingEstimate(
  samples: CalibrationSample[],
  target: AdvertisingTarget,
): AdvertisingEstimate {
  const clickObservations = samples
    .filter((sample) => finite(sample.adScore) && sample.adScore > 0 && finite(sample.adClicks) && sample.adClicks > 0)
    .map((sample) => observation(sample, sample.adClicks / sample.adScore));

  const cpcObservations = samples
    .filter((sample) => finite(sample.adClicks) && sample.adClicks > 0 && finite(sample.adSpend) && sample.adSpend > 0 && finite(sample.cpcProxy) && sample.cpcProxy > 0)
    .map((sample) => observation(sample, (sample.adSpend / sample.adClicks) / sample.cpcProxy));

  const orderObservations = samples
    .filter((sample) => (
      finite(sample.adScore) && sample.adScore > 0
      && finite(sample.organicScore) && sample.organicScore > 0
      && finite(sample.totalOrders) && sample.totalOrders > 0
      && finite(sample.adOrders) && sample.adOrders > 0
      && sample.adOrders < sample.totalOrders
    ))
    .map((sample) => {
      const adOrderShare = sample.adOrders / sample.totalOrders;
      return observation(sample, (adOrderShare / (1 - adOrderShare)) / (sample.adScore / sample.organicScore));
    });

  const clickScale = median(clickObservations.map((item) => item.value));
  const cpcScale = median(cpcObservations.map((item) => item.value));
  const orderTendency = median(orderObservations.map((item) => item.value));

  const targetHasPositiveTraffic = finite(target.adScore) && target.adScore > 0
    && finite(target.organicScore) && target.organicScore > 0;
  const targetScoreTotal = target.adScore + target.organicScore;
  const trafficShare = targetHasPositiveTraffic
    ? target.adScore / targetScoreTotal
    : null;
  const estimatedClicks = clickScale !== null && finite(target.adScore) && target.adScore > 0
    ? clickScale * target.adScore
    : null;
  const estimatedCpc = cpcScale !== null && finite(target.cpcProxy) && target.cpcProxy > 0
    ? cpcScale * target.cpcProxy
    : null;
  const estimatedSpend = estimatedClicks !== null && estimatedCpc !== null
    ? estimatedClicks * estimatedCpc
    : null;
  const estimatedDailySpend = estimatedSpend !== null && finite(target.observationDays) && target.observationDays > 0
    ? estimatedSpend / target.observationDays
    : null;

  const orderDenominator = orderTendency !== null && targetHasPositiveTraffic
    ? orderTendency * target.adScore + target.organicScore
    : null;
  const adOrderShare = orderTendency !== null && targetHasPositiveTraffic && orderDenominator !== null && orderDenominator > 0
    ? (orderTendency * target.adScore) / orderDenominator
    : null;
  const nonAdOrderShare = adOrderShare !== null ? 1 - adOrderShare : null;
  const estimatedAdOrders = adOrderShare !== null && target.totalOrders !== null && finite(target.totalOrders) && target.totalOrders > 0
    ? target.totalOrders * adOrderShare
    : null;
  const estimatedNonAdOrders = nonAdOrderShare !== null && target.totalOrders !== null && finite(target.totalOrders) && target.totalOrders > 0
    ? target.totalOrders * nonAdOrderShare
    : null;

  const warnings: string[] = [];
  if (samples.length < 5) warnings.push("当前校准样本少于 5 个，建议积累 5–10 个同类 ASIN，并覆盖多个完整窗口后再用于决策。");
  if (clickObservations.length === 0) warnings.push("没有有效的点击尺度样本：需要广告得分 A > 0，并提供真实广告点击 C。");
  if (cpcObservations.length === 0) warnings.push("没有有效的 CPC 校准样本：需要真实点击、真实花费和大于 0 的 CPC 代理。");
  if (orderObservations.length === 0) warnings.push("没有有效的订单倾向样本：订单比例模型要求 0 < 广告归因占比 < 1，且 A、O 均大于 0。");
  const invalidOrderSamples = samples.filter((sample) => (
    finite(sample.totalOrders) && finite(sample.adOrders)
    && (sample.totalOrders < 0 || sample.adOrders < 0 || sample.adOrders > sample.totalOrders)
  ));
  if (invalidOrderSamples.length > 0) warnings.push(`有 ${invalidOrderSamples.length} 个样本的订单字段无效，已排除订单倾向校准。`);
  if (!finite(target.adScore) || !finite(target.organicScore) || target.adScore < 0 || target.organicScore < 0) warnings.push("竞品广告得分和自然得分必须是非负数。");
  if (!targetHasPositiveTraffic) warnings.push("竞品 A 与 O 都必须大于 0，才能计算流量得分占比或订单比例；得分为 0 不等于确认没有投放。");
  if (!target.observationDays || target.observationDays <= 0) warnings.push("观察天数必须大于 0，才能计算日均广告花费。");
  if (target.totalOrders === null) warnings.push("未输入竞品总订单，只输出广告归因订单占比，不输出广告单和非广告单数量。");
  if (target.totalOrders !== null && (!finite(target.totalOrders) || target.totalOrders < 0)) warnings.push("竞品总订单不能为负数或非有限数。");
  if (target.totalOrders === 0) warnings.push("竞品总订单为 0，按方法边界不把它当作可靠 Q，因此不输出估算订单数量。");
  warnings.push("广告花费、CPC 和订单比例均为 Modeled_Estimate；西柚得分不是点击、曝光或后台真实花费。");
  warnings.push("结果只覆盖你在模型中输入的渠道和观察窗口；未观测的商品定向、SD 或跨商品 SB 支出不会被默认为 0。");

  return {
    scales: { clickScale, cpcScale, orderTendency },
    observations: {
      clickScale: clickObservations,
      cpcScale: cpcObservations,
      orderTendency: orderObservations,
    },
    target: {
      trafficShare,
      estimatedClicks,
      estimatedCpc,
      estimatedSpend,
      estimatedDailySpend,
      adOrderShare,
      nonAdOrderShare,
      estimatedAdOrders,
      estimatedNonAdOrders,
    },
    validSampleCount: new Set([
      ...clickObservations.map((item) => item.sampleId),
      ...cpcObservations.map((item) => item.sampleId),
      ...orderObservations.map((item) => item.sampleId),
    ]).size,
    warnings,
  };
}
