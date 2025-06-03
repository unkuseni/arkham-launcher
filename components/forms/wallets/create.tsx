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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Key,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Upload,
  Wallet
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
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

  // Management state
  const [keypairs, setKeypairs] = useState<KeypairData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKeypair, setSelectedKeypair] = useState<KeypairData | null>(null);
  const [reconstructedKeypair, setReconstructedKeypair] = useState<Keypair | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

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

    try {
      const options: KeypairCreationOptions = {
        count: data.count,
        encrypt: data.encrypt,
        filePrefix: data.filePrefix,
        includeMetadata: data.includeMetadata,
        concurrencyLimit: data.concurrencyLimit
      };

      const result = await createKeypairAndUpload(publicKey.toString(), options);
      setCreateResult(result);

      // Refresh keypairs list if on manage tab
      if (activeTab === "manage") {
        await loadKeypairs();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create keypairs');
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Keypair Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Keypairs</TabsTrigger>
              <TabsTrigger value="manage">Manage Keypairs</TabsTrigger>
            </TabsList>

            {/* Create Tab */}
            <TabsContent value="create" className="space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateKeypairs)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Keypairs</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              disabled={isCreating}
                            />
                          </FormControl>
                          <FormDescription>
                            Create between 1 and 100 keypairs
                          </FormDescription>
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
                            Prefix for generated files
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
                          <FormLabel>Concurrency Limit</FormLabel>
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
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            Maximum concurrent uploads
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="encrypt"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onChange={field.onChange}
                                disabled={isCreating}
                                className="h-4 w-4"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Encrypt Secret Keys</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="includeMetadata"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onChange={field.onChange}
                                disabled={isCreating}
                                className="h-4 w-4"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Include Metadata</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isCreating || !publicKey}
                    className="w-full"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      `Create ${form.watch('count')} Keypair${form.watch('count') > 1 ? 's' : ''}`
                    )}
                  </Button>
                </form>
              </Form>

              {/* Creation Results */}
              {createError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}

              {createResult && (
                <div className="space-y-3">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Successfully created: {createResult.totalCreated} keypairs
                      {createResult.totalFailed > 0 && ` | Failed: ${createResult.totalFailed}`}
                    </AlertDescription>
                  </Alert>

                  {createResult.success.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Successful Keypairs:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {createResult.success.map((kp, index) => (
                          <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                            <p><strong>Public Key:</strong> {truncateKey(kp.publicKey)}</p>
                            {kp.url && <p><strong>URL:</strong> {kp.url.slice(0, 50)}...</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Manage Tab */}
            <TabsContent value="manage" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Your Keypairs ({keypairs.length})</h3>
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

              {!publicKey && (
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertDescription>
                    Please connect your wallet to view your keypairs.
                  </AlertDescription>
                </Alert>
              )}

              {keypairs.length === 0 && publicKey && !isLoading && (
                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    No keypairs found. Create some keypairs using the "Create" tab.
                  </AlertDescription>
                </Alert>
              )}

              {keypairs.length > 0 && (
                <div className="grid gap-4">
                  {keypairs.map((keypair) => (
                    <Card key={keypair.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={keypair.encrypted ? "default" : "secondary"}>
                                {keypair.encrypted ? "Encrypted" : "Unencrypted"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(keypair.created_at)}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <p className="text-sm font-medium">Public Key:</p>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {truncateKey(keypair.keypair_public_key)}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(keypair.keypair_public_key)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleReconstructKeypair(keypair)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(keypair.r2_url)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy URL
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => window.open(keypair.r2_url, '_blank')}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open URL
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Keypair Details</DialogTitle>
            <DialogDescription>
              View and manage your keypair information
            </DialogDescription>
          </DialogHeader>

          {selectedKeypair && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Created:</span>
                  <p className="text-muted-foreground">{formatDate(selectedKeypair.created_at)}</p>
                </div>
                <div>
                  <span className="font-medium">Encryption:</span>
                  <p className="text-muted-foreground">
                    {selectedKeypair.encrypted ? "Encrypted" : "Unencrypted"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <Label className="font-medium text-sm">Public Key:</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">
                      {selectedKeypair.keypair_public_key}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedKeypair.keypair_public_key)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {reconstructedKeypair && (
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="font-medium text-sm">Secret Key:</Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                      >
                        {showSecretKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showSecretKey ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">
                        {showSecretKey
                          ? Array.from(reconstructedKeypair.secretKey).join(',')
                          : '•'.repeat(50)
                        }
                      </code>
                      {showSecretKey && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(Array.from(reconstructedKeypair.secretKey).join(','))}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="font-medium text-sm">Storage URL:</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">
                      {selectedKeypair.r2_url}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedKeypair.r2_url)}
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
    </div>
  );
};

export default KeypairManager;