export interface NluResultDto {
  intent: string;
  confidence: number;
  entities: Record<string, string | number | boolean>;
}
