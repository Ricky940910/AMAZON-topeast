import { describe, expect, it } from "vitest";
import { detectFieldMapping, detectReportType, inspectReport } from "./hourlyAds";

describe("hourly advertising report inspection", () => {
  it("maps common Amazon hourly fields and extracts hours from timestamps", () => {
    const result = inspectReport("marketing-stream-us.json", [
      {
        "Event Time": "2026-09-10T18:35:00",
        "Campaign Name": "Launch exact",
        Impressions: "1,200",
        Clicks: "48",
        Spend: "$36.00",
        "7 Day Total Orders": "4",
        "7 Day Total Sales": "$119.96",
      },
    ]);

    expect(result.reportType).toBe("marketing-stream");
    expect(result.granularity).toBe("hourly");
    expect(result.missingFields).toEqual([]);
    expect(result.hourlyRowCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      date: "2026-09-10",
      hour: 18,
      impressions: 1200,
      clicks: 48,
      spend: 36,
      orders: 4,
      sales: 119.96,
    });
  });

  it("recognizes a standard daily Sponsored Products report without pretending it is hourly", () => {
    const result = inspectReport("Sponsored Products Campaign Report.csv", [
      {
        Date: "2026-09-10",
        Campaign: "Daily campaign",
        Impressions: 1000,
        Clicks: 20,
        Spend: 15,
        Orders: 2,
        Sales: 59.98,
      },
    ]);

    expect(result.reportType).toBe("sponsored-products");
    expect(result.granularity).toBe("daily");
    expect(result.validRowCount).toBe(1);
    expect(result.hourlyRowCount).toBe(0);
    expect(result.warnings[0]).toContain("未识别到小时字段");
  });

  it("reports missing metrics explicitly", () => {
    const result = inspectReport("incomplete.csv", [
      { Date: "2026-09-10", Hour: 8, Impressions: 50, Clicks: 3, Spend: 2 },
    ]);

    expect(result.missingFields).toEqual(["orders", "sales"]);
    expect(result.validRowCount).toBe(1);
    expect(result.hourlyRowCount).toBe(1);
    expect(result.warnings.join(" ")).toContain("Orders / 订单量");
  });

  it("keeps optional dimensions optional", () => {
    const mapping = detectFieldMapping(["Date", "Hour", "Impressions", "Clicks", "Spend", "Orders", "Sales"]);
    expect(mapping.campaignName).toBeNull();
    expect(mapping.asin).toBeNull();
    expect(mapping.spend).toBe("Spend");
  });

  it("uses recognizable report names for source labels", () => {
    expect(detectReportType("Sponsored Brands Campaign.csv", ["Date", "Spend"])).toBe("sponsored-brands");
    expect(detectReportType("Business Report.csv", ["Date", "Sessions"])).toBe("business-report");
  });

  it("converts an explicit timestamp to the selected account time zone", () => {
    const result = inspectReport("stream.json", [
      {
        timestamp: "2026-09-11T01:30:00Z",
        impressions: 100,
        clicks: 10,
        spend: 5,
        orders: 1,
        sales: 20,
      },
    ], "America/Los_Angeles");

    expect(result.rows[0]).toMatchObject({ date: "2026-09-10", hour: 18 });
    expect(result.timeZone).toBe("America/Los_Angeles");
  });
});
