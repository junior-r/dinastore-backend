import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { FILE_STORAGE } from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '@/modules/users/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';
import { UploadDesignCommand } from '@/modules/customizations/application/commands/upload-design/upload-design.command';
import type { StudioConfig } from '@/modules/customizations/application/queries/get-studio-config/get-studio-config.handler';
import { GetStudioConfigQuery } from '@/modules/customizations/application/queries/get-studio-config/get-studio-config.query';
import { MAX_DESIGN_BYTES } from '@/modules/customizations/domain/design-policy';
import { Design } from '@/modules/customizations/domain/entities/design.entity';
import { DesignResponseDto } from '../dto/design-response.dto';
import { UploadDesignDto } from '../dto/upload-design.dto';

@Controller('customizations')
export class CustomizationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
  ) {}

  // Public: the studio can be explored signed out. Only uploading needs an
  // account.
  @Get('config')
  config() {
    return this.queryBus.execute<GetStudioConfigQuery, StudioConfig>(
      new GetStudioConfigQuery(),
    );
  }

  @Post('designs')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DESIGN_BYTES, files: 1 },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: UploadDesignDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('A design file is required');
    }

    const design = await this.commandBus.execute<UploadDesignCommand, Design>(
      new UploadDesignCommand(currentUser.sub, file.buffer, dto.toCrop()),
    );
    return DesignResponseDto.fromDomain(design, this.fileStorage);
  }
}
