import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;
  let reflector: Reflector;

  const mockExecutionContext = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnThis(),
    getResponse: jest.fn().mockReturnValue({ statusCode: 200 }),
  } as unknown as ExecutionContext;

  const mockCallHandler: CallHandler = {
    handle: () => of({ foo: 'bar' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransformInterceptor,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should wrap success response in unified envelope', (done) => {
    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toBeDefined();
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty(
          'message',
          'Request processed successfully',
        );
        expect(result).toHaveProperty('data');
        expect(result.data).toEqual({ foo: 'bar' });
        expect(result).toHaveProperty('timestamp');
        done();
      });
  });

  it('should extract message from nested object if present', (done) => {
    const customCallHandler: CallHandler = {
      handle: () => of({ message: 'Custom message', result: 'ok' }),
    };

    interceptor
      .intercept(mockExecutionContext, customCallHandler)
      .subscribe((result) => {
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('message', 'Custom message');
        expect(result.data).toEqual({ result: 'ok' });
        done();
      });
  });

  it('should bypass transformation if BypassInterceptor decorator is present', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({ foo: 'bar' });
        expect(result).not.toHaveProperty('success');
        done();
      });
  });
});
