import { IsOptional, IsString } from 'class-validator';

export class RejectAnalysisRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
