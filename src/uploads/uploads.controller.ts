import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { UserRole } from '../common/enums';

const uploadRoot = join(process.cwd(), 'uploads');

function ensureUploadDir() {
  if (!existsSync(uploadRoot)) {
    mkdirSync(uploadRoot, { recursive: true });
  }
}

@Controller('api/uploads')
export class UploadsController {
  @Post('images')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  @UseInterceptors(
    FilesInterceptor('files', 8, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, uploadRoot);
        },
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${randomUUID()}${safeExt}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image uploads are allowed') as never, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Session() _session: UserSession,
  ) {
    if (!files?.length) {
      throw new BadRequestException('No files uploaded');
    }

    return {
      urls: files.map((file) => `/uploads/${file.filename}`),
    };
  }
}
