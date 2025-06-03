"use client";

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type CreateKeypairsResult,
  type KeypairCreationOptions,
  createKeypairAndUpload,
  getKeypairFromUrl,
  getKeypairsByWallet
} from '@/lib/create-signers';
import useUmiStore from '@/store/useUmiStore';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Keypair } from '@metaplex-foundation/umi';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Key,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  Wallet
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Form schema for keypair creation
const createKeypairSchema = z.object({
  count: z.number().min(1).max(100),
  encrypt: z.boolean(),
  filePrefix: z.string().min(1).max(50),
  includeMetadata: z.boolean(),
  concurrencyLimit: z.number().min(1).max(10),
});

type CreateKeypairFormData = z.infer<typeof createKeypairSchema>;

interface KeypairData {
  id: string;
  keypair_public_key: string;
  r2_url: string;
  r2_key: string;
  encrypted: boolean;
  created_at: string;
}

const KeypairManager = () => {
  const { umi } = useUmiStore();
  const publicKey = umi.identity.publicKey;
  const [activeTab, setActiveTab] = useState("create");

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateKeypairsResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creationProgress, setCreationProgress] = useState(0);

  // Management state
  const [keypairs, setKeypairs] = useState<KeypairData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKeypair, setSelectedKeypair] = useState<KeypairData | null>(null);
  const [reconstructedKeypair, setReconstructedKeypair] = useState<Keypair | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Filter keypairs based on search query
  const filteredKeypairs = useMemo(() => {
    if (!searchQuery) return keypairs;
    return keypairs.filter(kp => 
      kp.keypair_public_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kp.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [keypairs, searchQuery]);

  // Form setup
  const form = useForm<CreateKeypairFormData>({
    resolver: zodResolver(createKeypairSchema),
    defaultValues: {
      count: 1,
      encrypt: true,
      filePrefix: 'my-keypair',
      includeMetadata: true,
      concurrencyLimit: 3,
    },
  });

  // Load keypairs when wallet connects or tab changes
  useEffect(() => {
    if (publicKey && activeTab === "manage") {
      loadKeypairs();
    }
  }, [publicKey, activeTab]);

  // Clear copy success message after 2 seconds
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  const loadKeypairs = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    try {
      const result = await getKeypairsByWallet(publicKey.toString());
      if (result) {
        setKeypairs(result.keypairs);
      }
    } catch (error) {
      console.error('Failed to load keypairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKeypairs = async (data: CreateKeypairFormData) => {
    if (!publicKey) {
      setCreateError('Please connect your wallet first');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateResult(null);
    setCreationProgress(0);

    try {
      const options: KeypairCreationOptions = {
        count: data.count,
        encrypt: data.encrypt,
        filePrefix: data.filePrefix,
        includeMetadata: data.includeMetadata,
        concurrencyLimit: data.concurrencyLimit
      };

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setCreationProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await createKeypairAndUpload(publicKey.toString(), options);
      
      clearInterval(progressInterval);
      setCreationProgress(100);
      setCreateResult(result);

      // Refresh keypairs list if on manage tab
      if (activeTab === "manage") {
        await loadKeypairs();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create keypairs');
      setCreationProgress(0);
    } finally {
      setIsCreating(false);
    }
  };

  const handleReconstructKeypair = async (keypair: KeypairData) => {
    setIsLoading(true);
    try {
      const reconstructed = await getKeypairFromUrl(keypair.r2_url, true);
      setReconstructedKeypair(reconstructed);
      setSelectedKeypair(keypair);
    } catch (error) {
      console.error('Failed to reconstruct keypair:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label || 'Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateKey = (key: string, length = 20) => {
    return `${key.slice(0, length)}...${key.slice(-8)}`;
  };

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <TooltipProvider>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Keypair Manager</h1>
            <p className="text-muted-foreground">Create and manage your Solana keypairs securely</p>
          </div>
          
          {publicKey && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <code className="bg-muted px-2 py-1 rounded text-xs">
                {truncateKey(publicKey.toString(), 12)}
              </code>
            </div>
          )}
        </div>

        {/* Success notification */}
        {copySuccess && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{copySuccess}</AlertDescription>
          </Alert>
        )}

        <Card className="border-0 shadow-lg">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b">
                <TabsList className="grid w-full grid-cols-2 bg-transparent h-14">
                  <TabsTrigger 
                    value="create" 
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Create Keypairs
                  </TabsTrigger>
                  <TabsTrigger 
                    value="manage"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Manage Keypairs
                    {keypairs.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {keypairs.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Create Tab */}
              <TabsContent value="create" className="p-6 space-y-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Form Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Configuration</h3>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleCreateKeypairs)} className="space-y-4">
                        <div className="grid gap-4">
                          <FormField
                            control={form.control}
                            name="count"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  Number of Keypairs
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Create between 1 and 100 keypairs at once</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    disabled={isCreating}
                                    className="text-center"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="filePrefix"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>File Prefix</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    disabled={isCreating}
                                    placeholder="my-keypair"
                                  />
                                </FormControl>
                                <FormDescription>
                                  This will be used as a prefix for your keypair files
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="concurrencyLimit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  Concurrency Limit
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Higher values = faster creation but more resource intensive</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </FormLabel>
                                <FormControl>
                                  <Select
                                    value={field.value.toString()}
                                    onValueChange={(value) => field.onChange(Number(value))}
                                    disabled={isCreating}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="1">1 (Slow)</SelectItem>
                                      <SelectItem value="3">3 (Balanced)</SelectItem>
                                      <SelectItem value="5">5 (Fast)</SelectItem>
                                      <SelectItem value="10">10 (Very Fast)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h4 className="font-medium text-sm">Security Options</h4>
                          <div className="space-y-3">
                            <FormField
                              control={form.control}
                              name="encrypt"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <Shield className="h-4 w-4 text-blue-500" />
                                    <div>
                                      <FormLabel className="!mt-0 font-medium">Encrypt Secret Keys</FormLabel>
                                      <p className="text-xs text-muted-foreground">
                                        Recommended for enhanced security
                                      </p>
                                    </div>
                                  </div>
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      disabled={isCreating}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="includeMetadata"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <Key className="h-4 w-4 text-green-500" />
                                    <div>
                                      <FormLabel className="!mt-0 font-medium">Include Metadata</FormLabel>
                                      <p className="text-xs text-muted-foreground">
                                        Store creation date and other info
                                      </p>
                                    </div>
                                  </div>
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      disabled={isCreating}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {isCreating && creationProgress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Creating keypairs...</span>
                              <span>{creationProgress}%</span>
                            </div>
                            <Progress value={creationProgress} className="h-2" />
                          </div>
                        )}

                        <Button
                          type="submit"
                          disabled={isCreating || !publicKey}
                          className="w-full h-12"
                          size="lg"
                        >
                          {isCreating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating {form.watch('count')} keypair{form.watch('count') > 1 ? 's' : ''}...
                            </>
                          ) : (
                            <>
                              <Key className="mr-2 h-4 w-4" />
                              Create {form.watch('count')} Keypair{form.watch('count') > 1 ? 's' : ''}
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </div>

                  {/* Preview/Results Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Preview</h3>
                    <Card className="bg-muted/30">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Keypairs to create:</span>
                          <Badge variant="outline">{form.watch('count')}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Encryption:</span>
                          <div className="flex items-center gap-1">
                            {form.watch('encrypt') ? (
                              <ShieldCheck className="h-3 w-3 text-green-500" />
                            ) : (
                              <Shield className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span>{form.watch('encrypt') ? 'Enabled' : 'Disabled'}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">File prefix:</span>
                          <code className="text-xs bg-background px-1 rounded">
                            {form.watch('filePrefix')}-*.json
                          </code>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Creation Results */}
                    {createError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{createError}</AlertDescription>
                      </Alert>
                    )}

                    {createResult && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          Successfully created <strong>{createResult.totalCreated}</strong> keypairs
                          {createResult.totalFailed > 0 && (
                            <> | Failed: <strong>{createResult.totalFailed}</strong></>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Manage Tab */}
              <TabsContent value="manage" className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Your Keypairs</h3>
                    <p className="text-sm text-muted-foreground">
                      {keypairs.length > 0 ? `Manage your ${keypairs.length} keypairs` : 'No keypairs found'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {keypairs.length > 3 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search keypairs..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 w-64"
                        />
                      </div>
                    )}
                    
                    <Button
                      onClick={loadKeypairs}
                      disabled={isLoading || !publicKey}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {!publicKey && (
                  <Alert>
                    <Wallet className="h-4 w-4" />
                    <AlertDescription>
                      Please connect your wallet to view your keypairs.
                    </AlertDescription>
                  </Alert>
                )}

                {isLoading ? (
                  <LoadingSkeleton />
                ) : filteredKeypairs.length === 0 && publicKey && !isLoading ? (
                  <Card className="p-8 text-center">
                    <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No keypairs found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery ? 'No keypairs match your search.' : 'Create some keypairs using the "Create" tab.'}
                    </p>
                    {!searchQuery && (
                      <Button onClick={() => setActiveTab("create")} variant="outline">
                        <Key className="mr-2 h-4 w-4" />
                        Create Keypairs
                      </Button>
                    )}
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {filteredKeypairs.map((keypair) => (
                      <Card key={keypair.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge 
                                  variant={keypair.encrypted ? "default" : "secondary"}
                                  className="flex items-center gap-1"
                                >
                                  {keypair.encrypted ? (
                                    <ShieldCheck className="h-3 w-3" />
                                  ) : (
                                    <Shield className="h-3 w-3" />
                                  )}
                                  {keypair.encrypted ? "Encrypted" : "Unencrypted"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(keypair.created_at)}
                                </span>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground">
                                  PUBLIC KEY
                                </Label>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 min-w-0">
                                    {truncateKey(keypair.keypair_public_key, 24)}
                                  </code>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyToClipboard(keypair.keypair_public_key, 'Public key copied')}
                                        className="shrink-0"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy public key</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => handleReconstructKeypair(keypair)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => copyToClipboard(keypair.keypair_public_key, 'Public key copied')}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy Public Key
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => copyToClipboard(keypair.r2_url, 'URL copied')}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy Storage URL
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => window.open(keypair.r2_url, '_blank')}
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Open in Browser
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Keypair Details Dialog */}
        <Dialog open={!!selectedKeypair} onOpenChange={() => {
          setSelectedKeypair(null);
          setReconstructedKeypair(null);
          setShowSecretKey(false);
        }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Keypair Details
              </DialogTitle>
              <DialogDescription>
                View and manage your keypair information securely
              </DialogDescription>
            </DialogHeader>

            {selectedKeypair && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">CREATED</p>
                    <p className="text-sm font-medium">{formatDate(selectedKeypair.created_at)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">ENCRYPTION</p>
                    <div className="flex items-center justify-center gap-1">
                      {selectedKeypair.encrypted ? (
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                      ) : (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      )}
                      <p className="text-sm font-medium">
                        {selectedKeypair.encrypted ? "Encrypted" : "Unencrypted"}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">STATUS</p>
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Active
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label className="font-medium text-sm mb-2 block">Public Key</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-3 py-2 rounded font-mono flex-1 break-all border">
                        {selectedKeypair.keypair_public_key}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(selectedKeypair.keypair_public_key, 'Public key copied')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {reconstructedKeypair && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-medium text-sm">Secret Key</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowSecretKey(!showSecretKey)}
                        >
                          {showSecretKey ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showSecretKey ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-3 py-2 rounded font-mono flex-1 break-all border min-h-[2.5rem] flex items-center">
                          {showSecretKey
                            ? `[${Array.from(reconstructedKeypair.secretKey).join(',')}]`
                            : '•'.repeat(64) + ' (Secret key hidden for security)'
                          }
                        </code>
                        {showSecretKey && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(
                              `[${Array.from(reconstructedKeypair.secretKey).join(',')}]`,
                              'Secret key copied'
                            )}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {showSecretKey && (
                        <Alert className="mt-2 border-orange-200 bg-orange-50">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-800 text-xs">
                            Keep your secret key safe and never share it with anyone.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  <div>
                    <Label className="font-medium text-sm mb-2 block">Storage URL</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-3 py-2 rounded font-mono flex-1 break-all border">
                        {selectedKeypair.r2_url}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(selectedKeypair.r2_url, 'URL copied')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(selectedKeypair.r2_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </div>
  );
};

export default KeypairManager;