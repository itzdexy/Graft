/**
 * LSP Integration
 * Inspired by Crush's LSP-enhanced context for additional code intelligence
 * Provides Language Server Protocol integration for symbol resolution, code analysis, and cross-referencing
 */

export interface LspServer {
  id: string;
  name: string;
  language: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  initialized: boolean;
  capabilities: ServerCapabilities;
  status: ServerStatus;
}

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface ServerCapabilities {
  textDocumentSync: TextDocumentSyncKind;
  hoverProvider: boolean;
  completionProvider: CompletionProviderCapability | boolean;
  signatureHelpProvider: SignatureHelpCapability | boolean;
  definitionProvider: boolean | DefinitionOptions;
  typeDefinitionProvider: boolean | DefinitionOptions;
  implementationProvider: boolean | DefinitionOptions;
  referencesProvider: boolean | ReferenceOptions;
  documentHighlightProvider: boolean;
  documentSymbolProvider: boolean | DocumentSymbolCapability;
  workspaceSymbolProvider: boolean | WorkspaceSymbolCapability;
  codeActionProvider: boolean | CodeActionCapability;
  codeLensProvider: boolean | CodeLensCapability;
  documentFormattingProvider: boolean | DocumentFormattingCapability;
  documentRangeFormattingProvider: boolean;
  renameProvider: boolean | RenameCapability;
  documentLinkProvider: boolean | DocumentLinkCapability;
  colorProvider: boolean;
  foldingRangeProvider: boolean | FoldingRangeCapability;
  declarationProvider: boolean | DeclarationCapability;
  selectionRangeProvider: boolean | SelectionRangeCapability;
}

export type TextDocumentSyncKind = 0 | 1 | 2;

export interface CompletionProviderCapability {
  triggerCharacters?: string[];
  resolveProvider?: boolean;
  completionItem?: CompletionItemCapability;
}

export interface CompletionItemCapability {
  snippetSupport?: boolean;
  commitCharactersSupport?: boolean;
  documentationFormat?: MarkupKind[];
  deprecatedSupport?: boolean;
  preselectSupport?: boolean;
  tagSupport?: TagSupport[];
  insertTextModeSupport?: InsertTextMode[];
  resolveSupport?: ResolveSupport;
}

export interface SignatureHelpCapability {
  signatureInformation?: SignatureInformationCapability;
  contextSupport?: boolean;
}

export interface DefinitionOptions {
  workDoneProgress?: boolean;
}

export interface ReferenceOptions {
  workDoneProgress?: boolean;
}

export interface DocumentSymbolCapability {
  hierarchicalDocumentSymbolSupport?: boolean;
  symbolKind?: SymbolKind[];
  tagSupport?: TagSupport;
}

export interface WorkspaceSymbolCapability {
  symbolKind?: SymbolKind[];
  tagSupport?: TagSupport;
}

export interface CodeActionCapability {
  codeActionKinds?: string[];
  resolveProvider?: boolean;
}

export interface CodeLensCapability {
  resolveProvider?: boolean;
}

export interface DocumentFormattingCapability {
  dynamicRegistration?: boolean;
}

export interface RenameCapability {
  prepareProvider?: boolean;
}

export interface DocumentLinkCapability {
  tooltipSupport?: boolean;
}

export interface FoldingRangeCapability {
  rangeLimit?: number;
  foldingRangeKind?: FoldingRangeKind[];
  foldingLineFoldingOnly?: boolean;
}

export interface DeclarationCapability {
  workDoneProgress?: boolean;
  linkSupport?: boolean;
}

export interface SelectionRangeCapability {
  dynamicRegistration?: boolean;
}

export type MarkupKind = 'plaintext' | 'markdown';
export type InsertTextMode = 'asIs' | 'adjustIndentation';
export type SymbolKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26;
export type FoldingRangeKind = 'comment' | 'imports' | 'region';

export interface TagSupport {
  tagSet: number[];
}

export interface ResolveSupport {
  properties: string[];
}

export interface SignatureInformationCapability {
  documentationFormat?: MarkupKind[];
  parameterInformation?: ParameterInformationCapability;
  activeParameterSupport?: boolean;
}

export interface ParameterInformationCapability {
  labelOffsetSupport?: boolean;
}

export interface LspContext {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
  detail?: string;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  character: number;
}

export interface HoverResult {
  contents: MarkupContent | string;
  range?: Range;
}

export interface MarkupContent {
  kind: MarkupKind;
  value: string;
}

export interface CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: MarkupContent | string;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  insertTextFormat?: InsertTextFormat;
  textEdit?: TextEdit;
  additionalTextEdits?: TextEdit[];
  commitCharacters?: string[];
  preselect?: boolean;
  deprecated?: boolean;
  tags?: CompletionItemTag[];
}

export type CompletionItemKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25;
export type InsertTextFormat = 1 | 2;
export type CompletionItemTag = 1;

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
  edit?: WorkspaceEdit;
  command?: Command;
}

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
  tags?: DiagnosticTag[];
  relatedInformation?: DiagnosticRelatedInformation[];
}

export type DiagnosticSeverity = 1 | 2 | 3 | 4;
export type DiagnosticTag = 1 | 2;

export interface DiagnosticRelatedInformation {
  location: Location;
  message: string;
}

export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
  documentChanges?: (TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[];
}

export interface TextDocumentEdit {
  textDocument: VersionedTextDocumentIdentifier;
  edits: (TextEdit | AnnotatedTextEdit)[];
}

export interface VersionedTextDocumentIdentifier {
  uri: string;
  version: number;
}

export interface AnnotatedTextEdit extends TextEdit {
  annotationId: string;
}

export interface CreateFile {
  uri: string;
  options?: CreateFileOptions;
}

export interface CreateFileOptions {
  overwrite?: boolean;
  ignoreIfExists?: boolean;
}

export interface RenameFile {
  oldUri: string;
  newUri: string;
  options?: RenameFileOptions;
}

export interface RenameFileOptions {
  overwrite?: boolean;
  ignoreIfExists?: boolean;
}

export interface DeleteFile {
  uri: string;
  options?: DeleteFileOptions;
}

export interface DeleteFileOptions {
  recursive?: boolean;
  ignoreIfNotExists?: boolean;
}

export interface Command {
  title: string;
  command: string;
  arguments?: unknown[];
}

class LspManager {
  private servers: Map<string, LspServer> = new Map();
  private contexts: Map<string, LspContext> = new Map();
  private activeServer: string | null = null;

  /**
   * Register an LSP server
   */
  registerServer(server: LspServer): void {
    this.servers.set(server.id, server);
  }

  /**
   * Unregister an LSP server
   */
  unregisterServer(serverId: string): boolean {
    return this.servers.delete(serverId);
  }

  /**
   * Get a server
   */
  getServer(serverId: string): LspServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all servers
   */
  getAllServers(): LspServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get servers by language
   */
  getServersByLanguage(language: string): LspServer[] {
    return this.getAllServers().filter(s => s.language === language);
  }

  /**
   * Start a server
   */
  async startServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    server.status = 'starting';

    try {
      // In a real implementation, this would start the actual LSP server process
      await this.startLspProcess(server);
      
      server.status = 'running';
      server.initialized = true;
      return true;
    } catch (error) {
      server.status = 'error';
      return false;
    }
  }

  /**
   * Stop a server
   */
  async stopServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    server.status = 'stopped';
    server.initialized = false;

    // In a real implementation, this would stop the actual LSP server process
    await this.stopLspProcess(server);

    return true;
  }

  /**
   * Set active server
   */
  setActiveServer(serverId: string): void {
    if (this.servers.has(serverId)) {
      this.activeServer = serverId;
    }
  }

  /**
   * Get active server
   */
  getActiveServer(): LspServer | undefined {
    if (!this.activeServer) return undefined;
    return this.servers.get(this.activeServer);
  }

  /**
   * Add document context
   */
  addContext(uri: string, context: LspContext): void {
    this.contexts.set(uri, context);
  }

  /**
   * Remove document context
   */
  removeContext(uri: string): void {
    this.contexts.delete(uri);
  }

  /**
   * Get context
   */
  getContext(uri: string): LspContext | undefined {
    return this.contexts.get(uri);
  }

  /**
   * Get hover information
   */
  async getHover(uri: string, position: Position): Promise<HoverResult | null> {
    const server = this.getServerForUri(uri);
    if (!server || !server.capabilities.hoverProvider) return null;

    // In a real implementation, this would send an LSP hover request
    return {
      contents: {
        kind: 'markdown',
        value: 'Hover information',
      },
    };
  }

  /**
   * Get completions
   */
  async getCompletions(uri: string, position: Position): Promise<CompletionItem[]> {
    const server = this.getServerForUri(uri);
    if (!server || !server.capabilities.completionProvider) return [];

    // In a real implementation, this would send an LSP completion request
    return [];
  }

  /**
   * Go to definition
   */
  async goToDefinition(uri: string, position: Position): Promise<Location[] | null> {
    const server = this.getServerForUri(uri);
    if (!server || !server.capabilities.definitionProvider) return null;

    // In a real implementation, this would send an LSP definition request
    return [];
  }

  /**
   * Find references
   */
  async findReferences(uri: string, position: Position): Promise<Location[] | null> {
    const server = this.getServerForUri(uri);
    if (!server || !server.capabilities.referencesProvider) return null;

    // In a real implementation, this would send an LSP references request
    return [];
  }

  /**
   * Get document symbols
   */
  async getDocumentSymbols(uri: string): Promise<SymbolInfo[] | null> {
    const server = this.getServerForUri(uri);
    if (!server || !server.capabilities.documentSymbolProvider) return null;

    // In a real implementation, this would send an LSP document symbol request
    return [];
  }

  /**
   * Get code actions
   */
  async getCodeActions(uri: string, range: Range): Promise<CodeAction[]> {
    const server = this.getServerForUri(uri);
    if (!server || !server.capabilities.codeActionProvider) return [];

    // In a real implementation, this would send an LSP code action request
    return [];
  }

  /**
   * Get diagnostics
   */
  async getDiagnostics(uri: string): Promise<Diagnostic[]> {
    const server = this.getServerForUri(uri);
    if (!server) return [];

    // In a real implementation, this would get diagnostics from the server
    return [];
  }

  /**
   * Format document
   */
  async formatDocument(uri: string): Promise<TextEdit[] | null> {
    const server = this.getServerForUri(uri);
    if (!server || !server.capabilities.documentFormattingProvider) return null;

    // In a real implementation, this would send an LSP formatting request
    return [];
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalServers: number;
    runningServers: number;
    activeServer: string | null;
    totalContexts: number;
    serversByLanguage: Record<string, number>;
  } {
    const servers = this.getAllServers();
    const running = servers.filter(s => s.status === 'running').length;

    const serversByLanguage: Record<string, number> = {} as any;
    for (const server of servers) {
      serversByLanguage[server.language] = (serversByLanguage[server.language] || 0) + 1;
    }

    return {
      totalServers: servers.length,
      runningServers: running,
      activeServer: this.activeServer,
      totalContexts: this.contexts.size,
      serversByLanguage,
    };
  }

  // Private methods

  private getServerForUri(uri: string): LspServer | undefined {
    const context = this.contexts.get(uri);
    if (!context) return this.getActiveServer();

    const servers = this.getServersByLanguage(context.languageId);
    return servers[0] || this.getActiveServer();
  }

  private async startLspProcess(server: LspServer): Promise<void> {
    // In a real implementation, this would spawn the LSP server process
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async stopLspProcess(server: LspServer): Promise<void> {
    // In a real implementation, this would terminate the LSP server process
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Global LSP manager instance
const lspManager = new LspManager();

export function registerServer(server: LspServer): void {
  lspManager.registerServer(server);
}

export function unregisterServer(serverId: string): boolean {
  return lspManager.unregisterServer(serverId);
}

export function getServer(serverId: string): LspServer | undefined {
  return lspManager.getServer(serverId);
}

export function getAllServers(): LspServer[] {
  return lspManager.getAllServers();
}

export function getServersByLanguage(language: string): LspServer[] {
  return lspManager.getServersByLanguage(language);
}

export async function startServer(serverId: string): Promise<boolean> {
  return lspManager.startServer(serverId);
}

export async function stopServer(serverId: string): Promise<boolean> {
  return lspManager.stopServer(serverId);
}

export function setActiveServer(serverId: string): void {
  lspManager.setActiveServer(serverId);
}

export function getActiveServer(): LspServer | undefined {
  return lspManager.getActiveServer();
}

export function addContext(uri: string, context: LspContext): void {
  lspManager.addContext(uri, context);
}

export function removeContext(uri: string): void {
  lspManager.removeContext(uri);
}

export function getContext(uri: string): LspContext | undefined {
  return lspManager.getContext(uri);
}

export async function getHover(uri: string, position: Position): Promise<HoverResult | null> {
  return lspManager.getHover(uri, position);
}

export async function getCompletions(uri: string, position: Position): Promise<CompletionItem[]> {
  return lspManager.getCompletions(uri, position);
}

export async function goToDefinition(uri: string, position: Position): Promise<Location[] | null> {
  return lspManager.goToDefinition(uri, position);
}

export async function findReferences(uri: string, position: Position): Promise<Location[] | null> {
  return lspManager.findReferences(uri, position);
}

export async function getDocumentSymbols(uri: string): Promise<SymbolInfo[] | null> {
  return lspManager.getDocumentSymbols(uri);
}

export async function getCodeActions(uri: string, range: Range): Promise<CodeAction[]> {
  return lspManager.getCodeActions(uri, range);
}

export async function getDiagnostics(uri: string): Promise<Diagnostic[]> {
  return lspManager.getDiagnostics(uri);
}

export async function formatDocument(uri: string): Promise<TextEdit[] | null> {
  return lspManager.formatDocument(uri);
}

export function getStatistics(): {
  totalServers: number;
  runningServers: number;
  activeServer: string | null;
  totalContexts: number;
  serversByLanguage: Record<string, number>;
} {
  return lspManager.getStatistics();
}
