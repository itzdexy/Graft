/**
 * Advanced security features for Tovyr
 * Provides secure credential management, code scanning, and security best practices
 */

export interface SecurityPolicy {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  rules: SecurityRule[];
}

export interface SecurityRule {
  id: string;
  pattern: RegExp | string;
  description: string;
  suggestion: string;
  category: 'credential' | 'injection' | 'xss' | 'crypto' | 'auth' | 'data';
}

export interface SecurityScanResult {
  file: string;
  line: number;
  column: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rule: string;
  description: string;
  suggestion: string;
  category: string;
}

export interface Credential {
  id: string;
  name: string;
  type: 'api_key' | 'password' | 'token' | 'certificate' | 'ssh_key';
  encrypted: boolean;
  createdAt: number;
  lastUsed: number;
  expiresAt?: number;
  metadata: Record<string, string>;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: number;
  action: string;
  user: string;
  resource: string;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error';
}

export interface SecurityConfig {
  enforcePolicies: boolean;
  autoScanOnSave: boolean;
  blockSuspiciousCommands: boolean;
  requireApprovalFor: string[];
  maxCredentialAge: number; // in days
  enableAuditLogging: boolean;
  encryptionKey?: string;
}

class SecuritySystem {
  private policies: SecurityPolicy[] = [];
  private credentials: Map<string, Credential> = new Map();
  private auditLog: SecurityAuditLog[] = [];
  private config: SecurityConfig;
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = this.generateEncryptionKey();
    this.config = this.getDefaultConfig();
    this.initializeDefaultPolicies();
  }

  /**
   * Scan code for security vulnerabilities
   */
  async scanCode(code: string, filePath: string): Promise<SecurityScanResult[]> {
    const results: SecurityScanResult[] = [];
    const lines = code.split('\n');

    for (const policy of this.policies) {
      if (!policy.enabled) continue;

      for (const rule of policy.rules) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let match: RegExpMatchArray | null = null;

          if (rule.pattern instanceof RegExp) {
            match = line.match(rule.pattern);
          } else {
            const regex = new RegExp(rule.pattern, 'gi');
            match = line.match(regex);
          }

          if (match) {
            results.push({
              file: filePath,
              line: i + 1,
              column: match.index || 0,
              severity: policy.severity,
              rule: rule.id,
              description: rule.description,
              suggestion: rule.suggestion,
              category: rule.category,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Scan a file for security issues
   */
  async scanFile(filePath: string): Promise<SecurityScanResult[]> {
    // In a real implementation, this would read the file
    const code = '';
    return this.scanCode(code, filePath);
  }

  /**
   * Scan entire project
   */
  async scanProject(projectPath: string): Promise<Map<string, SecurityScanResult[]>> {
    const results = new Map<string, SecurityScanResult[]>();

    // In a real implementation, this would scan all files
    const files = this.getProjectFiles(projectPath);

    for (const file of files) {
      const fileResults = await this.scanFile(file);
      if (fileResults.length > 0) {
        results.set(file, fileResults);
      }
    }

    return results;
  }

  /**
   * Store a credential securely
   */
  async storeCredential(
    name: string,
    value: string,
    type: Credential['type'],
    metadata?: Record<string, string>
  ): Promise<Credential> {
    const encrypted = this.encrypt(value);
    
    const credential: Credential = {
      id: this.generateId(),
      name,
      type,
      encrypted: true,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      metadata: metadata || {},
    };

    this.credentials.set(credential.id, credential);
    this.logAudit('credential_stored', name, { type, encrypted: true });

    return credential;
  }

  /**
   * Retrieve a credential
   */
  async getCredential(id: string): Promise<string | null> {
    const credential = this.credentials.get(id);
    
    if (!credential) {
      return null;
    }

    // Check if expired
    if (credential.expiresAt && credential.expiresAt < Date.now()) {
      this.logAudit('credential_expired', credential.name, { id });
      return null;
    }

    credential.lastUsed = Date.now();
    this.logAudit('credential_retrieved', credential.name, { id });

    // In a real implementation, this would decrypt the value
    return 'decrypted_value';
  }

  /**
   * Delete a credential
   */
  deleteCredential(id: string): void {
    const credential = this.credentials.get(id);
    if (credential) {
      this.credentials.delete(id);
      this.logAudit('credential_deleted', credential.name, { id });
    }
  }

  /**
   * Get all credentials
   */
  getCredentials(): Credential[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Check if a command is safe to execute
   */
  isCommandSafe(command: string): { safe: boolean; reason?: string } {
    const suspiciousPatterns = [
      /rm\s+-rf/,
      /dd\s+if=/,
      />\s*\/dev\/null/,
      /curl\s+.*\|\s*sh/,
      /wget\s+.*\|\s*sh/,
      /eval\s*\(/,
      /exec\s*\(/,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(command)) {
        return {
          safe: false,
          reason: `Command matches suspicious pattern: ${pattern}`,
        };
      }
    }

    if (this.config.blockSuspiciousCommands) {
      // Additional checks
      if (command.includes('sudo') && !command.includes('tovyr')) {
        return {
          safe: false,
          reason: 'Sudo commands require explicit approval',
        };
      }
    }

    return { safe: true };
  }

  /**
   * Get security policies
   */
  getPolicies(): SecurityPolicy[] {
    return this.policies;
  }

  /**
   * Enable/disable a security policy
   */
  setPolicyEnabled(policyName: string, enabled: boolean): void {
    const policy = this.policies.find(p => p.name === policyName);
    if (policy) {
      policy.enabled = enabled;
      this.logAudit('policy_updated', policyName, { enabled });
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(limit?: number): SecurityAuditLog[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return this.auditLog;
  }

  /**
   * Get audit log for a specific resource
   */
  getAuditLogForResource(resource: string): SecurityAuditLog[] {
    return this.auditLog.filter(log => log.resource === resource);
  }

  /**
   * Get security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update security configuration
   */
  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
    this.logAudit('config_updated', 'security', config);
  }

  /**
   * Generate security report
   */
  generateSecurityReport(): string {
    let report = 'Security Report\n';
    report += '===============\n\n';

    report += `Active Policies: ${this.policies.filter(p => p.enabled).length}/${this.policies.length}\n`;
    report += `Stored Credentials: ${this.credentials.size}\n`;
    report += `Audit Log Entries: ${this.auditLog.length}\n\n`;

    report += 'Configuration:\n';
    report += `- Enforce Policies: ${this.config.enforcePolicies}\n`;
    report += `- Auto Scan on Save: ${this.config.autoScanOnSave}\n`;
    report += `- Block Suspicious Commands: ${this.config.blockSuspiciousCommands}\n`;
    report += `- Audit Logging: ${this.config.enableAuditLogging}\n\n`;

    const recentActivity = this.auditLog.slice(-10);
    if (recentActivity.length > 0) {
      report += 'Recent Activity:\n';
      recentActivity.forEach(log => {
        report += `- [${new Date(log.timestamp).toISOString()}] ${log.action}: ${log.resource}\n`;
      });
    }

    return report;
  }

  /**
   * Check for expired credentials
   */
  checkExpiredCredentials(): Credential[] {
    const now = Date.now();
    return Array.from(this.credentials.values()).filter(
      cred => cred.expiresAt && cred.expiresAt < now
    );
  }

  /**
   * Rotate encryption key
   */
  rotateEncryptionKey(): void {
    this.encryptionKey = this.generateEncryptionKey();
    this.logAudit('key_rotated', 'encryption', {});
  }

  // Private helper methods

  private generateEncryptionKey(): string {
    // Browser-compatible random key generation
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private encrypt(data: string): string {
    // In a real implementation, this would use proper encryption
    return btoa(data);
  }

  private decrypt(data: string): string {
    // In a real implementation, this would use proper decryption
    return atob(data);
  }

  private generateId(): string {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    const randomPart = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${Date.now()}-${randomPart}`;
  }

  private getDefaultConfig(): SecurityConfig {
    return {
      enforcePolicies: true,
      autoScanOnSave: true,
      blockSuspiciousCommands: true,
      requireApprovalFor: ['sudo', 'rm -rf', 'dd'],
      maxCredentialAge: 90,
      enableAuditLogging: true,
    };
  }

  private initializeDefaultPolicies(): void {
    this.policies = [
      {
        name: 'Credential Leakage',
        description: 'Detect hardcoded credentials in code',
        severity: 'critical',
        enabled: true,
        rules: [
          {
            id: 'api_key_hardcoded',
            pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{10,}['"]/i,
            description: 'Hardcoded API key detected',
            suggestion: 'Use environment variables or a secure credential manager',
            category: 'credential',
          },
          {
            id: 'password_hardcoded',
            pattern: /password\s*[:=]\s*['"][^'"]{6,}['"]/i,
            description: 'Hardcoded password detected',
            suggestion: 'Use environment variables or a secure credential manager',
            category: 'credential',
          },
          {
            id: 'secret_hardcoded',
            pattern: /secret\s*[:=]\s*['"][^'"]{10,}['"]/i,
            description: 'Hardcoded secret detected',
            suggestion: 'Use environment variables or a secure credential manager',
            category: 'credential',
          },
        ],
      },
      {
        name: 'SQL Injection',
        description: 'Detect potential SQL injection vulnerabilities',
        severity: 'high',
        enabled: true,
        rules: [
          {
            id: 'sql_concatenation',
            pattern: /SELECT.*FROM.*WHERE.*\+/i,
            description: 'Potential SQL injection via string concatenation',
            suggestion: 'Use parameterized queries or prepared statements',
            category: 'injection',
          },
        ],
      },
      {
        name: 'XSS Vulnerabilities',
        description: 'Detect potential cross-site scripting vulnerabilities',
        severity: 'high',
        enabled: true,
        rules: [
          {
            id: 'innerHTML_usage',
            pattern: /\.innerHTML\s*=/,
            description: 'Direct innerHTML assignment can lead to XSS',
            suggestion: 'Use textContent or sanitize input before assignment',
            category: 'xss',
          },
        ],
      },
      {
        name: 'Weak Cryptography',
        description: 'Detect weak cryptographic practices',
        severity: 'medium',
        enabled: true,
        rules: [
          {
            id: 'md5_usage',
            pattern: /md5\s*\(/i,
            description: 'MD5 is considered weak for cryptographic purposes',
            suggestion: 'Use SHA-256 or stronger algorithms',
            category: 'crypto',
          },
          {
            id: 'sha1_usage',
            pattern: /sha1\s*\(/i,
            description: 'SHA-1 is considered weak for cryptographic purposes',
            suggestion: 'Use SHA-256 or stronger algorithms',
            category: 'crypto',
          },
        ],
      },
    ];
  }

  private getProjectFiles(projectPath: string): string[] {
    // In a real implementation, this would scan the directory
    return [];
  }

  private logAudit(
    action: string,
    resource: string,
    details: Record<string, unknown>
  ): void {
    if (!this.config.enableAuditLogging) return;

    const log: SecurityAuditLog = {
      id: this.generateId(),
      timestamp: Date.now(),
      action,
      user: 'system',
      resource,
      details,
      severity: 'info',
    };

    this.auditLog.push(log);

    // Keep log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog.shift();
    }
  }
}

// Global security system instance
const securitySystem = new SecuritySystem();

export async function scanCode(code: string, filePath: string): Promise<SecurityScanResult[]> {
  return securitySystem.scanCode(code, filePath);
}

export async function scanFile(filePath: string): Promise<SecurityScanResult[]> {
  return securitySystem.scanFile(filePath);
}

export async function scanProject(projectPath: string): Promise<Map<string, SecurityScanResult[]>> {
  return securitySystem.scanProject(projectPath);
}

export async function storeCredential(
  name: string,
  value: string,
  type: Credential['type'],
  metadata?: Record<string, string>
): Promise<Credential> {
  return securitySystem.storeCredential(name, value, type, metadata);
}

export async function getCredential(id: string): Promise<string | null> {
  return securitySystem.getCredential(id);
}

export function deleteCredential(id: string): void {
  securitySystem.deleteCredential(id);
}

export function getCredentials(): Credential[] {
  return securitySystem.getCredentials();
}

export function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  return securitySystem.isCommandSafe(command);
}

export function getPolicies(): SecurityPolicy[] {
  return securitySystem.getPolicies();
}

export function setPolicyEnabled(policyName: string, enabled: boolean): void {
  securitySystem.setPolicyEnabled(policyName, enabled);
}

export function getAuditLog(limit?: number): SecurityAuditLog[] {
  return securitySystem.getAuditLog(limit);
}

export function getConfig(): SecurityConfig {
  return securitySystem.getConfig();
}

export function updateConfig(config: Partial<SecurityConfig>): void {
  securitySystem.updateConfig(config);
}

export function generateSecurityReport(): string {
  return securitySystem.generateSecurityReport();
}

export function checkExpiredCredentials(): Credential[] {
  return securitySystem.checkExpiredCredentials();
}

export function rotateEncryptionKey(): void {
  securitySystem.rotateEncryptionKey();
}
