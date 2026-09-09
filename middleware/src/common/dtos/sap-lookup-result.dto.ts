export interface SapLookupResultDto {
  plate: string;
  found: boolean;
  profile?: {
    name: string;
    phone: string;
  };
}
