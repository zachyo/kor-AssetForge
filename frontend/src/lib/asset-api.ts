import { stellarService } from "@/lib/stellar";

export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

export interface OwnershipEntry {
  address: string;
  percentage: number;
  label: string;
}

export interface TransactionEntry {
  id: string;
  type: "buy" | "sell" | "transfer" | "mint" | "burn" | "stake" | "unstake" | "dividend";
  from: string;
  to: string;
  amount: number;
  assetId: string;
  timestamp: number;
  txHash: string;
  status: "completed" | "pending" | "failed";
}

export interface AssetDetail {
  id: string;
  code: string;
  issuer: string;
  name: string;
  description: string;
  totalSupply: string;
  decimals: number;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  allTimeHigh: number;
  allTimeLow: number;
  createdAt: number;
  verified: boolean;
  documents: {
    title: string;
    url: string;
    type: string;
  }[];
  metadata: {
    category: string;
    location: string;
    condition: string;
    tags: string[];
  };
}

export interface PortfolioData {
  totalValue: number;
  pnl24h: number;
  pnlPercentage: number;
  holdings: {
    assetId: string;
    name: string;
    symbol: string;
    balance: number;
    value: number;
    change24h: number;
    allocation: number;
  }[];
  recentActivity: {
    id: string;
    type: string;
    assetName: string;
    amount: number;
    timestamp: number;
  }[];
  pendingActions: {
    id: string;
    action: string;
    assetName: string;
    details: string;
    created: number;
  }[];
  performanceHistory: PricePoint[];
}

export interface SearchResult {
  id: string;
  name: string;
  symbol: string;
  type: string;
  price: number;
  change24h: number;
  volume: number;
  location: string;
  status: string;
  verified: boolean;
}

export interface FilterFacet {
  name: string;
  values: {
    label: string;
    value: string;
    count: number;
  }[];
}

class AssetApiService {
  private backendUrl: string;

  constructor() {
    this.backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  }

  async getAssetDetail(id: string): Promise<AssetDetail> {
    const res = await fetch(`${this.backendUrl}/api/v1/assets/${id}`);
    if (!res.ok) throw new Error("Failed to fetch asset detail");
    return res.json();
  }

  async getPriceHistory(assetId: string, period: "7d" | "30d" | "1y"): Promise<PricePoint[]> {
    const res = await fetch(`${this.backendUrl}/api/v1/assets/${assetId}/price-history?period=${period}`);
    if (!res.ok) throw new Error("Failed to fetch price history");
    return res.json();
  }

  async getOwnershipDistribution(assetId: string): Promise<OwnershipEntry[]> {
    const res = await fetch(`${this.backendUrl}/api/v1/assets/${assetId}/ownership`);
    if (!res.ok) throw new Error("Failed to fetch ownership data");
    return res.json();
  }

  async getTransactionHistory(assetId: string, limit: number = 20): Promise<TransactionEntry[]> {
    const res = await fetch(`${this.backendUrl}/api/v1/assets/${assetId}/transactions?limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return res.json();
  }

  async getRelatedAssets(assetId: string): Promise<SearchResult[]> {
    const res = await fetch(`${this.backendUrl}/api/v1/assets/${assetId}/related`);
    if (!res.ok) throw new Error("Failed to fetch related assets");
    return res.json();
  }

  async searchAssets(query: string, filters: Record<string, string>): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query, ...filters });
    const res = await fetch(`${this.backendUrl}/api/v1/search/assets?${params}`);
    if (!res.ok) throw new Error("Failed to search assets");
    return res.json();
  }

  async getFilterFacets(): Promise<FilterFacet[]> {
    const res = await fetch(`${this.backendUrl}/api/v1/search/facets`);
    if (!res.ok) throw new Error("Failed to fetch filter facets");
    return res.json();
  }

  async getAutocompleteSuggestions(query: string): Promise<string[]> {
    const res = await fetch(`${this.backendUrl}/api/v1/search/suggestions?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Failed to fetch suggestions");
    const data = await res.json();
    return data.suggestions;
  }

  async getDashboardData(): Promise<PortfolioData> {
    const res = await fetch(`${this.backendUrl}/api/v1/dashboard`);
    if (!res.ok) throw new Error("Failed to fetch dashboard data");
    return res.json();
  }

  async exportTransactionsCsv(assetId?: string, startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (assetId) params.set("asset_id", assetId);
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    const res = await fetch(`${this.backendUrl}/api/v1/dashboard/export?${params}`);
    if (!res.ok) throw new Error("Failed to export transactions");
    return res.blob();
  }

  async saveSearch(name: string, query: string, filters: Record<string, string>): Promise<void> {
    const res = await fetch(`${this.backendUrl}/api/v1/search/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, query, filters }),
    });
    if (!res.ok) throw new Error("Failed to save search");
  }
}

export const assetApi = new AssetApiService();
