/**
 * Image/Web Page Context
 * Inspired by Aider's ability to include images and web pages as context
 * Provides multimodal context processing for images, screenshots, and web pages
 */

export interface ContextProcessor {
  id: string;
  name: string;
  config: ContextConfig;
  imageProcessors: Map<string, ImageProcessor>;
  webProcessors: Map<string, WebPageProcessor>;
  cache: ContextCache;
  statistics: ContextStatistics;
  metadata: ProcessorMetadata;
}

export interface ContextConfig {
  maxImageSize: number;
  maxWebPageSize: number;
  enableOCR: boolean;
  enableWebScraping: boolean;
  enableCaching: boolean;
  supportedFormats: string[];
  timeout: number;
}

export interface ImageProcessor {
  id: string;
  name: string;
  format: string;
  process: (image: ImageInput) => Promise<ImageContext>;
  extractText?: (image: ImageInput) => Promise<string>;
  analyze?: (image: ImageInput) => Promise<ImageAnalysis>;
}

export interface ImageInput {
  data: Uint8Array;
  format: string;
  metadata: ImageMetadata;
}

export interface ImageMetadata {
  width: number;
  height: number;
  dpi?: number;
  colorSpace?: string;
}

export interface ImageContext {
  id: string;
  description: string;
  text?: string;
  analysis?: ImageAnalysis;
  embeddings?: Float32Array;
  thumbnail: Uint8Array;
  timestamp: number;
}

export interface ImageAnalysis {
  objects: DetectedObject[];
  textRegions: TextRegion[];
  colors: ColorPalette;
  layout: LayoutInfo;
  quality: QualityMetrics;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextRegion {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export interface LayoutInfo {
  type: LayoutType;
  columns: number;
  rows: number;
  elements: LayoutElement[];
}

export type LayoutType = 'single_column' | 'multi_column' | 'grid' | 'freeform' | 'unknown';

export interface LayoutElement {
  type: ElementType;
  position: BoundingBox;
  content?: string;
}

export type ElementType = 'text' | 'image' | 'button' | 'input' | 'navigation' | 'custom';

export interface QualityMetrics {
  sharpness: number;
  brightness: number;
  contrast: number;
  noise: number;
}

export interface WebPageProcessor {
  id: string;
  name: string;
  process: (url: string, options?: WebPageOptions) => Promise<WebPageContext>;
  extractContent?: (html: string) => Promise<ExtractedContent>;
  screenshot?: (url: string) => Promise<ImageInput>;
}

export interface WebPageOptions {
  includeImages: boolean;
  includeStyles: boolean;
  includeScripts: boolean;
  waitForLoad: boolean;
  viewport?: Viewport;
}

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export interface WebPageContext {
  id: string;
  url: string;
  title: string;
  content: ExtractedContent;
  screenshot?: ImageContext;
  links: Link[];
  metadata: PageMetadata;
  timestamp: number;
}

export interface ExtractedContent {
  text: string;
  html: string;
  structured: StructuredContent;
}

export interface StructuredContent {
  headings: Heading[];
  paragraphs: Paragraph[];
  lists: List[];
  tables: Table[];
  forms: Form[];
}

export interface Heading {
  level: number;
  text: string;
  id?: string;
}

export interface Paragraph {
  text: string;
  id?: string;
}

export interface List {
  type: 'ordered' | 'unordered';
  items: string[];
}

export interface Table {
  headers: string[];
  rows: string[][];
}

export interface Form {
  fields: FormField[];
  action?: string;
  method?: string;
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  value?: string;
}

export interface Link {
  url: string;
  text: string;
  type: LinkType;
}

export type LinkType = 'internal' | 'external' | 'anchor' | 'download';

export interface PageMetadata {
  author?: string;
  description?: string;
  keywords?: string[];
  language?: string;
  viewport?: string;
  robots?: string;
}

export interface ContextCache {
  images: Map<string, ImageContext>;
  webPages: Map<string, WebPageContext>;
  maxSize: number;
}

export interface ContextStatistics {
  totalImagesProcessed: number;
  totalWebPagesProcessed: number;
  cacheHits: number;
  cacheMisses: number;
  averageProcessingTime: number;
  totalDataProcessed: number;
}

export interface ProcessorMetadata {
  createdAt: number;
  updatedAt: number;
  version: number;
  totalOperations: number;
}

class ContextProcessorManager {
  private processors: Map<string, ContextProcessor> = new Map();

  /**
   * Create a context processor
   */
  createProcessor(name: string, config?: Partial<ContextConfig>): ContextProcessor {
    const processor: ContextProcessor = {
      id: this.generateProcessorId(),
      name,
      config: {
        maxImageSize: config?.maxImageSize || 10 * 1024 * 1024, // 10MB
        maxWebPageSize: config?.maxWebPageSize || 5 * 1024 * 1024, // 5MB
        enableOCR: config?.enableOCR ?? true,
        enableWebScraping: config?.enableWebScraping ?? true,
        enableCaching: config?.enableCaching ?? true,
        supportedFormats: config?.supportedFormats || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
        timeout: config?.timeout || 30000,
      },
      imageProcessors: new Map(),
      webProcessors: new Map(),
      cache: {
        images: new Map(),
        webPages: new Map(),
        maxSize: 1000,
      },
      statistics: {
        totalImagesProcessed: 0,
        totalWebPagesProcessed: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageProcessingTime: 0,
        totalDataProcessed: 0,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        totalOperations: 0,
      },
    };

    this.processors.set(processor.id, processor);
    return processor;
  }

  /**
   * Get a processor
   */
  getProcessor(processorId: string): ContextProcessor | undefined {
    return this.processors.get(processorId);
  }

  /**
   * Get all processors
   */
  getAllProcessors(): ContextProcessor[] {
    return Array.from(this.processors.values());
  }

  /**
   * Delete a processor
   */
  deleteProcessor(processorId: string): boolean {
    return this.processors.delete(processorId);
  }

  /**
   * Register an image processor
   */
  registerImageProcessor(processorId: string, imageProcessor: ImageProcessor): boolean {
    const processor = this.processors.get(processorId);
    if (!processor) return false;

    processor.imageProcessors.set(imageProcessor.id, imageProcessor);
    processor.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Register a web page processor
   */
  registerWebPageProcessor(processorId: string, webProcessor: WebPageProcessor): boolean {
    const processor = this.processors.get(processorId);
    if (!processor) return false;

    processor.webProcessors.set(webProcessor.id, webProcessor);
    processor.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Process an image
   */
  async processImage(processorId: string, image: ImageInput): Promise<ImageContext> {
    const processor = this.processors.get(processorId);
    if (!processor) {
      throw new Error(`Processor ${processorId} not found`);
    }

    // Check cache
    const cacheKey = this.generateImageCacheKey(image);
    if (processor.config.enableCaching && processor.cache.images.has(cacheKey)) {
      processor.statistics.cacheHits++;
      return processor.cache.images.get(cacheKey)!;
    }

    const startTime = Date.now();

    // Find appropriate processor
    const imageProcessor = this.findImageProcessor(processor, image.format);
    if (!imageProcessor) {
      throw new Error(`No processor found for format: ${image.format}`);
    }

    const context = await imageProcessor.process(image);

    // Extract text if OCR enabled
    if (processor.config.enableOCR && imageProcessor.extractText) {
      context.text = await imageProcessor.extractText(image);
    }

    // Analyze if available
    if (imageProcessor.analyze) {
      context.analysis = await imageProcessor.analyze(image);
    }

    // Cache result
    if (processor.config.enableCaching) {
      processor.cache.images.set(cacheKey, context);
      processor.statistics.cacheMisses++;
    }

    processor.statistics.totalImagesProcessed++;
    processor.statistics.totalDataProcessed += image.data.length;
    processor.statistics.averageProcessingTime =
      this.updateAverage(processor.statistics.averageProcessingTime, processor.statistics.totalImagesProcessed, Date.now() - startTime);

    processor.metadata.totalOperations++;
    processor.metadata.updatedAt = Date.now();

    return context;
  }

  /**
   * Process a web page
   */
  async processWebPage(processorId: string, url: string, options?: WebPageOptions): Promise<WebPageContext> {
    const processor = this.processors.get(processorId);
    if (!processor) {
      throw new Error(`Processor ${processorId} not found`);
    }

    // Check cache
    const cacheKey = this.generateWebCacheKey(url, options);
    if (processor.config.enableCaching && processor.cache.webPages.has(cacheKey)) {
      processor.statistics.cacheHits++;
      return processor.cache.webPages.get(cacheKey)!;
    }

    const startTime = Date.now();

    // Find appropriate processor
    const webProcessor = Array.from(processor.webProcessors.values())[0];
    if (!webProcessor) {
      throw new Error('No web page processor registered');
    }

    const context = await webProcessor.process(url, options);

    // Cache result
    if (processor.config.enableCaching) {
      processor.cache.webPages.set(cacheKey, context);
      processor.statistics.cacheMisses++;
    }

    processor.statistics.totalWebPagesProcessed++;
    processor.statistics.averageProcessingTime =
      this.updateAverage(processor.statistics.averageProcessingTime, processor.statistics.totalWebPagesProcessed, Date.now() - startTime);

    processor.metadata.totalOperations++;
    processor.metadata.updatedAt = Date.now();

    return context;
  }

  /**
   * Extract text from image
   */
  async extractTextFromImage(processorId: string, image: ImageInput): Promise<string> {
    const processor = this.processors.get(processorId);
    if (!processor) {
      throw new Error(`Processor ${processorId} not found`);
    }

    const imageProcessor = this.findImageProcessor(processor, image.format);
    if (!imageProcessor || !imageProcessor.extractText) {
      throw new Error('OCR not available for this image format');
    }

    return await imageProcessor.extractText(image);
  }

  /**
   * Take screenshot of web page
   */
  async takeScreenshot(processorId: string, url: string): Promise<ImageContext> {
    const processor = this.processors.get(processorId);
    if (!processor) {
      throw new Error(`Processor ${processorId} not found`);
    }

    const webProcessor = Array.from(processor.webProcessors.values())[0];
    if (!webProcessor || !webProcessor.screenshot) {
      throw new Error('Screenshot not available');
    }

    const imageInput = await webProcessor.screenshot(url);
    return await this.processImage(processorId, imageInput);
  }

  /**
   * Clear cache
   */
  clearCache(processorId: string, type?: 'images' | 'webpages' | 'all'): boolean {
    const processor = this.processors.get(processorId);
    if (!processor) return false;

    if (type === 'images' || type === 'all') {
      processor.cache.images.clear();
    }

    if (type === 'webpages' || type === 'all') {
      processor.cache.webPages.clear();
    }

    processor.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Get statistics for a processor
   */
  getStatistics(processorId: string): ContextStatistics | undefined {
    const processor = this.processors.get(processorId);
    if (!processor) return undefined;

    return { ...processor.statistics };
  }

  /**
   * Reset statistics for a processor
   */
  resetStatistics(processorId: string): boolean {
    const processor = this.processors.get(processorId);
    if (!processor) return false;

    processor.statistics = {
      totalImagesProcessed: 0,
      totalWebPagesProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageProcessingTime: 0,
      totalDataProcessed: 0,
    };

    processor.metadata.updatedAt = Date.now();

    return true;
  }

  // Private methods

  private findImageProcessor(processor: ContextProcessor, format: string): ImageProcessor | undefined {
    for (const imageProcessor of processor.imageProcessors.values()) {
      if (imageProcessor.format === format || imageProcessor.format === '*') {
        return imageProcessor;
      }
    }
    return undefined;
  }

  private generateImageCacheKey(image: ImageInput): string {
    const hash = this.hashBuffer(image.data);
    return `img:${image.format}:${hash}`;
  }

  private generateWebCacheKey(url: string, options?: WebPageOptions): string {
    const opts = JSON.stringify(options || {});
    return `web:${this.hashString(url)}:${this.hashString(opts)}`;
  }

  private hashBuffer(buffer: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < buffer.length; i++) {
      hash = ((hash << 5) - hash) + buffer[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateProcessorId(): string {
    return `processor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create processors
export function createImageProcessor(
  id: string,
  name: string,
  format: string,
  process: (image: ImageInput) => Promise<ImageContext>,
  extractText?: (image: ImageInput) => Promise<string>,
  analyze?: (image: ImageInput) => Promise<ImageAnalysis>
): ImageProcessor {
  return { id, name, format, process, extractText, analyze };
}

export function createWebPageProcessor(
  id: string,
  name: string,
  process: (url: string, options?: WebPageOptions) => Promise<WebPageContext>,
  extractContent?: (html: string) => Promise<ExtractedContent>,
  screenshot?: (url: string) => Promise<ImageInput>
): WebPageProcessor {
  return { id, name, process, extractContent, screenshot };
}

export function createImageInput(data: Uint8Array, format: string, metadata: ImageMetadata): ImageInput {
  return { data, format, metadata };
}

// Global context processor manager instance
const contextProcessorManager = new ContextProcessorManager();

export function createProcessor(name: string, config?: Partial<ContextConfig>): ContextProcessor {
  return contextProcessorManager.createProcessor(name, config);
}

export function getProcessor(processorId: string): ContextProcessor | undefined {
  return contextProcessorManager.getProcessor(processorId);
}

export function getAllProcessors(): ContextProcessor[] {
  return contextProcessorManager.getAllProcessors();
}

export function deleteProcessor(processorId: string): boolean {
  return contextProcessorManager.deleteProcessor(processorId);
}

export function registerImageProcessor(processorId: string, imageProcessor: ImageProcessor): boolean {
  return contextProcessorManager.registerImageProcessor(processorId, imageProcessor);
}

export function registerWebPageProcessor(processorId: string, webProcessor: WebPageProcessor): boolean {
  return contextProcessorManager.registerWebPageProcessor(processorId, webProcessor);
}

export async function processImage(processorId: string, image: ImageInput): Promise<ImageContext> {
  return contextProcessorManager.processImage(processorId, image);
}

export async function processWebPage(processorId: string, url: string, options?: WebPageOptions): Promise<WebPageContext> {
  return contextProcessorManager.processWebPage(processorId, url, options);
}

export async function extractTextFromImage(processorId: string, image: ImageInput): Promise<string> {
  return contextProcessorManager.extractTextFromImage(processorId, image);
}

export async function takeScreenshot(processorId: string, url: string): Promise<ImageContext> {
  return contextProcessorManager.takeScreenshot(processorId, url);
}

export function clearCache(processorId: string, type?: 'images' | 'webpages' | 'all'): boolean {
  return contextProcessorManager.clearCache(processorId, type);
}

export function getStatistics(processorId: string): ContextStatistics | undefined {
  return contextProcessorManager.getStatistics(processorId);
}

export function resetStatistics(processorId: string): boolean {
  return contextProcessorManager.resetStatistics(processorId);
}
