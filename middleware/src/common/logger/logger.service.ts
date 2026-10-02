import { Injectable, LoggerService as NestLoggerService, Optional } from '@nestjs/common';
import pino, { Logger as PinoLogger } from 'pino';
import pinoPretty from 'pino-pretty';
import * as path from 'path';
import { DailyRotateFileStream } from './daily-rotate-file.stream';
import { requestContextStorage } from './request-context.storage';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly pino: PinoLogger;
  private context?: string;

  constructor(@Optional() context?: string) {
    this.context = context;

    const isProd = process.env.NODE_ENV === 'production';
    const logsDir = path.resolve(process.cwd(), 'logs');
    const rotateStream = new DailyRotateFileStream(logsDir, 7);

    const streams: Array<{ stream: any; level?: string }> = [
      { stream: rotateStream },
    ];

    if (isProd) {
      streams.push({ stream: process.stdout });
    } else {
      const prettyStream = pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      });
      streams.push({ stream: prettyStream });
    }

    this.pino = pino(
      {
        messageKey: 'message',
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        formatters: {
          level: (label: string) => ({ level: label }),
        },
      },
      pino.multistream(streams),
    );
  }

  setContext(context: string): void {
    this.context = context;
  }

  private parseParams(optionalParams: any[]): {
    moduleName: string;
    correlationId?: string;
    extra: Record<string, any>;
    stack?: string;
  } {
    let moduleName = this.context || 'Application';
    let correlationId = requestContextStorage.getStore()?.correlationId;
    const extra: Record<string, any> = {};
    let stack: string | undefined;

    if (optionalParams && optionalParams.length > 0) {
      const last = optionalParams[optionalParams.length - 1];
      let candidateParams = optionalParams;

      if (typeof last === 'string') {
        moduleName = last;
        candidateParams = optionalParams.slice(0, -1);
      }

      for (const item of candidateParams) {
        if (typeof item === 'string' && !stack) {
          stack = item;
        } else if (item instanceof Error) {
          stack = item.stack;
          extra.error = item.message;
        } else if (item && typeof item === 'object') {
          if (item.correlationId) {
            correlationId = item.correlationId;
          }
          Object.assign(extra, item);
        }
      }
    }

    return { moduleName, correlationId, extra, stack };
  }

  log(message: any, ...optionalParams: any[]): void {
    this.writeLog('info', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]): void {
    this.writeLog('error', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]): void {
    this.writeLog('warn', message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]): void {
    this.writeLog('debug', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]): void {
    this.writeLog('trace', message, optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]): void {
    this.writeLog('fatal', message, optionalParams);
  }

  private writeLog(
    level: 'info' | 'error' | 'warn' | 'debug' | 'trace' | 'fatal',
    message: any,
    optionalParams: any[],
  ): void {
    const { moduleName, correlationId, extra, stack } = this.parseParams(optionalParams);

    const logPayload: Record<string, any> = {
      module: moduleName,
      ...extra,
    };

    if (correlationId !== undefined) {
      logPayload.correlationId = correlationId;
    }

    if (stack) {
      logPayload.stack = stack;
    }

    const msg = typeof message === 'string' ? message : JSON.stringify(message);

    this.pino[level](logPayload, msg);
  }
}
