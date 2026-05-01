import { createHmac } from 'node:crypto';

export class Signer {
  private secret: Buffer;
  private destroyed = false;

  constructor(apiSecret: Buffer) {
    this.secret = Buffer.from(apiSecret);
  }

  sign(apiKey: string, nonce: number, method: string, path: string, body: string): string {
    if (this.destroyed) throw new Error('Signer has been destroyed');
    const message = `${nonce}${method}${path}${body}`;
    const hex = createHmac('sha256', this.secret)
      .update(message, 'utf8')
      .digest('hex');
    return `Bitso ${apiKey}:${nonce}:${hex}`;
  }

  destroy(): void {
    if (!this.destroyed) {
      this.secret.fill(0);
      this.destroyed = true;
    }
  }
}
