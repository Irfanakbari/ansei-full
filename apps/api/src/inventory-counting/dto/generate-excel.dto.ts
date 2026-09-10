import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateExcelDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}
