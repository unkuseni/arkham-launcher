"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  type CreateKeypairsResult,
  type KeypairCreationOptions,
  createKeypairAndUpload
} from '@/lib/create-signers';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useState } from 'react';

const KeypairCreator = () => {
  const { publicKey } = useWallet();
  const [isCreating, setIsCreating] = useState(false);
  const [count, setCount] = useState(1);
  const [result, setResult] = useState<CreateKeypairsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateKeypairs = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setIsCreating(true);
    setError(null);
    setResult(null);

    try {
      const options: KeypairCreationOptions = {
        count,
        encrypt: true,
        filePrefix: 'my-keypair',
        includeMetadata: true,
        concurrencyLimit: 3
      };

      const createResult = await createKeypairAndUpload(
        publicKey.toString(),
        options
      );

      setResult(createResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create keypairs');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Keypairs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="count" className="block text-sm font-medium mb-2">
            Number of Keypairs
          </label>
          <Input
            id="count"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={isCreating}
          />
        </div>

        <Button
          onClick={handleCreateKeypairs}
          disabled={isCreating || !publicKey}
          className="w-full"
        >
          {isCreating ? 'Creating...' : `Create ${count} Keypair${count > 1 ? 's' : ''}`}
        </Button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <h3 className="font-medium text-green-800">Creation Complete!</h3>
              <p className="text-green-700 text-sm">
                Successfully created: {result.totalCreated} keypairs
              </p>
              {result.totalFailed > 0 && (
                <p className="text-red-700 text-sm">
                  Failed: {result.totalFailed} keypairs
                </p>
              )}
            </div>

            {result.success.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Successful Keypairs:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.success.map((kp, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                      <p><strong>Public Key:</strong> {kp.publicKey.slice(0, 20)}...</p>
                      {kp.url && <p><strong>URL:</strong> {kp.url.slice(0, 50)}...</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KeypairCreator;