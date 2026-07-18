import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  toUserId: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsString()
  propertyId?: string;
}
