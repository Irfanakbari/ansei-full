import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateMaterialRackDto {
  @IsString()
  @IsNotEmpty()
  rackQr: string;
}
