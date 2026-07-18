import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { VisitStatus } from '../../common/enums';

export class CreateVisitDto {
  @IsString()
  @MinLength(1)
  leadId: string;

  @IsString()
  @MinLength(1)
  propertyId: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @IsOptional()
  @IsString()
  assignedAgent?: string;

  @IsOptional()
  @IsString()
  locationNote?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
