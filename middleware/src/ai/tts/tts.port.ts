export interface ITtsAdapter {
  synthesize(text: string): Promise<Buffer>;
}
export const TTS_ADAPTER_TOKEN = 'TTS_ADAPTER_TOKEN';
