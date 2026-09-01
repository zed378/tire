-- ============================================================================
-- 0001_init — PostgreSQL 18
--
-- Implements PLAN/02 (data model), superseded for the vehicle/inspection split
-- by PLAN/11, plus the outbox and notification tables from PLAN/12 and the auth
-- hardening tables from PLAN/13.
--
-- The governing principle (PLAN/02 §1.1): every rule that a constraint can
-- enforce is enforced by a constraint. D-04 and D-05 got through the legacy
-- system because validation existed only in the form. A correctly typed column
-- and a correct CHECK cannot be bypassed by any bug in the layer above it.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Enumerated types (PLAN/02 §3) ───────────────────────────────────────────

CREATE TYPE user_role         AS ENUM ('supplier', 'admin', 'manager', 'operator');
CREATE TYPE submission_status AS ENUM ('draft', 'pending_qc', 'needs_revision', 'passed_qc', 'dropped_qc');
CREATE TYPE vehicle_category  AS ENUM ('TB', 'LT');
CREATE TYPE vehicle_segment   AS ENUM ('bus', 'truck');
CREATE TYPE axle_type         AS ENUM ('steer', 'drive', 'free_rolling');
CREATE TYPE tire_mounting     AS ENUM ('single', 'double');
CREATE TYPE tire_side         AS ENUM ('left', 'right');
CREATE TYPE tire_depth        AS ENUM ('inner', 'outer');
CREATE TYPE photo_slot        AS ENUM ('front_rear', 'side', 'tire_position');
CREATE TYPE qc_decision       AS ENUM ('pass', 'drop', 'revision');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'whatsapp');
CREATE TYPE notification_status  AS ENUM ('pending', 'sent', 'failed', 'suppressed');
CREATE TYPE export_job_status    AS ENUM ('queued', 'running', 'done', 'failed');

-- `operator` is added here, in the very first migration, even though its panel
-- is not built until F7. Adding a value to an ENUM on a table that already holds
-- production data requires an ALTER TYPE that cannot run inside a transaction on
-- some PostgreSQL versions. The cost is zero now and awkward later.

-- ── Shared foundations (PLAN/02 §4) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ============================================================================
-- MASTER DATA (PLAN/02 §5) — closes Q-07
-- ============================================================================

CREATE TABLE provinces (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text   NOT NULL UNIQUE,
  name        text   NOT NULL UNIQUE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_provinces_updated BEFORE UPDATE ON provinces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cities (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  province_id bigint NOT NULL REFERENCES provinces(id),
  code        text   NOT NULL UNIQUE,
  name        text   NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province_id, name)
);
CREATE INDEX idx_cities_province ON cities(province_id) WHERE is_active;
CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE vehicle_brands (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_vehicle_brands_updated BEFORE UPDATE ON vehicle_brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Free text made `Bridgestone`, `bridgestone`, and `Bridgstone` three separate
-- brands in every report. A managed list with a reviewed free-text escape hatch
-- (tire_specs.brand_other) fixes the reporting without blocking real new brands.
CREATE TABLE tire_brands (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tire_brands_updated BEFORE UPDATE ON tire_brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- USERS AND ACCESS (PLAN/02 §6, PLAN/04)
-- ============================================================================

CREATE TABLE users (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username             citext NOT NULL,
  display_name         text   NOT NULL,
  -- Argon2id. Closes B-11: the legacy system most likely held plain text in a
  -- spreadsheet readable by anyone with access to it.
  password_hash        text   NOT NULL,
  role                 user_role NOT NULL,
  -- Q-13 answered: both columns exist from the first migration even though the
  -- email channel arrives in F4 (PLAN/12 §10, N-07).
  email                text,
  phone                text,
  is_active            boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at        timestamptz,
  created_by           bigint REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,

  CONSTRAINT ck_users_email CHECK (email IS NULL OR email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT ck_users_phone CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$')
);

-- citext removes the entire class of "why can't Admin1 log in" bugs.
-- Uniqueness applies only among users who have not been deleted, which is why
-- PLAN/04 §5 guard 2 (the last active admin cannot be removed) exists: without
-- it, one click could permanently lock everyone out.
CREATE UNIQUE INDEX uq_users_username_active ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL AND is_active;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- D-13. No rows at all means no restriction; province rows and city rows
-- combine as a union, never an intersection.
CREATE TABLE user_regions (
  -- A surrogate key. PLAN/02 §6 defines this table without one, because the
  -- real guarantee is the functional unique index below. But a table with no
  -- primary key cannot be addressed by the ORM, and either column of the natural
  -- key is nullable by design.
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  province_id bigint REFERENCES provinces(id),
  city_id     bigint REFERENCES cities(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(province_id, city_id) = 1)
);
CREATE UNIQUE INDEX uq_user_regions
  ON user_regions(user_id, COALESCE(province_id, 0), COALESCE(city_id, 0));

-- ── Sessions (PLAN/02 §11, hardened by PLAN/13 §2.1) ────────────────────────

CREATE TABLE sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SHA-256 of the cookie value. A leaked database dump must not hand an
  -- attacker a usable session.
  token_hash     text NOT NULL UNIQUE,
  user_agent     text,
  ip_address     inet,
  device_label   text,
  mfa_satisfied  boolean NOT NULL DEFAULT false,
  -- Step-up re-verification window (PLAN/13 §4).
  elevated_until timestamptz,
  csrf_token     text NOT NULL,
  expires_at     timestamptz NOT NULL,
  -- Absolute ceiling: sliding renewal may not exceed 7 days from first login.
  absolute_expires_at timestamptz NOT NULL,
  revoked_at     timestamptz,
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expiry ON sessions(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE login_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username    citext NOT NULL,
  ip_address  inet,
  succeeded   boolean NOT NULL,
  failure_reason text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_user ON login_attempts(username, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address, created_at DESC);

-- ── MFA (PLAN/13 §3.2) ──────────────────────────────────────────────────────

-- The TOTP secret is ENCRYPTED, not hashed: the server must read it back to
-- verify a code. The key lives in an environment variable and never in the repo.
CREATE TABLE user_mfa (
  user_id      bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_enc   bytea NOT NULL,
  confirmed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mfa_recovery_codes (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,           -- Argon2id, treated exactly like a password
  used_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recovery_codes_user ON mfa_recovery_codes(user_id) WHERE used_at IS NULL;

-- Recently used TOTP codes, to make replay within the tolerance window fail.
CREATE TABLE mfa_used_codes (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       text   NOT NULL,
  used_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);

-- ============================================================================
-- VEHICLES (PLAN/11 §5.1)
--
-- The legacy system had no vehicle entity at all: a plate number was a column
-- on a submission. That is why "every vehicle is unique" could not be stated,
-- why the axle configuration was retyped on every inspection (widening D-04's
-- reach), and why a plate change split one vehicle's history in two.
-- ============================================================================

CREATE TABLE vehicles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Q-11 answered: staged path. The column exists from the first migration but
  -- stays nullable; uniqueness rests on the plate until backfill is far enough
  -- along (PLAN/11 §3.2).
  chassis_number  text,
  plate_display   text NOT NULL,
  -- GENERATED ALWAYS ... STORED is what makes this sound: no code path can write
  -- a plate key that disagrees with its display form, and no bug in any layer
  -- can insert an un-normalised plate (PLAN/11 §4.1).
  plate_key       text GENERATED ALWAYS AS (
                    upper(regexp_replace(plate_display, '[^A-Za-z0-9]', '', 'g'))
                  ) STORED,

  category            vehicle_category NOT NULL,
  segment             vehicle_segment  NOT NULL,
  sub_segment         text NOT NULL,
  vehicle_brand_id    bigint REFERENCES vehicle_brands(id),
  vehicle_brand_other text,
  cargo_type          text NOT NULL,

  axle_count      int NOT NULL,
  total_tires     int NOT NULL,

  city_id         bigint NOT NULL REFERENCES cities(id),

  -- Q-12 answered with option (c): a supplier may inspect a vehicle another
  -- supplier registered, but the record is flagged for an admin to look at.
  -- Rejecting outright would block fleets served by more than one supplier.
  needs_review    boolean NOT NULL DEFAULT false,
  review_note     text,

  created_by      bigint NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  -- D-05. Replaces PLAN/02's `^[A-Z0-9]{4,11}$`, which accepted `AAAA` and
  -- `1234` — neither of which is an Indonesian plate (PLAN/11 §4.1).
  CONSTRAINT ck_plate_format   CHECK (plate_display ~ '^[A-Z]{1,2} ?[0-9]{1,4} ?[A-Z]{0,3}$'),
  CONSTRAINT ck_plate_key_len  CHECK (length(plate_key) BETWEEN 3 AND 9),
  CONSTRAINT ck_chassis_format CHECK (chassis_number IS NULL OR chassis_number ~ '^[A-Z0-9]{5,25}$'),
  -- D-03 / V-09
  CONSTRAINT ck_lt_not_bus     CHECK (NOT (category = 'LT' AND segment = 'bus')),
  -- V-05
  CONSTRAINT ck_axle_count     CHECK (axle_count IN (2, 3, 4, 6)),
  -- Range from enumerating all 34 valid combinations (PLAN/03 §3), not a guess.
  CONSTRAINT ck_total_tires    CHECK (total_tires BETWEEN 4 AND 22),
  CONSTRAINT ck_brand_present  CHECK (num_nonnulls(vehicle_brand_id, vehicle_brand_other) >= 1)
);

-- Two unique indexes, not one. The chassis number is unique WHEN PRESENT; the
-- plate is unique always. Once backfill is complete the chassis becomes the
-- primary identity and the plate index softens to a warning — because a plate
-- genuinely may move between vehicles over time (PLAN/11 §5.1).
CREATE UNIQUE INDEX uq_vehicle_chassis ON vehicles(chassis_number)
  WHERE deleted_at IS NULL AND chassis_number IS NOT NULL;
CREATE UNIQUE INDEX uq_vehicle_plate ON vehicles(plate_key)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_city ON vehicles(city_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_review ON vehicles(created_at DESC) WHERE needs_review AND deleted_at IS NULL;

CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Without this, a plate change erases the trail and old inspections appear to
-- belong to a vehicle that never existed (PLAN/11 §5.3).
CREATE TABLE vehicle_plate_history (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id    bigint NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  plate_display text NOT NULL,
  valid_from    timestamptz NOT NULL,
  valid_to      timestamptz,
  changed_by    bigint REFERENCES users(id),
  reason        text
);
CREATE INDEX idx_plate_history_vehicle ON vehicle_plate_history(vehicle_id, valid_from DESC);

CREATE OR REPLACE FUNCTION record_plate_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO vehicle_plate_history (vehicle_id, plate_display, valid_from, changed_by)
    VALUES (NEW.id, NEW.plate_display, NEW.created_at, NEW.created_by);
  ELSIF NEW.plate_display IS DISTINCT FROM OLD.plate_display THEN
    UPDATE vehicle_plate_history
       SET valid_to = now()
     WHERE vehicle_id = NEW.id AND valid_to IS NULL;
    INSERT INTO vehicle_plate_history (vehicle_id, plate_display, valid_from)
    VALUES (NEW.id, NEW.plate_display, now());
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plate_history AFTER INSERT OR UPDATE OF plate_display ON vehicles
  FOR EACH ROW EXECUTE FUNCTION record_plate_change();

-- ── Axle configuration, owned by the vehicle (PLAN/02 §7.2 + PLAN/11 §2) ────

CREATE TABLE axle_configs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id bigint NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  axle_type  axle_type NOT NULL,
  axle_count int NOT NULL CHECK (axle_count BETWEEN 1 AND 5),
  mounting   tire_mounting NOT NULL,
  UNIQUE (vehicle_id, axle_type),
  -- K-01 / V-02: a steer axle is always single.
  CONSTRAINT ck_steer_single CHECK (axle_type <> 'steer' OR mounting = 'single')
);

-- V-01 / D-04. This cannot be a per-row CHECK because the rule spans several
-- rows at once. DEFERRABLE INITIALLY DEFERRED matters: the check runs at COMMIT,
-- so inserting three axle rows does not fail on the first one for being
-- incomplete.
CREATE OR REPLACE FUNCTION assert_axle_sum() RETURNS trigger AS $$
DECLARE
  v_vehicle  bigint;
  v_sum      int;
  v_declared int;
BEGIN
  v_vehicle := COALESCE(NEW.vehicle_id, OLD.vehicle_id);

  SELECT axle_count INTO v_declared FROM vehicles WHERE id = v_vehicle;
  IF NOT FOUND THEN
    RETURN NULL;  -- the vehicle was deleted in the same transaction
  END IF;

  SELECT COALESCE(SUM(axle_count), 0) INTO v_sum FROM axle_configs WHERE vehicle_id = v_vehicle;

  IF v_sum <> v_declared THEN
    RAISE EXCEPTION 'AXLE_SUM_MISMATCH: jumlah poros terinci (%) tidak sama dengan jumlah poros yang dipilih (%)', v_sum, v_declared;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_axle_sum
  AFTER INSERT OR UPDATE OR DELETE ON axle_configs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_axle_sum();

-- ============================================================================
-- INSPECTIONS (PLAN/11 §5.2)
-- ============================================================================

CREATE TABLE serial_counters (
  year     int PRIMARY KEY,
  last_seq int NOT NULL DEFAULT 0
);

-- B-03: in Sheets the Serial Number generator raced whenever two suppliers
-- submitted at once. ON CONFLICT DO UPDATE ... RETURNING is atomic and locks the
-- year row, so two concurrent requests get two different numbers — guaranteed by
-- the engine, not by hoping.
CREATE OR REPLACE FUNCTION next_serial_number(p_year int)
RETURNS TABLE (serial_number text, serial_year int, serial_seq int) AS $$
DECLARE v_seq int;
BEGIN
  INSERT INTO serial_counters (year, last_seq) VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_seq = serial_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  -- Five digits, not four. At 1,200 inspections a month the four-digit form is
  -- exhausted in month nine (PLAN/02 §7.1).
  RETURN QUERY SELECT 'SN' || p_year || '-' || lpad(v_seq::text, 5, '0'), p_year, v_seq;
END $$ LANGUAGE plpgsql;

CREATE TABLE inspections (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id    bigint NOT NULL REFERENCES vehicles(id),

  serial_number text NOT NULL UNIQUE,
  serial_year   int  NOT NULL,
  serial_seq    int  NOT NULL,

  -- Q-14 answered: the column is added now because adding it later to a table
  -- holding twelve thousand rows is not free, but the locking index below stays
  -- per-vehicle, matching the system owner's decision in PLAN/11 §5.4. Moving to
  -- per-period locking later is a one-index change (see the commented form).
  campaign_year int NOT NULL DEFAULT EXTRACT(YEAR FROM now()),

  status        submission_status NOT NULL DEFAULT 'draft',
  submitted_by  bigint NOT NULL REFERENCES users(id),
  submitted_at  timestamptz,
  notes         text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,

  CONSTRAINT ck_serial_parts CHECK (serial_number = 'SN' || serial_year || '-' || lpad(serial_seq::text, 5, '0')),
  CONSTRAINT ck_submitted_at CHECK ((status = 'draft') = (submitted_at IS NULL))
);

-- D-06 / V-08. The system owner's rule (PLAN/11 §5.4): a plate is locked while
-- an inspection is pending, awaiting revision, or passed; a dropped inspection
-- releases it; a draft never locks.
--
-- `needs_revision` locks on purpose (§5.5): if it did not, a supplier would
-- start a new record instead of fixing the old one, the revision flow would go
-- unused, and D-11 would come back wearing a different hat.
--
-- `draft` does not lock on purpose (§5.6): drafts are abandoned constantly in
-- field work, and a locking draft would hold a plate hostage until an admin
-- intervened.
--
-- To move to per-period locking (PLAN/11 §5.7), this becomes:
--   CREATE UNIQUE INDEX uq_locking_inspection ON inspections(vehicle_id, campaign_year) ...
CREATE UNIQUE INDEX uq_locking_inspection ON inspections(vehicle_id)
  WHERE deleted_at IS NULL
    AND status IN ('pending_qc', 'needs_revision', 'passed_qc');

CREATE INDEX idx_insp_status_created ON inspections(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_insp_supplier ON inspections(submitted_by, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_insp_vehicle ON inspections(vehicle_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_insp_submitted ON inspections(submitted_at DESC) WHERE deleted_at IS NULL AND submitted_at IS NOT NULL;
-- Exists specifically for the F-11 dashboard. Without it, aggregating TB vs LT
-- per city scans the whole table — exactly the failure that made the legacy QC
-- filter unusable at scale (B-04).
CREATE INDEX idx_insp_reporting ON inspections(vehicle_id, submitted_at)
  WHERE deleted_at IS NULL AND status = 'passed_qc';
-- Sweeps abandoned drafts after 30 days (PLAN/11 §5.6).
CREATE INDEX idx_insp_stale_drafts ON inspections(updated_at) WHERE status = 'draft' AND deleted_at IS NULL;

CREATE TRIGGER trg_inspections_updated BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Tire positions (PLAN/02 §8.1) ───────────────────────────────────────────
--
-- The materialisation of K-01 and K-02. These rows are NEVER typed by a human:
-- they are derived, entirely, by the axle engine. Positions belong to the
-- inspection rather than the vehicle so that correcting a vehicle's
-- configuration later does not silently relabel historical photographs.

CREATE TABLE tire_positions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inspection_id  bigint NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,

  -- Two forms, one source. The machine key is stable; the label is for humans.
  -- The legacy system had only the Indonesian label and used it as its Drive
  -- path, so every wording fix in the UI risked breaking photo matching.
  position_code  text NOT NULL,
  position_label text NOT NULL,

  axle_type      axle_type NOT NULL,
  axle_index     int NOT NULL CHECK (axle_index BETWEEN 1 AND 5),
  side           tire_side NOT NULL,
  depth          tire_depth,
  sort_order     int NOT NULL,

  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (inspection_id, position_code),
  UNIQUE (inspection_id, sort_order),
  -- A steer axle is single, so it never carries a depth.
  CONSTRAINT ck_depth_consistency CHECK (axle_type <> 'steer' OR depth IS NULL)
);
CREATE INDEX idx_tp_inspection ON tire_positions(inspection_id, sort_order);

-- ── Tire specifications (PLAN/02 §8.2) ──────────────────────────────────────

CREATE TABLE tire_specs (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Exactly one spec row per position: the cardinality from PLAN/00 §1.3.
  tire_position_id bigint NOT NULL UNIQUE REFERENCES tire_positions(id) ON DELETE CASCADE,
  tire_brand_id    bigint REFERENCES tire_brands(id),
  brand_other      text,
  pattern          text,
  size             text,
  ply_rating       text,
  is_retread       boolean NOT NULL DEFAULT false,
  filled_by        bigint REFERENCES users(id),
  filled_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_size_format CHECK (size IS NULL OR size ~ '^[0-9]{1,4}(\.[0-9])?[/A-Z0-9.\-]{2,14}$')
);
CREATE TRIGGER trg_tire_specs_updated BEFORE UPDATE ON tire_specs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Every column is nullable because staged entry is real work practice, not
-- sloppiness. Completeness is therefore derived, never stored as a status.
CREATE VIEW v_inspection_spec_progress AS
SELECT tp.inspection_id,
       count(*) AS total_positions,
       count(*) FILTER (
         WHERE ts.pattern IS NOT NULL
           AND ts.size IS NOT NULL
           AND (ts.tire_brand_id IS NOT NULL OR ts.brand_other IS NOT NULL)
       ) AS filled_positions
FROM tire_positions tp
LEFT JOIN tire_specs ts ON ts.tire_position_id = tp.id
GROUP BY tp.inspection_id;

-- ── Photos (PLAN/02 §8.3) ───────────────────────────────────────────────────

CREATE TABLE photos (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inspection_id    bigint NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  tire_position_id bigint REFERENCES tire_positions(id) ON DELETE CASCADE,
  slot             photo_slot NOT NULL,

  storage_key      text NOT NULL UNIQUE,
  thumbnail_key    text,
  -- Makes a retry from the offline queue idempotent: the same photo never
  -- produces two rows (PLAN/06 §4.1).
  checksum_sha256  text NOT NULL,
  byte_size        int  NOT NULL CHECK (byte_size > 0),
  mime_type        text NOT NULL CHECK (mime_type IN ('image/webp', 'image/jpeg')),
  width            int,
  height           int,
  -- EXIF capture time, GPS deliberately discarded (PLAN/06 §3.1). It comes from
  -- the device clock, which a user can change: weak evidence, never the sole
  -- basis of a dispute.
  captured_at      timestamptz,
  uploaded_by      bigint NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,

  CONSTRAINT ck_slot_position CHECK ((slot = 'tire_position') = (tire_position_id IS NOT NULL))
);
CREATE INDEX idx_photos_inspection ON photos(inspection_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_photos_position   ON photos(tire_position_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_photo_checksum ON photos(inspection_id, checksum_sha256) WHERE deleted_at IS NULL;

-- V-13 (K-06) plus the per-inspection cap from PLAN/06 §6. Ten per slot alone
-- restrains nothing once a 6-axle vehicle has 22 positions: that is the
-- difference between 84 GB and 562 GB of storage in year one.
CREATE OR REPLACE FUNCTION assert_photo_limit() RETURNS trigger AS $$
DECLARE
  v_slot_count       int;
  v_inspection_count int;
BEGIN
  SELECT count(*) INTO v_slot_count FROM photos
   WHERE inspection_id = NEW.inspection_id
     AND slot = NEW.slot
     AND tire_position_id IS NOT DISTINCT FROM NEW.tire_position_id
     AND deleted_at IS NULL;

  IF v_slot_count > 10 THEN
    RAISE EXCEPTION 'PHOTO_LIMIT_EXCEEDED: maksimal 10 foto per slot';
  END IF;

  SELECT count(*) INTO v_inspection_count FROM photos
   WHERE inspection_id = NEW.inspection_id AND deleted_at IS NULL;

  IF v_inspection_count > 30 THEN
    RAISE EXCEPTION 'PHOTO_LIMIT_EXCEEDED: maksimal 30 foto per pengajuan';
  END IF;

  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_photo_limit AFTER INSERT ON photos
  FOR EACH ROW EXECUTE FUNCTION assert_photo_limit();

-- Presigned but never confirmed. The daily GC job reads this to clean R2.
CREATE TABLE pending_uploads (
  storage_key      text PRIMARY KEY,
  inspection_id    bigint NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  tire_position_id bigint REFERENCES tire_positions(id) ON DELETE CASCADE,
  slot             photo_slot NOT NULL,
  checksum_sha256  text NOT NULL,
  byte_size        int NOT NULL,
  mime_type        text NOT NULL,
  requested_by     bigint NOT NULL REFERENCES users(id),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pending_uploads_expiry ON pending_uploads(created_at);

-- ============================================================================
-- QUALITY CONTROL (PLAN/02 §9)
--
-- A history table, not a status column. The legacy system stored `Nama Admin QC`
-- on the submission, so a second decision overwrote the first and nobody could
-- tell there had ever been one. With `needs_revision`, an inspection can pass
-- through QC repeatedly — history is the only shape that works.
-- ============================================================================

CREATE TABLE qc_reviews (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inspection_id bigint NOT NULL REFERENCES inspections(id),
  reviewer_id   bigint NOT NULL REFERENCES users(id),
  decision      qc_decision NOT NULL,
  status_before submission_status NOT NULL,
  status_after  submission_status NOT NULL,
  notes         text,
  reviewed_at   timestamptz NOT NULL DEFAULT now(),
  -- V-14. Without this, D-11 is only half solved: the supplier knows they were
  -- rejected but not what to fix.
  CONSTRAINT ck_notes_required CHECK (decision = 'pass' OR (notes IS NOT NULL AND length(btrim(notes)) >= 10))
);
CREATE INDEX idx_qc_inspection ON qc_reviews(inspection_id, reviewed_at DESC);
CREATE INDEX idx_qc_reviewer   ON qc_reviews(reviewer_id, reviewed_at DESC);

CREATE TABLE qc_comments (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  review_id        bigint NOT NULL REFERENCES qc_reviews(id) ON DELETE CASCADE,
  photo_id         bigint REFERENCES photos(id),
  tire_position_id bigint REFERENCES tire_positions(id),
  body             text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qc_comments_review ON qc_comments(review_id);
CREATE INDEX idx_qc_comments_photo ON qc_comments(photo_id) WHERE photo_id IS NOT NULL;

-- ============================================================================
-- AUDIT (PLAN/02 §10, PLAN/04 §6) — closes D-15 and B-12
--
-- Sheets version history is not an audit trail. It does not answer the question
-- that actually matters: who changed this inspection's status, when, from what
-- to what, and on what grounds.
-- ============================================================================

CREATE TABLE audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY,
  actor_id    bigint REFERENCES users(id),
  actor_role  user_role,
  action      text   NOT NULL,
  entity      text   NOT NULL,
  entity_id   bigint NOT NULL,
  -- Only the columns that changed. Never a password hash, a token, or a TOTP
  -- secret — not even hashed (PLAN/04 §6.2 rule 3).
  before      jsonb,
  after       jsonb,
  request_id  text,
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partitioned from day one. This is the only table that grows faster than
-- photos, and partitioning turns discarding old data into DROP TABLE rather
-- than a DELETE over millions of rows.
CREATE TABLE audit_logs_2026 PARTITION OF audit_logs FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE audit_logs_2027 PARTITION OF audit_logs FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE audit_logs_2028 PARTITION OF audit_logs FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');

CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_request ON audit_logs(request_id) WHERE request_id IS NOT NULL;

-- ============================================================================
-- OUTBOX AND NOTIFICATIONS (PLAN/12)
--
-- The event row is written INSIDE the same transaction as the data change. If
-- the transaction rolls back, the event goes with it, so notifying somebody
-- about something that never happened becomes impossible rather than rare.
-- This is also the real reason pg-boss was chosen over Redis: enqueueing can
-- join the data transaction.
-- ============================================================================

CREATE TABLE outbox (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type   text NOT NULL,
  aggregate_id bigint NOT NULL,
  payload      jsonb NOT NULL,
  actor_id     bigint REFERENCES users(id),
  request_id   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_outbox_pending ON outbox(created_at) WHERE processed_at IS NULL;

CREATE TABLE notifications (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outbox_id    bigint REFERENCES outbox(id),
  recipient_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel      notification_channel NOT NULL,
  event_type   text NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  link         text,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       notification_status NOT NULL DEFAULT 'pending',
  attempts     int NOT NULL DEFAULT 0,
  last_error   text,
  read_at      timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- One event, one recipient, one channel — exactly once. A worker retried after
  -- a timeout tries to insert the same row; the constraint refuses it, and the
  -- user does not get a duplicate. Idempotency enforced by the database, not by
  -- discipline in code.
  CONSTRAINT uq_notif UNIQUE (outbox_id, recipient_id, channel)
);
CREATE INDEX idx_notif_inbox ON notifications(recipient_id, created_at DESC) WHERE channel = 'in_app';
CREATE INDEX idx_notif_unread ON notifications(recipient_id) WHERE channel = 'in_app' AND read_at IS NULL;
CREATE INDEX idx_notif_pending ON notifications(created_at) WHERE status = 'pending';

CREATE TABLE notification_preferences (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text   NOT NULL,
  channel    notification_channel NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, event_type, channel)
);

-- ============================================================================
-- EXPORTS, METRICS, MIGRATION QUARANTINE
-- ============================================================================

-- D-09: the legacy export buttons produced nothing observable at all.
CREATE TABLE export_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL,
  requested_by  bigint NOT NULL REFERENCES users(id),
  params        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        export_job_status NOT NULL DEFAULT 'queued',
  progress      int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  row_count     int,
  storage_key   text,
  error_message text,
  request_id    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  expires_at    timestamptz
);
CREATE INDEX idx_export_requester ON export_jobs(requested_by, created_at DESC);

CREATE TABLE daily_metrics (
  day                 date PRIMARY KEY,
  inspections_created int NOT NULL DEFAULT 0,
  inspections_passed  int NOT NULL DEFAULT 0,
  inspections_dropped int NOT NULL DEFAULT 0,
  inspections_revised int NOT NULL DEFAULT 0,
  photos_uploaded     int NOT NULL DEFAULT 0,
  photo_bytes         bigint NOT NULL DEFAULT 0,
  queue_max_depth     int NOT NULL DEFAULT 0,
  computed_at         timestamptz NOT NULL DEFAULT now()
);

-- PLAN/07 §8. A row that does not pass goes here — never discarded, never forced
-- through. A script that guesses a human's intent produces mistakes that are
-- harder to find than the dirty data was.
CREATE TABLE migration_quarantine (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_sheet text  NOT NULL,
  source_row   int   NOT NULL,
  raw          jsonb NOT NULL,
  reason       text  NOT NULL,
  resolved_at  timestamptz,
  resolved_by  bigint REFERENCES users(id),
  resolution   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quarantine_open ON migration_quarantine(created_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- REPORTING AGGREGATE (PLAN/02 §12)
-- ============================================================================

CREATE MATERIALIZED VIEW mv_region_progress AS
SELECT c.province_id,
       v.city_id,
       v.category,
       date_trunc('day', i.submitted_at) AS day,
       count(*) AS unit_count
FROM inspections i
JOIN vehicles v ON v.id = i.vehicle_id
JOIN cities c ON c.id = v.city_id
WHERE i.deleted_at IS NULL
  AND i.status = 'passed_qc'
  AND i.submitted_at IS NOT NULL
GROUP BY 1, 2, 3, 4;

-- REFRESH ... CONCURRENTLY requires a unique index. Without it the refresh locks
-- the view and the dashboard freezes every ten minutes.
CREATE UNIQUE INDEX uq_mv_region ON mv_region_progress(province_id, city_id, category, day);

-- ============================================================================
-- APPEND-ONLY AUDIT (PLAN/13 §9, decision A-08)
--
-- Enforced by revoking the privilege, not by application convention. An audit
-- trail the application could edit is not evidence.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'c26_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM c26_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs_2026, audit_logs_2027, audit_logs_2028 FROM c26_app;
  END IF;
END $$;
