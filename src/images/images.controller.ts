import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { OptionalCurrentUser } from '../common/decorators/optional-current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { TargetType } from '../common/enums/target-type.enum';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RelatedQueryDto } from '../search/dto/search.dto';
import { SearchService } from '../search/search.service';
import { WorkspaceVisitRecorderService } from '../workspace/workspace-visit-recorder.service';
import { ImagesApplicationService } from './application/images.application';
import {
  CreateImagePackageDto,
  QueryImagePackagesDto,
  QueryMyImagePackagesDto,
  UpdateImagePackageDto,
} from './dto/image.dto';

@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesApplicationService: ImagesApplicationService,
    private readonly searchService: SearchService,
    private readonly workspaceVisitRecorderService: WorkspaceVisitRecorderService,
  ) {}

  @Post()
  @Idempotent(120)
  createImagePackage(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateImagePackageDto,
    @Req() req: Request,
  ) {
    return this.imagesApplicationService.createImagePackage(dto, user.userId, req.traceId);
  }

  @Get('me')
  listMyImagePackages(@CurrentUser() user: JwtUser, @Query() query: QueryMyImagePackagesDto) {
    return this.imagesApplicationService.listMyImagePackages(user.userId, query);
  }

  @Get('me/:id')
  getMyImagePackageDetail(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.imagesApplicationService.getMyImagePackageDetail(id, user.userId);
  }

  @Patch(':id')
  @Idempotent(120)
  updateImagePackage(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateImagePackageDto,
    @Req() req: Request,
  ) {
    return this.imagesApplicationService.updateImagePackage(id, user.userId, dto, req.traceId);
  }

  @Delete(':id')
  @Idempotent(120)
  deleteImagePackage(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Query('cascadeMedia') cascadeMedia: string | undefined,
    @Req() req: Request,
  ) {
    return this.imagesApplicationService.deleteImagePackage(
      id,
      user.userId,
      cascadeMedia === 'true',
      req.traceId,
    );
  }

  @Public()
  @Get()
  listImagePackages(@Query() query: QueryImagePackagesDto) {
    return this.imagesApplicationService.listImagePackages(query);
  }

  @Public()
  @Get(':id/related')
  related(@Param('id', ParseObjectIdPipe) id: string, @Query() query: RelatedQueryDto) {
    return this.searchService.related(TargetType.IMAGE, id, query);
  }

  @Public()
  @Get(':id')
  async getImagePackageDetail(
    @Param('id', ParseObjectIdPipe) id: string,
    @OptionalCurrentUser() user?: JwtUser,
  ) {
    const detail = await this.imagesApplicationService.getImagePackageDetail(id, user?.userId);
    this.workspaceVisitRecorderService.recordPublicDetailVisit(user?.userId, TargetType.IMAGE, id);

    return detail;
  }
}
