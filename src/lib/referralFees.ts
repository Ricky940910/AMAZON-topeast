import type { SalesSite } from "./profit";

export interface ReferralFeeCategory {
  id: string;
  label: string;
  minimumFee: number;
  ruleDescription: string;
  calculateRawFee: (price: number) => number;
  note?: string;
}

export interface ReferralFeeQuote {
  categoryId: string;
  categoryLabel: string;
  price: number;
  fee: number;
  effectiveRate: number;
  minimumFee: number;
  minimumApplied: boolean;
  ruleDescription: string;
  note?: string;
}

export const REFERRAL_FEE_SOURCE_URLS: Record<SalesSite, string> = {
  US: "https://sell.amazon.com/pricing",
  CA: "https://sell.amazon.ca/pricing",
  UK: "https://sell.amazon.co.uk/pricing",
  DE: "https://sell.amazon.de/preisgestaltung",
  JP: "https://sell.amazon.co.jp/pricing",
};

const positive = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const percentText = (rate: number) => `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;
const roundFee = (salesSite: SalesSite, value: number) => {
  const factor = salesSite === "JP" ? 1 : 100;
  return Math.round((positive(value) + Number.EPSILON) * factor) / factor;
};

function flat(id: string, label: string, rate: number, minimumFee: number, note?: string): ReferralFeeCategory {
  return { id, label, minimumFee, note, ruleDescription: percentText(rate), calculateRawFee: (price) => positive(price) * rate };
}

function threshold(id: string, label: string, bands: Array<{ upTo?: number; rate: number }>, minimumFee: number, note?: string): ReferralFeeCategory {
  const ruleDescription = bands.map((band, index) => {
    const previous = index > 0 ? bands[index - 1].upTo : undefined;
    if (band.upTo !== undefined) return `${previous === undefined ? `不高于 ${band.upTo}` : `${previous}–${band.upTo}`}：${percentText(band.rate)}`;
    return `${previous === undefined ? "全部价格" : `高于 ${previous}`}：${percentText(band.rate)}`;
  }).join("；");
  return {
    id,
    label,
    minimumFee,
    note,
    ruleDescription,
    calculateRawFee: (price) => {
      const safePrice = positive(price);
      const band = bands.find((item) => item.upTo === undefined || safePrice <= item.upTo) ?? bands[bands.length - 1];
      return safePrice * band.rate;
    },
  };
}

function progressive(id: string, label: string, bands: Array<{ upTo?: number; rate: number }>, minimumFee: number, note?: string): ReferralFeeCategory {
  const ruleDescription = bands.map((band, index) => {
    const previous = index > 0 ? bands[index - 1].upTo : undefined;
    return `${previous === undefined ? `前 ${band.upTo}` : band.upTo === undefined ? `超过 ${previous} 的部分` : `${previous}–${band.upTo} 的部分`}：${percentText(band.rate)}`;
  }).join("；");
  return {
    id,
    label,
    minimumFee,
    note,
    ruleDescription,
    calculateRawFee: (price) => {
      const safePrice = positive(price);
      let fee = 0;
      let lowerBound = 0;
      for (const band of bands) {
        const upperBound = band.upTo ?? safePrice;
        fee += Math.max(0, Math.min(safePrice, upperBound) - lowerBound) * band.rate;
        if (safePrice <= upperBound) break;
        lowerBound = upperBound;
      }
      return fee;
    },
  };
}

function custom(id: string, label: string, minimumFee: number, ruleDescription: string, calculateRawFee: (price: number) => number, note?: string): ReferralFeeCategory {
  return { id, label, minimumFee, ruleDescription, calculateRawFee, note };
}

const euClothing = (id: string, label: string, minimumFee: number, premiumThreshold: number) => custom(
  id,
  label,
  minimumFee,
  `不高于 15：5%；15–20：10%；20–${premiumThreshold}：15%；高于 ${premiumThreshold} 时前 ${premiumThreshold} 按 15%、超出部分按 7%`,
  (price) => {
    const safePrice = positive(price);
    if (safePrice <= 15) return safePrice * 0.05;
    if (safePrice <= 20) return safePrice * 0.10;
    if (safePrice <= premiumThreshold) return safePrice * 0.15;
    return premiumThreshold * 0.15 + (safePrice - premiumThreshold) * 0.07;
  },
  "高价档按 FBA / Seller Fulfilled Prime 官方费率处理。",
);

export const REFERRAL_FEE_CATEGORIES: Record<SalesSite, readonly ReferralFeeCategory[]> = {
  US: [
    flat("amazon-device-accessories", "Amazon Device Accessories", 0.45, 0.30),
    flat("automotive", "Automotive and Powersports", 0.12, 0.30),
    threshold("baby", "Baby Products", [{ upTo: 10, rate: 0.08 }, { rate: 0.15 }], 0.30),
    threshold("beauty-health", "Beauty, Health, and Personal Care", [{ upTo: 10, rate: 0.08 }, { rate: 0.15 }], 0.30),
    flat("books-media", "Media - Books, DVD, Music, Software, Video", 0.15, 0, "媒体商品另有每件 $1.80 closing fee，本工具暂不自动加入。"),
    threshold("clothing", "Clothing and Accessories", [{ upTo: 15, rate: 0.05 }, { upTo: 20, rate: 0.10 }, { rate: 0.17 }], 0.30),
    flat("consumer-electronics", "Consumer Electronics", 0.08, 0.30),
    progressive("electronics-accessories", "Electronics Accessories", [{ upTo: 100, rate: 0.15 }, { rate: 0.08 }], 0.30),
    threshold("grocery", "Grocery and Gourmet", [{ upTo: 15, rate: 0.08 }, { rate: 0.15 }], 0),
    flat("handmade", "Amazon Handmade", 0.15, 1, "Handmade 计划最低佣金按每件 $1.00 预估。"),
    flat("home-kitchen", "Home and Kitchen", 0.15, 0.30),
    flat("industrial", "Business, Industrial, and Scientific Supplies", 0.12, 0.30),
    flat("luggage", "Backpacks, Handbags, and Luggage", 0.15, 0.30),
    flat("musical", "Musical Instruments and AV Production", 0.15, 0.30),
    flat("office", "Office Products", 0.15, 0.30),
    flat("lawn-garden", "Lawn and Garden", 0.15, 0.30),
    flat("pet", "Pet Supplies", 0.15, 0.30, "兽医处方粮适用 22%，请改选 Veterinary Diets。"),
    flat("veterinary-diets", "Veterinary Diets", 0.22, 0.30),
    flat("sports", "Sports and Outdoors", 0.15, 0.30),
    flat("tools", "Tools and Home Improvement", 0.15, 0.30),
    flat("toys", "Toys and Games", 0.15, 0.30),
    flat("video-games", "Video Games and Gaming Accessories", 0.15, 0),
    flat("everything-else", "Everything Else", 0.15, 0.30),
  ],
  CA: [
    flat("amazon-device-accessories", "Amazon Device Accessories", 0.45, 0.40),
    flat("automotive", "Automotive and Powersports", 0.12, 0.40),
    threshold("baby", "Baby Products", [{ upTo: 15, rate: 0.08 }, { rate: 0.15 }], 0.40),
    threshold("beauty-health", "Beauty, Health and Personal Care", [{ upTo: 15, rate: 0.08 }, { rate: 0.15 }], 0.40),
    flat("books-media", "Media - Books, DVD, Music, Software, Video", 0.15, 0),
    custom("clothing", "Clothing and Accessories", 0.40, "低于 20：10%；20 及以上：17%", (price) => positive(price) < 20 ? positive(price) * 0.10 : positive(price) * 0.17),
    flat("consumer-electronics", "Consumer Electronics", 0.08, 0.40),
    progressive("electronics-accessories", "Electronic Accessories", [{ upTo: 100, rate: 0.15 }, { rate: 0.08 }], 0.40),
    threshold("grocery", "Grocery and Gourmet", [{ upTo: 20, rate: 0.08 }, { rate: 0.15 }], 0),
    flat("health", "Health and Personal Care", 0.15, 0.40),
    flat("home-kitchen", "Home and Kitchen", 0.15, 0.40),
    flat("industrial", "Business, Industrial, and Scientific Supplies", 0.12, 0.40),
    flat("luggage", "Backpacks, Handbags, and Luggage", 0.15, 0.40),
    flat("musical", "Musical Instruments and AV Production", 0.15, 0.40),
    flat("office", "Office Products", 0.15, 0.40),
    flat("lawn-garden", "Lawn and Garden", 0.15, 0.40),
    flat("pet", "Pet Products", 0.15, 0.40),
    flat("sports", "Sports and Outdoors", 0.15, 0.40),
    flat("tools", "Tools and Home Improvement", 0.15, 0.40),
    flat("toys", "Toys and Games", 0.15, 0.40),
    flat("video-games", "Video Games and Gaming Accessories", 0.15, 0),
    flat("everything-else", "Everything Else", 0.15, 0.40),
  ],
  UK: [
    flat("amazon-device-accessories", "Amazon Device Accessories", 0.45, 0.25),
    progressive("automotive", "Automotive and Powersports", [{ upTo: 45, rate: 0.15 }, { rate: 0.09 }], 0.25),
    threshold("baby", "Baby Products", [{ upTo: 10, rate: 0.08 }, { rate: 0.15 }], 0.25),
    threshold("beauty-health", "Beauty, Health and Personal Care", [{ upTo: 10, rate: 0.08 }, { rate: 0.15 }], 0.25),
    flat("books", "Books", 0.15, 0),
    euClothing("clothing", "Clothing and Accessories", 0.25, 40),
    flat("consumer-electronics", "Consumer Electronics", 0.07, 0.25),
    progressive("electronics-accessories", "Electronic Accessories", [{ upTo: 100, rate: 0.15 }, { rate: 0.08 }], 0.25),
    threshold("grocery", "Grocery and Gourmet", [{ upTo: 10, rate: 0.05 }, { rate: 0.15 }], 0),
    flat("handmade", "Handmade", 0.12, 0.25),
    threshold("home-products", "Home Products", [{ upTo: 20, rate: 0.08 }, { rate: 0.15 }], 0.25),
    flat("kitchen", "Kitchen", 0.15, 0.25),
    flat("industrial", "Business, Industrial, and Scientific Supplies", 0.15, 0.25),
    flat("luggage", "Luggage", 0.15, 0.25),
    flat("musical", "Musical Instruments and AV Production", 0.12, 0.25),
    flat("office", "Office Products", 0.15, 0.25),
    flat("lawn-garden", "Lawn and Garden", 0.15, 0.25),
    flat("pet", "Pet Supplies", 0.15, 0.25),
    flat("sports", "Sports and Outdoors", 0.15, 0.25),
    flat("tools", "Tools and Home Improvement", 0.13, 0.25),
    flat("toys", "Toys and Games", 0.15, 0.25),
    flat("video-games", "Video Games and Gaming Accessories", 0.15, 0),
    flat("everything-else", "Everything Else", 0.15, 0.25),
  ],
  DE: [
    flat("amazon-device-accessories", "Amazon-Gerätezubehör", 0.45, 0.30),
    progressive("automotive", "Automobil und Motorsport", [{ upTo: 50, rate: 0.15 }, { rate: 0.09 }], 0.30),
    threshold("baby", "Babyprodukte", [{ upTo: 10, rate: 0.08 }, { rate: 0.15 }], 0.30),
    threshold("beauty-health", "Beauty, Gesundheit und Körperpflege", [{ upTo: 10, rate: 0.08 }, { rate: 0.15 }], 0.30),
    flat("books", "Bücher", 0.15, 0),
    euClothing("clothing", "Kleidung und Accessoires", 0.30, 45),
    flat("consumer-electronics", "Unterhaltungselektronik", 0.07, 0.30),
    progressive("electronics-accessories", "Elektronisches Zubehör; Computerzubehör", [{ upTo: 100, rate: 0.15 }, { rate: 0.08 }], 0.30),
    threshold("grocery", "Lebensmittel und Gourmet", [{ upTo: 10, rate: 0.05 }, { rate: 0.15 }], 0),
    flat("handmade", "Handgemachte Produkte", 0.12, 0.30),
    threshold("home-products", "Haushaltsprodukte", [{ upTo: 20, rate: 0.08 }, { rate: 0.15 }], 0.30),
    flat("kitchen", "Küche", 0.15, 0.30),
    flat("industrial", "Materialien für Unternehmen, Industrie und Wissenschaft", 0.15, 0.30),
    flat("luggage", "Gepäck", 0.15, 0.30),
    flat("musical", "Musikinstrumente und AV-Produktion", 0.12, 0.30),
    flat("office", "Bürobedarf", 0.15, 0.30),
    flat("lawn-garden", "Rasen und Garten", 0.15, 0.30),
    flat("pet", "Haustierbedarf", 0.15, 0.30),
    flat("sports", "Sport und Outdoor", 0.15, 0.30),
    flat("tools", "Werkzeuge und Heimwerkerbedarf", 0.13, 0.30),
    flat("toys", "Spielzeug und Spiele", 0.15, 0.30),
    flat("video-games", "Videospiele und Gaming-Zubehör", 0.15, 0),
    flat("everything-else", "Alles andere", 0.15, 0.30),
  ],
  JP: [
    flat("amazon-device-accessories", "Amazonデバイス用アクセサリー", 0.454, 30),
    flat("media", "メディア - 本、DVD、ミュージック、PCソフト、ビデオ", 0.154, 0),
    threshold("electronics", "エレクトロニクス", [{ upTo: 750, rate: 0.05 }, { rate: 0.084 }], 30),
    threshold("electronics-accessories", "家電アクセサリー", [{ upTo: 750, rate: 0.05 }, { rate: 0.104 }], 30),
    threshold("musical", "楽器およびAV制作機器", [{ upTo: 750, rate: 0.05 }, { rate: 0.104 }], 30),
    threshold("beauty-health", "ビューティ・ヘルス・パーソナルケア", [{ upTo: 750, rate: 0.05 }, { upTo: 1500, rate: 0.084 }, { rate: 0.104 }], 30),
    threshold("sports", "スポーツ&アウトドア", [{ upTo: 750, rate: 0.05 }, { rate: 0.104 }], 30),
    threshold("automotive", "カー&バイク用品", [{ upTo: 750, rate: 0.05 }, { rate: 0.104 }], 30),
    threshold("toys", "おもちゃ&ホビー", [{ upTo: 750, rate: 0.05 }, { rate: 0.104 }], 30),
    flat("video-games", "テレビゲーム&ゲーム用アクセサリ", 0.154, 0),
    threshold("pet", "ペット用品", [{ upTo: 750, rate: 0.05 }, { upTo: 1500, rate: 0.084 }, { rate: 0.154 }], 30),
    threshold("office", "文房具・オフィス用品", [{ upTo: 750, rate: 0.05 }, { rate: 0.154 }], 30),
    threshold("home-kitchen", "ホーム&キッチン", [{ upTo: 750, rate: 0.05 }, { rate: 0.154 }], 30),
    threshold("garden", "ガーデニング・園芸用品", [{ upTo: 750, rate: 0.05 }, { rate: 0.154 }], 30),
    threshold("home-appliances", "ホーム&キッチン家電", [{ upTo: 750, rate: 0.05 }, { rate: 0.104 }], 30),
    threshold("furniture", "家具", [{ upTo: 750, rate: 0.05 }, { rate: 0.154 }], 30),
    threshold("diy", "DIY・工具", [{ upTo: 750, rate: 0.05 }, { rate: 0.154 }], 30),
    threshold("industrial", "産業・研究開発用品", [{ upTo: 750, rate: 0.05 }, { rate: 0.154 }], 30),
    threshold("food", "食品&飲料", [{ upTo: 750, rate: 0.05 }, { upTo: 1500, rate: 0.084 }, { rate: 0.104 }], 30),
    threshold("baby", "ベビー&マタニティ", [{ upTo: 750, rate: 0.05 }, { upTo: 1500, rate: 0.084 }, { rate: 0.154 }], 30),
    custom("fashion", "服&ファッション小物", 30, "不高于 750：5%；750–2,500：8.4%；2,500–3,000：12.4%；高于 3,000 时前 3,000 按 12.4%、超出部分按 8.4%", (price) => {
      const safePrice = positive(price);
      if (safePrice <= 750) return safePrice * 0.05;
      if (safePrice <= 2500) return safePrice * 0.084;
      if (safePrice <= 3000) return safePrice * 0.124;
      return 3000 * 0.124 + (safePrice - 3000) * 0.084;
    }),
    custom("shoes", "シューズ", 30, "不高于 750：5%；750–7,500：12.4%；高于 7,500 时前 7,500 按 12.4%、超出部分按 6.4%", (price) => {
      const safePrice = positive(price);
      if (safePrice <= 750) return safePrice * 0.05;
      if (safePrice <= 7500) return safePrice * 0.124;
      return 7500 * 0.124 + (safePrice - 7500) * 0.064;
    }),
    custom("luggage", "バックパック、ハンドバッグ、旅行かばん&トラベル用品", 30, "不高于 750：5%；750–7,500：12.4%；高于 7,500 时前 7,500 按 12.4%、超出部分按 6.4%", (price) => {
      const safePrice = positive(price);
      if (safePrice <= 750) return safePrice * 0.05;
      if (safePrice <= 7500) return safePrice * 0.124;
      return 7500 * 0.124 + (safePrice - 7500) * 0.064;
    }),
    threshold("everything-else", "その他のカテゴリー", [{ upTo: 750, rate: 0.05 }, { rate: 0.154 }], 30),
  ],
};

const DEFAULT_REFERRAL_CATEGORY_BY_BROWSE_NODE: Record<SalesSite, Record<string, string>> = {
  US: {
    "Amazon Device Accessories": "amazon-device-accessories", Automotive: "automotive", "Baby Products": "baby", "Beauty & Personal Care": "beauty-health", Books: "books-media", "Clothing, Shoes & Jewelry": "clothing", Electronics: "consumer-electronics", "Grocery & Gourmet Food": "grocery", Handmade: "handmade", "Health & Household": "beauty-health", "Home & Kitchen": "home-kitchen", "Industrial & Scientific": "industrial", Luggage: "luggage", "Musical Instruments": "musical", "Office Products": "office", "Patio, Lawn & Garden": "lawn-garden", "Pet Supplies": "pet", "Sports & Outdoors": "sports", "Tools & Home Improvement": "tools", "Toys & Games": "toys", "Video Games": "video-games",
  },
  CA: {
    Automotive: "automotive", Baby: "baby", "Beauty & Personal Care": "beauty-health", Books: "books-media", "Clothing, Shoes & Accessories": "clothing", Electronics: "consumer-electronics", "Grocery & Gourmet Food": "grocery", "Health & Personal Care": "beauty-health", "Home & Kitchen": "home-kitchen", "Industrial & Scientific": "industrial", "Luggage & Bags": "luggage", "Office Products": "office", "Patio, Lawn & Garden": "lawn-garden", "Pet Supplies": "pet", "Sports & Outdoors": "sports", "Tools & Home Improvement": "tools", "Toys & Games": "toys", "Video Games": "video-games",
  },
  UK: {
    Automotive: "automotive", "Baby Products": "baby", Beauty: "beauty-health", Books: "books", Clothing: "clothing", "DIY & Tools": "tools", "Electronics & Photo": "consumer-electronics", "Garden & Outdoors": "lawn-garden", Grocery: "grocery", "Health & Personal Care": "beauty-health", "Home & Kitchen": "home-products", "Industrial & Scientific": "industrial", Luggage: "luggage", "Musical Instruments & DJ": "musical", "Office Products": "office", "Pet Supplies": "pet", "Sports & Outdoors": "sports", "Toys & Games": "toys", "Video Games": "video-games",
  },
  DE: {
    "Auto & Motorrad": "automotive", Baby: "baby", Beauty: "beauty-health", Bekleidung: "clothing", Bücher: "books", "Drogerie & Körperpflege": "beauty-health", "Elektronik & Foto": "consumer-electronics", Garten: "lawn-garden", Haustier: "pet", "Küche, Haushalt & Wohnen": "home-products", "Lebensmittel & Getränke": "grocery", Musikinstrumente: "musical", "Schuhe & Handtaschen": "luggage", "Sport & Freizeit": "sports", Spielzeug: "toys", "Werkzeug & Baumarkt": "tools", Bürobedarf: "office", "Gewerbe, Industrie & Wissenschaft": "industrial", Games: "video-games",
  },
  JP: {
    "Amazonデバイス・アクセサリ": "amazon-device-accessories", おもちゃ: "toys", "カー・バイク用品": "automotive", ゲーム: "video-games", "シューズ＆バッグ": "shoes", "スポーツ＆アウトドア": "sports", ドラッグストア: "beauty-health", ビューティー: "beauty-health", ファッション: "fashion", "ベビー＆マタニティ": "baby", ペット用品: "pet", "ホーム＆キッチン": "home-kitchen", ホビー: "toys", "家電＆カメラ": "electronics", "文房具・オフィス用品": "office", 本: "media", "楽器・音響機器": "musical", "産業・研究開発用品": "industrial", "食品・飲料・お酒": "food", "DIY・工具・ガーデン": "diy",
  },
};

export function getReferralFeeCategories(salesSite: SalesSite): readonly ReferralFeeCategory[] {
  return REFERRAL_FEE_CATEGORIES[salesSite];
}

export function getDefaultReferralCategory(salesSite: SalesSite, browseCategory: string): string {
  return DEFAULT_REFERRAL_CATEGORY_BY_BROWSE_NODE[salesSite][browseCategory] ?? REFERRAL_FEE_CATEGORIES[salesSite][0].id;
}

export function calculateReferralFee(salesSite: SalesSite, categoryId: string, price: number): ReferralFeeQuote {
  const categories = REFERRAL_FEE_CATEGORIES[salesSite];
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const safePrice = positive(price);
  const rawFee = category.calculateRawFee(safePrice);
  const fee = safePrice > 0 ? roundFee(salesSite, Math.max(rawFee, category.minimumFee)) : 0;
  return {
    categoryId: category.id,
    categoryLabel: category.label,
    price: safePrice,
    fee,
    effectiveRate: safePrice > 0 ? fee / safePrice : 0,
    minimumFee: category.minimumFee,
    minimumApplied: safePrice > 0 && category.minimumFee > rawFee,
    ruleDescription: category.ruleDescription,
    note: category.note,
  };
}
