import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector) as any;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    function createMockExecutionContext(user?: any): ExecutionContext {
      const mockRequest = { user };
      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: jest.fn(),
          getNext: jest.fn(),
        }),
      } as unknown as ExecutionContext;
    }

    it('should return true if no roles are required (reflector returns undefined)', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createMockExecutionContext();
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should return true if no roles are required (reflector returns empty array)', () => {
      reflector.getAllAndOverride.mockReturnValue([]);

      const context = createMockExecutionContext();
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if user is not in request', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);

      const context = createMockExecutionContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Access denied: no user role provided'),
      );
    });

    it('should throw ForbiddenException if user does not have a role', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);

      const context = createMockExecutionContext({ email: 'test@example.com' });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Access denied: no user role provided'),
      );
    });

    it('should throw ForbiddenException if user role does not match required roles', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);

      const context = createMockExecutionContext({
        email: 'audience@example.com',
        role: UserRole.AUDIENCE,
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Access denied: insufficient permissions'),
      );
    });

    it('should return true if user has required role', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER, UserRole.GATE_STAFF]);

      const context = createMockExecutionContext({
        email: 'organizer@example.com',
        role: UserRole.ORGANIZER,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true if user has another acceptable role from the list', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER, UserRole.GATE_STAFF]);

      const context = createMockExecutionContext({
        email: 'staff@example.com',
        role: UserRole.GATE_STAFF,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
