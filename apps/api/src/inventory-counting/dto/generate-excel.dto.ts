import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateExcelDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsOptional()
  @IsNumber()
  tolerance?: number;
}
