"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { fetchRpcPoolInfo } from "@/lib/liquidity/cpmm/fetch-pool-info";
import useUmiStore, { ConnectionStatus, Network } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { fetchMint } from "@metaplex-foundation/mpl-toolbox";
import {
  AlertCircle,
  Copy,
  DollarSign,
  ExternalLink,
  Info,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Form schema
const poolInfoSchema = z.object({
  poolId: z.string().min(1, "Pool ID is required"),
});

type PoolInfoFormData = z.infer<typeof poolInfoSchema>;

interface PoolDisplayData {
  poolId: string;
  poolPrice: number;
  baseTokenMint: string;
  quoteTokenMint: string;
  baseTokenSymbol?: string;
  baseTokenDecimals?: number;
  baseTokenFees?: number;
  baseFundFees?: number;
  quoteFundFees?: number;
  quoteTokenFees?: number;
  quoteTokenDecimals?: number;
  quoteTokenSymbol?: string;
  baseReserve: string;
  quoteReserve: string;
  lpSupply: string;
  lpDecimals: number;
  feeRate: string;
  lastUpdated: number;
}

interface PopularPool {
  id: string;
  name: string;
  description: string;
  category: "stable" | "volatile" | "meme";
}

const LoadingSpinner = ({ className }: { className?: string }) => (
  <div
    className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
  />
);

const POPULAR_POOLS: PopularPool[] = [
  {
    id: "4y81XN75NGct6iUYkBp2ixQKtXdrQxxMVgFbFF9w5n4u",
    name: "SOL-RAY",
    description: "Solana - Raydium",
    category: "volatile",
  },
  {
    id: "6rXSohG2esLJMzKZzpFr1BXUeXg8Cr5Gv3TwbuXbrwQq",
    name: "SOL-USDC",
    description: "Solana - USD Coin",
    category: "stable",
  },
  {
    id: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
    name: "SOL-USDT",
    description: "Solana - Tether USD",
    category: "stable",
  },
];

const PoolInfo = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [poolData, setPoolData] = useState<PoolDisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchedPool, setLastSearchedPool] = useState<string>("");

  const { umi, network, connectionStatus } = useUmiStore();

  const form = useForm<PoolInfoFormData>({
    resolver: zodResolver(poolInfoSchema),
    defaultValues: {
      poolId: "",
    },
  });

  const watchedPoolId = form.watch("poolId");

  // Auto-fetch when pool ID is valid and changed
  useEffect(() => {
    const poolId = watchedPoolId?.trim();
    if (poolId && poolId.length >= 32 && poolId !== lastSearchedPool) {
      const timeoutId = setTimeout(() => {
        handleFetchPoolInfo(poolId);
      }, 1000); // Debounce for 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [watchedPoolId, lastSearchedPool]);

  const handleFetchPoolInfo = async (poolIdOverride?: string) => {
    const poolId = poolIdOverride || form.getValues("poolId");

    if (!poolId?.trim()) {
      setError("Please enter a pool ID");
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastSearchedPool(poolId);

    try {
      const poolInfo = await fetchRpcPoolInfo(poolId);

      if (!poolInfo) {
        setError("Pool not found or invalid pool ID");
        setPoolData(null);
        return;
      }


      // Transform the data for display
      const displayData: PoolDisplayData = {
        poolId,
        poolPrice: poolInfo.poolPrice?.toNumber() || 0,
        baseTokenMint: poolInfo.mintA?.toString() || "Unknown",
        baseTokenDecimals: poolInfo.mintDecimalA || 0,
        baseTokenFees: poolInfo.protocolFeesMintA?.toNumber() || 0,
        baseFundFees: poolInfo.fundFeesMintA?.toNumber() || 0,
        quoteFundFees: poolInfo.fundFeesMintB?.toNumber() || 0,
        quoteTokenMint: poolInfo.mintB?.toString() || "Unknown",
        quoteTokenFees: poolInfo.protocolFeesMintB?.toNumber() || 0,
        quoteTokenDecimals: poolInfo.mintDecimalB || 0,
        baseTokenSymbol: "Token A", // You might want to fetch actual token metadata
        quoteTokenSymbol: "Token B",
        baseReserve: poolInfo.baseReserve?.toString() || "0",
        quoteReserve: poolInfo.quoteReserve?.toString() || "0",
        lpSupply: poolInfo.lpAmount?.toString() || "0",
        lpDecimals: poolInfo.lpDecimals || 0,
        feeRate: "0.25%", // Default fee rate, might be in poolInfo
        lastUpdated: Date.now(),
      };
      setPoolData(displayData);
    } catch (err) {
      console.error("Error fetching pool info:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch pool information");
      setPoolData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: PoolInfoFormData) => {
    await handleFetchPoolInfo(data.poolId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You might want to add a toast notification here
  };

  const selectPopularPool = (poolId: string) => {
    form.setValue("poolId", poolId);
    handleFetchPoolInfo(poolId);
  };

  const formatNumber = (num: string | number, decimals = 6): string => {
    const value = typeof num === "string" ? Number.parseFloat(num) : num;
    if (Number.isNaN(value)) return "0";

    if (value === 0) return "0";
    if (value < (1 * 10 ** -decimals)) return `< ${(1 * 10 ** -decimals).toFixed(2)}`;
    if (value >= (1 * 10 ** decimals)) return `${(value / (1 * 10 ** decimals)).toFixed(2)}`;
    if (value >= 1 * 10 ** (decimals / 2)) return `${(value / (1 * 10 ** (decimals / 2))).toFixed(2)}K`;

    return value.toFixed(decimals);
  };

  const getExplorerUrl = (address: string) => {
    return network === Network.MAINNET
      ? `https://solscan.io/account/${address}`
      : `https://solscan.io/account/${address}?cluster=${network}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-secondary/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />

      <div className="container mx-auto px-4 py-12 max-w-4xl relative">
        {/* Hero Section */}
        <article className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/10 mb-8 relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg flex items-center justify-center">
              <Info className="w-6 h-6 text-white" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-blue-500/5 animate-pulse" />
          </div>
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-blue-500 via-purple-600 to-blue-500 bg-clip-text text-transparent mb-6 tracking-tight">
            Pool Info
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-3 max-w-3xl mx-auto font-medium">
            Get detailed information about CPMM liquidity pools
          </p>
          <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
            View pool reserves, prices, and trading metrics
          </p>
        </article>

        {/* Search Form */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Pool Information Lookup
            </CardTitle>
            <CardDescription>
              Enter a pool ID to fetch detailed pool information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="poolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pool ID</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="Enter pool ID (e.g., 4y81XN75NGct6iUYkBp2ixQKtXdrQxxMVgFbFF9w5n4u)"
                            {...field}
                            className="font-mono"
                          />
                        </FormControl>
                        <Button
                          type="submit"
                          disabled={isLoading || !field.value?.trim()}
                          className="shrink-0"
                        >
                          {isLoading ? (
                            <LoadingSpinner className="h-4 w-4" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <FormDescription>
                        Enter a valid CPMM pool ID to fetch its information
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>

            {/* Popular Pools */}
            <div className="mt-6">
              <Label className="text-sm font-medium mb-3 block">Popular Pools</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {POPULAR_POOLS.map((pool) => (
                  <Button
                    key={pool.id}
                    variant="outline"
                    size="sm"
                    onClick={() => selectPopularPool(pool.id)}
                    className="justify-start h-auto p-3"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{pool.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {pool.description}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert className="max-w-2xl mx-auto mb-8 border-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Pool Data Display */}
        {poolData && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Pool Details
                  </CardTitle>
                  <CardDescription>
                    Information for pool {poolData.poolId.slice(0, 8)}...{poolData.poolId.slice(-8)}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFetchPoolInfo()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pool Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Label className="text-sm text-muted-foreground">Pool Price</Label>
                  <p className="text-2xl font-bold">{formatNumber(poolData.poolPrice, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {poolData.quoteTokenSymbol} per {poolData.baseTokenSymbol}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Label className="text-sm text-muted-foreground">LP Supply</Label>
                  <p className="text-2xl font-bold">{formatNumber(poolData.lpSupply, poolData.lpDecimals)}</p>
                  <p className="text-xs text-muted-foreground">Total LP tokens</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Label className="text-sm text-muted-foreground">Fee Rate</Label>
                  <p className="text-2xl font-bold">{poolData.feeRate}</p>
                  <p className="text-xs text-muted-foreground">Trading fee</p>
                </div>
              </div>

              <Separator />

              {/* Token Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Token Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Base Token */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-medium">{poolData.baseTokenSymbol} (Base)</Label>
                      <Badge variant="outline">Token A</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Mint Address</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono">
                            {poolData.baseTokenMint.slice(0, 6)}...{poolData.baseTokenMint.slice(-6)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(poolData.baseTokenMint)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(getExplorerUrl(poolData.baseTokenMint), "_blank")}
                            className="h-6 w-6 p-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Reserve</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.baseReserve, poolData.baseTokenDecimals)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Protocol Fees</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.baseTokenFees || 0, poolData.baseTokenDecimals)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Fund Fees</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.baseFundFees || 0, poolData.baseTokenDecimals)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quote Token */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-medium">{poolData.quoteTokenSymbol} (Quote)</Label>
                      <Badge variant="outline">Token B</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Mint Address</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono">
                            {poolData.quoteTokenMint.slice(0, 6)}...{poolData.quoteTokenMint.slice(-6)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(poolData.quoteTokenMint)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(getExplorerUrl(poolData.quoteTokenMint), "_blank")}
                            className="h-6 w-6 p-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Reserve</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.quoteReserve, poolData.quoteTokenDecimals)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Protocol Fees</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.quoteTokenFees || 0, poolData.quoteTokenDecimals)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Fund Fees</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.quoteFundFees || 0, poolData.quoteTokenDecimals)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Fee Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Fee Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">Protocol Fees</Label>
                    <div className="space-y-1 mt-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{poolData.baseTokenSymbol}:</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.baseTokenFees || 0, poolData.baseTokenDecimals)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{poolData.quoteTokenSymbol}:</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.quoteTokenFees || 0, poolData.quoteTokenDecimals)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <Label className="text-sm font-medium text-green-700 dark:text-green-300">Fund Fees</Label>
                    <div className="space-y-1 mt-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{poolData.baseTokenSymbol}:</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.baseFundFees || 0, poolData.baseTokenDecimals)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{poolData.quoteTokenSymbol}:</span>
                        <span className="text-sm font-mono">{formatNumber(poolData.quoteFundFees || 0, poolData.quoteTokenDecimals)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pool Actions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Pool Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(poolData.poolId)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Pool ID
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(getExplorerUrl(poolData.poolId), "_blank")}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Explorer
                  </Button>
                </div>
              </div>

              {/* Last Updated */}
              <div className="text-xs text-muted-foreground text-center pt-4">
                Last updated: {new Date(poolData.lastUpdated).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection Alert */}
        {connectionStatus !== ConnectionStatus.CONNECTED && (
          <Alert className="max-w-2xl mx-auto mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connect your wallet for the best experience. Pool information can still be viewed without connection.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default PoolInfo;