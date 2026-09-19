-- Records first installation and supports the foundation persistence check.
CREATE TABLE application_metadata (
    id TINYINT NOT NULL PRIMARY KEY,
    installed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT chk_metadata_singleton CHECK (id = 1)
) ENGINE=InnoDB;
INSERT INTO application_metadata (id) VALUES (1);
