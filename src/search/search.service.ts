import { Injectable } from '@nestjs/common';
import { TargetType } from '../common/enums/target-type.enum';
import { SearchFeaturedService } from './search-featured.service';
import { type FeaturedQueryDto, type FullTextSearchDto, type QuickSearchDto, type RelatedQueryDto } from './dto/search.dto';
import { SearchQueryService } from './search-query.service';
import { SearchRelatedService } from './search-related.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly searchQueryService: SearchQueryService,
    private readonly searchFeaturedService: SearchFeaturedService,
    private readonly searchRelatedService: SearchRelatedService,
  ) {}

  fullTextSearch(dto: FullTextSearchDto): Promise<unknown> {
    return this.searchQueryService.fullTextSearch(dto);
  }

  quickSearch(dto: QuickSearchDto): Promise<unknown> {
    return this.searchQueryService.quickSearch(dto);
  }

  featured(dto: FeaturedQueryDto): Promise<unknown> {
    return this.searchFeaturedService.featured(dto);
  }

  related(targetType: TargetType, id: string, dto: RelatedQueryDto): Promise<unknown> {
    return this.searchRelatedService.related(targetType, id, dto);
  }
}
