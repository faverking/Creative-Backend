import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FeaturedQueryDto, FullTextSearchDto, QuickSearchDto } from './dto/search.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get('fulltext')
  fullText(@Query() query: FullTextSearchDto) {
    return this.searchService.fullTextSearch(query);
  }

  @Public()
  @Get('quick')
  quick(@Query() query: QuickSearchDto) {
    return this.searchService.quickSearch(query);
  }

  @Public()
  @Get('featured')
  featured(@Query() query: FeaturedQueryDto) {
    return this.searchService.featured(query);
  }

  @Public()
  @Get()
  search(@Query() query: FullTextSearchDto) {
    return this.searchService.fullTextSearch(query);
  }
}
