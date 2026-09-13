export interface SapLookupResultDto {
  plate: string;
  found: boolean;
  gateId?: string;
  profile?: {
    name: string;
    phone: string;
  };
}