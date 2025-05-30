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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type HarvestLockLiquidityParams, type HarvestLockLiquidityResult, harvestLockLiquidity } from "@/lib/liquidity/cpmm/harvest-lock";
import { type LockLiquidityParams, type LockLiquidityResult, lockLiquidity } from "@/lib/liquidity/cpmm/lock";
import useUmiStore, { ConnectionStatus, Network } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  AlertCircle,
  CheckCircle,
  Droplets,

  Lock,
  RefreshCw,
  Settings2,
  Tractor,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Lock Liquidity Schema
const lockLiquiditySchema = z.object({
  poolId: z.string().min(1, "Pool ID is required"),
  lpAmount: z.number().min(0.000001, "LP amount must be greater than 0").optional(),
  withMetadata: z.boolean(),
  computeBudgetUnits: z.number().min(100000).max(1400000),
  computeBudgetMicroLamports: z.number().min(1000).max(100000000),
});

// Harvest Lock Schema
const harvestLockSchema = z.object({
  poolId: z.string().min(1, "Pool ID is required"),
  nftMint: z.string().min(1, "NFT mint address is required"),
  lpFeeAmount: z.number().min(1, "LP fee amount must be greater than 0"),
  closeWsol: z.boolean(),
  computeBudgetUnits: z.number().min(100000).max(1400000),
  computeBudgetMicroLamports: z.number().min(1000).max(100000000),
});

type LockLiquidityFormData = z.infer<typeof lockLiquiditySchema>;
type HarvestLockFormData = z.infer<typeof harvestLockSchema>;

interface TokenBalance {
  mint: string;
  amount: bigint;
  decimals: number;
  symbol: string;
  name: string;
  formattedAmount: string;
  uiAmount: number;
}

const LoadingSpinner = ({ className }: { className?: string }) => (
  <div
    className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
  />
);

const LockLiquidityForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<LockLiquidityResult | null>(null);
  const [availableTokens, setAvailableTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const {
    umi,
    connection,
    network,
    getTokenBalances,
    signer,
    connectionStatus,
  } = useUmiStore();

  const form = useForm<LockLiquidityFormData>({
    resolver: zodResolver(lockLiquiditySchema),
    defaultValues: {
      poolId: "",
      lpAmount: undefined,
      withMetadata: true,
      computeBudgetUnits: 600000,
      computeBudgetMicroLamports: 46591500,
    },
  });

  useEffect(() => {
    const loadTokenBalances = async () => {
      if (!signer || connectionStatus !== ConnectionStatus.CONNECTED) {
        setAvailableTokens([]);
        return;
      }

      setLoadingTokens(true);
      try {
        const balances = await getTokenBalances();
        const formattedTokens: TokenBalance[] = balances.map((token) => ({
          mint: token.mint.toString(),
          amount: token.amount,
          decimals: token.decimals,
          symbol: token.symbol,
          name: token.name,
          formattedAmount: (
            Number(token.amount) /
            10 ** token.decimals
          ).toLocaleString(),
          uiAmount: Number(token.amount) / 10 ** token.decimals,
        }));

        setAvailableTokens(formattedTokens);
      } catch (error) {
        console.error("Failed to load token balances:", error);
        setAvailableTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };

    loadTokenBalances();
  }, [signer, connectionStatus, getTokenBalances]);

  const handleSubmit = async (data: LockLiquidityFormData) => {
    if (!umi || !connection() || !umi.identity) {
      console.error("Wallet not connected");
      return;
    }

    setIsSubmitting(true);
    try {
      const params: LockLiquidityParams = {
        umi,
        connection: connection(),
        network,
        signer: umi.identity,
        poolIdParam: data.poolId,
        lpAmountParam: data.lpAmount ? new BN(Math.floor(data.lpAmount * 1e9)) : undefined,
        withMetadata: data.withMetadata,
        computeBudgetUnits: data.computeBudgetUnits,
        computeBudgetMicroLamports: data.computeBudgetMicroLamports,
      };

      const lockResult = await lockLiquidity(params);
      setResult(lockResult);
      form.reset();
    } catch (error) {
      console.error("Failed to lock liquidity:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Pool ID */}
        <FormField
          control={form.control}
          name="poolId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pool ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter pool ID to lock liquidity from"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The pool ID where you want to lock LP tokens
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* LP Amount */}
        <FormField
          control={form.control}
          name="lpAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LP Amount (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  placeholder="Leave empty to lock all available LP tokens"
                  {...field}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                />
              </FormControl>
              <FormDescription>
                Amount of LP tokens to lock. If not specified, all available LP tokens will be locked.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Metadata Option */}
        <FormField
          control={form.control}
          name="withMetadata"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Include Metadata</FormLabel>
                <FormDescription>
                  Include metadata in the lock transaction
                </FormDescription>
              </div>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Advanced Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-advanced-lock"
              checked={showAdvanced}
              onCheckedChange={(checked) => setShowAdvanced(checked === true)}
            />
            <label
              htmlFor="show-advanced-lock"
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4" />
              Advanced Settings
            </label>
          </div>

          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="computeBudgetUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compute Units</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="computeBudgetMicroLamports"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Fee (μLamports)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !umi?.identity}
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner className="mr-2 h-4 w-4" />
              Locking Liquidity...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Lock Liquidity
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};

const HarvestLockForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<HarvestLockLiquidityResult | null>(null);

  const { umi, connection, network } = useUmiStore();

  const form = useForm<HarvestLockFormData>({
    resolver: zodResolver(harvestLockSchema),
    defaultValues: {
      poolId: "",
      nftMint: "",
      lpFeeAmount: 99999999,
      closeWsol: false,
      computeBudgetUnits: 600000,
      computeBudgetMicroLamports: 46591500,
    },
  });

  const handleSubmit = async (data: HarvestLockFormData) => {
    if (!umi || !connection() || !umi.identity) {
      console.error("Wallet not connected");
      return;
    }

    setIsSubmitting(true);
    try {
      const params: HarvestLockLiquidityParams = {
        umi,
        connection: connection(),
        network,
        signer: umi.identity,
        poolIdParam: data.poolId,
        nftMintParam: new PublicKey(data.nftMint),
        lpFeeAmountParam: new BN(data.lpFeeAmount),
        closeWsol: data.closeWsol,
        computeBudgetUnits: data.computeBudgetUnits,
        computeBudgetMicroLamports: data.computeBudgetMicroLamports,
      };

      const harvestResult = await harvestLockLiquidity(params);
      setResult(harvestResult);
      form.reset();
    } catch (error) {
      console.error("Failed to harvest lock liquidity:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Pool ID */}
        <FormField
          control={form.control}
          name="poolId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pool ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter pool ID to harvest from"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The pool ID where you want to harvest locked liquidity rewards
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* NFT Mint */}
        <FormField
          control={form.control}
          name="nftMint"
          render={({ field }) => (
            <FormItem>
              <FormLabel>NFT Mint Address</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter NFT mint address"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The NFT mint address associated with your locked position
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* LP Fee Amount */}
        <FormField
          control={form.control}
          name="lpFeeAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LP Fee Amount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                The LP fee amount to harvest from the locked position
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Close WSOL Option */}
        <FormField
          control={form.control}
          name="closeWsol"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Close WSOL Account</FormLabel>
                <FormDescription>
                  Close the WSOL account after harvesting
                </FormDescription>
              </div>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Advanced Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-advanced-harvest"
              checked={showAdvanced}
              onCheckedChange={(checked) => setShowAdvanced(checked === true)}
            />
            <label
              htmlFor="show-advanced-harvest"
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4" />
              Advanced Settings
            </label>
          </div>

          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="computeBudgetUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compute Units</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="computeBudgetMicroLamports"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Fee (μLamports)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !umi?.identity}
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner className="mr-2 h-4 w-4" />
              Harvesting Lock Rewards...
            </>
          ) : (
            <>
              <Tractor className="mr-2 h-4 w-4" />
              Harvest Lock Rewards
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};

const LockLiquidityPage = () => {
  const [activeTab, setActiveTab] = useState<"lock" | "harvest">("lock");
  const { umi } = useUmiStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-secondary/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

      <div className="container mx-auto px-4 py-12 max-w-4xl relative">
        {/* Hero Section */}
        <article className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 mb-8 relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-orange-500/5 animate-pulse" />
          </div>
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 bg-clip-text text-transparent mb-6 tracking-tight">
            Lock Liquidity
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-3 max-w-3xl mx-auto font-medium">
            Lock LP tokens and harvest rewards from locked positions
          </p>
          <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
            Secure your liquidity and earn additional rewards through the locking mechanism
          </p>
        </article>

        {/* Main form with tabs */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="w-5 h-5" />
              Liquidity Lock Manager
            </CardTitle>
            <CardDescription>
              Lock LP tokens or harvest rewards from existing locked positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "lock" | "harvest")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="lock" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Lock Liquidity
                </TabsTrigger>
                <TabsTrigger value="harvest" className="flex items-center gap-2">
                  <Tractor className="w-4 h-4" />
                  Harvest Rewards
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lock" className="space-y-6">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 mb-2">
                    <Lock className="w-4 h-4" />
                    <span className="font-medium text-sm">Lock Liquidity</span>
                  </div>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Lock your LP tokens to prevent withdrawal for a specified period. This may provide additional rewards or benefits.
                  </p>
                </div>
                <LockLiquidityForm />
              </TabsContent>

              <TabsContent value="harvest" className="space-y-6">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-200 mb-2">
                    <Tractor className="w-4 h-4" />
                    <span className="font-medium text-sm">Harvest Rewards</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Collect rewards from your locked liquidity positions. You'll need the NFT mint address that represents your locked position.
                  </p>
                </div>
                <HarvestLockForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Connection Alert */}
        {!umi?.identity && (
          <Alert className="max-w-2xl mx-auto mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to lock liquidity or harvest rewards. Make sure you have sufficient tokens and SOL for transaction fees.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default LockLiquidityPage;