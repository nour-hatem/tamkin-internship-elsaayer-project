import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from './logger.service';
import { runWithCorrelationId } from './request-context.storage';

describe('LoggerService', () => {
  const logsDir = path.resolve(process.cwd(), 'logs');
  let loggerService: LoggerService;

  beforeEach(() => {
    loggerService = new LoggerService('TestModule');
  });

  afterAll(() => {
    // Clean up created log files after tests
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir).filter((f) => /^app-.*\.log$/.test(f));
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(logsDir, file));
        } catch {
          // ignore
        }
      }
    }
  });

  it('should be defined and log info messages', async () => {
    expect(loggerService).toBeDefined();

    loggerService.log('Test info message', { plate: '12345' }, 'SpecificModule');
    loggerService.warn('Test warning message');
    loggerService.error('Test error message', 'fake stack trace', 'ErrorModule');

    // Wait a brief moment for stream write
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fs.existsSync(logsDir)).toBe(true);
    const files = fs.readdirSync(logsDir).filter((f) => /^app-.*\.log$/.test(f));
    expect(files.length).toBeGreaterThan(0);

    const latestFile = path.join(logsDir, files[files.length - 1]);
    const content = fs.readFileSync(latestFile, 'utf8');

    expect(content).toContain('Test info message');
    expect(content).toContain('"module":"SpecificModule"');
    expect(content).toContain('"plate":"12345"');
    expect(content).toContain('Test warning message');
    expect(content).toContain('"module":"TestModule"');
    expect(content).toContain('Test error message');
    expect(content).toContain('"module":"ErrorModule"');
  });

  it('should capture correlationId from request context', async () => {
    await runWithCorrelationId('corr-test-456', async () => {
      loggerService.log('Correlated message');
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const files = fs.readdirSync(logsDir).filter((f) => /^app-.*\.log$/.test(f));
    const latestFile = path.join(logsDir, files[files.length - 1]);
    const content = fs.readFileSync(latestFile, 'utf8');

    expect(content).toContain('Correlated message');
    expect(content).toContain('"correlationId":"corr-test-456"');
  });
});
