# TopEast Amazon 工具箱

面向 Amazon 美国站运营场景的本地与 Web 计算工具。

## 已完成

- 板块一：FBA 基础测算引擎（Module 1–5）
- 板块二：FBA 发货装箱助手
- 单位标准化、2026 Size Tier、Shipping Weight、体积重诊断
- 2026 普通商品、服装、危险品的非旺季/旺季配送费
- 2026 年 4 月 17 日起 3.5% fuel and logistics-related surcharge
- 包装尺寸降档模拟
- 平均装箱、指定每箱数量、重量与尺寸联合限制
- 多 SKU 独立计算、Amazon Shipment 数据生成
- Excel/CSV 导入导出与建议发货数量

## 本地运行

```bash
pnpm install
pnpm dev
```

## 规则来源

- [Amazon Product size tiers](https://sellercentral.amazon.com/help/hub/reference/external/GG5KW835AHDJCH8W)
- [Amazon 2026 US FBA fulfillment fee changes](https://sellercentral.amazon.com/help/hub/reference/external/GABBX6GZPA8MSZGW)
- [Amazon Dimensional weight](https://sellercentral.amazon.com/help/hub/reference/external/G53Z9EKF8VVZVH29)

本工具用于运营预估。Amazon 实际账单以 Seller Central 的产品测量数据和计费结果为准。
