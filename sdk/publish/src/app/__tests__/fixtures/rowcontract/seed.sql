-- The rows every row contract case starts from. Both runners empty every table, restart its
-- sequences and run this file, so the rows of a table without ids number 1, 2, 3 in order.

INSERT INTO data.projects (name, team_id) VALUES
  ('Launch', NULL), -- id 1
  ('Pipeline', '7e570000-0000-4000-8000-0000000000c1'), -- id 2
  ('Helpdesk', '7e570000-0000-4000-8000-0000000000c2'); -- id 3

INSERT INTO data.tasks (project_id, owner_id, title, status, priority, estimate, due, created_at) VALUES
  (1, '7e570000-0000-4000-8000-0000000000b1', 'Write the brief', 'open', 'high', 3, '2026-11-10', '2026-10-01T09:00:00+00:00'), -- id 1
  (1, '7e570000-0000-4000-8000-0000000000b1', 'Book the venue', 'doing', 'low', 9007199254740993, NULL, '2026-10-02T09:00:00+00:00'), -- id 2
  (2, '7e570000-0000-4000-8000-0000000000b1', 'Call Acme', 'done', NULL, NULL, '2026-11-03', '2026-10-03T09:00:00+00:00'), -- id 3
  (3, '7e570000-0000-4000-8000-0000000000b2', 'Answer tickets', 'open', 'high', 5, '2026-11-05', '2026-10-04T09:00:00+00:00'), -- id 4
  (1, '7e570000-0000-4000-8000-0000000000b2', 'Print badges', 'open', 'low', 2, NULL, '2026-10-05T09:00:00+00:00'), -- id 5
  (2, '7e570000-0000-4000-8000-0000000000b3', 'Send the quote', 'doing', NULL, 8, '2026-11-20', '2026-10-06T09:00:00+00:00'); -- id 6
-- The task_audit trigger adds one INSERT audit row for each task, ids 1 to 6.

INSERT INTO data.notes (task_id, follow_up_task_id, body, attachment, pinned) VALUES
  (1, 2, 'Draft is in the shared folder', '\x6f61697a', true), -- id 1
  (1, NULL, 'Ask Grace to review', NULL, false), -- id 2
  (4, NULL, 'Most tickets are about sign-in', NULL, NULL); -- id 3

INSERT INTO data.readings (id) SELECT generate_series(1, 1001);
