import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FcmService } from './fcm.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FcmService,
      useFactory: (config: ConfigService) => new FcmService(config),
      inject: [ConfigService],
    },
  ],
  exports: [FcmService],
})
export class FcmModule {}
