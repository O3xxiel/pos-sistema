import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): { id: number; username: string; roles: string[] } => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
