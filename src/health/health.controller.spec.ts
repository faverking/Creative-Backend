import { HealthController } from './health.controller';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

describe('HealthController', () => {
  it('is public', () => {
    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.getHealth);

    expect(metadata).toBe(true);
  });

  it('returns public service health', () => {
    const controller = new HealthController();

    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('mononest-api');
    expect(result.uptime).toEqual(expect.any(Number));
    expect(result.timestamp).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
