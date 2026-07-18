import { IsString, MinLength } from 'class-validator';

export class AddLeadNoteDto {
  @IsString()
  @MinLength(2)
  body: string;
}
