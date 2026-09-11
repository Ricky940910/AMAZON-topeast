# TopEast Amazon 工具箱

面向 Amazon 美国站运营场景的本地与 Web 计算工具。

## 已完成

- 板块一：FBA 基础测算引擎（Module 1–5）
- 板块二：FBA 发货装箱助手
- 板块三：FBA 库存成本推演
- 板块四：亚马逊利润测算器（运营版）
- 板块五：头程费用计算与利润联动
- 板块六：链接评分计算（VP Review + VP Rating 经验估算）
- 板块七：货物申报金额（40HQ 装箱排布与单件申报金额）
- 单位标准化、2026 Size Tier、Shipping Weight、体积重诊断
- 2026 普通商品、服装、危险品的非旺季/旺季配送费
- 2026 年 4 月 17 日起 3.5% fuel and logistics-related surcharge
- 包装尺寸降档模拟
- 平均装箱、指定每箱数量、重量与尺寸联合限制
- 多 SKU 独立计算、Amazon Shipment 数据生成
- Excel/CSV 导入导出与建议发货数量
- 2026 月仓储费、Storage Utilization Surcharge 与危险品费率
- 老化库存附加费、最低每件费、移除费与批量清货净回收
- 最多 24 个月库存递减推演和继续销售/促销/移除/清货建议
- 库存成本汇总复制、Excel/CSV 导出与打印
- 产品、物流、Amazon费用、退货、广告和促销成本模型
- 美国、加拿大、英国、德国、日本站 Referral Fee 类目自动匹配、分段费率与最低佣金
- 广告订单/自然订单拆分、ACOS/TACOS、预算覆盖与广告安全线
- 盈亏平衡售价、盈亏平衡 ACOS/TACOS 与最大安全 CPC
- 保守/正常/激进三种利润情景模拟和 SKU 运营评级
- 利润驾驶舱、结果复制、Excel/CSV 导出与打印
- 40HQ 六方向整齐装箱比较、箱装产品数量与申报金额计算
- 板块九：广告分时分析数据源中心（官方报表下载路径、上传文件/文件夹、CSV/XLSX/XLS/JSON 字段识别）
- 广告报表按日级与小时级分层，明确 Marketing Stream 是真正小时分析数据源

## 本地运行

```bash
pnpm install
pnpm dev
```

## 规则来源

- [Amazon Product size tiers](https://sellercentral.amazon.com/help/hub/reference/external/GG5KW835AHDJCH8W)
- [Amazon 2026 US FBA fulfillment fee changes](https://sellercentral.amazon.com/help/hub/reference/external/GABBX6GZPA8MSZGW)
- [Amazon Dimensional weight](https://sellercentral.amazon.com/help/hub/reference/external/G53Z9EKF8VVZVH29)
- [Amazon Monthly inventory storage fees](https://sellercentral.amazon.com/help/hub/reference/external/G3EDYEF6KUCFQTNM)
- [Amazon 2026 US fee changes](https://sellercentral.amazon.com/help/hub/reference/external/G201411300)
- [Amazon Removal and liquidation fees](https://sellercentral.amazon.com/help/hub/reference/external/GZ5Q2VW5WF4JWRGC)
- [Amazon US selling and referral fees](https://sell.amazon.com/pricing)
- [Amazon Canada selling and referral fees](https://sell.amazon.ca/pricing)
- [Amazon UK selling and referral fees](https://sell.amazon.co.uk/pricing)
- [Amazon Germany selling and referral fees](https://sell.amazon.de/preisgestaltung)
- [Amazon Japan selling and referral fees](https://sell.amazon.co.jp/pricing)

## 广告分时分析数据源

广告分时分析入口会展示下载路径和文件检测状态。V1 只在浏览器本地解析用户主动选择的文件，不上传第三方服务器。

### 真正的小时级数据

- Amazon Marketing Stream：通过 Amazon Ads API 获取小时级事件数据，再上传 CSV 或 JSON
- 官方文档：[Marketing Stream](https://advertising.amazon.com/API/docs/en-us/marketing-stream)

### Seller Central 日级补充报表

从 Seller Central 进入：`广告 → 广告活动管理 → 衡量与报告 → Sponsored ads reports`，按需下载：

- Sponsored Products Campaign Report
- Sponsored Products Search Term Report
- Sponsored Products Placement Report
- Sponsored Products Advertised Product Report

这些常规报表通常是日级汇总，不能直接替代小时数据。广告报表 API 文档：[Reporting API 3.0](https://advertising.amazon.com/API/docs/en-us/reporting/3-0/openapi)

### 经营数据补充

从 Seller Central 进入：`报告 → 业务报告 → 按子商品查看详情页面销售量和流量`，下载 Detail Page Sales and Traffic by Child Item，用于辅助判断总流量与广告依赖度。

上传支持：CSV、XLSX、XLS、Marketing Stream JSON；支持多文件和本地文件夹选择。浏览器安全限制下，页面只能显示“当前会话上传文件区”或用户选择的文件夹名称，不能读取任意本地绝对路径。

本工具用于运营预估。Amazon 实际账单以 Seller Central 的产品测量数据和计费结果为准。
