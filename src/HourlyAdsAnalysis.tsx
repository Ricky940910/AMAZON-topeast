import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type InputHTMLAttributes } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  CloudDownload,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Link2,
  ListChecks,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  granularityLabel,
  inspectReport,
  reportTypeLabel,
  type ParsedReportData,
  type RawRecord,
} from "./lib/hourlyAds";

type UploadStatus = "ready" | "warning" | "error";

interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  relativePath: string;
  report: ParsedReportData | null;
  status: UploadStatus;
  error: string;
}

interface SiteConfig {
  currency: string;
  label: string;
  timeZone: string;
}

const SITE_CONFIG: Record<string, SiteConfig> = {
  US: { currency: "USD", label: "美国站", timeZone: "America/Los_Angeles" },
  CA: { currency: "CAD", label: "加拿大站", timeZone: "America/Toronto" },
  MX: { currency: "MXN", label: "墨西哥站", timeZone: "America/Mexico_City" },
  UK: { currency: "GBP", label: "英国站", timeZone: "Europe/London" },
  DE: { currency: "EUR", label: "德国站", timeZone: "Europe/Berlin" },
  FR: { currency: "EUR", label: "法国站", timeZone: "Europe/Paris" },
  IT: { currency: "EUR", label: "意大利站", timeZone: "Europe/Rome" },
  ES: { currency: "EUR", label: "西班牙站", timeZone: "Europe/Madrid" },
  JP: { currency: "JPY", label: "日本站", timeZone: "Asia/Tokyo" },
  AU: { currency: "AUD", label: "澳洲站", timeZone: "Australia/Sydney" },
  IN: { currency: "INR", label: "印度站", timeZone: "Asia/Kolkata" },
};

const REPORT_SOURCES = [
  {
    id: "marketing-stream",
    badge: "分时核心",
    title: "Amazon Marketing Stream",
    granularity: "小时级",
    required: true,
    path: "Amazon Ads API / Marketing Stream",
    description: "用于真正的小时花费、点击、订单和销售额分析。它不是 Seller Central 普通广告报表，需要通过 Amazon Ads API 获取或导出后上传。",
    link: "https://advertising.amazon.com/API/docs/en-us/marketing-stream",
    linkLabel: "查看 Marketing Stream 官方文档",
  },
  {
    id: "sp-campaign",
    badge: "日级补充",
    title: "Sponsored Products Campaign Report",
    granularity: "通常日级",
    required: false,
    path: "Seller Central → 广告 → 广告活动管理 → 衡量与报告 → Sponsored ads reports → Sponsored Products → Campaign",
    description: "用于活动层级的日级花费、销售额、订单、点击和预算复核。普通下载报表没有小时字段，不作为小时数据替代品。",
    link: "https://advertising.amazon.com/API/docs/en-us/reporting/3-0/openapi",
    linkLabel: "查看 Reporting API 官方文档",
  },
  {
    id: "sp-search-term",
    badge: "日级补充",
    title: "Sponsored Products Search Term Report",
    granularity: "通常日级",
    required: false,
    path: "Seller Central → 广告 → 广告活动管理 → 衡量与报告 → Sponsored ads reports → Sponsored Products → Search term",
    description: "用于定位搜索词、Targeting、广告组和 SKU 的消耗与转化来源，辅助解释某个时段的流量质量。",
    link: "https://advertising.amazon.com/API/docs/en-us/reporting/3-0/openapi",
    linkLabel: "查看报表字段说明",
  },
  {
    id: "sp-placement",
    badge: "日级补充",
    title: "Sponsored Products Placement Report",
    granularity: "通常日级",
    required: false,
    path: "Seller Central → 广告 → 广告活动管理 → 衡量与报告 → Sponsored ads reports → Sponsored Products → Placement",
    description: "用于区分 Top of Search、Rest of Search 和 Product Pages 的广告效率。",
    link: "https://advertising.amazon.com/API/docs/en-us/reporting/3-0/openapi",
    linkLabel: "查看报表字段说明",
  },
  {
    id: "sp-product",
    badge: "日级补充",
    title: "Sponsored Products Advertised Product Report",
    granularity: "通常日级",
    required: false,
    path: "Seller Central → 广告 → 广告活动管理 → 衡量与报告 → Sponsored ads reports → Sponsored Products → Advertised product",
    description: "用于按 ASIN、SKU 判断广告花费集中在哪些商品。",
    link: "https://advertising.amazon.com/API/docs/en-us/reporting/3-0/openapi",
    linkLabel: "查看报表字段说明",
  },
  {
    id: "business-report",
    badge: "经营补充",
    title: "Detail Page Sales and Traffic by Child Item",
    granularity: "通常日级",
    required: false,
    path: "Seller Central → 报告 → 业务报告 → 按子商品查看详情页面销售量和流量",
    description: "用于结合 Sessions、Page Views、Units Ordered 和转化率判断广告依赖度。",
    link: "https://sellercentral.amazon.com/business-reports",
    linkLabel: "打开 Business Reports",
  },
] as const;

const TIME_ZONES = [
  ["account", "Amazon 账户时区（推荐）"],
  ["America/Los_Angeles", "美国太平洋时间 · Los Angeles"],
  ["America/New_York", "美国东部时间 · New York"],
  ["America/Toronto", "加拿大东部时间 · Toronto"],
  ["Europe/London", "英国时间 · London"],
  ["Europe/Berlin", "中欧时间 · Berlin"],
  ["Asia/Tokyo", "日本时间 · Tokyo"],
  ["Asia/Shanghai", "中国标准时间 · Shanghai"],
] as const;

const reportFormats = ".csv,.xlsx,.xls,.json,text/csv,application/json";

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & { webkitdirectory?: string };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uniqueId(): string {
  return `hourly-ad-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function jsonRows(value: unknown): RawRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is RawRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["data", "records", "rows", "results", "report"]) {
    const nested = jsonRows(record[key]);
    if (nested.length > 0) return nested;
  }
  return [record as RawRecord];
}

async function parseFile(file: File, timeZone: string): Promise<ParsedReportData> {
  const XLSX = await import("xlsx");
  const lowerName = file.name.toLowerCase();
  let rows: RawRecord[];

  if (lowerName.endsWith(".json") || file.type === "application/json") {
    rows = jsonRows(JSON.parse(await file.text()));
  } else {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false, raw: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error("文件中没有可读取的工作表");
    rows = XLSX.utils.sheet_to_json<RawRecord>(firstSheet, { defval: "", raw: true });
  }

  if (rows.length === 0) throw new Error("文件中没有可读取的数据行");
  return inspectReport(file.name, rows);
}

function statusText(item: UploadItem): string {
  if (item.status === "error") return "解析失败";
  if (!item.report) return "等待解析";
  if (item.report.missingFields.length > 0 || item.report.validRowCount === 0) return "需要检查";
  return "已识别";
}

function HeaderMapping({ report }: { report: ParsedReportData }) {
  const mappingRows = [
    ["日期", report.mapping.date ?? report.mapping.eventTime],
    ["小时", report.mapping.hour ?? (report.mapping.eventTime ? "由时间戳提取" : null)],
    ["Campaign", report.mapping.campaignName],
    ["Impressions", report.mapping.impressions],
    ["Clicks", report.mapping.clicks],
    ["Spend", report.mapping.spend],
    ["Orders", report.mapping.orders],
    ["Sales", report.mapping.sales],
  ];
  return (
    <div className="hourly-mapping-grid">
      {mappingRows.map(([label, value]) => (
        <div key={label} className={value ? "mapped" : "unmapped"}>
          <small>{label}</small>
          <b>{value ?? "未识别"}</b>
        </div>
      ))}
    </div>
  );
}

function HourlyAdsAnalysis() {
  const [site, setSite] = useState("");
  const [timeZone, setTimeZone] = useState("account");
  const [attributionWindow, setAttributionWindow] = useState("7");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [folderName, setFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const loadedReports = useMemo(() => items.filter((item) => item.report), [items]);
  const hourlyReports = useMemo(() => loadedReports.filter((item) => item.report?.granularity === "hourly"), [loadedReports]);
  const totalRows = useMemo(() => loadedReports.reduce((sum, item) => sum + (item.report?.validRowCount ?? 0), 0), [loadedReports]);
  const recognizedHourlyRows = useMemo(() => loadedReports.reduce((sum, item) => sum + (item.report?.hourlyRowCount ?? 0), 0), [loadedReports]);
  const selectedSite = site ? SITE_CONFIG[site] : null;
  const effectiveTimeZone = timeZone === "account" ? selectedSite?.timeZone ?? "account" : timeZone;
  const hasRequiredHourlySource = hourlyReports.some((item) => {
    const report = item.report;
    return Boolean(report && report.missingFields.length === 0 && report.validRowCount > 0 && report.hourlyRowCount > 0);
  });
  const hasErrors = items.some((item) => item.status === "error");
  const analysisReady = Boolean(site) && hasRequiredHourlySource && !hasErrors;

  useEffect(() => {
    setItems((current) => current.map((item) => {
      if (!item.report) return item;
      const report = inspectReport(item.fileName, item.report.rawRows, effectiveTimeZone);
      return {
        ...item,
        report,
        status: report.missingFields.length > 0 || report.validRowCount === 0 ? "warning" : "ready",
      };
    }));
  }, [effectiveTimeZone]);

  const addFiles = async (files: File[], selectedFolder = "") => {
    const supportedFiles = files.filter((file) => /\.(csv|xlsx?|json)$/i.test(file.name));
    if (supportedFiles.length === 0) return;
    setIsParsing(true);
    if (selectedFolder) setFolderName(selectedFolder);
    const next: UploadItem[] = [];

    for (const file of supportedFiles) {
      const id = uniqueId();
      try {
        const report = await parseFile(file, effectiveTimeZone);
        next.push({
          id,
          fileName: file.name,
          fileSize: file.size,
          relativePath: file.webkitRelativePath || "",
          report,
          status: report.missingFields.length > 0 || report.validRowCount === 0 ? "warning" : "ready",
          error: "",
        });
      } catch (error) {
        next.push({
          id,
          fileName: file.name,
          fileSize: file.size,
          relativePath: file.webkitRelativePath || "",
          report: null,
          status: "error",
          error: error instanceof Error ? error.message : "无法解析文件",
        });
      }
    }

    setItems((current) => {
      const existingNames = new Set(current.map((item) => `${item.relativePath}|${item.fileName}`));
      return [...current, ...next.filter((item) => !existingNames.has(`${item.relativePath}|${item.fileName}`))];
    });
    setIsParsing(false);
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    await addFiles(files);
    event.target.value = "";
  };

  const handleFolder = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => /\.(csv|xlsx?|json)$/i.test(file.name));
    const firstPath = files[0]?.webkitRelativePath ?? "";
    await addFiles(files, firstPath.split("/")[0] ?? "");
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isParsing) setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (!isParsing) await addFiles(Array.from(event.dataTransfer.files));
  };

  const removeItem = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  const clearUploads = () => {
    setItems([]);
    setFolderName("");
  };

  const preview = loadedReports[0]?.report;
  const previewRows = preview?.rows.filter((row) => row.date || row.campaignName).slice(0, 5) ?? [];

  return (
    <main className="main-content hourly-ads-main">
      <header className="topbar hourly-ads-topbar">
        <div>
          <div className="eyebrow">新增板块 · AMAZON ADVERTISING DAYPARTING</div>
          <h1>广告分时智能决策台</h1>
          <p>先确认官方数据来源，再上传报表进行本地字段识别与小时级分析</p>
        </div>
        <div className="hourly-ads-top-actions">
          <a className="rule-link" href="https://advertising.amazon.com/API/docs/en-us/marketing-stream" target="_blank" rel="noreferrer"><Link2 size={15} /> 官方数据文档</a>
          <button className="rule-link" type="button" onClick={clearUploads}><RefreshCcw size={15} /> 清空上传</button>
        </div>
      </header>

      <div className="hourly-ads-page">
        <section className="hourly-ads-hero">
          <div className="hourly-ads-hero-title">
            <span>DATA SOURCE CENTER</span>
            <strong>报表上传与数据源配置</strong>
            <p>支持 CSV、XLSX、XLS 和 Marketing Stream JSON。文件只在当前浏览器会话中解析，不上传第三方服务器。</p>
          </div>
          <div className="hourly-ads-hero-flow">
            <div><span>01</span><b>下载官方报表</b><small>按下方路径获取</small></div>
            <ChevronRight size={17} />
            <div><span>02</span><b>设置数据源</b><small>站点、时区、归因窗口</small></div>
            <ChevronRight size={17} />
            <div><span>03</span><b>上传并检测</b><small>自动识别字段与粒度</small></div>
          </div>
        </section>

        <div className="hourly-ads-grid">
          <section className="hourly-ads-panel hourly-config-panel">
            <div className="hourly-panel-heading">
              <div><span>01</span><div><h2>分析数据配置</h2><p>小时归属必须使用 Amazon 账户时区</p></div></div>
              <Database size={18} />
            </div>
            <div className="hourly-form">
              <label className="hourly-field"><span>Amazon 销售站点</span><select value={site} onChange={(event) => { const value = event.target.value; setSite(value); if (value && timeZone === "account") setTimeZone("account"); }}><option value="">请选择站点</option>{Object.entries(SITE_CONFIG).map(([code, config]) => <option key={code} value={code}>{code} · {config.label}</option>)}</select></label>
              <label className="hourly-field"><span>账号时区</span><select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>{TIME_ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <div className="hourly-form-grid">
                <label className="hourly-field"><span>数据开始日期</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
                <label className="hourly-field"><span>数据结束日期</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
              </div>
              <label className="hourly-field"><span>广告归因窗口</span><select value={attributionWindow} onChange={(event) => setAttributionWindow(event.target.value)}><option value="1">1 天</option><option value="7">7 天</option><option value="14">14 天</option><option value="30">30 天</option></select></label>
              <div className="hourly-config-summary">
                <div><small>站点币种</small><b>{selectedSite?.currency ?? "待选择"}</b></div>
                <div><small>分析时区</small><b>{timeZone === "account" ? "账户时区" : timeZone}</b></div>
                <div><small>归因窗口</small><b>{attributionWindow} 天</b></div>
              </div>
            </div>
            <div className="hourly-config-note"><Info size={15} /><span>如果文件中的时间已经按 Amazon 账户时区生成，请保持“账户时区”。不要用电脑本地时间替换报表时间。</span></div>
          </section>

          <section className="hourly-ads-panel hourly-upload-panel">
            <div className="hourly-panel-heading">
              <div><span>02</span><div><h2>设置上传路径</h2><p>选择文件或一次选择一个本地文件夹</p></div></div>
              <Upload size={18} />
            </div>
            <div className="hourly-upload-actions">
              <button type="button" className="hourly-primary-button" onClick={() => fileInputRef.current?.click()} disabled={isParsing}><FileSpreadsheet size={16} /> 选择报表文件</button>
              <button type="button" className="hourly-secondary-button" onClick={() => folderInputRef.current?.click()} disabled={isParsing}><FolderOpen size={16} /> 选择上传文件夹</button>
              <input ref={fileInputRef} className="sr-only" type="file" accept={reportFormats} multiple onChange={handleFiles} />
              <input ref={folderInputRef} className="sr-only" type="file" accept={reportFormats} multiple onChange={handleFolder} {...({ webkitdirectory: "" } as DirectoryInputProps)} />
            </div>
            <div className="hourly-path-display"><FolderOpen size={15} /><div><small>当前上传路径</small><b>{folderName ? `本地文件夹 · ${folderName}` : "当前会话文件区 · 尚未选择文件夹"}</b></div></div>
            <div className="hourly-upload-note"><ShieldCheck size={15} /><span>浏览器不会把本地绝对路径交给网页。选择后仅读取你主动选中的文件，刷新页面后需要重新选择。</span></div>
            <div className={`hourly-upload-dropzone ${isDragOver ? "drag-over" : ""}`} onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} role="button" tabIndex={0} aria-label="上传广告报表" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }}>
              <CloudDownload size={25} />
              <b>{isParsing ? "正在读取并识别文件…" : isDragOver ? "松开鼠标上传报表" : "点击或拖拽上传 CSV / XLSX / XLS / JSON"}</b>
              <span>支持多文件；原始文件不修改，识别结果只保留在当前页面</span>
            </div>
          </section>
        </div>

        <section className="hourly-ads-panel hourly-source-panel">
          <div className="hourly-panel-heading source-heading">
            <div><span>03</span><div><h2>官方报表下载路径</h2><p>分时核心数据和日级补充数据分开管理</p></div></div>
            <ListChecks size={18} />
          </div>
          <div className="hourly-source-alert"><AlertTriangle size={16} /><span>重要：Seller Central 常规 Sponsored Products 报表通常是日级汇总，不能直接生成 00–23 点小时数据。真正的小时分析需要 Marketing Stream 或其他含时间戳的小时级数据。</span></div>
          <div className="hourly-source-table-wrap">
            <table className="hourly-source-table">
              <thead><tr><th>用途</th><th>需要下载的报表</th><th>官方进入路径</th><th>数据粒度</th><th>操作</th></tr></thead>
              <tbody>{REPORT_SOURCES.map((source) => <tr key={source.id} className={source.required ? "required-row" : ""}>
                <td><span className={`hourly-source-badge ${source.required ? "required" : "optional"}`}>{source.badge}</span></td>
                <td><b>{source.title}</b><small>{source.description}</small></td>
                <td><span className="hourly-source-path">{source.path}</span></td>
                <td><span className={`granularity-pill ${source.granularity === "小时级" ? "hourly" : "daily"}`}>{source.granularity}</span></td>
                <td><a href={source.link} target="_blank" rel="noreferrer" title={source.linkLabel}><Link2 size={14} /> 官方链接</a></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="hourly-source-footnote"><Info size={14} /><span>分时分析最低要求：1 份含小时字段的 Marketing Stream 数据。建议同时准备 Sponsored Products Campaign 日级报表；Search Term、Placement、Advertised Product 和 Business Report 用于进一步解释分析结果。</span></div>
        </section>

        <section className="hourly-ads-panel hourly-uploaded-panel">
          <div className="hourly-panel-heading source-heading">
            <div><span>04</span><div><h2>已上传报表与字段检测</h2><p>识别后才进入后续分时分析，缺失关键字段会被拦截</p></div></div>
            <FileCheck2 size={18} />
          </div>
          {items.length === 0 ? <div className="hourly-empty-state"><Upload size={21} /><b>还没有上传报表</b><span>从上方选择文件或文件夹后，系统会显示文件类型、数据粒度、字段映射和错误提示。</span></div> : <div className="hourly-upload-list">{items.map((item) => {
            const report = item.report;
            return <article key={item.id} className={`hourly-upload-item ${item.status}`}>
              <div className="hourly-upload-item-head"><div className="hourly-file-icon"><FileSpreadsheet size={18} /></div><div className="hourly-upload-name"><b>{item.fileName}</b><small>{item.relativePath || "单文件上传"} · {formatFileSize(item.fileSize)}</small></div><span className={`hourly-status ${item.status}`}>{item.status === "ready" ? <Check size={12} /> : <AlertTriangle size={12} />}{statusText(item)}</span><button className="icon-button" type="button" onClick={() => removeItem(item.id)} title="移除文件"><Trash2 size={15} /></button></div>
              {report ? <><div className="hourly-upload-meta"><span>报表类型 <b>{reportTypeLabel(report.reportType)}</b></span><span>数据粒度 <b>{granularityLabel(report.granularity)}</b></span><span>有效行 <b>{report.validRowCount.toLocaleString("zh-CN")}</b></span><span>小时行 <b>{report.hourlyRowCount.toLocaleString("zh-CN")}</b></span><span>日期 <b>{report.dateFrom && report.dateTo ? `${report.dateFrom} 至 ${report.dateTo}` : "未识别"}</b></span></div><HeaderMapping report={report} />{report.warnings.length > 0 && <div className="hourly-inline-warning"><AlertTriangle size={14} /><span>{report.warnings.join("；")}</span></div>}</> : <div className="hourly-inline-error"><AlertTriangle size={14} /><span>{item.error}</span></div>}
            </article>;
          })}</div>}
        </section>

        <section className="hourly-ads-panel hourly-readiness-panel">
          <div className="hourly-panel-heading source-heading">
            <div><span>05</span><div><h2>分析入口状态</h2><p>当前只显示数据源准备情况，利润计算不在本板块范围内</p></div></div>
            <BarChart3 size={18} />
          </div>
          <div className="hourly-readiness-grid">
            <div><small>已上传文件</small><strong>{items.length}</strong><span>份</span></div>
            <div><small>有效数据行</small><strong>{totalRows.toLocaleString("zh-CN")}</strong><span>行</span></div>
            <div><small>小时数据行</small><strong>{recognizedHourlyRows.toLocaleString("zh-CN")}</strong><span>行</span></div>
            <div className={analysisReady ? "ready" : "pending"}><small>分时分析状态</small><strong>{analysisReady ? "可以开始" : hasRequiredHourlySource ? "还差配置" : "等待小时数据"}</strong><span>{analysisReady ? "站点、关键字段和小时数据均已就绪" : hasRequiredHourlySource ? "请先选择销售站点" : "请上传 Marketing Stream 或时间戳数据"}</span></div>
          </div>
          {!site && <div className="hourly-readiness-note"><Info size={15} /> 请先选择 Amazon 销售站点；站点与账号时区会作为后续分析的上下文。</div>}
          {hasRequiredHourlySource && preview && <div className="hourly-preview-block"><div className="hourly-preview-head"><b>首个可解析文件预览</b><span>{previewRows.length} 行</span></div><div className="hourly-preview-wrap"><table className="hourly-preview-table"><thead><tr><th>日期</th><th>小时</th><th>Campaign</th><th>曝光</th><th>点击</th><th>Spend</th><th>Orders</th><th>Sales</th></tr></thead><tbody>{previewRows.map((row) => <tr key={`${row.sourceRow}-${row.date}-${row.hour}`}><td>{row.date || "-"}</td><td>{row.hour === null ? "-" : `${String(row.hour).padStart(2, "0")}:00`}</td><td>{row.campaignName || "-"}</td><td>{row.impressions}</td><td>{row.clicks}</td><td>{row.spend}</td><td>{row.orders}</td><td>{row.sales}</td></tr>)}</tbody></table></div></div>}
        </section>
      </div>
    </main>
  );
}

export default HourlyAdsAnalysis;
