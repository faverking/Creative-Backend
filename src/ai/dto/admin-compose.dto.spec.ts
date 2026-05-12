import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TargetType } from '../../common/enums/target-type.enum';
import { AdminComposeRequestDto } from './admin-compose.dto';

describe('AdminComposeRequestDto', () => {
  it('rejects tasks outside the finalized task dictionary', () => {
    const dto = plainToInstance(AdminComposeRequestDto, {
      contentType: TargetType.ARTICLE,
      task: 'unknown-task',
      source: {
        title: '标题',
      },
    });

    const errors = validateSync(dto);

    expect(JSON.stringify(errors)).toContain('must be one of the following values');
  });

  it('rejects topic feature flags outside the finalized dictionary', () => {
    const dto = plainToInstance(AdminComposeRequestDto, {
      contentType: TargetType.TOPIC,
      task: 'suggest-feature-flags',
      source: {
        title: '测试标题',
        featureFlags: [999],
      },
    });

    const errors = validateSync(dto);

    expect(JSON.stringify(errors)).toContain('must be one of the following values');
  });

  it('accepts article rewrite-selection payloads with selection context fields', () => {
    const dto = plainToInstance(AdminComposeRequestDto, {
      contentType: TargetType.ARTICLE,
      task: 'rewrite-selection',
      source: {
        selectionText: '原始选中文本',
        selectionPrefix: '前文上下文',
        selectionSuffix: '后文上下文',
      },
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });
});
