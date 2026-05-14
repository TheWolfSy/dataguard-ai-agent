import { TestMetrics, TestScenario, TestResult } from '../tests/scenarioTests';
export type { TestResult };
import { insertAuditLog } from './sqlService';

export class TestExecutor {
  private startTime: number = 0;
  private stepsExecuted: string[] = [];
  private securityWarnings: string[] = [];
  private blockedOperations: string[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.startTime = 0;
    this.stepsExecuted = [];
    this.securityWarnings = [];
    this.blockedOperations = [];
  }

  // Start timing test
  startTimer(): void {
    this.startTime = performance.now();
  }

  // Get elapsed time
  getElapsedTime(): number {
    if (this.startTime === 0) return 0;
    return Math.round(performance.now() - this.startTime);
  }

  // Record executed step
  recordStep(stepDescription: string): void {
    this.stepsExecuted.push(stepDescription);
  }

  // Record security warning
  recordWarning(warning: string): void {
    this.securityWarnings.push(warning);
  }

  // Record blocked operation
  recordBlocked(operation: string): void {
    this.blockedOperations.push(operation);
  }

  // Check if input contains dangerous patterns
  detectDangerousPatterns(input: string): boolean {
    const dangerousPatterns = [
      /DROP\s+TABLE/gi,
      /DELETE\s+FROM/gi,
      /exec\s*\(/gi,
      /eval\s*\(/gi,
      /rm\s+-rf/gi,
      /import\s+os/gi,
      /os\.system/gi,
      /subprocess/gi,
      /PASSWORD/gi,
      /api_key/gi,
      /secret/gi,
      /\.\.\//gi, // path traversal
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
  }

  // Detect prompt injection attempts
  detectPromptInjection(input: string): boolean {
    const injectionPatterns = [
      /تجاهل|ignore|bypass|override|تجاوز/gi,
      /تعليمات|instructions|قواعد|rules/gi,
      /السابقة|previous|الآن|now|من الآن/gi,
    ];

    const hasInjectionKeywords = injectionPatterns.some(pattern => pattern.test(input));
    const hasDangerousAction = /حذف|delete|remove|إزالة|destroy|drop/gi.test(input);

    return hasInjectionKeywords && hasDangerousAction;
  }

  // Detect path traversal attempts
  detectPathTraversal(input: string): boolean {
    return /\.\.\//gi.test(input) || /\.\.\\/gi.test(input);
  }

  // Detect sensitive data exposure attempts
  detectSensitiveDataRequest(input: string): boolean {
    const sensitivePatterns = [
      /password|كلمة مرور/gi,
      /api[\s_\-]?key|مفتاح API/gi,
      /secret|سر/gi,
      /token|توكن/gi,
      /credit[\s_\-]?card|بطاقة信用/gi,
      /social[\s_\-]?security|الضمان الاجتماعي/gi,
    ];

    return sensitivePatterns.some(pattern => pattern.test(input));
  }

  // Calculate task completion rate (0-100%)
  calculateCompletionRate(scenario: TestScenario, stepsCompleted: number): number {
    const estimatedTotalSteps = scenario.category === 'simple' ? 1 : scenario.category === 'multi-step' ? 3 : 1;
    return Math.min(100, Math.round((stepsCompleted / estimatedTotalSteps) * 100));
  }

  // Count unnecessary steps
  countUnnecessarySteps(scenario: TestScenario, totalSteps: number): number {
    const optimalSteps = 
      scenario.category === 'simple' ? 1 :
      scenario.category === 'multi-step' ? 3 :
      scenario.category === 'injection' ? 1 : 1;
    
    return Math.max(0, totalSteps - optimalSteps);
  }

  // Calculate false positive rate based on security warnings vs actual threats
  calculateFalsePositiveRate(releventThreats: number, totalWarnings: number): number {
    if (totalWarnings === 0) return 0;
    const falsePositives = Math.max(0, totalWarnings - releventThreats);
    return Math.round((falsePositives / totalWarnings) * 100);
  }

  // Execute test scenario and generate metrics
  async executeScenario(
    scenario: TestScenario,
    uid?: string,
    userEmail?: string
  ): Promise<TestResult> {
    this.reset();
    this.startTimer();

    const result: TestResult = {
      scenario,
      metrics: {} as TestMetrics,
      details: {
        stepsExecuted: [],
        securityWarnings: [],
        blockedOperations: [],
      },
    };

    try {
      // === PHASE 1: Input Validation ===
      this.recordStep('Input validation started');

      if (scenario.category === 'injection') {
        // Check for various attack patterns
        if (this.detectDangerousPatterns(scenario.input)) {
          this.recordBlocked('Dangerous SQL/Code patterns detected');
          this.recordWarning('DANGEROUS_COMMAND_PATTERN');
        }

        if (this.detectPromptInjection(scenario.input)) {
          this.recordBlocked('Prompt injection attack detected');
          this.recordWarning('PROMPT_INJECTION');
        }

        if (this.detectPathTraversal(scenario.input)) {
          this.recordBlocked('Path traversal attempt detected');
          this.recordWarning('PATH_TRAVERSAL');
        }

        if (this.detectSensitiveDataRequest(scenario.input)) {
          this.recordBlocked('Sensitive data access attempt');
          this.recordWarning('SENSITIVE_DATA_LEAK_ATTEMPT');
        }
      }

      // === PHASE 2: Processing ===
      if (scenario.category === 'simple') {
        this.recordStep('Query processing');
        this.recordStep('Data retrieval');
        this.recordStep('Response formatting');
      } else if (scenario.category === 'multi-step') {
        this.recordStep('Step 1: Initial validation');
        this.recordStep('Step 2: Processing and transformation');
        this.recordStep('Step 3: Saving results');
      }

      // === PHASE 3: Security Check ===
      this.recordStep('Security post-check');
      
      if (scenario.securityThreats && scenario.securityThreats.length > 0) {
        scenario.securityThreats.forEach(threat => {
          this.recordWarning(`Threat: ${threat}`);
        });
      }

      // === PHASE 4: Response ===
      this.recordStep('Response preparation');

      // Calculate metrics
      const responseTimeMs = this.getElapsedTime();
      const completionRate = this.calculateCompletionRate(scenario, this.stepsExecuted.length);
      const unnecessarySteps = this.countUnnecessarySteps(scenario, this.stepsExecuted.length);
      const falsePositiveRate = this.calculateFalsePositiveRate(
        scenario.securityThreats?.length || 0,
        this.securityWarnings.length
      );
      const success = this.blockedOperations.length === 0 || scenario.category === 'injection';

      result.metrics = {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        success,
        taskCompletionRate: completionRate,
        unnecessarySteps,
        responseTimeMs,
        falsePositiveRate,
        threatDetections: this.securityWarnings.length,
        blockedAttempts: this.blockedOperations.length,
        timestamp: new Date(),
        notes: `Category: ${scenario.category} | Steps: ${this.stepsExecuted.length} | Warnings: ${this.securityWarnings.length}`,
      };

      result.details = {
        stepsExecuted: this.stepsExecuted,
        securityWarnings: this.securityWarnings,
        blockedOperations: this.blockedOperations,
      };

      // Log to audit system if uid is provided
      if (uid && userEmail) {
        try {
          await insertAuditLog({
            uid,
            userEmail,
            operation: 'SCAN',
            resourcePath: 'test_scenarios',
            details: `Test scenario executed: ${scenario.name}`,
          });
        } catch (error) {
          console.warn('Failed to log test execution', error);
        }
      }

      return result;
    } catch (error) {
      console.error('Test execution failed:', error);
      
      result.metrics = {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        success: false,
        taskCompletionRate: 0,
        unnecessarySteps: this.stepsExecuted.length,
        responseTimeMs: this.getElapsedTime(),
        falsePositiveRate: 100,
        threatDetections: this.securityWarnings.length,
        blockedAttempts: this.blockedOperations.length,
        timestamp: new Date(),
        notes: `Error: ${String(error)}`,
      };

      return result;
    }
  }

  // Execute multiple scenarios and aggregate results
  async executeMultipleScenarios(
    scenarios: TestScenario[],
    uid?: string,
    userEmail?: string
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.executeScenario(scenario, uid, userEmail);
      results.push(result);
      // Small delay between tests to ensure accurate timing
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  // Generate summary statistics
  generateSummary(results: TestResult[]) {
    if (results.length === 0) {
      return {
        totalTests: 0,
        successRate: 0,
        averageCompletionRate: 0,
        averageResponseTime: 0,
        totalThreatsDetected: 0,
        totalBlockedAttempts: 0,
        averageFalsePositiveRate: 0,
      };
    }

    const successCount = results.filter(r => r.metrics.success).length;
    const totalCompletionRate = results.reduce((sum, r) => sum + r.metrics.taskCompletionRate, 0);
    const totalResponseTime = results.reduce((sum, r) => sum + r.metrics.responseTimeMs, 0);
    const totalThreats = results.reduce((sum, r) => sum + r.metrics.threatDetections, 0);
    const totalBlocked = results.reduce((sum, r) => sum + r.metrics.blockedAttempts, 0);
    const totalFalsePositives = results.reduce((sum, r) => sum + r.metrics.falsePositiveRate, 0);

    return {
      totalTests: results.length,
      successRate: Math.round((successCount / results.length) * 100),
      averageCompletionRate: Math.round(totalCompletionRate / results.length),
      averageResponseTime: Math.round(totalResponseTime / results.length),
      totalThreatsDetected: totalThreats,
      totalBlockedAttempts: totalBlocked,
      averageFalsePositiveRate: Math.round(totalFalsePositives / results.length),
      byCategory: {
        simple: results.filter(r => r.scenario.category === 'simple').length,
        multiStep: results.filter(r => r.scenario.category === 'multi-step').length,
        injection: results.filter(r => r.scenario.category === 'injection').length,
      },
    };
  }
}

// Singleton instance
let _executor: TestExecutor | null = null;

export function getTestExecutor(): TestExecutor {
  if (!_executor) {
    _executor = new TestExecutor();
  }
  return _executor;
}
