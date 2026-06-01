/**
 * Types for the "Took? Breach Checker" full-stack application.
 */

export interface BreachSource {
  id: string;
  name: string;
  category: string;
  leakDate: string;
  severity: "Critical" | "High" | "Moderate";
  totalRecordsLeaked: number;
  compromisedDataFields: string[];
  description: string;
}

export interface LeakRecord {
  query: string;
  isLeaked: boolean;
  breach?: BreachSource;
  compromiseFields?: string[];
  sensitiveHint?: string; // a masked warning hint e.g., "p***99"
  compromisedIp?: string;
}

export interface SearchResponse {
  query: string;
  isLeaked: boolean;
  record?: LeakRecord;
  stats: {
    totalRecordsSearched: number;
    activeBreachesCount: number;
    leakRatePercent: number;
  };
}

export interface RemediationResponse {
  success: boolean;
  remediationPlan?: string;
  error?: string;
}

export interface ScannerFeedItem {
  id: string;
  queryMasked: string;
  breachName?: string;
  isLeaked: boolean;
  timestamp: string;
}
