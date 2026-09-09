export interface ISttAdapter {
  transcribe(audioBuffer: Buffer): Promise<string>;
}
export const STT_ADAPTER_TOKEN = 'STT_ADAPTER_TOKEN';
