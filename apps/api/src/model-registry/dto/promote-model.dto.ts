import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class PromoteModelDto {
  @IsString()
  modelId!: string;

  @IsOptional()
  @IsString()
  evaluationId?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  promotedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
