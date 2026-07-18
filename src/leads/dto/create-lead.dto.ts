import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  LeadSource,
  LeadStatus,
  LeadTemperature,
} from '../../common/enums';

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsEnum(LeadTemperature)
  temperature?: LeadTemperature;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsString()
  preferredLocation?: string;

  @IsOptional()
  @IsString()
  buyingTimeline?: string;

  @IsOptional()
  @IsString()
  assignedAgent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedProperties?: string[];
}
