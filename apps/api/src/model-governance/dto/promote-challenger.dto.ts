import { IsOptional, IsString } from 'class-validator';

export class PromoteChallengerDto {
  @IsOptional()
  @IsString()
  challengerModelId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
