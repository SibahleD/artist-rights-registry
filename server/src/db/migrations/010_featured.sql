-- A featured artist is a credit like any other: role performer, usually 0%, flagged so it can be shown as "(feat. …)".
ALTER TABLE collaborators
    ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT collaborators_featured_role_check CHECK (NOT is_featured OR role = 'performer');
