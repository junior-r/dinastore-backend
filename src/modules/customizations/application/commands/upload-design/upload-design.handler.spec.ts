import { DomainError } from '@/shared/domain/domain-error';
import { InvalidImageError } from '@/shared/domain/images/image-processor.port';
import type { ProcessedImage } from '@/shared/domain/images/image-processor.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { createMockFileStorage } from '@/shared/testing/mock-file-storage';
import { Design } from '@/modules/customizations/domain/entities/design.entity';
import type { DesignRenderer } from '@/modules/customizations/domain/ports/design-renderer.port';
import type { DesignRepository } from '@/modules/customizations/domain/repositories/design.repository';
import {
  createMockDesignRenderer,
  createMockDesignRepository,
  createMockStoreLogo,
} from '@/modules/customizations/testing/mocks';
import { UploadDesignCommand } from './upload-design.command';
import { UploadDesignHandler } from './upload-design.handler';

function image(
  name: string,
  extension: string,
  width: number,
  height: number,
): ProcessedImage {
  return {
    data: Buffer.from(name),
    contentType: `image/${extension}`,
    extension,
    width,
    height,
  };
}

describe('UploadDesignHandler', () => {
  let repository: jest.Mocked<DesignRepository>;
  let renderer: jest.Mocked<DesignRenderer>;
  let storage: jest.Mocked<FileStorage>;
  let handler: UploadDesignHandler;

  const logo = Buffer.from('logo');
  const command = new UploadDesignCommand('user-1', Buffer.from('upload'));

  function renders(width: number, height: number) {
    renderer.render.mockResolvedValue({
      source: image('source', 'png', width, height),
      print: image('print', 'png', width, height),
      thumbnail: image('thumb', 'webp', 800, 800),
    });
  }

  beforeEach(() => {
    repository = createMockDesignRepository();
    renderer = createMockDesignRenderer();
    storage = createMockFileStorage();
    const storeLogo = createMockStoreLogo();
    storeLogo.get.mockResolvedValue({
      data: logo,
      width: 720,
      height: 180,
      url: 'http://files/brand/logo.png',
    });
    repository.create.mockImplementation((design) => Promise.resolve(design));
    handler = new UploadDesignHandler(repository, renderer, storeLogo, storage);
  });

  it('renders with the store logo and stores the three files', async () => {
    renders(2000, 1500);

    const design = await handler.execute(command);

    expect(renderer.render).toHaveBeenCalledWith(command.file, logo, null);
    expect(design).toBeInstanceOf(Design);
    expect(design.userId).toBe('user-1');
    expect(design.width).toBe(2000);
    expect(design.height).toBe(1500);

    const storedKeys = storage.put.mock.calls.map(([key]) => key);
    expect(storedKeys).toEqual([
      design.sourceKey,
      design.printKey,
      design.thumbnailKey,
    ]);
    expect(design.printKey).toBe(`designs/${design.id}-print.png`);
    expect(design.thumbnailKey).toBe(`designs/${design.id}-thumb.webp`);
  });

  it('passes the crop through to the renderer', async () => {
    renders(1000, 800);
    const crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };

    await handler.execute(
      new UploadDesignCommand('user-1', Buffer.from('upload'), crop),
    );

    expect(renderer.render).toHaveBeenCalledWith(
      expect.any(Buffer),
      logo,
      crop,
    );
  });

  it('refuses a design too small to print, before storing anything', async () => {
    renders(300, 200);

    await expect(handler.execute(command)).rejects.toThrow(DomainError);
    expect(storage.put).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('passes an unreadable file through as an invalid image', async () => {
    renderer.render.mockRejectedValue(new InvalidImageError());

    await expect(handler.execute(command)).rejects.toThrow(InvalidImageError);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('removes the stored files when saving the design fails', async () => {
    renders(2000, 1500);
    repository.create.mockRejectedValue(new Error('db down'));

    await expect(handler.execute(command)).rejects.toThrow('db down');

    const storedKeys = storage.put.mock.calls.map(([key]) => key);
    const deletedKeys = storage.delete.mock.calls.map(([key]) => key);
    expect(deletedKeys).toEqual(storedKeys);
  });
});
