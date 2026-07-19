import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const deliveryChannels = ['APP', 'TELEGRAM', 'BOTH'] as const;

export class BasketItemDto {
  @IsInt()
  fixtureId!: number;

  @IsInt()
  leagueId!: number;

  @IsString()
  leagueName!: string;

  @IsOptional()
  @IsString()
  leagueLogoUrl?: string;

  @IsInt()
  season!: number;

  @IsString()
  date!: string;

  @IsInt()
  homeTeamId!: number;

  @IsString()
  homeTeamName!: string;

  @IsOptional()
  @IsString()
  homeTeamLogoUrl?: string;

  @IsInt()
  awayTeamId!: number;

  @IsString()
  awayTeamName!: string;

  @IsOptional()
  @IsString()
  awayTeamLogoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marketsOverride?: string[];

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(30)
  historyDepthOverride?: number;
}

export class CreateAnalysisRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  defaultMarkets!: string[];

  @IsInt()
  @Min(3)
  @Max(30)
  historyDepth!: number;

  @IsOptional()
  @IsBoolean()
  includeExcel?: boolean;

  @IsIn(deliveryChannels)
  deliveryChannel!: 'APP' | 'TELEGRAM' | 'BOTH';

  @IsOptional()
  @IsString()
  message?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BasketItemDto)
  items!: BasketItemDto[];
}
