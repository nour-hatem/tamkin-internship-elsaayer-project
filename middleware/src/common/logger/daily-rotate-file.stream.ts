import * as fs from 'fs';
import * as path from 'path';
import { Writable } from 'stream';

export class DailyRotateFileStream extends Writable {
  private currentDay: string = '';
  private currentStream: fs.WriteStream | null = null;
  private readonly logsDir: string;
  private readonly maxFiles: number;

  constructor(logsDir?: string, maxFiles: number = 7) {
    super();
    this.logsDir = logsDir || path.resolve(process.cwd(), 'logs');
    this.maxFiles = maxFiles;
    this.ensureDirExists();
  }

  private ensureDirExists(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private getTodayString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private cleanOldFiles(): void {
    try {
      this.ensureDirExists();
      const files = fs
        .readdirSync(this.logsDir)
        .filter((f) => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(f))
        .sort();

      while (files.length > this.maxFiles) {
        const oldest = files.shift();
        if (oldest) {
          fs.unlinkSync(path.join(this.logsDir, oldest));
        }
      }
    } catch {
      // Ignore cleanup error in edge cases (e.g. concurrent unlinks)
    }
  }

  private getStream(): fs.WriteStream {
    const today = this.getTodayString();
    if (this.currentStream && this.currentDay === today) {
      return this.currentStream;
    }

    if (this.currentStream) {
      this.currentStream.end();
    }

    this.ensureDirExists();
    this.currentDay = today;
    const filePath = path.join(this.logsDir, `app-${today}.log`);
    this.currentStream = fs.createWriteStream(filePath, { flags: 'a' });
    this.cleanOldFiles();
    return this.currentStream;
  }

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      const stream = this.getStream();
      stream.write(chunk, encoding, callback);
    } catch (err: any) {
      callback(err);
    }
  }

  _final(callback: (error?: Error | null) => void): void {
    if (this.currentStream) {
      this.currentStream.end(callback);
    } else {
      callback();
    }
  }
}
