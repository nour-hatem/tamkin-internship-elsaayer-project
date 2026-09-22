import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class QrTokenService {
  generate(): string {
    return randomUUID();
  }
}
