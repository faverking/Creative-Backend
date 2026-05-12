import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  async sendLoginAlert(_email: string): Promise<void> {
    return;
  }
}
