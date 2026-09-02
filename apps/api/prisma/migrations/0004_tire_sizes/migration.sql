-- ============================================================================
-- 0004_tire_sizes
--
-- Creates the `tire_sizes` master data table to store standard tire sizes
-- categorized by vehicle group (TB = Truck and Bus, LT = Light Truck).
-- Populated by `req-Size.csv` during seeding.
-- ============================================================================

CREATE TABLE tire_sizes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  size       text NOT NULL,
  type       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_tire_sizes_type CHECK (type IN ('TB', 'LT'))
);

CREATE UNIQUE INDEX uq_tire_sizes
  ON tire_sizes (size, type);

CREATE INDEX ix_tire_sizes_size ON tire_sizes (size);
CREATE INDEX ix_tire_sizes_type ON tire_sizes (type);

CREATE TRIGGER trg_tire_sizes_updated BEFORE UPDATE ON tire_sizes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
