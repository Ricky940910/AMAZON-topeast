# TopEast Amazon 工具箱

面向 Amazon 美国站运营场景的本地与 Web 计算工具。

## 已完成

- 板块一：FBA 基础测算引擎（Module 1–5）
- 板块二：FBA 发货装箱助手
- 板块三：FBA 库存成本推演
- 板块四：亚马逊利润测算器（运营版）
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

本工具用于运营预估。Amazon 实际账单以 Seller Central 的产品测量数据和计费结果为准。
