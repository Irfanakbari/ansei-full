import { IsNotEmpty, IsString } from 'class-validator';

export class CloseInventoryCountingDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}
