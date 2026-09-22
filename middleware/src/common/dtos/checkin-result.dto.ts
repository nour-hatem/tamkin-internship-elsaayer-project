export interface CheckInResultDto {
  success: boolean;
  gateOpened: boolean;
  phone:string
  queueEntryId?: string;
  reason?: string;
}

