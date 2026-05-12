import type { Request, Response } from 'express';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { TargetType } from '../common/enums/target-type.enum';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { AdminAiController } from './admin-ai.controller';
import type { AdminAiService } from './admin-ai.service';
import type { AdminAiStreamEvent } from './ai.types';

describe('AdminAiController', () => {
  const user: JwtUser = {
    userId: 'user-1',
    roles: ['user'],
    passwordVersion: 1,
    status: 'active',
    name: 'User',
  };

  it('allows all logged-in roles including normal users', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminAiController)).toEqual([
      'editor',
      'admin',
      'super_admin',
    ]);
  });

  it('delegates compose requests to the service with the request trace id', async () => {
    const adminAiService = {
      composeForAdmin: jest.fn().mockResolvedValue({
        task: 'rewrite-title',
        contentType: TargetType.ARTICLE,
        model: 'gpt-5.4-mini',
        promptVersion: 'v1',
        traceId: 'trace-1',
        result: {
          title: '结果标题',
        },
      }),
    } as unknown as AdminAiService;

    const controller = new AdminAiController(adminAiService);

    const result = await controller.compose(
      user,
      {
        contentType: TargetType.ARTICLE,
        task: 'rewrite-title',
        source: {
          title: '原标题',
        },
      },
      {
        traceId: 'trace-1',
      } as Request,
    );

    expect(adminAiService.composeForAdmin).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        task: 'rewrite-title',
      }),
      'trace-1',
    );
    expect(result.result).toEqual({
      title: '结果标题',
    });
  });

  it('writes stream events as SSE messages', async () => {
    async function* createStream(): AsyncGenerator<AdminAiStreamEvent> {
      yield {
        event: 'delta',
        data: {
          text: 'partial',
        },
      };
      yield {
        event: 'completed',
        data: {
          task: 'rewrite-title',
          contentType: TargetType.ARTICLE,
          model: 'gpt-5.4-mini',
          promptVersion: 'v1',
          traceId: 'trace-2',
          result: {
            title: '完整标题',
          },
        },
      };
    }

    const adminAiService = {
      composeForAdminStream: jest.fn().mockResolvedValue(createStream()),
    } as unknown as AdminAiService;

    const controller = new AdminAiController(adminAiService);
    const setHeader = jest.fn();
    const flushHeaders = jest.fn();
    const write = jest.fn();
    const end = jest.fn();

    await controller.composeStream(
      user,
      {
        contentType: TargetType.ARTICLE,
        task: 'rewrite-title',
        source: {
          title: '原标题',
        },
      },
      {
        traceId: 'trace-2',
      } as Request,
      {
        setHeader,
        flushHeaders,
        write,
        end,
      } as unknown as Response,
    );

    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
    expect(write).toHaveBeenCalledWith('event: delta\ndata: {"text":"partial"}\n\n');
    expect(write).toHaveBeenCalledWith(
      'event: completed\ndata: {"task":"rewrite-title","contentType":"article","model":"gpt-5.4-mini","promptVersion":"v1","traceId":"trace-2","result":{"title":"完整标题"}}\n\n',
    );
    expect(end).toHaveBeenCalled();
  });
});
