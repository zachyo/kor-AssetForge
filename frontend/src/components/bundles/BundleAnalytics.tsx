"use client";

import { BundleRecord } from "./BundleList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, ShoppingCart, BarChart2 } from "lucide-react";

interface BundleAnalyticsProps {
  bundles: BundleRecord[];
}

export function BundleAnalytics({ bundles }: BundleAnalyticsProps) {
  const total = bundles.length;
  const active = bundles.filter((b) => b.status === "Active").length;
  const listed = bundles.filter((b) => b.status === "Listed").length;
  const sold = bundles.filter((b) => b.status === "Sold").length;
  const totalAssets = bundles.reduce((sum, b) => sum + b.asset_ids.length, 0);
  const totalVolume = bundles
    .filter((b) => b.status === "Sold")
    .reduce((sum, b) => sum + b.list_price, 0);
  const avgBundleSize = total > 0 ? (totalAssets / total).toFixed(1) : "0";
  const listingRate = total > 0 ? Math.round(((listed + sold) / total) * 100) : 0;

  const stats = [
    { label: "Total Bundles", value: total, icon: <Package className="h-5 w-5 text-blue-500" /> },
    { label: "Listed", value: listed, icon: <TrendingUp className="h-5 w-5 text-amber-500" /> },
    { label: "Sold", value: sold, icon: <ShoppingCart className="h-5 w-5 text-green-500" /> },
    {
      label: "Total Volume",
      value: `${totalVolume.toLocaleString()} stroops`,
      icon: <BarChart2 className="h-5 w-5 text-purple-500" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {s.icon}
                {s.label}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg. Assets per Bundle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgBundleSize}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Listing Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{listingRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {active} active, {listed} listed, {sold} sold
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}