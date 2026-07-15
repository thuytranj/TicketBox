import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryService } from './cloudinary.service';
import { v2 as cloudinary } from 'cloudinary';
import { BadRequestException } from '@nestjs/common';

jest.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CloudinaryService],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should successfully upload a file and return response', async () => {
      const mockResult = { secure_url: 'https://cloudinary.com/image.png' };
      const mockUploadStream = jest
        .fn()
        .mockImplementation((options, callback) => {
          callback(null, mockResult);
          return {
            write: jest.fn(),
            end: jest.fn(),
          };
        });
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        mockUploadStream,
      );

      const file = {
        buffer: Buffer.from('test-image-content'),
      } as Express.Multer.File;

      const result = await service.uploadFile(file);
      expect(result).toEqual(mockResult);
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        { folder: 'ticketbox/posters' },
        expect.any(Function),
      );
    });

    it('should throw BadRequestException if upload fails', async () => {
      const mockError = new Error('Upload error');
      const mockUploadStream = jest
        .fn()
        .mockImplementation((options, callback) => {
          callback(mockError, null);
          return {
            write: jest.fn(),
            end: jest.fn(),
          };
        });
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        mockUploadStream,
      );

      const file = {
        buffer: Buffer.from('test-image-content'),
      } as Express.Multer.File;

      await expect(service.uploadFile(file)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete a file', async () => {
      const mockResult = { result: 'ok' };
      (cloudinary.uploader.destroy as jest.Mock).mockImplementation(
        (publicId, callback) => {
          callback(null, mockResult);
        },
      );

      const result = await service.deleteFile('test_id');
      expect(result).toEqual(mockResult);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        'test_id',
        expect.any(Function),
      );
    });

    it('should throw BadRequestException if delete fails', async () => {
      const mockError = new Error('Delete error');
      (cloudinary.uploader.destroy as jest.Mock).mockImplementation(
        (publicId, callback) => {
          callback(mockError, null);
        },
      );

      await expect(service.deleteFile('test_id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
