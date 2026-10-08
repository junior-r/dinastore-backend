import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { UploadDesignHandler } from './application/commands/upload-design/upload-design.handler';
import { GetStudioConfigHandler } from './application/queries/get-studio-config/get-studio-config.handler';
import { DESIGN_RENDERER } from './domain/ports/design-renderer.port';
import { STORE_LOGO_PORT } from './domain/ports/store-logo.port';
import { DESIGN_REPOSITORY } from './domain/repositories/design.repository';
import { FileStoreLogo } from './infrastructure/logo/file-store-logo';
import { SharpDesignRenderer } from './infrastructure/rendering/sharp-design-renderer';
import { PrismaDesignRepository } from './infrastructure/repositories/prisma-design.repository';
import { CustomizationsController } from './presentation/controllers/customizations.controller';

@Module({
  // FILE_STORAGE comes from the global StorageModule.
  imports: [CqrsModule, PassportModule],
  controllers: [CustomizationsController],
  providers: [
    UploadDesignHandler,
    GetStudioConfigHandler,
    { provide: DESIGN_REPOSITORY, useClass: PrismaDesignRepository },
    { provide: DESIGN_RENDERER, useClass: SharpDesignRenderer },
    { provide: STORE_LOGO_PORT, useClass: FileStoreLogo },
  ],
})
export class CustomizationsModule {}
