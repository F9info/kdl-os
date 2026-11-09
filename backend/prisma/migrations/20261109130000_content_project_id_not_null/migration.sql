-- T04b: every content row belongs to a project. Rows with no project belonged to the default project
-- (the project flagged is_default, else slug 'default'), so they are moved there first. If rows exist and no
-- default project does, SET NOT NULL fails and the migration stops with nothing changed (it runs in a transaction).
DO $$
DECLARE
  default_id TEXT;
  t TEXT;
BEGIN
  SELECT id INTO default_id FROM projects WHERE deleted_at IS NULL AND is_default = TRUE LIMIT 1;
  IF default_id IS NULL THEN
    SELECT id INTO default_id FROM projects WHERE deleted_at IS NULL AND slug = 'default' LIMIT 1;
  END IF;
  FOREACH t IN ARRAY ARRAY['team_members','faq_entries','sectors','catalog_items','work_categories','gallery_items','testimonials','project_case_studies','menus'] LOOP
    IF default_id IS NOT NULL THEN
      EXECUTE format('UPDATE %I SET project_id = $1 WHERE project_id IS NULL', t) USING default_id;
    END IF;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN project_id SET NOT NULL', t);
  END LOOP;
END $$;
