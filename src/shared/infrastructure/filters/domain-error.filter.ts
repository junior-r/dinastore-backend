import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '@/shared/domain/domain-error';

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const badRequest = new BadRequestException(exception.message);
    response.status(badRequest.getStatus()).json(badRequest.getResponse());
  }
}
