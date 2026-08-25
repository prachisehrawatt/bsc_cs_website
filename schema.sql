CREATE TABLE IF NOT EXISTS subjects (
  slug TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (semester, slug)
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('notes','tutorials','practicals','project','pyqs')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects (semester);

CREATE INDEX IF NOT EXISTS idx_resources_sem_subject
ON resources (semester, subject);

CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects (semester);

CREATE INDEX IF NOT EXISTS idx_resources_sem_subject_category
ON resources (semester, subject, category);
