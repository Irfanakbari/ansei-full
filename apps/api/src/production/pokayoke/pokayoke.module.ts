import { Module } from '@nestjs/common';
import { PokayokeController } from './pokayoke.controller';
import { PokayokeService } from './pokayoke.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { ShoppingModule } from '../shopping/shopping.module';

@Module({
  imports: [ShoppingModule],
  controllers: [PokayokeController],
  providers: [PokayokeService, PrismaService, LogProcessService],
  exports: [PokayokeService],
})
export class PokayokeModule {}
