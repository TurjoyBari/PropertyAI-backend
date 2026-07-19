import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType } from '../../common/enums';

export class MatchPropertiesDto {
  /** Natural language query — Gemini extracts filters only */
  @IsOptional()
  @IsString()
  @MinLength(2)
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @IsBoolean()
  nearMetro?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ScoreLeadDto {
  @IsString()
  @MinLength(1)
  leadId: string;
}

export class GenerateDescriptionDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @MinLength(2)
  location: string;

  @IsOptional()
  @IsString()
  features?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatAgentDto {
  @IsString()
  @MinLength(1)
  message: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];

  /** IDs from the last assistant property list — enables "1" / cheapest / compare */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lastShownPropertyIds?: string[];
}

export class SaveChatHistoryDto {
  @IsArray()
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    at?: string;
    matches?: unknown[];
  }>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lastShownPropertyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quickReplies?: string[];
}
