-- Add the optional Material-to-Supplier relation for databases created before this field existed.
ALTER TABLE "Material"
ADD COLUMN IF NOT EXISTS "SupplierId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Material_SupplierId_fkey'
  ) THEN
    ALTER TABLE "Material"
    ADD CONSTRAINT "Material_SupplierId_fkey"
    FOREIGN KEY ("SupplierId") REFERENCES "Supplier"("Id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
