import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { CommentsModule } from './comments/comments.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { configurationLoaders } from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DraftsModule } from './drafts/drafts.module';
import { FavoritesModule } from './favorites/favorites.module';
import { FeaturedContentsModule } from './featured-contents/featured-contents.module';
import { HealthModule } from './health/health.module';
import { HomeModule } from './home/home.module';
import { HistoryModule } from './history/history.module';
import { AuditModule } from './infra/audit/audit.module';
import { MongoModule } from './infra/database/mongo.module';
import { LoggerModule } from './infra/logger/logger.module';
import { MailModule } from './infra/mail/mail.module';
import { MetricsModule } from './infra/metrics/metrics.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { ImagesModule } from './images/images.module';
import { InteractionsModule } from './interactions/interactions.module';
import { MediaModule } from './media/media.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/report.module';
import { SearchModule } from './search/search.module';
import { TopicsModule } from './topics/topics.module';
import { UsersModule } from './users/users.module';

const envFilePath =
  process.env.NODE_ENV === 'production'
    ? ['.env']
    : ['.env.local', '.env.dev', '.env'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      load: configurationLoaders,
      envFilePath,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60),
        limit: Number(process.env.THROTTLE_LIMIT ?? 60),
      },
    ]),
    MongoModule,
    RedisModule,
    LoggerModule,
    StorageModule,
    MailModule,
    MetricsModule,
    AuditModule,
    AuthModule,
    AiModule,
    UsersModule,
    MediaModule,
    ArticlesModule,
    CommentsModule,
    FavoritesModule,
    FeaturedContentsModule,
    HealthModule,
    HomeModule,
    HistoryModule,
    DraftsModule,
    BooksModule,
    TopicsModule,
    ImagesModule,
    InteractionsModule,
    AdminModule,
    SearchModule,
    NotificationModule,
    ReportModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
