-- Analytics dashboard: indexes for fast date-range and org-scoped queries
-- passport_scans: filter by passport_id + scan_timestamp
create index if not exists idx_passport_scans_passport_timestamp
  on passport_scans(passport_id, scan_timestamp desc);

-- passport_scans: filter by scan_result for fraud/suspicious
create index if not exists idx_passport_scans_result_timestamp
  on passport_scans(scan_result, scan_timestamp desc)
  where scan_result = 'suspicious';

-- passport_scans: location_country for geographic aggregation
create index if not exists idx_passport_scans_country
  on passport_scans(location_country)
  where location_country is not null;

-- ownership_records: filter by passport_id + claimed_at
create index if not exists idx_ownership_records_passport_claimed
  on ownership_records(passport_id, claimed_at desc);
