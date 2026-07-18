import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerBookVisitDto {
  @IsString()
  @MinLength(1)
  propertyId: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  locationNote?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
