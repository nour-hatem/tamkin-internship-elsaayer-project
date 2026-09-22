import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypedEventEmitter } from './typed-event-emitter.service';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [TypedEventEmitter],
  exports: [TypedEventEmitter],
})
export class CommonModule {}
