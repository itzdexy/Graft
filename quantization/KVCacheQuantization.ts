/**
 * KV-Cache Quantization
 * Inspired by llama.cpp's KV cache quantization for memory efficiency
 * Reduces memory usage by quantizing key-value cache during inference
 */

export interface KVCacheQuantizer {
  id: string;
  name: string;
  config: QuantizationConfig;
  cache: KVCache;
  statistics: QuantizationStatistics;
  metadata: QuantizerMetadata;
}

export interface QuantizationConfig {
  quantizationType: QuantizationType;
  bits: number;
  blockSize: number;
  enablePerChannel: boolean;
  enableDynamicQuantization: boolean;
  threshold: number;
}

export type QuantizationType = 'none' | 'f16' | 'q8_0' | 'q4_0' | 'q4_1' | 'q5_0' | 'q5_1' | 'q8_1' | 'q2_k' | 'q3_k' | 'q4_k' | 'q5_k' | 'q6_k';

export interface KVCache {
  keys: Float32Array[];
  values: Float32Array[];
  shape: CacheShape;
  metadata: CacheMetadata;
}

export interface CacheShape {
  layers: number;
  heads: number;
  seqLen: number;
  headDim: number;
}

export interface CacheMetadata {
  allocatedBytes: number;
  quantizedBytes: number;
  compressionRatio: number;
}

export interface QuantizationStatistics {
  totalQuantizations: number;
  totalDequantizations: number;
  averageQuantizationTime: number;
  averageDequantizationTime: number;
  memorySaved: number;
  accuracyLoss: number;
}

export interface QuantizerMetadata {
  createdAt: number;
  updatedAt: number;
  version: number;
  totalOperations: number;
}

export interface QuantizationResult {
  quantizedData: Uint8Array;
  scale: number;
  zeroPoint: number;
  time: number;
  originalSize: number;
  quantizedSize: number;
}

export interface DequantizationResult {
  dequantizedData: Float32Array;
  time: number;
  mse: number;
}

class KVCacheQuantizationManager {
  private quantizers: Map<string, KVCacheQuantizer> = new Map();

  /**
   * Create a KV cache quantizer
   */
  createQuantizer(
    name: string,
    shape: CacheShape,
    config?: Partial<QuantizationConfig>
  ): KVCacheQuantizer {
    const quantizer: KVCacheQuantizer = {
      id: this.generateQuantizerId(),
      name,
      config: {
        quantizationType: config?.quantizationType || 'q4_k',
        bits: config?.bits || 4,
        blockSize: config?.blockSize || 32,
        enablePerChannel: config?.enablePerChannel ?? true,
        enableDynamicQuantization: config?.enableDynamicQuantization ?? false,
        threshold: config?.threshold || 0.5,
      },
      cache: {
        keys: this.initializeCacheArrays(shape),
        values: this.initializeCacheArrays(shape),
        shape,
        metadata: {
          allocatedBytes: this.calculateAllocatedBytes(shape),
          quantizedBytes: 0,
          compressionRatio: 1,
        },
      },
      statistics: {
        totalQuantizations: 0,
        totalDequantizations: 0,
        averageQuantizationTime: 0,
        averageDequantizationTime: 0,
        memorySaved: 0,
        accuracyLoss: 0,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        totalOperations: 0,
      },
    };

    this.quantizers.set(quantizer.id, quantizer);
    return quantizer;
  }

  /**
   * Get a quantizer
   */
  getQuantizer(quantizerId: string): KVCacheQuantizer | undefined {
    return this.quantizers.get(quantizerId);
  }

  /**
   * Get all quantizers
   */
  getAllQuantizers(): KVCacheQuantizer[] {
    return Array.from(this.quantizers.values());
  }

  /**
   * Delete a quantizer
   */
  deleteQuantizer(quantizerId: string): boolean {
    return this.quantizers.delete(quantizerId);
  }

  /**
   * Quantize KV cache
   */
  async quantizeCache(quantizerId: string, layerIndex: number): Promise<QuantizationResult> {
    const quantizer = this.quantizers.get(quantizerId);
    if (!quantizer) {
      throw new Error(`Quantizer ${quantizerId} not found`);
    }

    const startTime = Date.now();

    const keys = quantizer.cache.keys[layerIndex];
    const values = quantizer.cache.values[layerIndex];

    const keyResult = this.quantizeArray(keys, quantizer.config);
    const valueResult = this.quantizeArray(values, quantizer.config);

    const time = Date.now() - startTime;

    const result: QuantizationResult = {
      quantizedData: this.combineQuantizedData(keyResult.quantizedData, valueResult.quantizedData),
      scale: (keyResult.scale + valueResult.scale) / 2,
      zeroPoint: (keyResult.zeroPoint + valueResult.zeroPoint) / 2,
      time,
      originalSize: keys.length * 4 + values.length * 4, // Float32 = 4 bytes
      quantizedSize: keyResult.quantizedData.length + valueResult.quantizedData.length,
    };

    // Update statistics
    quantizer.statistics.totalQuantizations++;
    quantizer.statistics.averageQuantizationTime =
      this.updateAverage(quantizer.statistics.averageQuantizationTime, quantizer.statistics.totalQuantizations, time);
    quantizer.statistics.memorySaved += result.originalSize - result.quantizedSize;

    // Update cache metadata
    quantizer.cache.metadata.quantizedBytes += result.quantizedSize;
    quantizer.cache.metadata.compressionRatio =
      quantizer.cache.metadata.allocatedBytes / quantizer.cache.metadata.quantizedBytes;

    quantizer.metadata.totalOperations++;
    quantizer.metadata.updatedAt = Date.now();

    return result;
  }

  /**
   * Dequantize KV cache
   */
  async dequantizeCache(
    quantizerId: string,
    quantizedData: Uint8Array,
    layerIndex: number
  ): Promise<DequantizationResult> {
    const quantizer = this.quantizers.get(quantizerId);
    if (!quantizer) {
      throw new Error(`Quantizer ${quantizerId} not found`);
    }

    const startTime = Date.now();

    const [keyData, valueData] = this.splitQuantizedData(quantizedData);

    // Calculate scale and zeroPoint from the quantized data
    const scale = this.calculateScaleFromQuantized(keyData);
    const zeroPoint = this.calculateZeroPointFromQuantized(keyData, scale);

    const keys = this.dequantizeArray(keyData, scale, zeroPoint);
    const values = this.dequantizeArray(valueData, scale, zeroPoint);

    const time = Date.now() - startTime;

    // Calculate MSE (mean squared error) as accuracy metric
    const originalKeys = quantizer.cache.keys[layerIndex];
    const originalValues = quantizer.cache.values[layerIndex];
    const mse = this.calculateMSE(keys, originalKeys) + this.calculateMSE(values, originalValues);

    const result: DequantizationResult = {
      dequantizedData: new Float32Array([...keys, ...values]),
      time,
      mse,
    };

    // Update statistics
    quantizer.statistics.totalDequantizations++;
    quantizer.statistics.averageDequantizationTime =
      this.updateAverage(quantizer.statistics.averageDequantizationTime, quantizer.statistics.totalDequantizations, time);
    quantizer.statistics.accuracyLoss = mse;

    quantizer.metadata.totalOperations++;
    quantizer.metadata.updatedAt = Date.now();

    return result;
  }

  /**
   * Update cache with new data
   */
  updateCache(quantizerId: string, layerIndex: number, keys: Float32Array, values: Float32Array): boolean {
    const quantizer = this.quantizers.get(quantizerId);
    if (!quantizer) return false;

    quantizer.cache.keys[layerIndex] = keys;
    quantizer.cache.values[layerIndex] = values;

    return true;
  }

  /**
   * Get statistics for a quantizer
   */
  getStatistics(quantizerId: string): QuantizationStatistics | undefined {
    const quantizer = this.quantizers.get(quantizerId);
    if (!quantizer) return undefined;

    return { ...quantizer.statistics };
  }

  /**
   * Reset statistics for a quantizer
   */
  resetStatistics(quantizerId: string): boolean {
    const quantizer = this.quantizers.get(quantizerId);
    if (!quantizer) return false;

    quantizer.statistics = {
      totalQuantizations: 0,
      totalDequantizations: 0,
      averageQuantizationTime: 0,
      averageDequantizationTime: 0,
      memorySaved: 0,
      accuracyLoss: 0,
    };

    quantizer.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Get cache information
   */
  getCacheInfo(quantizerId: string): {
    shape: CacheShape;
    allocatedBytes: number;
    quantizedBytes: number;
    compressionRatio: number;
  } | undefined {
    const quantizer = this.quantizers.get(quantizerId);
    if (!quantizer) return undefined;

    return {
      shape: quantizer.cache.shape,
      allocatedBytes: quantizer.cache.metadata.allocatedBytes,
      quantizedBytes: quantizer.cache.metadata.quantizedBytes,
      compressionRatio: quantizer.cache.metadata.compressionRatio,
    };
  }

  // Private methods

  private initializeCacheArrays(shape: CacheShape): Float32Array[] {
    const arrays: Float32Array[] = [];
    const size = shape.heads * shape.seqLen * shape.headDim;

    for (let i = 0; i < shape.layers; i++) {
      arrays.push(new Float32Array(size));
    }

    return arrays;
  }

  private calculateAllocatedBytes(shape: CacheShape): number {
    const sizePerLayer = shape.heads * shape.seqLen * shape.headDim * 4; // Float32 = 4 bytes
    return sizePerLayer * shape.layers * 2; // Keys and values
  }

  private quantizeArray(data: Float32Array, config: QuantizationConfig): QuantizationResult {
    const startTime = Date.now();

    const quantized = new Uint8Array(data.length);
    const scale = this.calculateScale(data, config.bits);
    const zeroPoint = this.calculateZeroPoint(data, scale, config.bits);

    for (let i = 0; i < data.length; i++) {
      quantized[i] = Math.round(data[i] / scale + zeroPoint);
    }

    const time = Date.now() - startTime;

    return {
      quantizedData: quantized,
      scale,
      zeroPoint,
      time,
      originalSize: data.length * 4,
      quantizedSize: quantized.length,
    };
  }

  private dequantizeArray(data: Uint8Array, scale: number, zeroPoint: number): Float32Array {
    const dequantized = new Float32Array(data.length);

    for (let i = 0; i < data.length; i++) {
      dequantized[i] = (data[i] - zeroPoint) * scale;
    }

    return dequantized;
  }

  private calculateScale(data: Float32Array, bits: number): number {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;
    return range / (Math.pow(2, bits) - 1);
  }

  private calculateZeroPoint(data: Float32Array, scale: number, bits: number): number {
    const max = Math.max(...data);
    const min = Math.min(...data);
    return Math.round(-min / scale);
  }

  private calculateScaleFromQuantized(data: Uint8Array): number {
    // Estimate scale from quantized data range
    const max = Math.max(...data);
    const min = Math.min(...data);
    return (max - min) / 255;
  }

  private calculateZeroPointFromQuantized(data: Uint8Array, scale: number): number {
    const min = Math.min(...data);
    return Math.round(-min / scale);
  }

  private combineQuantizedData(keyData: Uint8Array, valueData: Uint8Array): Uint8Array {
    const combined = new Uint8Array(keyData.length + valueData.length);
    combined.set(keyData, 0);
    combined.set(valueData, keyData.length);
    return combined;
  }

  private splitQuantizedData(data: Uint8Array): [Uint8Array, Uint8Array] {
    const mid = Math.floor(data.length / 2);
    return [data.slice(0, mid), data.slice(mid)];
  }

  private calculateMSE(original: Float32Array, reconstructed: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < original.length; i++) {
      const diff = original[i] - reconstructed[i];
      sum += diff * diff;
    }
    return sum / original.length;
  }

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateQuantizerId(): string {
    return `quantizer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create cache shapes
export function createCacheShape(
  layers: number,
  heads: number,
  seqLen: number,
  headDim: number
): CacheShape {
  return { layers, heads, seqLen, headDim };
}

// Global KV cache quantization manager instance
const kvCacheQuantizationManager = new KVCacheQuantizationManager();

export function createQuantizer(
  name: string,
  shape: CacheShape,
  config?: Partial<QuantizationConfig>
): KVCacheQuantizer {
  return kvCacheQuantizationManager.createQuantizer(name, shape, config);
}

export function getQuantizer(quantizerId: string): KVCacheQuantizer | undefined {
  return kvCacheQuantizationManager.getQuantizer(quantizerId);
}

export function getAllQuantizers(): KVCacheQuantizer[] {
  return kvCacheQuantizationManager.getAllQuantizers();
}

export function deleteQuantizer(quantizerId: string): boolean {
  return kvCacheQuantizationManager.deleteQuantizer(quantizerId);
}

export async function quantizeCache(quantizerId: string, layerIndex: number): Promise<QuantizationResult> {
  return kvCacheQuantizationManager.quantizeCache(quantizerId, layerIndex);
}

export async function dequantizeCache(
  quantizerId: string,
  quantizedData: Uint8Array,
  layerIndex: number
): Promise<DequantizationResult> {
  return kvCacheQuantizationManager.dequantizeCache(quantizerId, quantizedData, layerIndex);
}

export function updateCache(
  quantizerId: string,
  layerIndex: number,
  keys: Float32Array,
  values: Float32Array
): boolean {
  return kvCacheQuantizationManager.updateCache(quantizerId, layerIndex, keys, values);
}

export function getStatistics(quantizerId: string): QuantizationStatistics | undefined {
  return kvCacheQuantizationManager.getStatistics(quantizerId);
}

export function resetStatistics(quantizerId: string): boolean {
  return kvCacheQuantizationManager.resetStatistics(quantizerId);
}

export function getCacheInfo(quantizerId: string): {
  shape: CacheShape;
  allocatedBytes: number;
  quantizedBytes: number;
  compressionRatio: number;
} | undefined {
  return kvCacheQuantizationManager.getCacheInfo(quantizerId);
}
