// ============================================================
// Yene Verify — Analytics Controller (Step 18)
//
// Read-only insight endpoints. Merchant-only (SUB_MERCHANT role
// gets 403 from the global RolesGuard). No data mutation, no raw
// row exposure, no admin surface in this step.
// ============================================================

import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentTenant, requireTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AnalyticsRangeQuerySchema, type AnalyticsRangeQuery } from './dto/analytics-range.query';
import type {
  AnalyticsAnomaliesResponseDto,
  AnalyticsBestDaysResponseDto,
  AnalyticsBestMonthsResponseDto,
  AnalyticsBestProductsResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRecommendationsResponseDto,
  AnalyticsSummaryResponseDto,
  AnalyticsTrendResponseDto,
} from './dto/analytics-response.dto';

@ApiTags('Analytics')
@Controller({ path: 'analytics', version: '1' })
@Roles('MERCHANT')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  private merchantId(tenant: { merchantId: string } | undefined): string {
    return requireTenant(tenant);
  }

  @Get('summary')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verified volume totals over a date range' })
  @ApiResponse({ status: 200, description: 'Summary metrics' })
  async summary(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ): Promise<AnalyticsSummaryResponseDto> {
    return this.service.summary(this.merchantId(tenant), query);
  }

  @Get('best-products')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Top products by verified amount (top 10)' })
  @ApiResponse({ status: 200, description: 'Best product list' })
  async bestProducts(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ): Promise<AnalyticsBestProductsResponseDto> {
    return this.service.bestProducts(this.merchantId(tenant), query);
  }

  @Get('peak-hours')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Hourly verified volume (Addis Ababa local time)' })
  @ApiResponse({ status: 200, description: '24 hour buckets' })
  async peakHours(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ): Promise<AnalyticsPeakHoursResponseDto> {
    return this.service.peakHours(this.merchantId(tenant), query);
  }

  @Get('best-days')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Day-of-week verified volume (ISO, Mon=1..Sun=7)' })
  @ApiResponse({ status: 200, description: '7 day buckets' })
  async bestDays(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ): Promise<AnalyticsBestDaysResponseDto> {
    return this.service.bestDays(this.merchantId(tenant), query);
  }

  @Get('best-months')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Per-month verified volume in range' })
  @ApiResponse({ status: 200, description: 'Month buckets' })
  async bestMonths(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ): Promise<AnalyticsBestMonthsResponseDto> {
    return this.service.bestMonths(this.merchantId(tenant), query);
  }

  @Get('trend')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current vs previous equal-length period delta' })
  @ApiResponse({ status: 200, description: 'Trend comparison' })
  async trend(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ): Promise<AnalyticsTrendResponseDto> {
    return this.service.trend(this.merchantId(tenant), query);
  }

  @Get('anomalies')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Daily-volume Z-score anomalies (|z| >= 2.5, needs 7+ days)' })
  @ApiResponse({ status: 200, description: 'Anomalous days' })
  async anomalies(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ): Promise<AnalyticsAnomaliesResponseDto> {
    return this.service.anomalies(this.merchantId(tenant), query);
  }

  @Get('recommendations')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Rule-based recommendations (0-5 items)' })
  @ApiResponse({ status: 200, description: 'Recommendation list' })
  async recommendations(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ): Promise<AnalyticsRecommendationsResponseDto> {
    return this.service.recommendations(this.merchantId(tenant), query);
  }
}
