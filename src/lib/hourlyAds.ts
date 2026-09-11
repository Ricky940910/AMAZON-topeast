export type RawCell = string | number | boolean | Date | null | undefined;
export type RawRecord = Record<string, RawCell>;

export type HourlyReportType =
  | "marketing-stream"
  | "sponsored-products"
  | "sponsored-brands"
  | "sponsored-display"
  | "business-report"
  | "unknown";

export type DataGranularity = "hourly" | "daily" | "unknown";
export type ReportTimeZone = "account" | string;

export type StandardField =
  | "date"
  | "hour"
  | "eventTime"
  | "campaignName"
  | "campaignId"
  | "portfolio"
  | "asin"
  | "sku"
  | "impressions"
  | "clicks"
  | "spend"
  | "orders"
  | "sales";

export interface FieldMapping {
  date: string | null;
  hour: string | null;
  eventTime: string | null;
  campaignName: string | null;
  campaignId: string | null;
  portfolio: string | null;
  asin: string | null;
  sku: string | null;
  impressions: string | null;
  clicks: string | null;
  spend: string | null;
  orders: string | null;
  sales: string | null;
}

export interface NormalizedAdRow {
  sourceRow: number;
  date: string;
  dayOfWeek: string;
  hour: number | null;
  campaignName: string;
  campaignId: string;
  portfolio: string;
  asin: string;
  sku: string;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  sales: number;
}

export interface ParsedReportData {
  reportType: HourlyReportType;
  granularity: DataGranularity;
  timeZone: ReportTimeZone;
  headers: string[];
  mapping: FieldMapping;
  missingFields: StandardField[];
  rows: NormalizedAdRow[];
  validRowCount: number;
  hourlyRowCount: number;
  invalidRowCount: number;
  dateFrom: string;
  dateTo: string;
  warnings: string[];
  rawRows: RawRecord[];
}

export const STANDARD_FIELD_LABELS: Record<StandardField, string> = {
  date: "日期",
  hour: "小时",
  eventTime: "时间戳",
  campaignName: "Campaign 名称",
  campaignId: "Campaign ID",
  portfolio: "Portfolio",
  asin: "ASIN",
  sku: "SKU",
  impressions: "Impressions / 曝光量",
  clicks: "Clicks / 点击量",
  spend: "Spend / 广告花费",
  orders: "Orders / 订单量",
  sales: "Sales / 广告销售额",
};

const FIELD_ALIASES: Record<StandardField, string[]> = {
  date: ["date", "日期", "report date", "统计日期", "report day", "day"],
  hour: ["hour", "小时", "hour of day", "time hour", "hourly"],
  eventTime: ["event time", "eventtime", "timestamp", "datetime", "date time", "日期时间", "time"],
  campaignName: ["campaign name", "campaign", "广告活动名称", "广告活动", "活动名称"],
  campaignId: ["campaign id", "campaignid", "广告活动id", "活动id"],
  portfolio: ["portfolio", "portfolio name", "组合", "投资组合"],
  asin: ["asin", "advertised asin", "广告asin", "商品asin"],
  sku: ["sku", "advertised sku", "广告sku", "商品sku"],
  impressions: ["impressions", "曝光量", "展示量", "impression"],
  clicks: ["clicks", "点击量", "click"],
  spend: ["spend", "cost", "广告花费", "花费", "支出", "ad spend", "ad cost"],
  orders: ["7 day total orders", "7-day total orders", "orders", "orders (#)", "广告订单", "订单量", "units ordered"],
  sales: ["7 day total sales", "7-day total sales", "sales", "sales ($)", "广告销售额", "销售额", "ordered product sales"],
};

const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-()[\]{}#$%/:]+/g, "");
}

function isBlank(value: RawCell): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function pickHeader(headers: string[], aliases: string[]): string | null {
  const normalizedHeaders = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const exactIndex = normalizedHeaders.indexOf(normalizedAlias);
    if (exactIndex >= 0) return headers[exactIndex];
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (normalizedAlias.length < 4) continue;
    const partialIndex = normalizedHeaders.findIndex((header) => header.includes(normalizedAlias));
    if (partialIndex >= 0) return headers[partialIndex];
  }

  return null;
}

export function collectHeaders(rows: RawRecord[]): string[] {
  const headers: string[] = [];
  const seen = new Set<string>();
  rows.slice(0, 50).forEach((row) => {
    Object.keys(row).forEach((header) => {
      if (!seen.has(header)) {
        seen.add(header);
        headers.push(header);
      }
    });
  });
  return headers;
}

export function detectFieldMapping(headers: string[]): FieldMapping {
  return {
    date: pickHeader(headers, FIELD_ALIASES.date),
    hour: pickHeader(headers, FIELD_ALIASES.hour),
    eventTime: pickHeader(headers, FIELD_ALIASES.eventTime),
    campaignName: pickHeader(headers, FIELD_ALIASES.campaignName),
    campaignId: pickHeader(headers, FIELD_ALIASES.campaignId),
    portfolio: pickHeader(headers, FIELD_ALIASES.portfolio),
    asin: pickHeader(headers, FIELD_ALIASES.asin),
    sku: pickHeader(headers, FIELD_ALIASES.sku),
    impressions: pickHeader(headers, FIELD_ALIASES.impressions),
    clicks: pickHeader(headers, FIELD_ALIASES.clicks),
    spend: pickHeader(headers, FIELD_ALIASES.spend),
    orders: pickHeader(headers, FIELD_ALIASES.orders),
    sales: pickHeader(headers, FIELD_ALIASES.sales),
  };
}

function numberValue(value: RawCell): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (isBlank(value)) return 0;

  const text = String(value).trim();
  const negative = text.startsWith("(") && text.endsWith(")");
  const cleaned = text.replace(/[,$€£¥￥%\s]/g, "").replace(/[()]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function validDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function formatDateTimeInZone(date: Date, timeZone: string): { date: string; inlineHour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    if (!values.year || !values.month || !values.day || values.hour === undefined) return null;
    return { date: `${values.year}-${values.month}-${values.day}`, inlineHour: Number(values.hour) };
  } catch {
    return null;
  }
}

function hasExplicitTimeZone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

function parseDate(value: RawCell, timeZone: ReportTimeZone = "account"): { date: string; inlineHour: number | null } {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (timeZone !== "account") {
      const converted = formatDateTimeInZone(value, timeZone);
      if (converted) return converted;
    }
    return {
      date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
      inlineHour: value.getHours(),
    };
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 20000 && value < 80000) {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return {
      date: `${excelDate.getUTCFullYear()}-${pad(excelDate.getUTCMonth() + 1)}-${pad(excelDate.getUTCDate())}`,
      inlineHour: value % 1 ? Math.floor((value % 1) * 24) : null,
    };
  }

  const text = String(value ?? "").trim();
  if (!text) return { date: "", inlineHour: null };

  const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    if (timeZone !== "account" && hasExplicitTimeZone(text)) {
      const converted = formatDateTimeInZone(new Date(text), timeZone);
      if (converted) return converted;
    }
    return { date: validDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])) ?? "", inlineHour: parseHour(text) };
  }

  const usMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (usMatch) {
    return { date: validDate(Number(usMatch[3]), Number(usMatch[1]), Number(usMatch[2])) ?? "", inlineHour: parseHour(text) };
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      inlineHour: date.getHours(),
    };
  }

  return { date: "", inlineHour: null };
}

function parseHour(value: RawCell): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const hour = Math.floor(value);
    return hour >= 0 && hour <= 23 ? hour : null;
  }

  const text = String(value ?? "").trim();
  if (!text) return null;
  const timeMatch = text.match(/(?:T|\s)(\d{1,2})(?::\d{2})?\s*(AM|PM)?/i)
    ?? text.match(/^(\d{1,2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!timeMatch) return null;
  let hour = Number(timeMatch[1]);
  const meridiem = timeMatch[2]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour >= 0 && hour <= 23 ? hour : null;
}

function parseDateAndHour(dateValue: RawCell, hourValue: RawCell, eventTimeValue: RawCell, timeZone: ReportTimeZone): { date: string; hour: number | null } {
  const eventTime = !isBlank(eventTimeValue) ? parseDate(eventTimeValue, timeZone) : { date: "", inlineHour: null };
  const dateSource = !isBlank(dateValue) ? parseDate(dateValue, timeZone) : eventTime;
  const explicitHour = parseHour(hourValue);
  return {
    date: dateSource.date,
    hour: explicitHour ?? dateSource.inlineHour ?? eventTime.inlineHour,
  };
}

function stringValue(value: RawCell): string {
  return isBlank(value) ? "" : String(value).trim();
}

function getValue(row: RawRecord, header: string | null): RawCell {
  return header ? row[header] : undefined;
}

function dayOfWeek(date: string): string {
  if (!date) return "";
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(value.getTime()) ? "" : DAY_LABELS[value.getUTCDay()];
}

export function detectReportType(fileName: string, headers: string[]): HourlyReportType {
  const text = `${fileName} ${headers.join(" ")}`.toLowerCase();
  if (text.includes("marketing stream") || text.includes("event time") || text.includes("eventtime") || text.includes("timestamp")) return "marketing-stream";
  if (text.includes("sponsored brands") || text.includes("sb campaign") || text.includes("sb ")) return "sponsored-brands";
  if (text.includes("sponsored display") || text.includes("sd campaign") || text.includes("sd ")) return "sponsored-display";
  if (text.includes("business report") || text.includes("detail page sales") || text.includes("sessions")) return "business-report";
  if (text.includes("sponsored products") || text.includes("sp campaign") || text.includes("search term") || text.includes("placement")) return "sponsored-products";
  return "unknown";
}

function missingFields(mapping: FieldMapping): StandardField[] {
  const missing: StandardField[] = [];
  if (!mapping.date && !mapping.eventTime) missing.push("date");
  if (!mapping.hour && !mapping.eventTime) missing.push("hour");
  if (!mapping.impressions) missing.push("impressions");
  if (!mapping.clicks) missing.push("clicks");
  if (!mapping.spend) missing.push("spend");
  if (!mapping.orders) missing.push("orders");
  if (!mapping.sales) missing.push("sales");
  return missing;
}

export function normalizeReportRows(rawRows: RawRecord[], mapping: FieldMapping, timeZone: ReportTimeZone = "account"): NormalizedAdRow[] {
  return rawRows.map((row, index) => {
    const parsedDate = parseDateAndHour(getValue(row, mapping.date), getValue(row, mapping.hour), getValue(row, mapping.eventTime), timeZone);
    return {
      sourceRow: index + 2,
      date: parsedDate.date,
      dayOfWeek: dayOfWeek(parsedDate.date),
      hour: parsedDate.hour,
      campaignName: stringValue(getValue(row, mapping.campaignName)),
      campaignId: stringValue(getValue(row, mapping.campaignId)),
      portfolio: stringValue(getValue(row, mapping.portfolio)),
      asin: stringValue(getValue(row, mapping.asin)),
      sku: stringValue(getValue(row, mapping.sku)),
      impressions: numberValue(getValue(row, mapping.impressions)),
      clicks: numberValue(getValue(row, mapping.clicks)),
      spend: numberValue(getValue(row, mapping.spend)),
      orders: numberValue(getValue(row, mapping.orders)),
      sales: numberValue(getValue(row, mapping.sales)),
    };
  });
}

function isCoreRowValid(row: NormalizedAdRow): boolean {
  return Boolean(row.date)
    && [row.impressions, row.clicks, row.spend, row.orders, row.sales].every((value) => Number.isFinite(value));
}

function isHourlyRowValid(row: NormalizedAdRow): boolean {
  return isCoreRowValid(row) && row.hour !== null;
}

export function inspectReport(fileName: string, rawRows: RawRecord[], timeZone: ReportTimeZone = "account"): ParsedReportData {
  const headers = collectHeaders(rawRows);
  const mapping = detectFieldMapping(headers);
  const rows = normalizeReportRows(rawRows, mapping, timeZone);
  const missing = missingFields(mapping);
  const validRows = rows.filter(isCoreRowValid);
  const hourlyRows = rows.filter(isHourlyRowValid);
  const hasInlineHour = rows.some((row) => row.hour !== null);
  const granularity: DataGranularity = hasInlineHour ? "hourly" : missing.includes("hour") ? "daily" : "unknown";
  const dates = validRows.map((row) => row.date).filter(Boolean).sort();
  const warnings: string[] = [];

  if (granularity === "daily") warnings.push("当前文件未识别到小时字段，仅支持日级补充分析。需要 Marketing Stream 或含时间戳的小时数据才能进行分时分析。");
  if (missing.length > 0) warnings.push(`缺少关键字段：${missing.map((field) => STANDARD_FIELD_LABELS[field]).join("、")}`);
  if (rawRows.length > 0 && validRows.length === 0) warnings.push("没有识别到可用数据行，请检查表头、日期格式和数值列。");
  if (validRows.length > 0 && hourlyRows.length < validRows.length) warnings.push(`有 ${validRows.length - hourlyRows.length} 行缺少有效小时，分析时将跳过这些行。`);

  return {
    reportType: detectReportType(fileName, headers),
    granularity,
    timeZone,
    headers,
    mapping,
    missingFields: missing,
    rows,
    validRowCount: validRows.length,
    hourlyRowCount: hourlyRows.length,
    invalidRowCount: rawRows.length - validRows.length,
    dateFrom: dates[0] ?? "",
    dateTo: dates[dates.length - 1] ?? "",
    warnings,
    rawRows,
  };
}

export function reportTypeLabel(type: HourlyReportType): string {
  const labels: Record<HourlyReportType, string> = {
    "marketing-stream": "Marketing Stream / 小时数据",
    "sponsored-products": "Sponsored Products",
    "sponsored-brands": "Sponsored Brands",
    "sponsored-display": "Sponsored Display",
    "business-report": "Business Report",
    unknown: "未识别报表",
  };
  return labels[type];
}

export function granularityLabel(granularity: DataGranularity): string {
  return granularity === "hourly" ? "小时级" : granularity === "daily" ? "日级" : "待确认";
}
