# CPMM Liquidity Operations - Refactored Architecture

## Overview

This refactoring centralizes common functionality across all CPMM (Constant Product Market Maker) operations into a unified base system, improving code maintainability, error handling, and consistency.

## Architecture Changes

### 1. **Base Module (`base.ts`)**

The new base module provides:

- **Unified Error Handling**: Custom `CPMMOperationError` class with operation context
- **Common Parameter Validation**: Standardized validation for all operations
- **SDK Initialization**: Centralized Raydium SDK setup
- **Pool Data Fetching**: Network-agnostic pool information retrieval
- **Transaction Configuration**: Consistent transaction settings
- **Result Standardization**: Common transaction result format

### 2. **Key Improvements**

#### **Error Handling**

```typescript
export class CPMMOperationError extends Error {
 constructor(
  message: string,
  public readonly code: string,
  public readonly operation: string,
  public readonly details?: any,
 ) {
  super(message);
  this.name = "CPMMOperationError";
 }
}
```

**Benefits:**

- Operation-specific error context
- Structured error codes for programmatic handling
- Detailed error information for debugging
- Consistent error format across all operations

#### **Network-Agnostic Pool Data Fetching**

```typescript
export async function getPoolData(
 raydium: any,
 poolId: string,
 operation: string,
 includeRpcData = false,
): Promise<PoolData>
```

**Benefits:**

- Handles mainnet (API) vs devnet (RPC) differences automatically
- Optional RPC data inclusion for operations that need it (swaps)
- Consistent pool validation across operations
- Centralized pool data error handling

#### **Standardized Transaction Results**

```typescript
export interface CPMMTransactionResult {
 txId: string;
 poolId: string;
 timestamp: number;
 network: Network;
 explorerUrl: string;
}
```

**Benefits:**

- Consistent return format across all operations
- Automatic explorer URL generation
- Operation timestamp tracking
- Network-specific URL formatting

## Refactored Operations

### 1. **Remove Liquidity (`remove.ts`)**

#### **Before:**

- Manual parameter validation
- Inline SDK initialization
- Hardcoded configuration values
- Basic error handling
- Inconsistent return format

#### **After:**

```typescript
export const removeFromCPMMPool = async (
 params: RemoveFromCPMMPoolParams,
): Promise<RemoveLiquidityResult>
```

**Improvements:**

- Extends base parameters for consistency
- Comprehensive parameter validation
- Configurable slippage and closeWsol options
- Enhanced error context
- Structured result with operation-specific data

#### **Usage:**

```typescript
const result = await removeFromCPMMPool({
 umi,
 connection,
 network,
 signer,
 poolIdParam: "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny",
 lpAmountParam: new BN(1000),
 slippagePercent: 1,
 closeWsol: true,
});

console.log(`Removed liquidity: ${result.explorerUrl}`);
```

### 2. **Swap (`swap.ts`)**

#### **Before:**

- Manual RPC data fetching
- Inline mint validation
- Limited slippage validation
- Basic logging

#### **After:**

```typescript
export const swap = async (params: SwapParams): Promise<SwapResult>
```

**Improvements:**

- Automatic RPC data inclusion for calculations
- Enhanced mint validation with descriptive errors
- Comprehensive slippage range validation
- Detailed swap result including fees and amounts
- Better transaction logging

#### **Key Features:**

- **Smart Base Detection**: Automatically determines if input is base or quote token
- **Enhanced Validation**: Validates input mint belongs to pool
- **Comprehensive Results**: Returns all swap details including fees

#### **Usage:**

```typescript
const result = await swap({
 umi,
 connection,
 network,
 signer,
 poolIdParam: "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny",
 inputAmountParam: new BN(100000), // 0.1 SOL
 inputMintParam: NATIVE_MINT,
 slippageParam: 0.005, // 0.5%
});

console.log(`Swapped ${result.inputAmount} for ${result.outputAmount}`);
console.log(`Trade fee: ${result.tradeFee}`);
```

## Benefits of Refactoring

### 1. **Code Reusability**

- Common functionality shared across all operations
- Reduced code duplication
- Consistent patterns

### 2. **Maintainability**

- Centralized error handling and validation
- Single source of truth for common configurations
- Easier to update SDK integration

### 3. **Error Handling**

- Structured error types with operation context
- Better error messages for debugging
- Consistent error format for UI integration

### 4. **Type Safety**

- Strong typing for all parameters and results
- Interface inheritance for consistency
- Better IDE support and autocompletion

### 5. **Flexibility**

- Configurable parameters with sensible defaults
- Optional parameters for advanced use cases
- Easy to extend for new operations

### 6. **Developer Experience**

- Consistent API across all operations
- Better documentation through types
- Predictable behavior and error handling

## Migration Guide

### **Old Pattern:**

```typescript
// Manual setup for each operation
const umiWithSigner = umi.use(signerIdentity(signer));
const raydium = await initSdk(umiWithSigner, connection, network, { loadToken: true });

// Manual error handling
if (!raydium) {
 throw new Error("Failed to initialize SDK");
}

// Manual pool fetching
const data = await raydium.api.fetchPoolById({ ids: poolId });
const poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;
```

### **New Pattern:**

```typescript
// Unified operation with comprehensive error handling
const result = await removeFromCPMMPool({
 umi,
 connection,
 network,
 signer,
 poolIdParam,
 lpAmountParam,
 slippagePercent: 1,
});
```

## Future Enhancements

### 1. **Add Support for:**

- Pool creation operations
- Liquidity locking/unlocking
- Multi-hop swaps
- Batch operations

### 2. **Additional Features:**

- Transaction simulation before execution
- Gas estimation
- Price impact calculation
- MEV protection options

### 3. **Monitoring & Analytics:**

- Operation metrics collection
- Performance monitoring
- Success/failure rate tracking

## Best Practices

### 1. **Error Handling**

```typescript
try {
 const result = await swap(params);
 // Handle success
} catch (error) {
 if (error instanceof CPMMOperationError) {
  // Handle specific CPMM errors
  console.error(`${error.operation} failed: ${error.code}`);
 } else {
  // Handle unexpected errors
  console.error('Unexpected error:', error);
 }
}
```

### 2. **Parameter Validation**

```typescript
// Always validate amounts
if (inputAmount.lte(new BN(0))) {
 throw new Error("Amount must be positive");
}

// Use type-safe parameters
const params: SwapParams = {
 umi,
 connection,
 network,
 signer,
 inputAmountParam: validatedAmount,
 slippageParam: 0.005, // 0.5%
};
```

### 3. **Network Handling**

```typescript
// Let the base system handle network differences
const result = await removeFromCPMMPool(params);
// Works automatically on both mainnet and devnet
```

This refactored architecture provides a solid foundation for all CPMM operations while maintaining flexibility and extensibility for future enhancements.
