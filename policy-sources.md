# Amazon FBA 官方政策来源备忘

检查日期：2026-07-22

本项目的库存决策台会把 Amazon 费用规则做成独立“政策层”。SKU 实际费用优先顺序建议为：

1. 领星或 Seller Central 已产生的 SKU 级真实费用字段
2. Seller Central Fee Preview / Amazon Revenue Calculator 的 SKU 级预估
3. 页面内置站点规则估算

## 已纳入页面的官方来源

- US Monthly inventory storage fees  
  https://sellercentral.amazon.com/help/hub/reference/external/G3EDYEF6KUCFQTNM

- US Aged inventory surcharge  
  https://sellercentral.amazon.com/gp/help/external/GJQNPA23YWVA4SBD

- US FBA Liquidations  
  https://sellercentral.amazon.com/help/hub/reference/external/GYVCG5Q3BEJ6MLMF

- US 2026 removal / disposal / liquidation fee changes  
  https://sellercentral.amazon.com/help/hub/reference/external/GZ5Q2VW5WF4JWRGC

- Canada FBA aged inventory surcharge  
  https://sellercentral.amazon.ca/help/hub/reference/external/G200684750

- EU / UK 2026 FBA Rate Card  
  https://m.media-amazon.com/images/G/02/sell/images/260114-FBA-Rate-Card-EN.pdf

- UK FBA fulfilment fees  
  https://sellercentral.amazon.co.uk/help/hub/reference/external/G200209150

- US Low-inventory-level fee  
  https://sellercentral.amazon.com/help/hub/reference/external/GV43F6S76Y9DHYRH

## 当前第一版规则边界

- 已支持 US / CA / UK / DE 的基础仓储费与库龄附加费配置。
- 如果上传表格包含 `storageFee`，页面优先使用实际仓储费。
- 如果上传表格包含 `volume` 和 `sizeTier`，页面可按站点规则估算仓储费。
- 清算、移除、FBA 配送费等 SKU 级费用在第一版中用于决策估算；后续建议接领星费用字段或 Seller Central 费用预览字段。
