import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
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
import { BooksApplicationService } from './application/books.application';
import {
  CreateBookDto,
  QueryBooksDto,
  QueryMyBooksDto,
  UpdateBookDto,
  UpsertBookChaptersDto,
} from './dto/book.dto';

@Controller('books')
export class BooksController {
  constructor(
    private readonly booksApplicationService: BooksApplicationService,
    private readonly searchService: SearchService,
    private readonly workspaceVisitRecorderService: WorkspaceVisitRecorderService,
  ) {}

  @Post()
  @Idempotent(120)
  createBook(@CurrentUser() user: JwtUser, @Body() dto: CreateBookDto, @Req() req: Request) {
    return this.booksApplicationService.createBook(dto, user.userId, req.traceId);
  }

  @Get('me')
  listMyBooks(@CurrentUser() user: JwtUser, @Query() query: QueryMyBooksDto) {
    return this.booksApplicationService.listMyBooks(user.userId, query);
  }

  @Get('me/:id')
  getMyBookDetail(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.booksApplicationService.getMyBookDetail(id, user.userId);
  }

  @Patch(':id')
  @Idempotent(120)
  updateBook(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateBookDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.booksApplicationService.updateBook(id, dto, user.userId, req.traceId);
  }

  @Delete(':id')
  @Idempotent(120)
  deleteBook(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Query('cascadeMedia') cascadeMedia: string | undefined,
    @Req() req: Request,
  ) {
    return this.booksApplicationService.deleteBook(
      id,
      user.userId,
      cascadeMedia === 'true',
      req.traceId,
    );
  }

  @Public()
  @Get()
  listBooks(@Query() query: QueryBooksDto) {
    return this.booksApplicationService.listBooks(query);
  }

  @Public()
  @Get(':id/related')
  related(@Param('id', ParseObjectIdPipe) id: string, @Query() query: RelatedQueryDto) {
    return this.searchService.related(TargetType.BOOK, id, query);
  }

  @Public()
  @Get(':id')
  async getBookDetail(
    @Param('id', ParseObjectIdPipe) id: string,
    @OptionalCurrentUser() user?: JwtUser,
  ) {
    const detail = await this.booksApplicationService.getBookDetail(id, user?.userId);
    this.workspaceVisitRecorderService.recordPublicDetailVisit(user?.userId, TargetType.BOOK, id);

    return detail;
  }

  @Put(':id/chapters')
  @Idempotent(120)
  upsertBookChapters(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpsertBookChaptersDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.booksApplicationService.upsertBookChapters(id, dto, user.userId, req.traceId);
  }
}
