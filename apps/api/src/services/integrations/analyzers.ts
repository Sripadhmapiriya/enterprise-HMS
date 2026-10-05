export interface AnalyzerResultItem {
  parameterCode: string;
  parameterName: string;
  value: number;
  unit: string;
  referenceRange: string;
  criticalLow?: number;
  criticalHigh?: number;
}

export interface AnalyzerFeedPayload {
  analyzerId: string;
  analyzerModel: string;
  sampleBarcode: string;
  timestamp: string;
  results: AnalyzerResultItem[];
}

export interface AnalyzerIngestResponse {
  success: boolean;
  sampleBarcode: string;
  resultsCount: number;
  criticalValuesFlagged: number;
  status: string;
  processedResults: Array<{
    parameter: string;
    value: number;
    unit: string;
    flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL';
  }>;
}

export class AnalyzerService {
  async processAnalyzerFeed(payload: AnalyzerFeedPayload): Promise<AnalyzerIngestResponse> {
    let criticalCount = 0;

    const processed = payload.results.map((r) => {
      let flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' = 'NORMAL';

      if (r.criticalLow !== undefined && r.value < r.criticalLow) {
        flag = 'CRITICAL';
        criticalCount++;
      } else if (r.criticalHigh !== undefined && r.value > r.criticalHigh) {
        flag = 'CRITICAL';
        criticalCount++;
      }

      return {
        parameter: r.parameterName || r.parameterCode,
        value: r.value,
        unit: r.unit,
        flag,
      };
    });

    return {
      success: true,
      sampleBarcode: payload.sampleBarcode,
      resultsCount: payload.results.length,
      criticalValuesFlagged: criticalCount,
      status: criticalCount > 0 ? 'CRITICAL_ALERT_TRIGGERED' : 'RESULTS_INGESTED',
      processedResults: processed,
    };
  }
}

export const analyzerService = new AnalyzerService();
