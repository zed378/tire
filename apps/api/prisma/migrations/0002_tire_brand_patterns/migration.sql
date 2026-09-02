-- ============================================================================
-- 0002_tire_brand_patterns
--
-- `tire_brand_patterns` was declared in schema.prisma and served by the
-- master-brand module, but 0001_init never created it. Nothing caught that,
-- because local development had been running against a database built by
-- `prisma db push` rather than by the migrations, and `migrate deploy` only
-- ever runs the SQL. So production had the model, the routes, and the seed
-- data — and no table.
--
-- Column shapes follow the model in schema.prisma exactly. The CHECK on `type`
-- is not expressed there: Prisma models it as a free `String`, and PLAN/02 §1.1
-- is explicit that a rule a constraint can enforce is enforced by a constraint.
-- ============================================================================

CREATE TABLE tire_brand_patterns (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand      text NOT NULL,
  pattern    text NOT NULL,
  -- TB = truck and bus, LT = light truck. The two CSV sources are separate
  -- files and a pattern belongs to exactly one of them.
  type       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_tire_brand_patterns_type CHECK (type IN ('TB', 'LT'))
);

-- The seed re-runs on every deployment, so this is what makes it idempotent.
CREATE UNIQUE INDEX uq_tire_brand_patterns
  ON tire_brand_patterns (brand, pattern, type);

CREATE INDEX ix_tire_brand_patterns_brand ON tire_brand_patterns (brand);
CREATE INDEX ix_tire_brand_patterns_type  ON tire_brand_patterns (type);

CREATE TRIGGER trg_tire_brand_patterns_updated BEFORE UPDATE ON tire_brand_patterns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
