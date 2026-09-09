export interface CheckInResultDto {
  success: boolean;
  gateOpened: boolean;
  queueEntryId?: string;
  reason?: string;
}
