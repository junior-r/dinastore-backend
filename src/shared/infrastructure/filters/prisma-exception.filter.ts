import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@generated/prisma/client';
import { PRISMA_ERROR } from '@/shared/infrastructure/prisma/prisma-error-codes';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = this.toHttpException(exception);
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private toHttpException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): HttpException {
    switch (exception.code) {
      case PRISMA_ERROR.UNIQUE_CONSTRAINT: {
        const target = Array.isArray(exception.meta?.target)
          ? exception.meta.target.join(', ')
          : 'field';
        return new ConflictException(
          `A record with this ${target} already exists`,
        );
      }
      case PRISMA_ERROR.FOREIGN_KEY_CONSTRAINT:
        return new BadRequestException('The referenced record does not exist');
      case PRISMA_ERROR.RECORD_NOT_FOUND:
        return new NotFoundException('Record not found');
      default:
        return new InternalServerErrorException('Unexpected database error');
    }
  }
}
