import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VisitStatus } from '../../common/enums';

export class QueryVisitsDto {
  /** Inclusive start of range (ISO date/datetime) */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive end of range (ISO date/datetime) */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  assignedAgent?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 100;
}
