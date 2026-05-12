import { BadRequestException } from '@nestjs/common';

const SHANGHAI_OFFSET = '+08:00';
const SHANGHAI_TIMEZONE = 'Asia/Shanghai';

export interface DateRangeFilter {
  $gte?: Date;
  $lt?: Date;
}

export function buildShanghaiDateRangeFilter(startDate?: string, endDate?: string): DateRangeFilter | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  const filter: DateRangeFilter = {};

  if (startDate) {
    filter.$gte = parseAndValidateShanghaiDate(startDate, 'startDate');
  }

  if (endDate) {
    const endAt = parseAndValidateShanghaiDate(endDate, 'endDate');
    const endExclusive = new Date(endAt);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    filter.$lt = endExclusive;
  }

  if (filter.$gte && filter.$lt && filter.$gte >= filter.$lt) {
    throw new BadRequestException('startDate cannot be later than endDate');
  }

  return filter;
}

function parseAndValidateShanghaiDate(value: string, fieldName: string): Date {
  const parsed = new Date(`${value}T00:00:00.000${SHANGHAI_OFFSET}`);
  if (Number.isNaN(parsed.getTime()) || formatShanghaiDate(parsed) !== value) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format`);
  }

  return parsed;
}

function formatShanghaiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((item) => item.type === 'year')?.value ?? '0000';
  const month = parts.find((item) => item.type === 'month')?.value ?? '01';
  const day = parts.find((item) => item.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}
