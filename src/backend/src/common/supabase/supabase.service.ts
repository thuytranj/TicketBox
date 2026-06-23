import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    this.serviceRoleKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucketName = this.configService.getOrThrow<string>('SUPABASE_BUCKET_NAME');
  }

  /**
   * Upload file to Supabase Storage bucket
   * @param file Express Multer File
   * @param path target path inside the bucket (e.g. 'imports/file.csv')
   * @returns full path / key of the uploaded file
   */
  async uploadFile(file: Express.Multer.File, path: string): Promise<string> {
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${path}`;
    try {
      this.logger.log(`Uploading file to Supabase Storage: ${url}`);
      const response = await axios.post<{ Key: string }>(
        url,
        file.buffer,
        {
          headers: {
            Authorization: `Bearer ${this.serviceRoleKey}`,
            apikey: this.serviceRoleKey,
            'Content-Type': file.mimetype || 'application/octet-stream',
          },
        },
      );

      this.logger.log(`File uploaded successfully: ${response.data.Key}`);
      return path; // We return the relative path inside the bucket
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`Failed to upload file to Supabase Storage: ${errMsg}`, error.stack);
      throw new BadRequestException(`Supabase upload failed: ${errMsg}`);
    }
  }

  /**
   * Download file content as string (CSV text)
   * @param path relative path inside the bucket
   */
  async downloadFile(path: string): Promise<string> {
    const url = `${this.supabaseUrl}/storage/v1/object/authenticated/${this.bucketName}/${path}`;
    try {
      this.logger.log(`Downloading file from Supabase Storage: ${url}`);
      const response = await axios.get<string>(
        url,
        {
          headers: {
            Authorization: `Bearer ${this.serviceRoleKey}`,
            apikey: this.serviceRoleKey,
          },
          responseType: 'text',
        },
      );
      return response.data;
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`Failed to download file from Supabase Storage: ${errMsg}`, error.stack);
      throw new BadRequestException(`Supabase download failed: ${errMsg}`);
    }
  }

  /**
   * Delete file from Supabase Storage bucket
   * @param path relative path inside the bucket
   */
  async deleteFile(path: string): Promise<void> {
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${path}`;
    try {
      this.logger.log(`Deleting file from Supabase Storage: ${url}`);
      await axios.delete(
        url,
        {
          headers: {
            Authorization: `Bearer ${this.serviceRoleKey}`,
            apikey: this.serviceRoleKey,
          },
        },
      );
      this.logger.log(`File deleted successfully from Supabase Storage: ${path}`);
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`Failed to delete file from Supabase Storage: ${errMsg}`, error.stack);
      // We don't necessarily throw here if it's just cleanup, but logging it is important
    }
  }
}
