// Circuit breaker for external service calls
// Prevents cascading failures and enables graceful degradation

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: "closed" | "half_open" | "open";
  halfOpenTime: number;
}

const CIRCUITS = new Map<string, CircuitState>();

const FAILURE_THRESHOLD = 5;
const RECOVERY_TIMEOUT_MS = 30_000; // 30s before trying again
const HALF_OPEN_MAX = 3; // Max requests in half-open state

export class CircuitBreaker {
  constructor(
    private readonly serviceName: string,
    private readonly failureThreshold = FAILURE_THRESHOLD,
    private readonly recoveryTimeout = RECOVERY_TIMEOUT_MS,
  ) {}

  private getState(): CircuitState {
    const existing = CIRCUITS.get(this.serviceName);
    if (existing) return existing;

    const state: CircuitState = {
      failures: 0,
      lastFailure: 0,
      state: "closed",
      halfOpenTime: 0,
    };
    CIRCUITS.set(this.serviceName, state);
    return state;
  }

  getCircuitState(): "closed" | "half_open" | "open" {
    const s = this.getState();

    if (s.state === "open" && Date.now() - s.lastFailure > this.recoveryTimeout) {
      s.state = "half_open";
      s.halfOpenTime = Date.now();
      s.failures = 0;
    }

    return s.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const s = this.getState();
    const currentState = this.getCircuitState();

    if (currentState === "open") {
      throw new Error(
        `Circuit breaker OPEN for ${this.serviceName}. No requests allowed.`,
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  onSuccess(): void {
    const s = this.getState();
    s.failures = 0;
    s.state = "closed";
  }

  onFailure(): void {
    const s = this.getState();
    s.failures++;
    s.lastFailure = Date.now();

    if (s.failures >= this.failureThreshold) {
      s.state = "open";
      console.error(
        `[CircuitBreaker] ${this.serviceName} OPEN after ${s.failures} failures`,
      );
    }
  }
}
