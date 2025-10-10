/**
 * Web Vitals Integration
 * 
 * Captures and reports Core Web Vitals metrics for performance monitoring.
 * Provides real-time performance insights and budget tracking.
 */

import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals';
import { config } from '@/lib/env';

// Web Vitals metrics interface
export interface WebVitalsMetrics {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fcp: number | null;
  ttfb: number | null;
  fid: number | null;
  route: string;
  timestamp: number;
}

// Performance budget thresholds
export const PERFORMANCE_BUDGETS = {
  LCP: 2500, // Largest Contentful Paint (ms)
  CLS: 0.1,  // Cumulative Layout Shift
  INP: 200,  // Interaction to Next Paint (ms)
  FCP: 1800, // First Contentful Paint (ms)
  TTFB: 800, // Time to First Byte (ms)
  FID: 100,  // First Input Delay (ms)
} as const;

// Performance budget status
export type BudgetStatus = 'good' | 'needs-improvement' | 'poor';

// Web Vitals callback type
export type WebVitalsCallback = (metrics: WebVitalsMetrics) => void;

// Global metrics storage
let currentMetrics: Partial<WebVitalsMetrics> = {};
let metricsCallbacks: WebVitalsCallback[] = [];

/**
 * Determines budget status based on metric value and threshold
 * @param value - Metric value
 * @param threshold - Budget threshold
 * @param isLowerBetter - Whether lower values are better
 * @returns Budget status
 */
const getBudgetStatus = (
  value: number,
  threshold: number,
  isLowerBetter: boolean = true
): BudgetStatus => {
  if (isLowerBetter) {
    if (value <= threshold) return 'good';
    if (value <= threshold * 1.5) return 'needs-improvement';
    return 'poor';
  } else {
    if (value >= threshold) return 'good';
    if (value >= threshold * 0.5) return 'needs-improvement';
    return 'poor';
  }
};

/**
 * Handles Web Vitals metric collection
 * @param metric - Web Vitals metric
 */
const handleMetric = (metric: Metric): void => {
  const route = window.location.pathname;
  const timestamp = Date.now();

  // Update current metrics
  switch (metric.name) {
    case 'LCP':
      currentMetrics.lcp = metric.value;
      break;
    case 'CLS':
      currentMetrics.cls = metric.value;
      break;
    case 'INP':
      currentMetrics.inp = metric.value;
      break;
    case 'FCP':
      currentMetrics.fcp = metric.value;
      break;
    case 'TTFB':
      currentMetrics.ttfb = metric.value;
      break;
    // FID is deprecated in web-vitals v5, use INP instead
  }

  // Create complete metrics object
  const completeMetrics: WebVitalsMetrics = {
    lcp: currentMetrics.lcp || null,
    cls: currentMetrics.cls || null,
    inp: currentMetrics.inp || null,
    fcp: currentMetrics.fcp || null,
    ttfb: currentMetrics.ttfb || null,
    fid: currentMetrics.fid || null,
    route,
    timestamp,
  };

  // Log metric for development
  if (config.IS_DEVELOPMENT) {
    const status = getBudgetStatus(metric.value, PERFORMANCE_BUDGETS[metric.name as keyof typeof PERFORMANCE_BUDGETS]);
    console.log(`Web Vitals - ${metric.name}:`, {
      value: metric.value,
      status,
      route,
    });
  }

  // Notify callbacks
  metricsCallbacks.forEach(callback => {
    try {
      callback(completeMetrics);
    } catch (error) {
      console.error('Error in Web Vitals callback:', error);
    }
  });
};

/**
 * Initialize Web Vitals collection
 */
export const initWebVitals = (): void => {
  // Only initialize in browser environment
  if (typeof window === 'undefined') return;

  // Collect all Web Vitals metrics
  onCLS(handleMetric);
  onFCP(handleMetric);
  onLCP(handleMetric);
  onTTFB(handleMetric);
  onINP(handleMetric);

  // Reset metrics on route change
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    resetMetrics();
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    resetMetrics();
  };

  window.addEventListener('popstate', resetMetrics);
};

/**
 * Reset metrics for new route
 */
const resetMetrics = (): void => {
  currentMetrics = {};
};

/**
 * Add a callback for Web Vitals metrics
 * @param callback - Callback function
 */
export const addWebVitalsCallback = (callback: WebVitalsCallback): void => {
  metricsCallbacks.push(callback);
};

/**
 * Remove a callback for Web Vitals metrics
 * @param callback - Callback function to remove
 */
export const removeWebVitalsCallback = (callback: WebVitalsCallback): void => {
  const index = metricsCallbacks.indexOf(callback);
  if (index > -1) {
    metricsCallbacks.splice(index, 1);
  }
};

/**
 * Get current Web Vitals metrics
 * @returns Current metrics
 */
export const getCurrentMetrics = (): Partial<WebVitalsMetrics> => {
  return { ...currentMetrics };
};

/**
 * Check if metrics meet performance budgets
 * @param metrics - Web Vitals metrics
 * @returns Budget status for each metric
 */
export const checkPerformanceBudgets = (metrics: WebVitalsMetrics): Record<string, BudgetStatus> => {
  const status: Record<string, BudgetStatus> = {};

  if (metrics['lcp'] !== null) {
    status['lcp'] = getBudgetStatus(metrics['lcp'], PERFORMANCE_BUDGETS.LCP);
  }
  if (metrics['cls'] !== null) {
    status['cls'] = getBudgetStatus(metrics['cls'], PERFORMANCE_BUDGETS.CLS, false);
  }
  if (metrics['inp'] !== null) {
    status['inp'] = getBudgetStatus(metrics['inp'], PERFORMANCE_BUDGETS.INP);
  }
  if (metrics['fcp'] !== null) {
    status['fcp'] = getBudgetStatus(metrics['fcp'], PERFORMANCE_BUDGETS.FCP);
  }
  if (metrics['ttfb'] !== null) {
    status['ttfb'] = getBudgetStatus(metrics['ttfb'], PERFORMANCE_BUDGETS.TTFB);
  }
  if (metrics['fid'] !== null) {
    status['fid'] = getBudgetStatus(metrics['fid'], PERFORMANCE_BUDGETS.FID);
  }

  return status;
};

/**
 * Get overall performance score
 * @param metrics - Web Vitals metrics
 * @returns Overall score (0-100)
 */
export const getPerformanceScore = (metrics: WebVitalsMetrics): number => {
  const statuses = checkPerformanceBudgets(metrics);
  const scores = Object.values(statuses).map(status => {
    switch (status) {
      case 'good': return 100;
      case 'needs-improvement': return 50;
      case 'poor': return 0;
      default: return 0;
    }
  });

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length);
};

/**
 * Format metric value for display
 * @param value - Metric value
 * @param metric - Metric name
 * @returns Formatted string
 */
export const formatMetricValue = (value: number, metric: string): string => {
  switch (metric) {
    case 'LCP':
    case 'FCP':
    case 'TTFB':
    case 'INP':
    case 'FID':
      return `${Math.round(value)}ms`;
    case 'CLS':
      return value.toFixed(3);
    default:
      return value.toString();
  }
};
